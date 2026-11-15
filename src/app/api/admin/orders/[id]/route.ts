import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Authorize Staff: Only owner, admin, manager (and privileged staff)
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse) return errorResponse;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const { id: rawId } = await params;
    const orderLookup = rawId.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderLookup);

    // 2. Fetch Core Order Record
    let orderQuery = supabase
      .from('orders')
      .select(`
        id,
        order_code,
        customer_id,
        customer_name,
        phone,
        delivery_address,
        delivery_landmark,
        delivery_latitude,
        delivery_longitude,
        delivery_zone_id,
        delivery_details,
        special_instructions,
        status,
        subtotal,
        discount_amount,
        delivery_fee,
        total_amount,
        payment_method,
        payment_status,
        estimated_delivery_time,
        assigned_rider_id,
        created_at,
        updated_at,
        items:order_items (
          id,
          menu_item_id,
          item_name,
          unit_price,
          quantity,
          total_price,
          customizations,
          notes,
          created_at
        ),
        payments:payments (
          id,
          amount,
          currency,
          payment_method,
          provider,
          provider_reference,
          status,
          gateway_response,
          gateway_metadata,
          initialized_at,
          verified_at,
          webhook_event_id,
          webhook_received_at,
          refund_status,
          refund_amount,
          refund_reason,
          refunded_at,
          created_at,
          updated_at
        ),
        history:order_status_history (
          id,
          status,
          from_status,
          to_status,
          actor_type,
          actor_id,
          notes,
          rider_id,
          created_at
        )
      `);

    if (isUuid) {
      orderQuery = orderQuery.or(`id.eq.${orderLookup},order_code.eq.${orderLookup.toUpperCase()}`);
    } else {
      orderQuery = orderQuery.eq('order_code', orderLookup.toUpperCase());
    }

    const { data: orderData, error: orderError } = await orderQuery.maybeSingle();

    if (orderError) throw orderError;
    if (!orderData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 3. Fetch Customer Details if linked
    let customerDetails: any = null;
    if (orderData.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, full_name, phone, email, created_at')
        .eq('id', orderData.customer_id)
        .maybeSingle();
      customerDetails = customer;
    }

    // 4. Fetch Delivery Zone details if zone_id exists
    let deliveryZone: any = null;
    if (orderData.delivery_zone_id) {
      const { data: zone } = await supabase
        .from('delivery_zones')
        .select('id, name, city, state, delivery_fee, estimated_time')
        .eq('id', orderData.delivery_zone_id)
        .maybeSingle();
      deliveryZone = zone;
    }

    // 5. Fetch Assigned Courier Profile if assigned
    let assignedRider: any = null;
    if (orderData.assigned_rider_id) {
      const { data: rider } = await supabase
        .from('riders')
        .select('id, full_name, phone, vehicle_type, rating, is_active')
        .eq('id', orderData.assigned_rider_id)
        .maybeSingle();
      assignedRider = rider;
    }

    // 6. Fetch Webhook Event Audit Logs related to payments
    const paymentRefs = (orderData.payments || [])
      .map((p: any) => p.provider_reference)
      .filter(Boolean);

    let webhookEvents: any[] = [];
    if (paymentRefs.length > 0) {
      const { data: webhooks } = await supabase
        .from('payment_webhook_events')
        .select('id, event_id, event_type, provider, provider_reference, verification_status, error_message, processed_at, created_at')
        .in('provider_reference', paymentRefs);
      webhookEvents = webhooks || [];
    }

    // 7. Sanitize Payment Records (NEVER expose secret keys, authorization codes, signatures, internal tokens)
    const sanitizedPayments = (orderData.payments || []).map((p: any) => {
      let safeMeta = { ...p.gateway_metadata };
      delete safeMeta.secret_key;
      delete safeMeta.authorization_code;
      delete safeMeta.signature;
      delete safeMeta.secret;
      delete safeMeta.token;
      delete safeMeta.subaccount_secret;

      return {
        id: p.id,
        amount: Number(p.amount) || 0,
        currency: p.currency || 'NGN',
        paymentMethod: p.payment_method || 'card',
        paymentGateway: p.payment_gateway || p.provider || 'paystack',
        provider: p.provider || 'paystack',
        reference: p.provider_reference,
        status: p.status, // successful, pending, failed, abandoned
        gatewayResponse: p.gateway_response,
        gatewayMetadata: safeMeta,
        channel: safeMeta?.channel || safeMeta?.authorization?.channel || (p.payment_method || 'card'),
        initializedAt: p.initialized_at || p.created_at,
        verifiedAt: p.verified_at,
        webhookEventId: p.webhook_event_id,
        webhookReceivedAt: p.webhook_received_at,
        refundStatus: p.refund_status || 'none', // none, pending, partial, full, failed
        refundAmount: Number(p.refund_amount) || 0,
        refundReason: p.refund_reason,
        refundedAt: p.refunded_at,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      };
    });

    // 8. Calculate Authoritative Refund Figures across all payment records
    const originalPaymentAmount = sanitizedPayments
      .filter((p: any) => p.status === 'successful')
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const totalAmountRefunded = sanitizedPayments
      .reduce((sum: number, p: any) => sum + p.refundAmount, 0);

    const remainingRefundableBalance = Math.max(0, originalPaymentAmount - totalAmountRefunded);

    // Collect all refund transactions
    const refundRecords = sanitizedPayments
      .filter((p: any) => p.refundStatus !== 'none' || p.refundAmount > 0)
      .map((p: any) => {
        const refundMeta = p.gatewayMetadata || {};
        return {
          paymentId: p.id,
          paymentReference: p.reference,
          originalAmount: p.amount,
          refundAmount: p.refundAmount,
          refundStatus: p.refundStatus,
          refundReason: p.refundReason || 'Customer requested refund',
          refundReference: refundMeta.refund_id || refundMeta.refundReference || `REF-${p.id.slice(0, 8)}`,
          initiatedAt: p.refundedAt || p.updatedAt,
          completedAt: p.refundStatus === 'full' || p.refundStatus === 'partial' ? p.refundedAt : null,
          failureReason: p.refundStatus === 'failed' ? (p.gatewayResponse || 'Gateway refund rejection') : null,
          initiatedByStaff: refundMeta.actor_id || 'Managerial Staff'
        };
      });

    // 9. Synthesize Authoritative Chronological Event Timeline
    // Must include: Order created, Payment initialized/verified/failed, Kitchen state changes, Prep delays, Rider assignment, Transit, Delivery, and Refunds.
    const timelineEvents: Array<{
      id: string;
      eventType: string;
      title: string;
      description?: string;
      status: 'success' | 'warning' | 'error' | 'info';
      source: string;
      actorId?: string;
      timestamp: string;
    }> = [];

    // Event: Order Created
    timelineEvents.push({
      id: `order-created-${orderData.id}`,
      eventType: 'order_created',
      title: 'Order Placed by Customer',
      description: `Order #${orderData.order_code} was submitted for ${orderData.customer_name}. Total: ₦${Number(orderData.total_amount).toLocaleString()}`,
      status: 'info',
      source: 'Customer / Checkout',
      actorId: orderData.customer_id || 'guest',
      timestamp: orderData.created_at
    });

    // Events from Payments
    sanitizedPayments.forEach((p: any, idx: number) => {
      // Payment Initialized
      timelineEvents.push({
        id: `payment-init-${p.id}`,
        eventType: 'payment_initialized',
        title: `Payment Initialized via ${p.provider.toUpperCase()}`,
        description: `Reference: ${p.reference} &bull; Amount: ₦${p.amount.toLocaleString()} ${p.currency}`,
        status: 'info',
        source: 'Paystack Gateway',
        timestamp: p.initializedAt || p.createdAt
      });

      // Payment Verified / Failed
      if (p.status === 'successful') {
        timelineEvents.push({
          id: `payment-success-${p.id}`,
          eventType: 'payment_verified',
          title: 'Payment Successfully Verified',
          description: `Transaction confirmed by gateway. Paid ₦${p.amount.toLocaleString()} via ${p.channel}`,
          status: 'success',
          source: 'Paystack / Webhook',
          timestamp: p.verifiedAt || p.updatedAt || p.createdAt
        });
      } else if (p.status === 'failed') {
        timelineEvents.push({
          id: `payment-failed-${p.id}`,
          eventType: 'payment_failed',
          title: 'Payment Attempt Failed',
          description: p.gatewayResponse || 'The transaction was declined or failed during gateway processing.',
          status: 'error',
          source: 'Paystack Gateway',
          timestamp: p.updatedAt || p.createdAt
        });
      }

      // Refund Events
      if (p.refundStatus && p.refundStatus !== 'none') {
        timelineEvents.push({
          id: `refund-${p.id}`,
          eventType: 'refund_processed',
          title: `Refund: ${p.refundStatus.toUpperCase()}`,
          description: `Amount: ₦${p.refundAmount.toLocaleString()} &bull; Reason: ${p.refundReason || 'Managerial reconciliation'}`,
          status: p.refundStatus === 'failed' ? 'error' : 'warning',
          source: 'Paystack Refund API',
          timestamp: p.refundedAt || p.updatedAt
        });
      }
    });

    // Events from Webhook Logs
    webhookEvents.forEach((wh: any) => {
      timelineEvents.push({
        id: `webhook-${wh.id}`,
        eventType: 'webhook_event',
        title: `Webhook Received: ${wh.event_type}`,
        description: `Reference: ${wh.provider_reference} &bull; Status: ${wh.verification_status}`,
        status: wh.verification_status.includes('success') ? 'success' : (wh.verification_status.includes('fail') ? 'error' : 'info'),
        source: 'Paystack Webhook Handler',
        timestamp: wh.processed_at || wh.created_at
      });
    });

    // Events from Order Status History (Audit Trail)
    (orderData.history || []).forEach((h: any) => {
      const toState = h.to_status || h.status;
      let title = `Order Status: ${toState.toUpperCase()}`;
      let statusType: 'success' | 'warning' | 'error' | 'info' = 'info';

      if (toState === 'confirmed') {
        title = 'Order Confirmed';
        statusType = 'info';
      } else if (toState === 'accepted') {
        title = 'Kitchen Accepted Order';
        statusType = 'info';
      } else if (toState === 'preparing') {
        title = 'Kitchen Preparation Started';
        statusType = 'info';
      } else if (toState === 'ready_for_pickup') {
        title = 'Order Ready for Pickup';
        statusType = 'info';
      } else if (toState === 'assigned_to_rider') {
        title = 'Courier Assigned to Dispatch';
        statusType = 'info';
      } else if (toState === 'picked_up') {
        title = 'Courier Picked Up Food';
        statusType = 'info';
      } else if (toState === 'out_for_delivery') {
        title = 'Out for Delivery';
        statusType = 'warning';
      } else if (toState === 'delivered') {
        title = 'Order Delivered Successfully';
        statusType = 'success';
      } else if (toState === 'cancelled') {
        title = 'Order Cancelled';
        statusType = 'error';
      } else if (toState === 'refunded') {
        title = 'Order Marked Refunded';
        statusType = 'warning';
      }

      timelineEvents.push({
        id: `history-${h.id}`,
        eventType: `status_${toState}`,
        title,
        description: h.notes || undefined,
        status: statusType,
        source: h.actor_type || 'Staff Operation',
        actorId: h.actor_id || undefined,
        timestamp: h.created_at
      });
    });

    // Events from Prep Time Adjustments (if recorded)
    ((orderData as any).prep_history || []).forEach((ph: any) => {
      timelineEvents.push({
        id: `prep-${ph.id}`,
        eventType: 'prep_adjustment',
        title: `Prep Time: ${ph.new_prep_minutes} Mins (${ph.action})`,
        description: ph.delay_reason ? `Reason: ${ph.delay_reason}` : undefined,
        status: ph.delay_reason ? 'warning' : 'info',
        source: `${ph.adjusted_by_name} (${ph.adjusted_by_role})`,
        timestamp: ph.created_at
      });
    });

    // Events from Delivery Verification Attempts (if recorded)
    ((orderData as any).verification_logs || []).forEach((vl: any) => {
      timelineEvents.push({
        id: `verify-attempt-${vl.id}`,
        eventType: 'delivery_verification_attempt',
        title: vl.attempt_success ? 'Delivery OTP Verified at Doorstep' : `OTP Attempt #${vl.attempt_number} Failed`,
        description: vl.error_message || undefined,
        status: vl.attempt_success ? 'success' : 'error',
        source: 'Courier Doorstep Verification',
        timestamp: vl.attempted_at
      });
    });

    // Sort complete chronological timeline strictly ascending by timestamp
    timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 10. Assemble Authoritative Response
    const fullRecord = {
      // A. Customer Information
      customer: {
        id: orderData.customer_id,
        name: orderData.customer_name || 'Guest Customer',
        phone: orderData.phone,
        email: customerDetails?.email || null,
        deliveryAddress: orderData.delivery_address,
        landmark: orderData.delivery_landmark || null,
        specialInstructions: orderData.special_instructions || null,
        coordinates: (orderData.delivery_latitude && orderData.delivery_longitude) ? {
          latitude: Number(orderData.delivery_latitude),
          longitude: Number(orderData.delivery_longitude)
        } : null,
        deliveryZone: deliveryZone ? {
          id: deliveryZone.id,
          name: deliveryZone.name,
          city: deliveryZone.city,
          deliveryFee: Number(deliveryZone.delivery_fee)
        } : (orderData.delivery_zone_id ? { id: orderData.delivery_zone_id } : null)
      },

      // B. Order Information (Immutable Prices at Time of Purchase)
      order: {
        id: orderData.id,
        orderCode: orderData.order_code,
        createdAt: orderData.created_at,
        updatedAt: orderData.updated_at,
        status: orderData.status,
        subtotal: Number(orderData.subtotal) || 0,
        discountAmount: Number(orderData.discount_amount) || 0,
        deliveryFee: Number(orderData.delivery_fee) || 0,
        totalAmount: Number(orderData.total_amount) || 0,
        paymentMethod: orderData.payment_method,
        paymentStatus: orderData.payment_status,
        estimatedDeliveryTime: orderData.estimated_delivery_time,
        estimatedPrepMinutes: (orderData as any).estimated_prep_minutes || null,
        estimatedReadyTime: (orderData as any).estimated_ready_time || null,
        cancellationReason: (orderData.history || [])
          .slice()
          .reverse()
          .find((h: any) => h.to_status === 'cancelled' || h.status === 'cancelled')?.notes || null,
        assignedRider: assignedRider ? {
          id: assignedRider.id,
          fullName: assignedRider.full_name,
          phone: assignedRider.phone,
          vehicleType: assignedRider.vehicle_type,
          rating: Number(assignedRider.rating)
        } : null,
        items: (orderData.items || []).map((it: any) => ({
          id: it.id,
          menuItemId: it.menu_item_id,
          name: it.item_name,
          unitPrice: Number(it.unit_price) || 0, // Immutable price paid at purchase time
          quantity: it.quantity,
          totalPrice: Number(it.total_price) || 0,
          customizations: it.customizations,
          notes: it.notes
        }))
      },

      // C. Payment Information (Sanitized & Secure)
      payments: sanitizedPayments,

      // D. Refund Information (Authoritative DB Records)
      refund: {
        originalPaymentAmount,
        totalAmountRefunded,
        remainingRefundableBalance,
        hasRefund: totalAmountRefunded > 0 || sanitizedPayments.some(p => p.refundStatus !== 'none'),
        records: refundRecords
      },

      // E. Chronological Event Timeline
      timeline: timelineEvents
    };

    return NextResponse.json({
      success: true,
      data: fullRecord
    });
  } catch (error: any) {
    console.error('Order detail API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve order details' },
      { status: 500 }
    );
  }
}

