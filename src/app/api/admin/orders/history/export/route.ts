import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function escapeCsvField(field: any): string {
  if (field === null || field === undefined) return '';
  const stringVal = String(field);
  if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  return stringVal;
}

export async function GET(req: NextRequest) {
  // 1. Authorize: Restricted strictly to Owner, Admin, and Manager
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse) return errorResponse;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';
    const dateRange = searchParams.get('dateRange') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sort = searchParams.get('sort') || 'newest';
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    // Search Paystack reference linkage
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

    // Build base query
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_code,
        customer_name,
        created_at,
        subtotal,
        discount_amount,
        delivery_fee,
        total_amount,
        payment_status,
        status,
        delivery_zone_id,
        payments:payments (
          provider_reference,
          refund_status,
          refund_amount,
          status
        )
      `);

    // Status Filter
    if (filter === 'delivered' || filter === 'successful') {
      query = query.eq('status', 'delivered');
    } else if (filter === 'paid_not_delivered') {
      query = query
        .eq('payment_status', 'paid')
        .neq('status', 'delivered')
        .neq('status', 'cancelled')
        .neq('status', 'refunded');
    } else if (filter === 'failed_payment' || filter === 'failed') {
      query = query.eq('payment_status', 'failed');
    } else if (filter === 'cancelled') {
      query = query.eq('status', 'cancelled');
    } else if (filter === 'fully_refunded' || filter === 'refunded') {
      query = query.eq('status', 'refunded');
    } else if (filter === 'pending_payment' || filter === 'pending') {
      query = query.or('status.eq.pending_payment,payment_status.eq.pending');
    }

    // Date Range Filter
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
        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDay.toISOString());
      }
    }

    // Search query
    if (search) {
      if (matchedOrderIdsFromPayments.length > 0) {
        query = query.or(`order_code.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%,id.in.(${matchedOrderIdsFromPayments.join(',')})`);
      } else {
        query = query.or(`order_code.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
    }

    // Sorting
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

    // Limit to safe CSV export bounds (e.g. 5000 records)
    query = query.limit(5000);

    const { data: orders, error: ordersError } = await query;
    if (ordersError) throw ordersError;

    // Build CSV Headers (Exactly as Specified)
    // Order reference, Customer, Order date, Subtotal, Discount, Delivery fee, Total amount, Payment status, Order status, Refund status, Amount refunded, Payment reference, Delivery zone
    const csvHeaders = [
      'Order reference',
      'Customer',
      'Order date',
      'Subtotal',
      'Discount',
      'Delivery fee',
      'Total amount',
      'Payment status',
      'Order status',
      'Refund status',
      'Amount refunded',
      'Payment reference',
      'Delivery zone'
    ];

    const csvRows = (orders || []).map(order => {
      const payments = (order.payments || []) as any[];
      const latestPayment = payments[payments.length - 1];

      // Derive refund details
      const totalRefunded = payments.reduce((sum, p) => sum + (Number(p.refund_amount) || 0), 0);
      let derivedRefundStatus = 'none';
      if (payments.some(p => p.refund_status === 'full') || order.status === 'refunded') {
        derivedRefundStatus = 'full';
      } else if (payments.some(p => p.refund_status === 'partial') || totalRefunded > 0) {
        derivedRefundStatus = 'partial';
      } else if (payments.some(p => p.refund_status === 'processing')) {
        derivedRefundStatus = 'processing';
      } else if (payments.some(p => p.refund_status === 'pending')) {
        derivedRefundStatus = 'pending';
      } else if (payments.some(p => p.refund_status === 'failed')) {
        derivedRefundStatus = 'failed';
      }

      const zoneName = order.delivery_zone_id || 'Agbani Delivery Zone';

      return [
        escapeCsvField(order.order_code),
        escapeCsvField(order.customer_name || 'Guest Customer'),
        escapeCsvField(new Date(order.created_at).toISOString()),
        escapeCsvField(Number(order.subtotal || 0).toFixed(2)),
        escapeCsvField(Number(order.discount_amount || 0).toFixed(2)),
        escapeCsvField(Number(order.delivery_fee || 0).toFixed(2)),
        escapeCsvField(Number(order.total_amount || 0).toFixed(2)),
        escapeCsvField(order.payment_status),
        escapeCsvField(order.status),
        escapeCsvField(derivedRefundStatus),
        escapeCsvField(totalRefunded.toFixed(2)),
        escapeCsvField(latestPayment?.provider_reference || ''),
        escapeCsvField(zoneName)
      ].join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\r\n');
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `jfc_orders_export_${timestampStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (error: any) {
    console.error('Export CSV error:', error);
    return NextResponse.json({ error: error.message || 'Failed to export history as CSV' }, { status: 500 });
  }
}
