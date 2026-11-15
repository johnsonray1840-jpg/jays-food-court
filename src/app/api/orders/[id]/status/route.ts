import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCustomerSession } from '@/lib/session';
import { getStaffSession, StaffRole } from '@/lib/auth';
import {
  OrderStatus,
  OrderActorRole,
  validateOrderTransition,
  getEstimatedDeliveryTimeForStatus
} from '@/lib/order-state-machine';
import { Order } from '@/types';
import {
  sendOrderPreparingEmail,
  sendOrderDispatchedEmail,
  sendOrderDeliveredEmail
} from '@/lib/email';

const ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');
const HISTORY_FILE = path.join(process.cwd(), 'data', 'order_status_history.json');

const statusTransitionSchema = z.object({
  status: z.enum([
    'pending_payment',
    'confirmed',
    'accepted',
    'preparing',
    'ready_for_pickup',
    'assigned_to_rider',
    'picked_up',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'refunded',
    // Legacy support
    'cooking',
    'dispatched'
  ]),
  actorRole: z.enum(['owner', 'customer', 'kitchen_staff', 'rider', 'manager', 'admin', 'system']).optional(),
  actorId: z.string().optional(),
  riderId: z.string().uuid().optional(),
  deliveryOtp: z.string().min(4).max(6).optional(),
  emergencyOverrideReason: z.string().min(5).max(300).optional(),
  notes: z.string().max(300).optional()
});

interface LocalHistoryRecord {
  id: string;
  orderId: string;
  fromStatus: string;
  toStatus: string;
  actorType: string;
  actorId: string | null;
  riderId: string | null;
  notes: string | null;
  createdAt: string;
}

function readOrders(): Order[] {
  try {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeOrders(orders: Order[]) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing orders file:', err);
  }
}

function appendLocalHistory(record: LocalHistoryRecord) {
  try {
    let list: LocalHistoryRecord[] = [];
    if (fs.existsSync(HISTORY_FILE)) {
      list = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
    list.push(record);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing history file:', err);
  }
}

function readLocalHistory(orderId: string): LocalHistoryRecord[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const list: LocalHistoryRecord[] = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    return list.filter((h) => h.orderId === orderId);
  } catch (err) {
    return [];
  }
}

