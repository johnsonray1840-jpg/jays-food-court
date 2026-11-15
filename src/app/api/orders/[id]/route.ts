import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCustomerSession, hasOrderAccess, ORDER_ACCESS_COOKIE_NAME } from '@/lib/session';
import { getStaffSession } from '@/lib/auth';
import { normalizeNigerianPhone } from '@/lib/phone';
import { Order, OrderStatus } from '@/types';

const ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');

function readOrders(): (Order & { customerId?: string })[] {
  try {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  return phone.slice(0, 4) + '***' + phone.slice(-3);
}

function maskAddress(addr: string): string {
  if (!addr) return '';
  const parts = addr.split(',');
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return 'Agbani, Enugu';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawOrderId } = await params;
  const orderLookup = rawOrderId.trim().toUpperCase();

  // Authentication & Session Context
  const staff = await getStaffSession(req);
  
  // Check customer session from req cookie header or Next.js cookies
  let customerSession = null;
  const custCookieVal = req.cookies.get('jfc_customer_session')?.value;
  if (custCookieVal) {
    const { verifySessionToken } = await import('@/lib/session');
    customerSession = verifySessionToken(custCookieVal);
  } else {
    try {
      customerSession = await getCustomerSession();
    } catch {}
  }

  let orderRecord: any = null;
  let orderCustomerId: string | null = null;
  let orderPhone: string | null = null;

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderLookup);
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_code,
          customer_id,
          customer_name,
          phone,
          delivery_address,
          delivery_latitude,
          delivery_longitude,
          delivery_landmark,
          delivery_zone_id,
          delivery_details,
          delivery_otp,
          status,
          subtotal,
          discount_amount,
          delivery_fee,
          total_amount,
          payment_method,
          estimated_delivery_time,
          assigned_rider_id,
          created_at,
          order_items (
            id,
            item_name,
            unit_price,
            quantity,
            total_price,
            customizations,
            notes
          ),
          assigned_rider:riders (
            full_name,
            phone,
            rating
          )
        `);

      if (isUuid) {
        query = query.or(`order_code.eq.${orderLookup},id.eq.${orderLookup}`);
      } else {
        query = query.eq('order_code', orderLookup);
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        orderRecord = data;
        orderCustomerId = data.customer_id;
        orderPhone = data.phone;
      }
    } catch (err) {
      console.warn('Supabase order tracking query error, falling back to local store', err);
    }
  }

  if (!orderRecord) {
    const orders = readOrders();
    const found = orders.find((o) => o.id.toUpperCase() === orderLookup || o.id === rawOrderId);
    if (!found) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    orderRecord = found;
    orderCustomerId = found.customerId || null;
    orderPhone = found.phone || null;
  }

  // OBJECT-LEVEL AUTHORIZATION CHECK:
  // Is the requester the verified owner of this order, a privileged staff member, or the assigned rider?
  const isPrivilegedStaff = Boolean(staff && staff.role !== 'rider');
  const isAssignedRider = Boolean(
    staff && staff.role === 'rider' && orderRecord.assigned_rider_id && orderRecord.assigned_rider_id === staff.id
  );
  const normOrderPhone = orderPhone ? (normalizeNigerianPhone(orderPhone) || orderPhone) : '';
  const normSessPhone = customerSession?.phone
    ? (normalizeNigerianPhone(customerSession.phone) || customerSession.phone)
    : '';
  const orderAccessCookie = req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value;
  const canonicalOrderCode = orderRecord.order_code || orderRecord.id || orderLookup;
  const hasPerOrderAccess = hasOrderAccess(orderAccessCookie, canonicalOrderCode);

  const isOrderOwner = Boolean(
    hasPerOrderAccess ||
    (customerSession &&
      ((orderCustomerId && customerSession.customerId === orderCustomerId) ||
       (normOrderPhone && normSessPhone && normSessPhone === normOrderPhone)))
  );

  // Riders cannot inspect orders that are unassigned or assigned to another courier
  if (staff?.role === 'rider' && !isAssignedRider) {
    return NextResponse.json(
      { error: 'Access denied: Riders can only inspect orders assigned to them.' },
      { status: 403 }
    );
  }

  // If a customer is logged in as Customer A and attempts to access Customer B's order:
  if (customerSession && !isOrderOwner && !isPrivilegedStaff && !isAssignedRider) {
    return NextResponse.json(
      { error: 'Access denied: You do not have permission to view another customer\'s order.' },
      { status: 403 }
    );
  }

  const exposeFullPii = isPrivilegedStaff || isAssignedRider || isOrderOwner;

  // Format Order
  if (orderRecord.order_items !== undefined) {
    // Supabase format
    const assignedRider: any = Array.isArray(orderRecord.assigned_rider)
      ? orderRecord.assigned_rider[0]
      : orderRecord.assigned_rider;

    const order: Order = {
      id: orderRecord.order_code,
      createdAt: orderRecord.created_at,
      customerName: exposeFullPii ? orderRecord.customer_name : 'Guest Customer',
      phone: exposeFullPii ? orderRecord.phone : maskPhone(orderRecord.phone),
      address: exposeFullPii ? orderRecord.delivery_address : maskAddress(orderRecord.delivery_address),
      deliveryLatitude: orderRecord.delivery_latitude ? Number(orderRecord.delivery_latitude) : (orderRecord.deliveryDetails?.latitude ? Number(orderRecord.deliveryDetails.latitude) : undefined),
      deliveryLongitude: orderRecord.delivery_longitude ? Number(orderRecord.delivery_longitude) : (orderRecord.deliveryDetails?.longitude ? Number(orderRecord.deliveryDetails.longitude) : undefined),
      deliveryLandmark: orderRecord.delivery_landmark || orderRecord.deliveryDetails?.landmark,
      deliveryZoneId: orderRecord.delivery_zone_id,
      deliveryDetails: orderRecord.delivery_details || orderRecord.deliveryDetails,
      deliveryOtp: isOrderOwner || isPrivilegedStaff ? (orderRecord.delivery_otp || orderRecord.deliveryOtp) : undefined,
      assignedRiderId: orderRecord.assigned_rider_id,
      items: (orderRecord.order_items || []).map((oi: any) => {
        const cust = oi.customizations || {};
        return {
          key: oi.id,
          id: 1,
          name: oi.item_name,
          img: 'egusi',
          unit: Number(oi.unit_price),
          qty: oi.quantity,
          swallow: cust.swallow || null,
          extras: (cust.options || []).map((opt: any) => opt.name) || [],
          note: exposeFullPii ? oi.notes || '' : ''
        };
      }),
      subtotal: Number(orderRecord.subtotal),
      discount: Number(orderRecord.discount_amount),
      deliveryFee: Number(orderRecord.delivery_fee),
      total: Number(orderRecord.total_amount),
      paymentMode: orderRecord.payment_method === 'cash_on_delivery' ? 'cod' : 'transfer',
      status: orderRecord.status as OrderStatus,
      eta: orderRecord.estimated_delivery_time || '18 - 25 Mins',
      isAuthorizedCustomer: Boolean(isOrderOwner || isPrivilegedStaff),
      rider: assignedRider
        ? {
            name: assignedRider.full_name,
            phone: assignedRider.phone,
            rating: assignedRider.rating ? `${assignedRider.rating} ★` : ''
          }
        : null
    };

    return NextResponse.json(order);
  }

  // Local JSON format
  const sanitizedLocal: Order = {
    ...orderRecord,
    customerName: exposeFullPii ? orderRecord.customerName : 'Guest Customer',
    phone: exposeFullPii ? orderRecord.phone : maskPhone(orderRecord.phone),
    address: exposeFullPii ? orderRecord.address : maskAddress(orderRecord.address),
    deliveryLatitude: orderRecord.deliveryLatitude || orderRecord.deliveryCoordinates?.latitude || (orderRecord.deliveryDetails?.latitude ? Number(orderRecord.deliveryDetails.latitude) : undefined),
    deliveryLongitude: orderRecord.deliveryLongitude || orderRecord.deliveryCoordinates?.longitude || (orderRecord.deliveryDetails?.longitude ? Number(orderRecord.deliveryDetails.longitude) : undefined),
    deliveryLandmark: orderRecord.deliveryLandmark || orderRecord.deliveryDetails?.landmark,
    deliveryOtp: isOrderOwner || isPrivilegedStaff ? (orderRecord.deliveryOtp || orderRecord.delivery_otp) : undefined,
    isAuthorizedCustomer: Boolean(isOrderOwner || isPrivilegedStaff),
  };

  return NextResponse.json(sanitizedLocal);
}
