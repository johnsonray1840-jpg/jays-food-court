import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  addOrderAccessCookie,
  setCustomerSessionCookie,
  signSessionToken,
  signOrderAccessToken,
  verifyOrderAccessToken,
  ORDER_ACCESS_COOKIE_NAME
} from '@/lib/session';
import { normalizeNigerianPhone } from '@/lib/phone';

const ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');

function readLocalOrders(): any[] {
  try {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawOrderId } = await params;
    const orderLookup = rawOrderId.trim().toUpperCase();

    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body.phone || '').trim();
    if (!rawPhone) {
      return NextResponse.json(
        { error: 'Please enter the phone number used to place this order.' },
        { status: 400 }
      );
    }

    const normalizedInput = normalizeNigerianPhone(rawPhone);
    if (!normalizedInput) {
      return NextResponse.json(
        { error: 'Please enter a valid Nigerian phone number (e.g. 0803 123 4567).' },
        { status: 400 }
      );
    }

    let orderRecord: { orderCode: string; customerId: string | null; phone: string | null } | null = null;

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderLookup);
      let query = supabase.from('orders').select('id, order_code, customer_id, phone');
      if (isUuid) {
        query = query.or(`order_code.eq.${orderLookup},id.eq.${orderLookup}`);
      } else {
        query = query.eq('order_code', orderLookup);
      }

      const { data } = await query.maybeSingle();
      if (data) {
        orderRecord = {
          orderCode: data.order_code,
          customerId: data.customer_id || null,
          phone: data.phone || null
        };
      }
    }

    if (!orderRecord) {
      const localOrders = readLocalOrders();
      const found = localOrders.find(
        (o) => String(o.id || '').toUpperCase() === orderLookup || String(o.id || '') === rawOrderId
      );
      if (found) {
        orderRecord = {
          orderCode: String(found.id).toUpperCase(),
          customerId: found.customerId || null,
          phone: found.phone || null
        };
      }
    }

    if (!orderRecord) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const normalizedOrderPhone = orderRecord.phone ? normalizeNigerianPhone(orderRecord.phone) : null;
    const isPhoneMatch = Boolean(
      normalizedOrderPhone
        ? normalizedInput === normalizedOrderPhone
        : orderRecord.phone && orderRecord.phone.replace(/\D/g, '') === rawPhone.replace(/\D/g, '')
    );

    if (!isPhoneMatch) {
      return NextResponse.json(
        { error: 'The phone number entered does not match this order.' },
        { status: 403 }
      );
    }

    const canonicalPhone = normalizedOrderPhone || normalizedInput;
    const customerId = orderRecord.customerId || `cust-${orderRecord.orderCode}`;

    let orderAccessToken = '';
    try {
      orderAccessToken = await addOrderAccessCookie(orderRecord.orderCode);
    } catch {
      const existingVal = req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value;
      const existingCodes = existingVal ? verifyOrderAccessToken(existingVal) : [];
      orderAccessToken = signOrderAccessToken([...existingCodes, orderRecord.orderCode]);
    }

    try {
      await setCustomerSessionCookie(customerId, canonicalPhone);
    } catch {
      // Fallback for non-Next HTTP invocation
    }

    const sessionToken = signSessionToken({
      customerId,
      phone: canonicalPhone,
      createdAt: Date.now()
    });

    const response = NextResponse.json({
      success: true,
      isAuthorizedCustomer: true,
      orderCode: orderRecord.orderCode
    });

    response.cookies.set({
      name: ORDER_ACCESS_COOKIE_NAME,
      value: orderAccessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 60
    });

    response.cookies.set({
      name: 'jfc_customer_session',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 60
    });

    return response;
  } catch (err) {
    console.error('Customer order verification error:', err);
    return NextResponse.json({ error: 'Unable to verify order ownership.' }, { status: 500 });
  }
}
