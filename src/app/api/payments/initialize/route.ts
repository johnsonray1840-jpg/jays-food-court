import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { initializePaystackTransaction } from '@/lib/paystack';

const initSchema = z.object({
  orderCode: z.string().trim().min(5),
  email: z.string().trim().email(),
  callbackUrl: z.string().url().optional()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = initSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payment initialization payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { orderCode, email, callbackUrl } = parsed.data;
    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database service unavailable' },
        { status: 503 }
      );
    }

    // Retrieve order to get authoritative total_amount
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_code, customer_id, customer_name, phone, total_amount, status, payment_status')
      .eq('order_code', orderCode)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: `Order "${orderCode}" not found.` },
        { status: 404 }
      );
    }

    if (order.status !== 'pending_payment') {
      return NextResponse.json(
        { error: `Order "${orderCode}" is in status "${order.status}". Only orders awaiting payment can be initialized.` },
        { status: 409 }
      );
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json(
        { error: `Order "${orderCode}" has already been paid.` },
        { status: 409 }
      );
    }

    const amountInNaira = Number(order.total_amount);
    if (isNaN(amountInNaira) || amountInNaira <= 0) {
      return NextResponse.json(
        { error: 'Invalid order total amount for payment initialization' },
        { status: 400 }
      );
    }

    // 1. RECOVERY & DEDUPLICATION: Check for an active, unexpired payment initialized within the last 15 minutes.
    // If found and the authorization_url was saved in gateway_metadata, reuse it without spawning duplicate Paystack charges!
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentPayment } = await supabase
      .from('payments')
      .select('id, provider_reference, gateway_metadata, created_at')
      .eq('order_id', order.id)
      .eq('status', 'pending')
      .gte('created_at', fifteenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPayment && recentPayment.gateway_metadata?.authorization_url) {
      return NextResponse.json({
        success: true,
        authorizationUrl: recentPayment.gateway_metadata.authorization_url,
        accessCode: recentPayment.gateway_metadata.access_code,
        reference: recentPayment.provider_reference,
        amount: amountInNaira,
        reused: true
      });
    }

    // 2. Mark any older pending payments for this order as 'abandoned'
    await supabase
      .from('payments')
      .update({
        status: 'abandoned',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', order.id)
      .eq('status', 'pending');

    // 3. Unique reference per initialization attempt: JFC-{orderCode}-{timestamp}
    // Paystack strictly rejects calling transaction/initialize twice with the exact same reference
    const paystackReference = `${order.order_code}-${Date.now()}`;

    // 4. Initialize Paystack transaction on official Paystack API
    // Amount is passed strictly in Naira and converted to kobo exactly once inside initializePaystackTransaction
    const paystackRes = await initializePaystackTransaction({
      email,
      amountInNaira,
      reference: paystackReference,
      callbackUrl,
      metadata: {
        orderId: order.id,
        orderCode: order.order_code,
        customerId: order.customer_id,
        customerName: order.customer_name,
        phone: order.phone
      }
    });

    const authUrl = paystackRes.data.authorization_url;
    const accessCode = paystackRes.data.access_code;

    // 5. Persist pending transaction with metadata BEFORE returning to client
    const { error: insertErr } = await supabase.from('payments').insert({
      id: crypto.randomUUID(),
      order_id: order.id,
      amount: amountInNaira,
      currency: 'NGN',
      payment_method: 'paystack',
      provider: 'paystack',
      provider_reference: paystackReference,
      status: 'pending',
      gateway_metadata: {
        authorization_url: authUrl,
        access_code: accessCode,
        client_email: email
      }
    });

    if (insertErr) {
      console.error('Failed to persist payment reference in payments table:', insertErr);
      // Even if this insert fails, our webhook and verify endpoints reconstruct/upsert the payment
      // record atomically using confirm_order_payment_atomic when Paystack calls back.
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: authUrl,
      accessCode: accessCode,
      reference: paystackReference,
      amount: amountInNaira
    });
  } catch (err: any) {
    console.error('Paystack initialization error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initialize online payment' },
      { status: 500 }
    );
  }
}
