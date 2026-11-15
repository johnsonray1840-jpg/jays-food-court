import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { verifyPaystackWebhookSignature, verifyPaystackTransaction } from '@/lib/paystack';
import { sendOrderConfirmedEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const signature = req.headers.get('x-paystack-signature');
  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // 1. VERIFY HMAC SHA-512 SIGNATURE WITH TIMING-SAFE EQUALITY
  const isSignatureValid = verifyPaystackWebhookSignature(rawBody, signature);
  if (!isSignatureValid) {
    console.warn('SECURITY ALERT: Rejected unauthorized Paystack webhook request. Invalid HMAC SHA-512 signature.');
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  // 2. VALIDATE EVENT TYPE
  const eventType = event.event;
  if (!eventType) {
    return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  // Handle asynchronous Paystack refund webhook notifications
  if (eventType === 'refund.processed' || eventType === 'refund.failed') {
    const refundData = event.data;
    const txRef = refundData?.transaction_reference || refundData?.transaction?.reference;
    const refundAmountInNaira = refundData?.amount ? Number(refundData.amount) / 100 : 0;
    const refundId = String(refundData?.id || '');

    if (txRef) {
      const { data: pmt } = await supabase
        .from('payments')
        .select('id, amount, refund_amount')
        .eq('provider_reference', txRef)
        .maybeSingle();

      if (pmt) {
        if (eventType === 'refund.processed') {
          await supabase.rpc('confirm_refund_atomic', {
            p_payment_id: pmt.id,
            p_refund_amount: refundAmountInNaira || pmt.amount,
            p_refund_reason: refundData?.customer_note || 'Refund processed by Paystack',
            p_gateway_refund_id: refundId,
            p_gateway_status: 'processed',
            p_actor_id: 'paystack_refund_webhook'
          });
        } else if (eventType === 'refund.failed') {
          await supabase
            .from('payments')
            .update({
              refund_status: 'failed',
              gateway_metadata: {
                refund_failure: refundData,
                failed_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', pmt.id);
        }
      }
    }

    return NextResponse.json({ success: true, event: eventType, processed: true }, { status: 200 });
  }

  // Only process charge.success for new orders; acknowledge other legitimate events
  if (eventType !== 'charge.success') {
    return NextResponse.json({ received: true, ignored: eventType }, { status: 200 });
  }

  const data = event.data;
  const paystackReference = data?.reference;
  if (!paystackReference) {
    return NextResponse.json({ error: 'Missing transaction reference in payload' }, { status: 400 });
  }

  // Paystack webhooks may provide event.id, data.id, or only reference.
  // We use event.id or data.id or reference directly to allow exact matching with stored event IDs
  const paystackEventId = String(event.id || data?.id || paystackReference);

  // 3. IDEMPOTENT CONCURRENCY LOCK & RETRY STATE EVALUATION
  // Inspect existing webhook event in database before doing external API work
  const { data: existingEvent, error: fetchErr } = await supabase
    .from('payment_webhook_events')
    .select('id, verification_status, attempt_count')
    .eq('event_id', paystackEventId)
    .maybeSingle();

  if (fetchErr) {
    console.error('Database error checking webhook idempotency:', fetchErr);
    // Transient DB failure: return HTTP 500 so Paystack automatically retries
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  let webhookRecordId: string;

  if (existingEvent) {
    // A. Already fully processed successfully: return immediate HTTP 200 without duplicate work
    if (existingEvent.verification_status === 'verified_success') {
      return NextResponse.json(
        { success: true, message: 'Duplicate webhook already verified and processed.' },
        { status: 200 }
      );
    }

    // B. Terminal failure (e.g. invalid signature, amount tampering, wrong currency):
    // Do not retry or process; return HTTP 200 to silence Paystack or HTTP 400
    if (existingEvent.verification_status === 'failed_terminal' || existingEvent.verification_status === 'amount_mismatch') {
      return NextResponse.json(
        { error: 'Webhook permanently failed previous verification. Manual review required.' },
        { status: 200 }
      );
    }

    // C. Currently processing: another worker or concurrent request has an active lock
    if (existingEvent.verification_status === 'processing') {
      console.log(`Webhook event "${paystackEventId}" is currently in-flight. Yielding.`);
      return NextResponse.json(
        { message: 'Event currently processing. Retry queued.' },
        { status: 429 }
      );
    }

    // D. Failed retryable: update attempt count and set back to processing
    webhookRecordId = existingEvent.id;
    await supabase
      .from('payment_webhook_events')
      .update({
        verification_status: 'processing',
        attempt_count: (existingEvent.attempt_count || 1) + 1,
        processed_at: new Date().toISOString()
      })
      .eq('id', webhookRecordId);
  } else {
    // New incoming webhook: claim lock with status 'processing'
    webhookRecordId = crypto.randomUUID();
    const { error: lockErr } = await supabase.from('payment_webhook_events').insert({
      id: webhookRecordId,
      event_id: paystackEventId,
      event_type: eventType,
      provider: 'paystack',
      provider_reference: paystackReference,
      payload: event,
      verification_status: 'processing',
      attempt_count: 1
    });

    if (lockErr) {
      if (lockErr.code === '23505' || String(lockErr.message).includes('duplicate key')) {
        return NextResponse.json(
          { success: true, message: 'Duplicate webhook delivery acknowledged.' },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: 'Failed to record webhook event' }, { status: 500 });
    }
  }

  // 4. VALIDATE PRELIMINARY PAYLOAD FIELDS (Currency, Reference, and Amount)
  const txCurrency = data.currency;
  if (txCurrency && txCurrency !== 'NGN') {
    await supabase
      .from('payment_webhook_events')
      .update({
        verification_status: 'failed_terminal',
        error_message: `Currency mismatch: ${txCurrency}`
      })
      .eq('id', webhookRecordId);
    return NextResponse.json({ error: `Currency mismatch: ${txCurrency}` }, { status: 400 });
  }

  const rawAmountInKobo = Number(data.amount);
  if (isNaN(rawAmountInKobo) || rawAmountInKobo <= 0) {
    await supabase
      .from('payment_webhook_events')
      .update({
        verification_status: 'failed_terminal',
        error_message: 'Invalid transaction amount in webhook'
      })
      .eq('id', webhookRecordId);
    return NextResponse.json({ error: 'Invalid transaction amount in webhook' }, { status: 400 });
  }

  const metadata = data.metadata || {};
  const orderCode = metadata.orderCode || paystackReference.split('-').slice(0, 3).join('-');

  // Match target order in database
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_code, customer_id, customer_name, phone, total_amount, status, payment_status')
    .eq('order_code', orderCode)
    .maybeSingle();

  if (orderErr || !order) {
    await supabase
      .from('payment_webhook_events')
      .update({
        verification_status: 'failed_terminal',
        error_message: `Order "${orderCode}" not found`
      })
      .eq('id', webhookRecordId);
    return NextResponse.json({ error: `Order "${orderCode}" not found` }, { status: 404 });
  }

  const expectedAmountInKobo = Math.round(Number(order.total_amount) * 100);
  if (Math.abs(rawAmountInKobo - expectedAmountInKobo) > 100) {
    const errMsg = `Amount mismatch: Paid ₦${rawAmountInKobo / 100}, expected ₦${Number(order.total_amount)}`;
    await supabase
      .from('payment_webhook_events')
      .update({
        order_id: order.id,
        verification_status: 'amount_mismatch',
        error_message: errMsg
      })
      .eq('id', webhookRecordId);
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }

  try {
    // 4. INDEPENDENT VERIFICATION VIA PAYSTACK API
    // Never trust webhook body alone: independently verify directly with Paystack's transaction endpoint
    let verifiedData: any;
    try {
      verifiedData = await verifyPaystackTransaction(paystackReference);
    } catch (verErr: any) {
      const isTransient = verErr.message?.includes('network') ||
                          verErr.message?.includes('timeout') ||
                          verErr.message?.includes('50') ||
                          verErr.message?.includes('ECONNRESET');

      await supabase
        .from('payment_webhook_events')
        .update({
          verification_status: isTransient ? 'retry_pending' : 'failed',
          error_message: `Paystack verification request error: ${verErr.message}`,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookRecordId);

      // Return 503 for transient upstream errors so Paystack automatically retries webhook delivery.
      // Return 400 for definitive client errors (e.g. reference not found).
      const statusCode = isTransient ? 503 : 400;
      return NextResponse.json({ error: `Verification failed: ${verErr.message}` }, { status: statusCode });
    }

    if (!verifiedData.status || verifiedData.data.status !== 'success') {
      await supabase
        .from('payment_webhook_events')
        .update({
          verification_status: 'failed_terminal',
          error_message: `Paystack API reported status: "${verifiedData.data?.status}"`,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookRecordId);

      return NextResponse.json(
        { error: 'Transaction verification returned non-success status', status: verifiedData.data?.status },
        { status: 400 }
      );
    }

    const tx = verifiedData.data;
    const amountPaidInNaira = Number(tx.amount) / 100;
    const currency = tx.currency;
    const metadata = tx.metadata || {};
    const orderCode = metadata.orderCode || paystackReference.split('-').slice(0, 3).join('-');

    // 5. VALIDATE CURRENCY (Strictly NGN)
    if (currency !== 'NGN') {
      await supabase
        .from('payment_webhook_events')
        .update({
          verification_status: 'failed_terminal',
          error_message: `Currency mismatch: expected NGN, received ${currency}`,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookRecordId);

      return NextResponse.json({ error: `Currency mismatch: ${currency}` }, { status: 400 });
    }

    // 6. MATCH ORDER IN DATABASE
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_code, customer_id, customer_name, phone, total_amount, status, payment_status')
      .eq('order_code', orderCode)
      .maybeSingle();

    if (orderErr || !order) {
      await supabase
        .from('payment_webhook_events')
        .update({
          verification_status: 'failed_terminal',
          error_message: `Target order "${orderCode}" not found`,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookRecordId);

      return NextResponse.json({ error: `Order "${orderCode}" not found` }, { status: 404 });
    }

    // 7. VERIFY CUSTOMER & ORDER ASSOCIATION
    if (metadata.orderId && metadata.orderId !== order.id) {
      await supabase
        .from('payment_webhook_events')
        .update({
          verification_status: 'failed_terminal',
          error_message: `Order ID mismatch: expected ${order.id}, got ${metadata.orderId}`,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookRecordId);

      return NextResponse.json({ error: 'Order identity mismatch' }, { status: 400 });
    }

    // 8. VERIFY EXACT AMOUNT AGAINST AUTHORITATIVE ORDER TOTAL
    const expectedAmount = Number(order.total_amount);
    if (Math.abs(amountPaidInNaira - expectedAmount) > 0.01) {
      const errMsg = `Amount mismatch: Paid ₦${amountPaidInNaira}, expected ₦${expectedAmount}`;
      console.error(`SECURITY ALERT: ${errMsg} for order ${orderCode}`);

      await supabase
        .from('payment_webhook_events')
        .update({
          order_id: order.id,
          verification_status: 'amount_mismatch',
          error_message: errMsg,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookRecordId);

      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    // 9. ATOMIC DATABASE TRANSACTION: CONFIRM PAYMENT & TRANSITION ORDER STATUS
    // Normalize Paystack channel to schema allowed values: 'transfer' | 'card' | 'cash_on_delivery'
    const rawChannel = String(tx.channel || '').toLowerCase();
    const normalizedPaymentMethod =
      rawChannel.includes('transfer') || rawChannel.includes('bank')
        ? 'transfer'
        : rawChannel.includes('cash')
        ? 'cash_on_delivery'
        : 'card';

    // Uses single-statement ACID confirm_order_payment_atomic RPC
    const { data: confirmRes, error: confirmErr } = await supabase.rpc('confirm_order_payment_atomic', {
      p_order_id: order.id,
      p_provider_reference: paystackReference,
      p_amount: amountPaidInNaira,
      p_currency: 'NGN',
      p_payment_method: normalizedPaymentMethod,
      p_gateway_response: tx.gateway_response || 'Successful',
      p_gateway_metadata: {
        paystack_id: tx.id,
        ip_address: tx.ip_address,
        paid_at: tx.paid_at,
        channel: tx.channel,
        customer_email: tx.customer?.email,
        customer_code: tx.customer?.customer_code
      },
      p_webhook_event_id: paystackEventId
    });

    if (confirmErr) {
      throw new Error(`confirm_order_payment_atomic failed: ${confirmErr.message}`);
    }

    // 10. LOG SUCCESSFUL VERIFICATION OUTCOME ONLY AFTER ATOMIC OPERATION SUCCEEDS
    await supabase
      .from('payment_webhook_events')
      .update({
        order_id: order.id,
        verification_status: 'verified_success',
        processed_at: new Date().toISOString()
      })
      .eq('id', webhookRecordId);

    // 11. TRIGGER INSTANT ORDER CONFIRMATION EMAIL VIA RESEND
    try {
      const recipientEmail = tx.customer?.email || metadata.customerEmail || metadata.email;
      if (recipientEmail && recipientEmail.includes('@')) {
        const { data: orderDetails } = await supabase
          .from('orders')
          .select(`
            id,
            order_code,
            customer_name,
            total_amount,
            delivery_address,
            delivery_verification_code,
            items:order_items (
              item_name,
              quantity,
              unit_price
            )
          `)
          .eq('id', order.id)
          .maybeSingle();

        const formattedItems = (orderDetails?.items || []).map((it: any) => ({
          name: it.item_name || 'Dish',
          qty: it.quantity || 1,
          unitPrice: Number(it.unit_price) || 0
        }));

        sendOrderConfirmedEmail({
          to: recipientEmail,
          customerName: order.customer_name || 'Valued Customer',
          orderCode: order.order_code,
          items: formattedItems.length > 0 ? formattedItems : [{ name: 'Chef Signature Dish', qty: 1, unitPrice: amountPaidInNaira }],
          totalAmount: amountPaidInNaira,
          deliveryAddress: (orderDetails as any)?.delivery_address || 'Agbani, Enugu',
          deliveryOtp: (orderDetails as any)?.delivery_verification_code || undefined,
          trackingUrl: `http://localhost:3000/?order=${order.order_code}#track`
        }).catch((e) => console.warn('Resend webhook notification background error:', e));
      }
    } catch (mailErr) {
      console.warn('Could not dispatch confirmation email from webhook:', mailErr);
    }

    const latency = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      orderCode: order.order_code,
      status: confirmRes?.status || 'confirmed',
      amount: amountPaidInNaira,
      channel: tx.channel,
      latencyMs: latency
    });
  } catch (err: any) {
    console.error('Unhandled webhook error:', err);

    await supabase
      .from('payment_webhook_events')
      .update({
        verification_status: 'failed_retryable',
        error_message: err.message || 'Unknown processing error',
        processed_at: new Date().toISOString()
      })
      .eq('id', webhookRecordId);

    // Return HTTP 500 so Paystack automatically retries webhook delivery
    return NextResponse.json({ error: 'Webhook processing failed temporarily. Retrying.' }, { status: 500 });
  }
}
