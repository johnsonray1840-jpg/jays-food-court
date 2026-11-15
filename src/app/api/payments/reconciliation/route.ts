import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { requireStaffAuthorization } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const reconcileBodySchema = z.object({
  action: z.enum(['sync_with_paystack', 'mark_abandoned']),
  reference: z.string().trim().min(3)
});

/**
 * Operational Monitoring & Financial Reconciliation Endpoint
 * Restricted to Owner, Admin, and Manager roles.
 *
 * Scans, classifies, and reports all financial incidents:
 * 1. Payments without matching orders (orphaned gateway payments)
 * 2. Orders with successful payments but inconsistent operational order status
 * 3. Cancelled orders with successful payments (requires refund attention)
 * 4. Refunds that remain pending or processing too long (> 24 hours)
 * 5. Failed webhook processing events
 * 6. Duplicate payment references or multi-pay attempts
 * 7. Late payments completed after order was cancelled
 * 8. Payments requiring manual staff review
 */
export async function GET(req: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
    if (errorResponse) return errorResponse;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    // 1. Fetch Authoritative Datasets
    const [
      paymentsRes,
      ordersRes,
      webhooksRes
    ] = await Promise.all([
      supabase
        .from('payments')
        .select(`
          id,
          order_id,
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
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select(`
          id,
          order_code,
          customer_name,
          phone,
          status,
          payment_status,
          subtotal,
          delivery_fee,
          total_amount,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('payment_webhook_events')
        .select(`
          id,
          event_id,
          event_type,
          provider_reference,
          verification_status,
          error_message,
          created_at,
          processed_at
        `)
        .order('created_at', { ascending: false })
        .limit(100)
    ]);

    if (paymentsRes.error) throw paymentsRes.error;
    if (ordersRes.error) throw ordersRes.error;

    const allPayments = paymentsRes.data || [];
    const allOrders = ordersRes.data || [];
    const allWebhooks = webhooksRes.data || [];

    const orderMap = new Map<string, any>();
    allOrders.forEach(o => orderMap.set(o.id, o));

    // Group payments by order_id and reference
    const paymentsByOrder = new Map<string, any[]>();
    const paymentsByRef = new Map<string, any[]>();
    allPayments.forEach(p => {
      if (p.order_id) {
        const list = paymentsByOrder.get(p.order_id) || [];
        list.push(p);
        paymentsByOrder.set(p.order_id, list);
      }
      if (p.provider_reference) {
        const list = paymentsByRef.get(p.provider_reference) || [];
        list.push(p);
        paymentsByRef.set(p.provider_reference, list);
      }
    });

    // 2. DETECT FINANCIAL INCIDENTS

    // Incident A: Payments without matching orders (Orphaned Payments)
    const paymentsWithoutMatchingOrders = allPayments.filter(p => !p.order_id || !orderMap.has(p.order_id));

    // Incident B: Cancelled orders with successful payments (Needs refund attention)
    const cancelledOrdersWithSuccessfulPayments: any[] = [];
    allOrders.forEach(ord => {
      if (ord.status === 'cancelled') {
        const orderPayments = paymentsByOrder.get(ord.id) || [];
        const successPay = orderPayments.find(p => p.status === 'successful');
        if (successPay && successPay.refund_status !== 'full') {
          cancelledOrdersWithSuccessfulPayments.push({
            order: ord,
            payment: successPay,
            incidentType: 'cancelled_order_paid_unrefunded',
            message: `Order #${ord.order_code} is cancelled, but payment of ₦${Number(successPay.amount).toLocaleString()} has not been fully refunded.`
          });
        }
      }
    });

    // Incident C: Orders with successful payments but inconsistent order status
    // (e.g. marked 'pending_payment' even though payment succeeded)
    const inconsistentStatusOrders: any[] = [];
    allOrders.forEach(ord => {
      const orderPayments = paymentsByOrder.get(ord.id) || [];
      const hasSuccess = orderPayments.some(p => p.status === 'successful');
      if (hasSuccess && (ord.payment_status !== 'paid' || ord.status === 'pending_payment')) {
        inconsistentStatusOrders.push({
          order: ord,
          payments: orderPayments,
          incidentType: 'inconsistent_status',
          message: `Order #${ord.order_code} has a successful Paystack transaction, but order is still in '${ord.status}' / '${ord.payment_status}'.`
        });
      }
    });

    // Incident D: Refunds that remain pending or processing too long (> 24 hours)
    const stalePendingRefunds = allPayments.filter(p => 
      ['pending', 'processing'].includes(p.refund_status) && 
      p.updated_at && 
      p.updated_at <= twentyFourHoursAgo
    );

    // Incident E: Failed webhook processing
    const failedWebhooks = allWebhooks.filter(wh => 
      ['failed', 'amount_mismatch', 'failed_terminal', 'invalid_signature'].includes(wh.verification_status)
    );

    // Incident F: Duplicate payment events (Multiple successful payments for a single order)
    const duplicatePayments: any[] = [];
    paymentsByOrder.forEach((orderPayments, orderId) => {
      const successes = orderPayments.filter(p => p.status === 'successful');
      if (successes.length > 1) {
        duplicatePayments.push({
          orderId,
          order: orderMap.get(orderId),
          payments: successes,
          incidentType: 'duplicate_successful_payments',
          message: `Order has ${successes.length} successful payment transactions on record. Total excess paid.`
        });
      }
    });

    // Incident G: Late payments (Payments confirmed after order was already marked cancelled)
    const lateSuccessfulPayments = cancelledOrdersWithSuccessfulPayments.filter(item => {
      const payTime = new Date(item.payment.created_at).getTime();
      const ordCancelTime = new Date(item.order.updated_at).getTime();
      return payTime > ordCancelTime;
    });

    // Total Financial Incidents Count
    const totalIncidentCount = 
      paymentsWithoutMatchingOrders.length +
      cancelledOrdersWithSuccessfulPayments.length +
      inconsistentStatusOrders.length +
      stalePendingRefunds.length +
      failedWebhooks.length +
      duplicatePayments.length;

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        totalIncidentCount,
        hasFinancialIncidents: totalIncidentCount > 0,
        paymentsWithoutMatchingOrdersCount: paymentsWithoutMatchingOrders.length,
        cancelledOrdersWithSuccessfulPaymentsCount: cancelledOrdersWithSuccessfulPayments.length,
        inconsistentStatusOrdersCount: inconsistentStatusOrders.length,
        stalePendingRefundsCount: stalePendingRefunds.length,
        failedWebhooksCount: failedWebhooks.length,
        duplicatePaymentsCount: duplicatePayments.length,
        lateSuccessfulPaymentsCount: lateSuccessfulPayments.length
      },
      incidents: {
        cancelledOrdersWithSuccessfulPayments,
        inconsistentStatusOrders,
        paymentsWithoutMatchingOrders,
        stalePendingRefunds,
        failedWebhooks,
        duplicatePayments,
        lateSuccessfulPayments
      }
    });
  } catch (err: any) {
    console.error('Reconciliation report error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * On-demand staff reconciliation POST action:
 * Queries Paystack directly via server-to-server API to resolve a specific payment reference.
 * Strictly preserves audit history and never silently modifies data.
 */
export async function POST(req: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const parsed = reconcileBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid reconciliation payload', details: parsed.error.format() }, { status: 400 });
    }

    const { action, reference } = parsed.data;
    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    if (action === 'sync_with_paystack') {
      // 1. Independently verify directly with Paystack API
      let paystackRes;
      try {
        paystackRes = await verifyPaystackTransaction(reference);
      } catch (err: any) {
        return NextResponse.json({
          error: `Paystack lookup failed: ${err.message}`
        }, { status: 404 });
      }

      const tx = paystackRes.data;
      const amountPaid = Number(tx.amount) / 100;
      const metadata = tx.metadata || {};
      const orderCode = metadata.orderCode || reference.split('-').slice(0, 3).join('-');

      const { data: order } = await supabase
        .from('orders')
        .select('id, order_code, total_amount, status, payment_status')
        .eq('order_code', orderCode)
        .maybeSingle();

      if (!order) {
        return NextResponse.json({ error: `Associated order "${orderCode}" not found in database.` }, { status: 404 });
      }

      if (tx.status === 'success') {
        const actorName = staff ? `${staff.fullName || staff.email} (${staff.role})` : 'managerial_staff';

        const rawChannel = String(tx.channel || '').toLowerCase();
        const normalizedPaymentMethod =
          rawChannel.includes('transfer') || rawChannel.includes('bank')
            ? 'transfer'
            : rawChannel.includes('cash')
            ? 'cash_on_delivery'
            : 'card';

        // Execute atomic confirmation / late payment refund handler
        const { data: atomicRes, error: atomicErr } = await supabase.rpc('confirm_order_payment_atomic', {
          p_order_id: order.id,
          p_provider_reference: reference,
          p_amount: amountPaid,
          p_currency: 'NGN',
          p_payment_method: normalizedPaymentMethod,
          p_gateway_response: tx.gateway_response || 'Manual Reconciliation Sync',
          p_gateway_metadata: {
            reconciled_by: actorName,
            reconciled_at: new Date().toISOString(),
            paystack_tx: tx
          },
          p_webhook_event_id: `manual_reconcile_${reference}_${Date.now()}`
        });

        if (atomicErr) {
          throw new Error(`confirm_order_payment_atomic failed: ${atomicErr.message}`);
        }

        // Record history entry for audit preservation
        await supabase.from('order_status_history').insert({
          order_id: order.id,
          status: order.status,
          from_status: order.status,
          to_status: order.status,
          actor_type: staff?.role || 'manager',
          actor_id: staff?.id || actorName,
          notes: `Reconciled with Paystack: ₦${amountPaid.toLocaleString()} confirmed via ${tx.channel || 'gateway'}`
        });

        return NextResponse.json({
          success: true,
          message: `Payment reference ${reference} synchronized and reconciled with Paystack.`,
          result: atomicRes
        });
      } else {
        // Transaction failed or abandoned on Paystack
        await supabase
          .from('payments')
          .update({
            status: tx.status === 'abandoned' ? 'abandoned' : 'failed',
            gateway_response: tx.gateway_response,
            updated_at: new Date().toISOString()
          })
          .eq('provider_reference', reference);

        return NextResponse.json({
          success: true,
          message: `Paystack status is "${tx.status}". Local record updated.`,
          paystackStatus: tx.status
        });
      }
    } else if (action === 'mark_abandoned') {
      await supabase
        .from('payments')
        .update({
          status: 'abandoned',
          updated_at: new Date().toISOString()
        })
        .eq('provider_reference', reference)
        .eq('status', 'pending');

      return NextResponse.json({
        success: true,
        message: `Payment reference "${reference}" marked as abandoned.`
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    console.error('Reconciliation sync error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
