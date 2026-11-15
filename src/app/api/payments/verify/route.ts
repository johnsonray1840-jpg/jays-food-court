import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { sendOrderConfirmedEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // Call Paystack verification API
    const paystackRes = await verifyPaystackTransaction(reference);

    if (!paystackRes.status || paystackRes.data.status !== 'success') {
      return NextResponse.json(
        {
          success: false,
          status: paystackRes.data.status,
          message: paystackRes.data.gateway_response || 'Payment not successful'
        },
        { status: 400 }
      );
    }

    const data = paystackRes.data;
    const amountPaidInNaira = Number(data.amount) / 100;
    const metadata = data.metadata || {};
    const orderCode = metadata.orderCode || reference.split('-').slice(0, 3).join('-');

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_code, total_amount, status, payment_status')
      .eq('order_code', orderCode)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: `Order "${orderCode}" not found` }, { status: 404 });
    }

    // Check amount
    const expectedAmount = Number(order.total_amount);
    if (Math.abs(amountPaidInNaira - expectedAmount) > 0.01) {
      return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 });
    }

    // Normalize Paystack channel to schema allowed values: 'transfer' | 'card' | 'cash_on_delivery'
    const rawChannel = String(data.channel || '').toLowerCase();
    const normalizedPaymentMethod =
      rawChannel.includes('transfer') || rawChannel.includes('bank')
        ? 'transfer'
        : rawChannel.includes('cash')
        ? 'cash_on_delivery'
        : 'card';

    // Atomic database transaction: Confirm payment and transition order status
    const { data: confirmRes, error: confirmErr } = await supabase.rpc('confirm_order_payment_atomic', {
      p_order_id: order.id,
      p_provider_reference: reference,
      p_amount: amountPaidInNaira,
      p_currency: 'NGN',
      p_payment_method: normalizedPaymentMethod,
      p_gateway_response: data.gateway_response || 'Successful',
      p_gateway_metadata: {
        paystack_id: data.id,
        ip_address: data.ip_address,
        paid_at: data.paid_at,
        channel: data.channel,
        customer_email: data.customer?.email,
        customer_code: data.customer?.customer_code
      },
      p_webhook_event_id: `verify_client_${reference}`
    });

    if (confirmErr) {
      throw new Error(`confirm_order_payment_atomic failed: ${confirmErr.message}`);
    }

    if (confirmRes?.is_late_payment) {
      return NextResponse.json({
        success: false,
        isLatePayment: true,
        orderCode: order.order_code,
        status: 'cancelled',
        message: 'Order was expired/cancelled before payment completion. Payment will be refunded.'
      }, { status: 409 });
    }

    // Trigger instant order confirmation email via Resend
    try {
      const recipientEmail = data.customer?.email || (metadata as any)?.customerEmail || (metadata as any)?.email;
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
          customerName: (orderDetails as any)?.customer_name || 'Valued Customer',
          orderCode: order.order_code,
          items: formattedItems.length > 0 ? formattedItems : [{ name: 'Chef Signature Dish', qty: 1, unitPrice: amountPaidInNaira }],
          totalAmount: amountPaidInNaira,
          deliveryAddress: (orderDetails as any)?.delivery_address || 'Agbani, Enugu',
          deliveryOtp: (orderDetails as any)?.delivery_verification_code || undefined,
          trackingUrl: `http://localhost:3000/?order=${order.order_code}#track`
        }).catch((e) => console.warn('Resend verify notification background error:', e));
      }
    } catch (mailErr) {
      console.warn('Could not dispatch confirmation email from verify:', mailErr);
    }

    return NextResponse.json({
      success: true,
      orderCode: order.order_code,
      orderId: order.id,
      amount: amountPaidInNaira,
      channel: data.channel,
      status: confirmRes?.status || 'confirmed'
    });
  } catch (err: any) {
    console.error('Payment verification error:', err);
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
