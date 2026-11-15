import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. Authorize Staff: Restricted to Owner, Admin, and Manager
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse) return errorResponse;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';
    // Filters: 'all', 'delivered', 'paid_not_delivered', 'failed_payment', 'cancelled', 'fully_refunded', 'partially_refunded', 'pending_refund', 'failed_refund', 'pending_payment'
    const dateRange = searchParams.get('dateRange') || 'all'; // all, today, yesterday, 7days, 30days, this_month, custom
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sort = searchParams.get('sort') || 'newest'; // newest, oldest, amount_desc, amount_asc
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    // 2. Fetch Global Database Statistics from actual records (distinguishing orders vs payment transactions)
    const [
      ordersStatsRes,
      paymentsStatsRes
    ] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, payment_status, total_amount, created_at'),
      supabase
        .from('payments')
        .select('id, order_id, amount, status, refund_status, refund_amount, refund_reason, created_at')
    ]);

    if (ordersStatsRes.error) throw ordersStatsRes.error;
    if (paymentsStatsRes.error) throw paymentsStatsRes.error;

    const allDbOrders = ordersStatsRes.data || [];
    const allDbPayments = paymentsStatsRes.data || [];

    // Calculate Authoritative Summary Statistics from actual records
    const totalOrders = allDbOrders.length;
    const completedDeliveredOrders = allDbOrders.filter(o => o.status === 'delivered').length;
    const paidNotDeliveredOrders = allDbOrders.filter(o => 
      o.payment_status === 'paid' && !['delivered', 'cancelled', 'refunded'].includes(o.status)
    ).length;
    const failedPaymentAttempts = allDbPayments.filter(p => p.status === 'failed').length;
    const cancelledOrders = allDbOrders.filter(o => o.status === 'cancelled').length;
    
    // Refunds distinction
    const fullyRefundedOrders = allDbOrders.filter(o => o.status === 'refunded').length || 
      allDbPayments.filter(p => p.refund_status === 'full').length;
    const fullyRefundedPayments = allDbPayments.filter(p => p.refund_status === 'full').length;
    const partiallyRefundedPayments = allDbPayments.filter(p => p.refund_status === 'partial').length;
    const pendingRefunds = allDbPayments.filter(p => ['pending', 'processing'].includes(p.refund_status)).length;
    const failedRefunds = allDbPayments.filter(p => p.refund_status === 'failed').length;
    const pendingPaymentOrders = allDbOrders.filter(o => o.status === 'pending_payment' || o.payment_status === 'pending').length;

    // Total successful payment amount (sum of successful payments verified on gateway)
    const totalSuccessfulPaymentAmount = allDbPayments
      .filter(p => p.status === 'successful')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Total refunded amount
    const totalRefundedAmount = allDbPayments
      .reduce((sum, p) => sum + (Number(p.refund_amount) || 0), 0);

    // Outstanding refund incidents (pending, processing, failed, or needing review)
    const outstandingRefundIncidents = allDbPayments.filter(p => 
      ['pending', 'processing', 'failed'].includes(p.refund_status)
    ).length;

    const summaryStats = {
      totalOrders,
      completedDeliveredOrders,
      paidNotDeliveredOrders,
      failedPaymentAttempts,
      cancelledOrders,
      fullyRefundedOrders,
      fullyRefundedPayments,
      partiallyRefundedPayments,
      pendingRefunds,
      failedRefunds,
      pendingPaymentOrders,
      totalSuccessfulPaymentAmount,
      totalRefundedAmount,
      outstandingRefundIncidents,
      totalPaymentTransactions: allDbPayments.length
    };

    // 3. Search optimization: If searching by payment reference / Paystack transaction reference
    let matchedOrderIdsFromPayments: string[] = [];
    if (search) {
      const { data: matchedPayments } = await supabase
        .from('payments')
        .select('order_id')
        .ilike('provider_reference', `%${search}%`);
      if (matchedPayments && matchedPayments.length > 0) {
        matchedOrderIdsFromPayments = Array.from(new Set(matchedPayments.map(p => p.order_id).filter(Boolean)));
      }
    }

    // 4. Build Detailed Orders Query
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_code,
        customer_id,
        customer_name,
        phone,
        delivery_address,
        status,
        subtotal,
        discount_amount,
        delivery_fee,
        total_amount,
        payment_method,
        payment_status,
        assigned_rider_id,
        created_at,
        updated_at,
        items:order_items (
          id,
          item_name,
          unit_price,
          quantity,
          total_price,
          customizations,
          notes
        ),
        payments:payments (
          id,
          amount,
          currency,
          payment_method,
          provider,
          provider_reference,
          status,
          gateway_response,
          gateway_metadata,
          refund_status,
          refund_amount,
          refund_reason,
          refunded_at,
          created_at
        ),
        history:order_status_history (
          id,
          status,
          from_status,
          to_status,
          actor_type,
          actor_id,
          notes,
          created_at
        )
      `, { count: 'exact' });

    // 5. Apply Status Filters
    switch (filter) {
      case 'delivered':
      case 'successful':
        query = query.eq('status', 'delivered');
        break;
      case 'paid_not_delivered':
        query = query
          .eq('payment_status', 'paid')
          .neq('status', 'delivered')
          .neq('status', 'cancelled')
          .neq('status', 'refunded');
        break;
      case 'failed_payment':
      case 'failed':
        // Orders with payment_status failed or payment records failed
        const failedPaymentOrderIds = Array.from(new Set(
          allDbPayments.filter(p => p.status === 'failed').map(p => p.order_id)
        ));
        if (failedPaymentOrderIds.length > 0) {
          query = query.or(`payment_status.eq.failed,id.in.(${failedPaymentOrderIds.join(',')})`);
        } else {
          query = query.eq('payment_status', 'failed');
        }
        break;
      case 'cancelled':
        query = query.eq('status', 'cancelled');
        break;
      case 'fully_refunded':
      case 'refunded':
        const fullRefundOrderIds = Array.from(new Set(
          allDbPayments.filter(p => p.refund_status === 'full').map(p => p.order_id)
        ));
        if (fullRefundOrderIds.length > 0) {
          query = query.or(`status.eq.refunded,id.in.(${fullRefundOrderIds.join(',')})`);
        } else {
          query = query.eq('status', 'refunded');
        }
        break;
      case 'partially_refunded':
        const partialRefundOrderIds = Array.from(new Set(
          allDbPayments.filter(p => p.refund_status === 'partial').map(p => p.order_id)
        ));
        if (partialRefundOrderIds.length > 0) {
          query = query.in('id', partialRefundOrderIds);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // match none
        }
        break;
      case 'pending_refund':
        const pendingRefundOrderIds = Array.from(new Set(
          allDbPayments.filter(p => ['pending', 'processing'].includes(p.refund_status)).map(p => p.order_id)
        ));
        if (pendingRefundOrderIds.length > 0) {
          query = query.in('id', pendingRefundOrderIds);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
        break;
      case 'failed_refund':
        const failedRefundOrderIds = Array.from(new Set(
          allDbPayments.filter(p => p.refund_status === 'failed').map(p => p.order_id)
        ));
        if (failedRefundOrderIds.length > 0) {
          query = query.in('id', failedRefundOrderIds);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
        break;
      case 'pending_payment':
      case 'pending':
        query = query.or('status.eq.pending_payment,payment_status.eq.pending');
        break;
      default:
        // 'all': no lifecycle filter
        break;
    }

    // 6. Apply Date Range Filters
    const now = new Date();
    if (dateRange === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte('created_at', startOfDay);
    } else if (dateRange === 'yesterday') {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      query = query.gte('created_at', yesterdayStart.toISOString()).lt('created_at', yesterdayEnd.toISOString());
    } else if (dateRange === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', sevenDaysAgo.toISOString());
    } else if (dateRange === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    } else if (dateRange === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      query = query.gte('created_at', startOfMonth);
    } else if (dateRange === 'custom') {
      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        // Set to end of the selected day
        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDay.toISOString());
      }
    }

    // 7. Apply Search across Order reference, Customer name, Phone, and Paystack references
    if (search) {
      if (matchedOrderIdsFromPayments.length > 0) {
        query = query.or(`order_code.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%,id.in.(${matchedOrderIdsFromPayments.join(',')})`);
      } else {
        query = query.or(`order_code.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
    }

    // 8. Apply Sorting
    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'amount_desc':
        query = query.order('total_amount', { ascending: false });
        break;
      case 'amount_asc':
        query = query.order('total_amount', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // 9. Paginate
    query = query.range(offset, offset + limit - 1);

    const { data: ordersData, error: ordersError, count: totalFiltered } = await query;
    if (ordersError) throw ordersError;

    // 10. Fetch Assigned Rider Names for accurate display
    const riderIds = Array.from(new Set((ordersData || []).map(o => o.assigned_rider_id).filter(Boolean)));
    const riderNameMap = new Map<string, string>();
    if (riderIds.length > 0) {
      const { data: riders } = await supabase
        .from('riders')
        .select('id, full_name, phone')
        .in('id', riderIds);
      (riders || []).forEach(r => riderNameMap.set(r.id, `${r.full_name} (${r.phone})`));
    }

    // 11. Transform Output Records
    const records = (ordersData || []).map(order => {
      const payments = (order.payments || []) as any[];
      const history = (order.history || []) as any[];
      history.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Derive financial classification
      const latestPayment = payments[payments.length - 1] || null;
      const isPaid = order.payment_status === 'paid' || payments.some(p => p.status === 'successful');
      const isRefunded = order.status === 'refunded' || payments.some(p => ['full', 'partial'].includes(p.refund_status));
      const hasIncident = payments.some(p => ['pending', 'processing', 'failed'].includes(p.refund_status)) ||
                          history.some(h => String(h.notes || '').toLowerCase().includes('incident'));

      // Check cancellation details
      const cancellationEntry = history.slice().reverse().find(h => h.to_status === 'cancelled' || h.status === 'cancelled');

      // Determine overall refund status for this order
      let refundStatus = 'none';
      if (payments.some(p => p.refund_status === 'full') || order.status === 'refunded') {
        refundStatus = 'full';
      } else if (payments.some(p => p.refund_status === 'partial')) {
        refundStatus = 'partial';
      } else if (payments.some(p => p.refund_status === 'processing')) {
        refundStatus = 'processing';
      } else if (payments.some(p => p.refund_status === 'pending')) {
        refundStatus = 'pending';
      } else if (payments.some(p => p.refund_status === 'failed')) {
        refundStatus = 'failed';
      }

      return {
        id: order.id,
        orderCode: order.order_code,
        customerId: order.customer_id,
        customerName: order.customer_name || 'Guest Customer',
        phone: order.phone,
        deliveryAddress: order.delivery_address,
        status: order.status,
        subtotal: Number(order.subtotal) || 0,
        discountAmount: Number(order.discount_amount) || 0,
        deliveryFee: Number(order.delivery_fee) || 0,
        totalAmount: Number(order.total_amount) || 0,
        paymentMethod: order.payment_method || (latestPayment?.payment_method || 'Paystack'),
        paymentStatus: order.payment_status,
        refundStatus,
        assignedRiderId: order.assigned_rider_id,
        assignedRiderName: order.assigned_rider_id ? (riderNameMap.get(order.assigned_rider_id) || 'Assigned Courier') : null,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items: (order.items || []).map((it: any) => ({
          id: it.id,
          name: it.item_name,
          unitPrice: Number(it.unit_price) || 0,
          quantity: it.quantity,
          totalPrice: Number(it.total_price) || 0,
          customizations: it.customizations,
          notes: it.notes
        })),
        payments: payments.map((p: any) => ({
          id: p.id,
          amount: Number(p.amount) || 0,
          currency: p.currency || 'NGN',
          paymentMethod: p.payment_method,
          provider: p.provider,
          reference: p.provider_reference,
          status: p.status,
          gatewayResponse: p.gateway_response,
          refundStatus: p.refund_status || 'none',
          refundAmount: Number(p.refund_amount) || 0,
          refundReason: p.refund_reason,
          refundedAt: p.refunded_at,
          createdAt: p.created_at
        })),
        history: history.map((h: any) => ({
          id: h.id,
          fromStatus: h.from_status,
          toStatus: h.to_status || h.status,
          actorType: h.actor_type,
          actorId: h.actor_id,
          notes: h.notes,
          timestamp: h.created_at
        })),
        financialSummary: {
          isPaid,
          isRefunded,
          hasIncident,
          latestPaymentStatus: latestPayment?.status || order.payment_status,
          latestRefundStatus: refundStatus,
          refundAmount: payments.reduce((sum, p) => sum + (Number(p.refund_amount) || 0), 0),
          cancellation: cancellationEntry ? {
            timestamp: cancellationEntry.created_at,
            actorType: cancellationEntry.actor_type,
            notes: cancellationEntry.notes,
            paymentWasMade: isPaid
          } : null
        }
      };
    });

    return NextResponse.json({
      success: true,
      summary: summaryStats,
      pagination: {
        page,
        limit,
        total: totalFiltered || 0,
        totalPages: Math.ceil((totalFiltered || 0) / limit)
      },
      orders: records
    });
  } catch (error: any) {
    console.error('Order history API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve order history' },
      { status: 500 }
    );
  }
}