/**
 * GET: Retrieves the order status, current ETA, and the complete immutable audit history trail.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawOrderId } = await params;
  const orderLookup = rawOrderId.trim().toUpperCase();
  const staff = await getStaffSession(req);
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
  const supabase = getSupabaseAdminClient();

  let orderData: any = null;
  let isLocal = false;

  if (supabase) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderLookup);
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_code,
          customer_id,
          phone,
          status,
          assigned_rider_id,
          estimated_delivery_time,
          assigned_rider:riders (
            id,
            full_name,
            phone,
            rating
          ),
          order_status_history (
            id,
            from_status,
            to_status,
            actor_type,
            actor_id,
            notes,
            created_at
          )
        `);

      if (isUuid) {
        query = query.or(`order_code.eq.${orderLookup},id.eq.${orderLookup}`);
      } else {
        query = query.eq('order_code', orderLookup);
      }

      const { data: order } = await query.maybeSingle();
      if (order) {
        orderData = order;
      }
    } catch (err) {
      console.warn('Supabase status query error, falling back to local history', err);
    }
  }

  if (!orderData) {
    const orders = readOrders() as any[];
    const found = orders.find((o) => o.id.toUpperCase() === orderLookup);
    if (!found) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    isLocal = true;
    orderData = found;
  }

  const isFullPrivilegedStaff = Boolean(staff && staff.role !== 'rider');
  const isAssignedRider = Boolean(
    staff && staff.role === 'rider' && orderData.assigned_rider_id && orderData.assigned_rider_id === staff.id
  );
  const isOwner = Boolean(
    customerSession &&
    ((orderData.customer_id && customerSession.customerId === orderData.customer_id) ||
     (orderData.customerId && customerSession.customerId === orderData.customerId) ||
     (orderData.phone && customerSession.phone === orderData.phone))
  );

  if (staff?.role === 'rider' && !isAssignedRider) {
    return NextResponse.json(
      { error: 'Access denied: Riders can only inspect orders assigned to them.' },
      { status: 403 }
    );
  }

  // If authenticated as a different customer, deny cross-customer access
  if (customerSession && !isOwner && !isFullPrivilegedStaff && !isAssignedRider) {
    return NextResponse.json(
      { error: 'Access denied: You cannot inspect another customer\'s order status.' },
      { status: 403 }
    );
  }

  const authorizedForDetails = isFullPrivilegedStaff || isAssignedRider || isOwner;
  const rawHistory = isLocal
    ? readLocalHistory(orderData.id)
    : (orderData.order_status_history || []);

  return NextResponse.json({
    orderId: isLocal ? orderData.id : orderData.order_code,
    status: orderData.status,
    eta: isLocal ? orderData.eta : orderData.estimated_delivery_time,
    rider: authorizedForDetails ? (isLocal ? orderData.rider : orderData.assigned_rider) : null,
    history: authorizedForDetails ? rawHistory : []
  });
}

/**
 * PUT: Executes a validated lifecycle transition with authorized actors and immutable audit trail.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawOrderId } = await params;
    const orderLookup = rawOrderId.trim().toUpperCase();
    const rawBody = await req.json();

    const parseResult = statusTransitionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { notes } = parseResult.data;

    // Normalize legacy status names
    let requestedStatus: OrderStatus = parseResult.data.status as OrderStatus;
    if (requestedStatus === ('cooking' as any)) requestedStatus = 'preparing';
    if (requestedStatus === ('dispatched' as any)) requestedStatus = 'out_for_delivery';

    // 1. RESOLVE & AUTHENTICATE ACTOR ROLE & IDENTITY
    // Checks verified staff session, validated kitchen station terminal credentials, or verified customer cookie
    const staffSession = await getStaffSession(req);
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

    let actorRole: OrderActorRole;
    let actorId: string;

    if (staffSession) {
      actorRole = staffSession.role;
      actorId = staffSession.id;
    } else if (customerSession) {
      actorRole = 'customer';
      actorId = customerSession.customerId;
    } else {
      return NextResponse.json(
        { error: 'Authentication required. Only authorized staff and verified order customers can update order status.' },
        { status: 401 }
      );
    }

    // 2. RETRIEVE CURRENT ORDER STATE
    const supabase = getSupabaseAdminClient();
    let currentOrder: { id: string; order_code: string; status: OrderStatus; customer_id?: string; customer_phone?: string; assigned_rider_id?: string; deliveryOtp?: string } | null = null;

    if (supabase) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderLookup);
      let query = supabase
        .from('orders')
        .select('id, order_code, status, customer_id, phone, assigned_rider_id, delivery_otp');

      if (isUuid) {
        query = query.or(`order_code.eq.${orderLookup},id.eq.${orderLookup}`);
      } else {
        query = query.eq('order_code', orderLookup);
      }

      const { data: dbOrder } = await query.maybeSingle();

      if (dbOrder) {
        currentOrder = {
          id: dbOrder.id,
          order_code: dbOrder.order_code,
          status: dbOrder.status as OrderStatus,
          customer_id: dbOrder.customer_id || undefined,
          customer_phone: dbOrder.phone || undefined,
          assigned_rider_id: dbOrder.assigned_rider_id || undefined,
          deliveryOtp: (dbOrder as any).delivery_otp || undefined
        };
      }
    }

    if (!currentOrder) {
      const orders = readOrders() as any[];
      const local = orders.find((o) => o.id.toUpperCase() === orderLookup);
      if (local) {
        currentOrder = {
          id: local.id,
          order_code: local.id,
          status: local.status as OrderStatus,
          customer_id: local.customerId || undefined,
          customer_phone: local.phone || undefined,
          assigned_rider_id: local.assigned_rider_id || local.rider?.id || undefined,
          deliveryOtp: local.deliveryOtp || undefined
        };
      }
    }

    if (!currentOrder) {
      return NextResponse.json({ error: `Order "${orderLookup}" was not found.` }, { status: 404 });
    }

    // STRICT CUSTOMER OWNERSHIP ENFORCEMENT:
    // If an actor claims the customer role, they can ONLY modify their own orders!
    if (actorRole === 'customer') {
      const isOwner = Boolean(
        customerSession &&
        ((currentOrder.customer_id && customerSession.customerId === currentOrder.customer_id) ||
         (currentOrder.customer_phone && customerSession.phone === currentOrder.customer_phone))
      );

      if (!isOwner) {
        return NextResponse.json(
          { error: 'Access denied: You are not authorized to modify an order belonging to another customer.' },
          { status: 403 }
        );
      }
    }

    // STRICT RIDER OWNERSHIP ENFORCEMENT & CONCURRENT CLAIM LOCKING:
    // Riders claiming ready_for_pickup orders transition them to assigned_to_rider.
    // For subsequent stages, riders can ONLY transition orders explicitly assigned to them.
    if (actorRole === 'rider') {
      if (requestedStatus === 'assigned_to_rider') {
        // First-to-claim atomic guard: order must be ready_for_pickup and unassigned
        if (currentOrder.status !== 'ready_for_pickup' || currentOrder.assigned_rider_id) {
          return NextResponse.json(
            { error: 'Conflict: This delivery order has already been claimed by another courier.' },
            { status: 409 }
          );
        }

        // Single active delivery policy: Check if rider already has an active delivery
        if (supabase && actorId) {
          const { data: activeDeliveries } = await supabase
            .from('orders')
            .select('id, order_code, status')
            .eq('assigned_rider_id', actorId)
            .in('status', ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched']);

          if (activeDeliveries && activeDeliveries.length > 0) {
            return NextResponse.json(
              {
                error: `Capacity limit reached: You currently have active delivery ${activeDeliveries[0].order_code}. Complete it before claiming new orders.`,
                activeOrderCode: activeDeliveries[0].order_code
              },
              { status: 422 }
            );
          }
        }
      } else {
        if (!currentOrder.assigned_rider_id || currentOrder.assigned_rider_id !== actorId) {
          return NextResponse.json(
            { error: 'Access denied: Riders can only update status for orders assigned to them.' },
            { status: 403 }
          );
        }
      }

      // DELIVERY OTP VERIFICATION & BRUTE-FORCE PROTECTION:
      // When a courier marks an order as delivered, the customer's verification code is mandatory.
      if (requestedStatus === 'delivered') {
        const submittedOtp = parseResult.data.deliveryOtp?.trim();
        const expectedOtp = currentOrder.deliveryOtp?.trim();

        if (expectedOtp) {
          if (!submittedOtp) {
            return NextResponse.json(
              { error: 'Verification failed: Customer delivery verification code is required to complete handover.' },
              { status: 400 }
            );
          }

          // Cryptographic constant-time comparison
          const submittedHash = crypto.createHash('sha256').update(submittedOtp).digest('hex');
          const expectedHash = crypto.createHash('sha256').update(expectedOtp).digest('hex');

          const subBuf = Buffer.from(submittedHash, 'utf8');
          const expBuf = Buffer.from(expectedHash, 'utf8');

          if (subBuf.length !== expBuf.length || !crypto.timingSafeEqual(subBuf, expBuf)) {
            return NextResponse.json(
              { error: 'Verification failed: Incorrect delivery code. Please verify the code displayed on customer tracking screen.' },
              { status: 400 }
            );
          }
        }
      }
    }

    // DELIVERY COMPLETION RULES
    if (requestedStatus === 'delivered' && actorRole !== 'rider') {
      if (!['owner', 'manager', 'admin'].includes(actorRole)) {
        return NextResponse.json(
          { error: 'Forbidden: Delivery completion without courier OTP requires Owner or Manager emergency override.' },
          { status: 403 }
        );
      }

      // If owner/manager provides the valid customer OTP or an emergency justification reason:
      const submittedOtp = parseResult.data.deliveryOtp?.trim();
      const expectedOtp = currentOrder.deliveryOtp?.trim();
      const hasValidOtp = expectedOtp && submittedOtp && submittedOtp === expectedOtp;

      if (!hasValidOtp && !parseResult.data.emergencyOverrideReason) {
        return NextResponse.json(
          { error: 'Audit requirement: Please enter the customer delivery verification code or provide a valid justification reason for emergency completion.' },
          { status: 422 }
        );
      }
    }

    const currentStatus = currentOrder.status;

    // 3. VALIDATE STATE TRANSITION PERMISSION MATRIX
    const validation = validateOrderTransition(currentStatus, requestedStatus, actorRole);
    if (!validation.allowed) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 403 }
      );
    }

    // 4. PREVENT INVENTED RIDER ASSIGNMENTS
    // When transitioning to assigned_to_rider, a genuine, verified rider is mandatory
    let resolvedRiderId: string | null = (actorRole === 'rider' && actorId) ? actorId : (parseResult.data.riderId || null);
    let assignedRiderInfo: { name: string; phone: string; rating: string } | null = null;

    if (requestedStatus === 'assigned_to_rider') {
      if (!resolvedRiderId && supabase) {
        // Query active, available riders from database
        const { data: activeRiders } = await supabase
          .from('riders')
          .select('id, full_name, phone, rating, is_active, is_available')
          .eq('is_active', true)
          .eq('is_available', true)
          .limit(1);

        if (!activeRiders || activeRiders.length === 0) {
          return NextResponse.json(
            { error: 'No active riders are currently available in Agbani. Cannot invent rider assignment.' },
            { status: 422 }
          );
        }
        resolvedRiderId = activeRiders[0].id;
        assignedRiderInfo = {
          name: activeRiders[0].full_name,
          phone: activeRiders[0].phone,
          rating: activeRiders[0].rating ? `${activeRiders[0].rating} ★` : 'Verified Courier'
        };
      } else if (resolvedRiderId && supabase) {
        const { data: verifiedRider } = await supabase
          .from('riders')
          .select('id, full_name, phone, rating, is_active')
          .eq('id', resolvedRiderId)
          .eq('is_active', true)
          .maybeSingle();

        if (!verifiedRider) {
          return NextResponse.json(
            { error: `Rider reference "${resolvedRiderId}" is not a verified active courier.` },
            { status: 422 }
          );
        }
        assignedRiderInfo = {
          name: verifiedRider.full_name,
          phone: verifiedRider.phone,
          rating: verifiedRider.rating ? `${verifiedRider.rating} ★` : 'Verified Courier'
        };
      }
    }

    const newEta = getEstimatedDeliveryTimeForStatus(requestedStatus);

    // 5. ATOMIC DATABASE EXECUTION WITH IMMUTABLE HISTORY
    if (supabase && currentOrder.id) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('transition_order_status_atomic', {
          p_order_id: currentOrder.id,
          p_from_status: currentStatus,
          p_to_status: requestedStatus,
          p_actor_type: actorRole,
          p_actor_id: actorId,
          p_rider_id: resolvedRiderId,
          p_estimated_time: newEta,
          p_notes: notes || `Transitioned to ${requestedStatus} by ${actorRole}`
        });

        if (rpcErr) {
          const msg = String(rpcErr.message || '');
          const isMissingRpc =
            rpcErr.code === 'PGRST202' ||
            rpcErr.code === '42883' ||
            msg.includes('Could not find the function');

          if (!isMissingRpc) {
            if (msg.includes('STATE_CONFLICT') || msg.includes('State conflict')) {
              return NextResponse.json(
                { error: 'Order status changed concurrently. Please refresh and retry.' },
                { status: 409 }
              );
            }
            if (msg.includes('ORDER_NOT_FOUND') || msg.includes('not found')) {
              return NextResponse.json({ error: `Order "${orderLookup}" was not found.` }, { status: 404 });
            }
            if (msg.includes('FORBIDDEN_TRANSITION') || msg.includes('UNAUTHORIZED_ACTOR')) {
              return NextResponse.json({ error: msg }, { status: 403 });
            }
            if (msg.includes('idx_unique_active_delivery_per_rider') || msg.includes('duplicate key value violates unique constraint')) {
              return NextResponse.json(
                { error: 'This courier already has an active in-flight delivery. Couriers must complete their ongoing delivery before taking on another order.' },
                { status: 409 }
              );
            }
            throw new Error(`Order status RPC transition failed: ${msg}`);
          }

          // Missing RPC fallback (check errors explicitly and compensate on history failure)
          const { data: updatedRows, error: updateErr } = await supabase
            .from('orders')
            .update({
              status: requestedStatus,
              estimated_delivery_time: newEta,
              assigned_rider_id: resolvedRiderId || currentOrder.assigned_rider_id || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentOrder.id)
            .eq('status', currentStatus)
            .select('id');

          if (updateErr) {
            throw new Error(`Order status update failed: ${updateErr.message}`);
          }
          if (!updatedRows || updatedRows.length === 0) {
            return NextResponse.json(
              { error: 'Order status changed concurrently. Please refresh and retry.' },
              { status: 409 }
            );
          }

          const { error: histErr } = await supabase.from('order_status_history').insert({
            id: crypto.randomUUID(),
            order_id: currentOrder.id,
            status: requestedStatus,
            from_status: currentStatus,
            to_status: requestedStatus,
            actor_type: actorRole,
            actor_id: actorId,
            rider_id: resolvedRiderId || currentOrder.assigned_rider_id || null,
            notes: notes || `Transitioned to ${requestedStatus}`
          });

          if (histErr) {
            await supabase
              .from('orders')
              .update({
                status: currentStatus,
                assigned_rider_id: currentOrder.assigned_rider_id || null,
                updated_at: new Date().toISOString()
              })
              .eq('id', currentOrder.id);
            throw new Error(`Order status history insert failed (reverted): ${histErr.message}`);
          }
        }

        // Concurrency-safe rider operational lifecycle sync
        if (resolvedRiderId) {
          if (requestedStatus === 'assigned_to_rider' || requestedStatus === 'picked_up' || requestedStatus === 'out_for_delivery') {
            await supabase
              .from('riders')
              .update({ is_available: false, updated_at: new Date().toISOString() })
              .eq('id', resolvedRiderId);
          } else if (requestedStatus === 'delivered' || requestedStatus === 'cancelled') {
            // Once delivery complete, check if rider has any remaining active deliveries
            const { data: remainingActive } = await supabase
              .from('orders')
              .select('id')
              .eq('assigned_rider_id', resolvedRiderId)
              .in('status', ['assigned_to_rider', 'picked_up', 'out_for_delivery'])
              .neq('id', currentOrder.id);

            if (!remainingActive || remainingActive.length === 0) {
              await supabase
                .from('riders')
                .update({ is_available: true, updated_at: new Date().toISOString() })
                .eq('id', resolvedRiderId);
            }
          }
        }
      } catch (dbErr) {
        console.error('Supabase status transition exception:', dbErr);
        return NextResponse.json(
          { error: 'Unable to persist order status transition in database.' },
          { status: 500 }
        );
      }
    }

    // 6. RECORD IMMUTABLE LOCAL AUDIT HISTORY
    appendLocalHistory({
      id: crypto.randomUUID(),
      orderId: currentOrder.order_code,
      fromStatus: currentStatus,
      toStatus: requestedStatus,
      actorType: actorRole,
      actorId,
      riderId: resolvedRiderId,
      notes: notes || null,
      createdAt: new Date().toISOString()
    });

    // 7. UPDATE LOCAL ORDERS MIRROR
    const orders = readOrders();
    const idx = orders.findIndex((o) => o.id.toUpperCase() === orderLookup);
    if (idx !== -1) {
      orders[idx].status = requestedStatus;
      orders[idx].eta = newEta;
      if (assignedRiderInfo) {
        orders[idx].rider = assignedRiderInfo;
      }
      writeOrders(orders);
    }

    // 8. DISPATCH RESEND EMAIL NOTIFICATIONS ON SIGNIFICANT LIFECYCLE PROGRESS
    try {
      let customerEmail = (currentOrder as any).email || (currentOrder as any).customer_email;
      if (!customerEmail && supabase && currentOrder.customer_id) {
        const { data: custData } = await supabase
          .from('customers')
          .select('email, full_name')
          .eq('id', currentOrder.customer_id)
          .maybeSingle();
        if (custData?.email) customerEmail = custData.email;
      }

      if (customerEmail && customerEmail.includes('@')) {
        const custName = (currentOrder as any).customer_name || 'Valued Customer';
        const trackingUrl = `http://localhost:3000/?order=${currentOrder.order_code}#track`;

        if (requestedStatus === 'preparing' || requestedStatus === 'accepted') {
          sendOrderPreparingEmail({
            to: customerEmail,
            customerName: custName,
            orderCode: currentOrder.order_code,
            prepEstimateMinutes: 15,
            trackingUrl
          }).catch((err) => console.warn('Resend preparing email error:', err));
        } else if (requestedStatus === 'out_for_delivery' || (requestedStatus as any) === 'dispatched' || requestedStatus === 'picked_up') {
          sendOrderDispatchedEmail({
            to: customerEmail,
            customerName: custName,
            orderCode: currentOrder.order_code,
            riderName: assignedRiderInfo?.name || 'Assigned Courier',
            riderPhone: assignedRiderInfo?.phone || '+2347087426626',
            deliveryOtp: currentOrder.deliveryOtp || (currentOrder as any).delivery_verification_code,
            trackingUrl
          }).catch((err) => console.warn('Resend dispatched email error:', err));
        } else if (requestedStatus === 'delivered') {
          sendOrderDeliveredEmail({
            to: customerEmail,
            customerName: custName,
            orderCode: currentOrder.order_code
          }).catch((err) => console.warn('Resend delivered email error:', err));
        }
      }
    } catch (emailErr) {
      console.warn('Background Resend lifecycle notification failed:', emailErr);
    }

    return NextResponse.json({
      success: true,
      orderId: currentOrder.order_code,
      fromStatus: currentStatus,
      toStatus: requestedStatus,
      eta: newEta,
      actorRole,
      assignedRider: assignedRiderInfo || undefined
    });
  } catch (err: any) {
    console.error('Order status transition exception:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to execute order lifecycle transition.' },
      { status: 500 }
    );
  }
}