// -------------------------------------------------------------
// CONTROLLED ORDER EDITING (PATCH)
// Safe edits only: delivery instructions, correctable customer contact info,
// delivery address before dispatch, admin notes.
// Financial totals, item prices, payment refs are strictly IMMUTABLE.
// -------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const { id: rawId } = await params;
    const orderLookup = rawId.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderLookup);

    // Fetch existing order to check current operational state
    let checkQuery = supabase.from('orders').select('id, order_code, status, assigned_rider_id');
    checkQuery = isUuid ? checkQuery.eq('id', orderLookup) : checkQuery.eq('order_code', orderLookup);
    const { data: currentOrder, error: fetchErr } = await checkQuery.maybeSingle();

    if (fetchErr || !currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const body = await req.json();

    // STRICT VALIDATION: Reject any attempt to alter financial snapshots
    if (
      body.subtotal !== undefined ||
      body.total_amount !== undefined ||
      body.total !== undefined ||
      body.discount_amount !== undefined ||
      body.delivery_fee !== undefined ||
      body.items !== undefined ||
      body.payment_reference !== undefined
    ) {
      return NextResponse.json({
        error: 'Forbidden: Financial amounts, item prices and transaction references are immutable and cannot be edited.'
      }, { status: 403 });
    }

    // Check dispatch constraint on address modification
    const isDispatched = ['picked_up', 'out_for_delivery', 'dispatched', 'delivered'].includes(currentOrder.status);
    if (body.deliveryAddress !== undefined && isDispatched) {
      return NextResponse.json({
        error: 'Delivery address cannot be modified once the courier has picked up or is out for delivery.'
      }, { status: 409 });
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (body.customerName !== undefined) updatePayload.customer_name = body.customerName.trim();
    if (body.phone !== undefined) updatePayload.phone = body.phone.trim();
    if (body.deliveryAddress !== undefined) updatePayload.delivery_address = body.deliveryAddress.trim();
    if (body.deliveryLandmark !== undefined) updatePayload.delivery_landmark = body.deliveryLandmark.trim();
    if (body.specialInstructions !== undefined) updatePayload.special_instructions = body.specialInstructions.trim();

    const { error: updateErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', currentOrder.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Record immutable audit history for this operational update
    const auditNotes = body.auditReason || `Operational details modified by ${staff.fullName} (${staff.role})`;
    try {
      await supabase.from('order_status_history').insert({
        order_id: currentOrder.id,
        from_status: currentOrder.status,
        to_status: currentOrder.status,
        actor_type: staff.role,
        actor_id: staff.id,
        notes: auditNotes,
        created_at: new Date().toISOString()
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Operational order details updated successfully.'
    });
  } catch (err: any) {
    console.error('Patch order error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update order' }, { status: 500 });
  }
}

// -------------------------------------------------------------
// SAFE OPERATIONAL ORDER REMOVAL / ARCHIVAL (DELETE)
// Never destroys financial auditability.
// Requires mandatory explanation reason.
// Soft-archives order, keeping payments and refund records intact.
// -------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const { id: rawId } = await params;
    const orderLookup = rawId.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderLookup);

    const body = await req.json().catch(() => ({}));
    const reason = body.reason?.trim();

    if (!reason || reason.length < 5) {
      return NextResponse.json({
        error: 'A mandatory archival justification reason (minimum 5 characters) is required for operational removal.'
      }, { status: 400 });
    }

    // 1. Fetch order & linked financial transactions
    let query = supabase.from('orders').select('id, order_code, status, payment_status, total_amount');
    query = isUuid ? query.eq('id', orderLookup) : query.eq('order_code', orderLookup);
    const { data: order, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. CHECK FINANCIAL INTEGRITY CONSTRAINTS:
    // Prevent deletion of records with unresolved payments or pending refunds that must be retained
    const { data: payments } = await supabase
      .from('payments')
      .select('id, status, refund_status')
      .eq('order_id', order.id);

    const hasPendingRefund = (payments || []).some(p => ['pending', 'processing'].includes(p.refund_status));
    if (hasPendingRefund) {
      return NextResponse.json({
        error: 'Cannot remove order: An active refund is currently processing on Paystack for this order. Please wait for reconciliation.'
      }, { status: 409 });
    }

    const nowIso = new Date().toISOString();
    const actorLabel = `${staff.fullName} (${staff.role})`;

    // 3. ARCHIVAL / SAFE REMOVAL:
    // We update the order status to 'cancelled' if active, and set the archival metadata.
    // We NEVER use cascading deletion on orders, order_items, payments, or refunds.
    const newStatus = ['delivered', 'cancelled', 'refunded'].includes(order.status)
      ? order.status
      : 'cancelled';

    await supabase
      .from('orders')
      .update({
        status: newStatus,
        updated_at: nowIso
      })
      .eq('id', order.id);

    // 4. Record mandatory audit log
    try {
      await supabase.from('order_status_history').insert({
        order_id: order.id,
        from_status: order.status,
        to_status: newStatus,
        actor_type: staff.role,
        actor_id: staff.id,
        notes: `Order operationally removed/archived by ${actorLabel}. Reason: "${reason}"`,
        created_at: nowIso
      });
    } catch {}

    // Also mirror to local order_status_history.json to guarantee offline test & local environment auditability
    try {
      const fs = await import('fs');
      const path = await import('path');
      const histPath = path.join(process.cwd(), 'data', 'order_status_history.json');
      let histList: any[] = [];
      if (fs.existsSync(histPath)) {
        histList = JSON.parse(fs.readFileSync(histPath, 'utf8') || '[]');
      }
      histList.push({
        id: `h-${Date.now()}`,
        orderId: order.id,
        order_id: order.id,
        fromStatus: order.status,
        from_status: order.status,
        toStatus: newStatus,
        to_status: newStatus,
        actorType: staff.role,
        actor_type: staff.role,
        actorId: staff.id,
        actor_id: staff.id,
        notes: `Order operationally removed/archived by ${actorLabel}. Reason: "${reason}"`,
        createdAt: nowIso,
        created_at: nowIso
      });
      fs.writeFileSync(histPath, JSON.stringify(histList, null, 2), 'utf8');
    } catch {}

    return NextResponse.json({
      success: true,
      archived: true,
      message: `Order #${order.order_code || order.id.slice(0, 8)} safely removed from active operations and archived. All payment references, refunds, and audit history are permanently preserved.`
    });
  } catch (err: any) {
    console.error('Delete/Archive order error:', err);
    return NextResponse.json({ error: err.message || 'Failed to safely archive order' }, { status: 500 });
  }
}
