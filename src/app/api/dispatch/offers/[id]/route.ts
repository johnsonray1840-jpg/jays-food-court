import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';
import { recordOfferRejection } from '@/lib/dispatch-pool-service';
import { resolveZoneFromAddress, isRiderEligibleForZone } from '@/lib/enugu-zones-service';

const offerActionSchema = z.object({
  action: z.enum(['accept', 'reject'])
});

// POST /api/dispatch/offers/[id] - Rider accepts or rejects a specific delivery offer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['rider', 'admin', 'manager', 'owner']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id: orderId } = await params;
    const body = await req.json();
    const parsed = offerActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { action } = parsed.data;
    const riderId = staff.id;
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // 1. If REJECT: Record the rejection so this rider does not see it again, but order remains available for other riders
    if (action === 'reject') {
      recordOfferRejection(orderId, riderId);
      return NextResponse.json({
        success: true,
        action: 'rejected',
        message: 'Offer declined. The order remains available for other fleet couriers.'
      });
    }

    // 2. If ACCEPT: Atomically claim the order using strict first-to-claim CAS locking
    // Check rider eligibility: must be active and not exceed capacity (1 order)
    if (staff.role === 'rider') {
      const { data: riderProfile } = await supabase
        .from('riders')
        .select('id, full_name, phone, rating, is_active, is_available')
        .eq('id', riderId)
        .maybeSingle();

      if (!riderProfile || !riderProfile.is_active) {
        return NextResponse.json({ error: 'Rider account is suspended or inactive.' }, { status: 403 });
      }

      const { data: activeDeliveries } = await supabase
        .from('orders')
        .select('id, order_code, status')
        .eq('assigned_rider_id', riderId)
        .in('status', ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched']);

      if (activeDeliveries && activeDeliveries.length > 0) {
        return NextResponse.json(
          { error: `Capacity limit reached: You currently have active delivery #${activeDeliveries[0].order_code}.` },
          { status: 422 }
        );
      }

      // Verify zone dispatch eligibility before atomic lock
      const { data: targetOrder } = await supabase
        .from('orders')
        .select('delivery_address')
        .eq('id', orderId)
        .maybeSingle();

      if (targetOrder?.delivery_address) {
        const orderZone = resolveZoneFromAddress(targetOrder.delivery_address);
        if (!isRiderEligibleForZone(riderId, orderZone.id)) {
          return NextResponse.json(
            { error: `Zone mismatch: You are not eligible to claim deliveries in "${orderZone.name}".` },
            { status: 403 }
          );
        }
      }
    }

    // Atomic conditional claim: order must be ready_for_pickup, paid, and assigned_rider_id IS NULL
    const { data: claimedOrder, error: claimErr } = await supabase
      .from('orders')
      .update({
        assigned_rider_id: riderId,
        status: 'assigned_to_rider',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('status', 'ready_for_pickup')
      .eq('payment_status', 'paid')
      .is('assigned_rider_id', null)
      .select('id, order_code, delivery_address, total_amount, status, assigned_rider_id')
      .maybeSingle();

    if (claimErr) {
      console.error('Atomic claim database error:', claimErr.message);
      return NextResponse.json({ error: 'Database error claiming offer' }, { status: 500 });
    }

    // Race condition check: If another courier claimed it milliseconds earlier, claimedOrder will be null
    if (!claimedOrder) {
      return NextResponse.json(
        {
          error: 'ORDER_ALREADY_ASSIGNED: Another courier claimed this delivery offer first.',
          code: 'COLLISION_REJECTED'
        },
        { status: 409 }
      );
    }

    // Record order status history
    try {
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: 'assigned_to_rider',
        actor_role: 'rider',
        actor_id: riderId,
        note: `Delivery offer accepted and claimed by courier ${staff.fullName}`
      });
    } catch {
      // Non-blocking history record
    }

    return NextResponse.json({
      success: true,
      action: 'accepted',
      assignedOrder: claimedOrder,
      message: `Delivery #${claimedOrder.order_code} successfully assigned to you! Proceed to kitchen for pickup.`
    });
  } catch (err: any) {
    console.error('Offer action route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
