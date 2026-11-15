import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createPaystackRefund } from '@/lib/paystack';
import { requireStaffAuthorization } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const refundSchema = z.object({
  paymentId: z.string().uuid(),
  amountInNaira: z.number().positive().optional(),
  reason: z.string().trim().min(3, 'A valid refund reason is mandatory (min 3 chars)').max(500)
});

/**
 * Staff / Admin endpoint to process refunds.
 * Restricted STRICTLY to Authorized Owner and Manager roles.
 * Kitchen staff and Riders are strictly forbidden.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authorize: Kitchen staff and riders are strictly denied
    const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const parsed = refundSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid refund payload', details: parsed.error.format() }, { status: 400 });
    }

    const { paymentId, amountInNaira, reason } = parsed.data;
    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // 2. Fetch payment and verify eligibility with row-level locking check
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .select('id, order_id, amount, currency, status, refund_status, refund_amount, provider_reference, gateway_metadata')
      .eq('id', paymentId)
      .maybeSingle();

    if (pErr || !payment) {
      return NextResponse.json({ error: `Payment record "${paymentId}" not found` }, { status: 404 });
    }

    // Validate that payment was actually successful
    if (payment.status !== 'successful') {
      return NextResponse.json(
        { error: `Cannot refund payment with status "${payment.status}". Only successful payments can be refunded.` },
        { status: 400 }
      );
    }

    // Prevent duplicate submission if already full or currently processing
    if (payment.refund_status === 'full') {
      return NextResponse.json(
        { error: 'Payment has already been fully refunded.', refundStatus: payment.refund_status },
        { status: 409 }
      );
    }

    if (payment.refund_status === 'processing' || payment.refund_status === 'pending') {
      return NextResponse.json(
        { error: 'A refund request for this payment is already pending/processing.', refundStatus: payment.refund_status },
        { status: 409 }
      );
    }

    const existingRefundAmount = Number(payment.refund_amount || 0);
    const originalPaymentAmount = Number(payment.amount);
    const remainingRefundableBalance = Math.max(0, originalPaymentAmount - existingRefundAmount);

    const targetRefundAmount = amountInNaira ? Number(amountInNaira) : remainingRefundableBalance;

    // Validate refundable balance
    if (targetRefundAmount <= 0) {
      return NextResponse.json({ error: 'Refund amount must be greater than zero.' }, { status: 400 });
    }

    if (targetRefundAmount > remainingRefundableBalance) {
      return NextResponse.json(
        {
          error: `Refund amount (₦${targetRefundAmount.toLocaleString()}) exceeds remaining refundable balance (₦${remainingRefundableBalance.toLocaleString()}). Original paid: ₦${originalPaymentAmount.toLocaleString()}, already refunded: ₦${existingRefundAmount.toLocaleString()}.`
        },
        { status: 400 }
      );
    }

    const isFullRefund = (existingRefundAmount + targetRefundAmount) >= originalPaymentAmount;
    const initiatorIdentity = staff ? `${staff.fullName || staff.email} (${staff.role})` : 'manager_staff';

    // 3. Mark payment as 'processing' FIRST to prevent race condition / duplicate submissions
    const updatedMetadata = {
      ...(payment.gateway_metadata || {}),
      refund_requested_by: initiatorIdentity,
      refund_requested_at: new Date().toISOString(),
      refund_requested_amount: targetRefundAmount,
      refund_requested_reason: reason
    };

    await supabase
      .from('payments')
      .update({
        refund_status: 'processing',
        gateway_metadata: updatedMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    // 4. Call official Paystack refund API
    let paystackRefundRes;
    try {
      paystackRefundRes = await createPaystackRefund({
        transaction: payment.provider_reference,
        amountInNaira: targetRefundAmount,
        merchantNote: `[${initiatorIdentity}]: ${reason}`
      });
    } catch (refErr: any) {
      console.error('Paystack refund API error:', refErr);
      
      // Mark as failed if Paystack rejects the request
      await supabase
        .from('payments')
        .update({
          refund_status: 'failed',
          refund_reason: `Paystack rejection: ${refErr.message}`,
          gateway_metadata: {
            ...updatedMetadata,
            refund_error: refErr.message,
            failed_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      return NextResponse.json(
        { error: `Paystack refund initiation failed: ${refErr.message}` },
        { status: 502 }
      );
    }

    // 5. Update database atomically after Paystack accepts refund request
    const refundData = paystackRefundRes.data || {};
    const gatewayStatus = refundData.status || 'pending'; // 'pending', 'processing', 'processed', or 'failed'
    
    // Total accumulated refund amount
    const totalNewRefundAmount = existingRefundAmount + targetRefundAmount;

    const { data: atomicRes, error: atomicErr } = await supabase.rpc('confirm_refund_atomic', {
      p_payment_id: payment.id,
      p_refund_amount: totalNewRefundAmount,
      p_refund_reason: reason,
      p_gateway_refund_id: String(refundData.id || ''),
      p_gateway_status: gatewayStatus,
      p_actor_id: initiatorIdentity
    });

    if (atomicErr) {
      console.error('confirm_refund_atomic error:', atomicErr);
      return NextResponse.json(
        {
          warning: 'Refund accepted at Paystack but atomic DB confirmation returned an error.',
          error: atomicErr.message,
          paystackRefundId: refundData.id
        },
        { status: 500 }
      );
    }

    // Record Status History transition if order reached full refund
    if (isFullRefund && payment.order_id) {
      await supabase.from('order_status_history').insert({
        order_id: payment.order_id,
        status: 'refunded',
        from_status: 'confirmed',
        to_status: 'refunded',
        actor_type: staff?.role || 'manager',
        actor_id: staff?.id || initiatorIdentity,
        notes: `Refund processed: ₦${targetRefundAmount.toLocaleString()} (${reason})`
      });
    }

    return NextResponse.json({
      success: true,
      message: `Refund of ₦${targetRefundAmount.toLocaleString()} initiated successfully via Paystack.`,
      refundStatus: isFullRefund ? 'full' : 'partial',
      data: {
        paymentId: payment.id,
        orderId: payment.order_id,
        amountRefunded: targetRefundAmount,
        totalRefunded: totalNewRefundAmount,
        remainingBalance: originalPaymentAmount - totalNewRefundAmount,
        gatewayRefundId: refundData.id,
        gatewayStatus,
        initiatedBy: initiatorIdentity
      }
    });
  } catch (err: any) {
    console.error('Unexpected refund processing error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
