import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Sweeper endpoint to safely expire abandoned orders.
 * Orders in 'pending_payment' older than expirationMinutes (default 30 min)
 * are transitioned to 'cancelled' with payment_status = 'failed'.
 *
 * Crucially:
 * - Legitimate payment records in public.payments are NEVER deleted (preserving audit trail).
 * - Only orders with ZERO successful payments are cancelled.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const expirationMinutes = 30;
    const cutoffTime = new Date(Date.now() - expirationMinutes * 60 * 1000).toISOString();

    // Query stale pending orders
    const { data: staleOrders, error } = await supabase
      .from('orders')
      .select('id, order_code, created_at')
      .eq('status', 'pending_payment')
      .eq('payment_status', 'pending')
      .lte('created_at', cutoffTime)
      .limit(50);

    if (error) {
      throw new Error(`Failed to query stale orders: ${error.message}`);
    }

    const cancelled: string[] = [];

    for (const order of staleOrders || []) {
      // Confirm no successful payment exists
      const { data: successfulPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', order.id)
        .eq('status', 'successful')
        .maybeSingle();

      if (successfulPayment) {
        // Safe-guard: Do not cancel if payment was actually successful!
        continue;
      }

      // Transition order status using atomic RPC
      const { error: transErr } = await supabase.rpc('transition_order_status_atomic', {
        p_order_id: order.id,
        p_from_status: 'pending_payment',
        p_to_status: 'cancelled',
        p_actor_type: 'system',
        p_actor_id: 'payment_expiration_sweeper',
        p_rider_id: null,
        p_estimated_time: null,
        p_notes: `Order expired: Payment was not completed within ${expirationMinutes} minutes.`
      });

      if (!transErr) {
        // Mark payment status failed
        await supabase
          .from('orders')
          .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', order.id);

        // Mark any pending payment attempts for this order as abandoned
        await supabase
          .from('payments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('order_id', order.id)
          .eq('status', 'pending');

        cancelled.push(order.order_code);
      }
    }

    return NextResponse.json({
      success: true,
      scanned: staleOrders?.length || 0,
      cancelledCount: cancelled.length,
      cancelledOrders: cancelled
    });
  } catch (err: any) {
    console.error('Payment expiration sweeper error:', err);
    return NextResponse.json({ error: err.message || 'Sweeper failed' }, { status: 500 });
  }
}
