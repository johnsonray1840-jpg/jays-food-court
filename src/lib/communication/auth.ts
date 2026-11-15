import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession, verifySessionToken, hasOrderAccess, ORDER_ACCESS_COOKIE_NAME } from '@/lib/session';
import { getStaffSession } from '@/lib/auth';
import { normalizeNigerianPhone } from '@/lib/phone';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export interface CommunicationSession {
  order: any;
  conversation: any;
  userRole: 'customer' | 'rider';
  userId: string;
  userName: string;
}

/**
 * Validates that an incoming request is authorized to communicate regarding the given order.
 * Strictly verifies customer ownership or assigned courier assignment.
 * Automatically synchronizes or fetches the active conversation entity for the order.
 * If rider assignment changes, safely closes old conversations and opens an active conversation
 * for the currently assigned rider.
 */
export async function authenticateCommunicationParticipant(
  req: NextRequest,
  orderLookup: string
): Promise<{ errorResponse?: NextResponse; session?: CommunicationSession }> {
  const cleanOrderCode = orderLookup.trim().toUpperCase();

  // 1. Check Staff Session (Rider)
  const staff = await getStaffSession(req);

  // 2. Check Customer Session
  let customerSession = null;
  const custCookieVal = req.cookies.get('jfc_customer_session')?.value;
  if (custCookieVal) {
    customerSession = verifySessionToken(custCookieVal);
  } else {
    try {
      customerSession = await getCustomerSession();
    } catch {}
  }

  // 3. Fetch authoritative order record
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Database service unavailable' },
        { status: 503 }
      )
    };
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanOrderCode);
  let query = supabase
    .from('orders')
    .select(`
      id,
      order_code,
      customer_id,
      customer_name,
      phone,
      status,
      assigned_rider_id,
      assigned_rider:riders (
        id,
        full_name,
        phone
      )
    `);

  if (isUuid) {
    query = query.or(`order_code.eq.${cleanOrderCode},id.eq.${cleanOrderCode}`);
  } else {
    query = query.eq('order_code', cleanOrderCode);
  }

  const { data: order, error: orderErr } = await query.maybeSingle();

  if (orderErr || !order) {
    return {
      errorResponse: NextResponse.json(
        { error: `Order "${cleanOrderCode}" not found.` },
        { status: 404 }
      )
    };
  }

  // 4. Verify Active Communication States
  const activeCommunicationStates = ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'];
  const isArchived = ['delivered', 'cancelled', 'refunded'].includes(order.status);

  // 5. Check Membership & Explicit Role Resolution (Prevents customer/rider cookie collisions)
  const roleHeader = req.headers.get('x-communication-role')?.toLowerCase();
  const roleQuery = new URL(req.url).searchParams.get('role')?.toLowerCase();
  const requestedRole: 'customer' | 'rider' | null =
    roleHeader === 'customer' || roleHeader === 'rider'
      ? roleHeader
      : roleQuery === 'customer' || roleQuery === 'rider'
      ? roleQuery
      : null;

  const isPrivilegedStaff = Boolean(
    staff && (staff.role === 'owner' || staff.role === 'manager' || staff.role === 'admin')
  );

  const isAssignedRider = Boolean(
    staff &&
    (staff.role === 'rider' || isPrivilegedStaff) &&
    (order.assigned_rider_id === staff.id || isPrivilegedStaff)
  );

  const orderPhoneNorm = order.phone ? (normalizeNigerianPhone(order.phone) || order.phone) : '';
  const sessPhoneNorm = customerSession?.phone
    ? (normalizeNigerianPhone(customerSession.phone) || customerSession.phone)
    : '';
  const orderAccessCookie = req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value;

  const isOrderCustomer = Boolean(
    hasOrderAccess(orderAccessCookie, order.order_code) ||
    (customerSession &&
      ((order.customer_id && customerSession.customerId === order.customer_id) ||
       (orderPhoneNorm && sessPhoneNorm && sessPhoneNorm === orderPhoneNorm)))
  );

  let resolvedRole: 'customer' | 'rider';
  if (requestedRole === 'customer') {
    if (isOrderCustomer || isPrivilegedStaff) {
      resolvedRole = 'customer';
    } else {
      return {
        errorResponse: NextResponse.json(
          { error: 'Access denied: Please verify your order phone number to chat or call.' },
          { status: 403 }
        )
      };
    }
  } else if (requestedRole === 'rider') {
    if (isAssignedRider) {
      resolvedRole = 'rider';
    } else {
      return {
        errorResponse: NextResponse.json(
          { error: 'Access denied: Only the assigned courier can access rider communication.' },
          { status: 403 }
        )
      };
    }
  } else if (isAssignedRider) {
    resolvedRole = 'rider';
  } else if (isOrderCustomer) {
    resolvedRole = 'customer';
  } else {
    return {
      errorResponse: NextResponse.json(
        { error: 'Access denied: You are not an authorized participant in this order conversation.' },
        { status: 403 }
      )
    };
  }

  // 6. Manage / Fetch Conversation Lifecycle Entity
  // Check for existing active conversation for this order
  const { data: existingActiveConv } = await supabase
    .from('order_conversations')
    .select('*')
    .eq('order_id', order.id)
    .eq('status', 'active')
    .maybeSingle();

  let conversation = existingActiveConv;

  // If order is closed/archived, mark any active conversation as closed
  if (isArchived && conversation) {
    await supabase
      .from('order_conversations')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.id);
    conversation.status = 'closed';
    conversation.closed_at = new Date().toISOString();
  }

  // If order has an assigned rider and active communication state:
  if (!isArchived && order.assigned_rider_id) {
    if (!conversation) {
      // Create new active conversation
      const { data: newConv } = await supabase
        .from('order_conversations')
        .insert({
          order_id: order.id,
          order_code: order.order_code,
          customer_id: order.customer_id || (customerSession ? customerSession.customerId : null),
          customer_phone: order.phone,
          rider_id: order.assigned_rider_id,
          status: 'active'
        })
        .select()
        .single();
      conversation = newConv;
    } else if (conversation.rider_id !== order.assigned_rider_id) {
      // Rider reassignment detected: Close old conversation to ensure private transfer
      await supabase
        .from('order_conversations')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      // Create new active conversation for the new rider
      const { data: reallocatedConv } = await supabase
        .from('order_conversations')
        .insert({
          order_id: order.id,
          order_code: order.order_code,
          customer_id: order.customer_id || (customerSession ? customerSession.customerId : null),
          customer_phone: order.phone,
          rider_id: order.assigned_rider_id,
          status: 'active'
        })
        .select()
        .single();
      conversation = reallocatedConv;
    }
  }

  // If conversation is still not created (e.g. order before rider assignment), fetch any previous conversation
  if (!conversation) {
    const { data: lastConv } = await supabase
      .from('order_conversations')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    conversation = lastConv;
  }

  // 7. Return Participant Details
  const assignedRider = Array.isArray(order.assigned_rider) ? order.assigned_rider[0] : order.assigned_rider;
  if (resolvedRole === 'rider') {
    return {
      session: {
        order,
        conversation,
        userRole: 'rider',
        userId: String(order.assigned_rider_id || staff!.id),
        userName: assignedRider?.full_name || staff?.fullName || 'Your Courier'
      }
    };
  }

  return {
    session: {
      order,
      conversation,
      userRole: 'customer',
      userId: String(order.customer_id || customerSession?.customerId || order.order_code),
      userName: order.customer_name || 'Customer'
    }
  };
}
