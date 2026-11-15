import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';
import { JFC_KITCHEN_COORDINATES } from '@/lib/enugu-geocoding';
import { resolveZoneFromAddress, isRiderEligibleForZone } from '@/lib/enugu-zones-service';
import { getOfferRecord } from '@/lib/dispatch-pool-service';

// GET /api/dispatch/offers - Retrieve eligible, unassigned delivery offers for authenticated, active, online riders
export async function GET(req: NextRequest) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['rider', 'admin', 'manager', 'owner']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const riderId = staff.id;

    // 1. Verify Rider Eligibility Criteria:
    // - Must be role: 'rider' (or admin/owner testing)
    // - Must be active and online (is_available = true)
    // - Must not exceed capacity (1 active delivery limit)
    if (staff.role === 'rider') {
      const { data: riderProfile } = await supabase
        .from('riders')
        .select('id, full_name, is_active, is_available')
        .eq('id', riderId)
        .maybeSingle();

      if (!riderProfile || !riderProfile.is_active) {
        return NextResponse.json(
          { error: 'Rider account is suspended or inactive. Offers unavailable.' },
          { status: 403 }
        );
      }

      if (!riderProfile.is_available) {
        return NextResponse.json({
          offers: [],
          status: 'offline',
          message: 'You are currently offline. Switch status to Online to view delivery offers.'
        });
      }

      // Check current active delivery capacity (strict 1-order capacity rule)
      const { data: activeDeliveries } = await supabase
        .from('orders')
        .select('id, order_code, status')
        .eq('assigned_rider_id', riderId)
        .in('status', ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched']);

      if (activeDeliveries && activeDeliveries.length > 0) {
        return NextResponse.json({
          offers: [],
          status: 'capacity_reached',
          activeDelivery: activeDeliveries[0],
          message: `Capacity limit reached (1 active delivery max). Complete order #${activeDeliveries[0].order_code} first.`
        });
      }
    }

    // 2. Query orders that are strictly ready_for_pickup, paid, and unassigned
    const { data: poolOrders, error: poolErr } = await supabase
      .from('orders')
      .select(`
        id,
        order_code,
        delivery_address,
        subtotal,
        delivery_fee,
        total_amount,
        estimated_delivery_time,
        status,
        payment_status,
        assigned_rider_id,
        created_at,
        updated_at,
        order_items (
          id,
          item_name,
          quantity,
          unit_price
        )
      `)
      .eq('status', 'ready_for_pickup')
      .eq('payment_status', 'paid')
      .is('assigned_rider_id', null)
      .order('created_at', { ascending: true });

    if (poolErr) {
      console.error('Dispatch pool query error:', poolErr.message);
      return NextResponse.json({ error: poolErr.message }, { status: 500 });
    }

    const now = Date.now();
    const eligibleOffers = (poolOrders || [])
      .map((order) => {
        const record = getOfferRecord(order.id, order.order_code);
        const remainingSeconds = Math.max(0, Math.floor((record.expiresAt - now) / 1000));

        // Skip if this specific rider previously rejected this offer
        if (record.rejectedByRiderIds.has(riderId)) {
          return null;
        }

        // Zone-based dispatch eligibility guard
        const orderZone = resolveZoneFromAddress(order.delivery_address);
        if (staff.role === 'rider' && !isRiderEligibleForZone(riderId, orderZone.id)) {
          return null;
        }

        return {
          id: order.id,
          orderCode: order.order_code,
          pickupLocation: {
            name: "Jay's Food Court Kitchen Hub",
            address: "Ndiagu Ugwu, Agbani, Enugu State",
            latitude: JFC_KITCHEN_COORDINATES.latitude,
            longitude: JFC_KITCHEN_COORDINATES.longitude
          },
          deliveryAddress: order.delivery_address,
          totalAmount: Number(order.total_amount),
          deliveryFee: Number(order.delivery_fee),
          itemCount: (order.order_items || []).reduce((acc: number, item: any) => acc + (item.quantity || 1), 0),
          estimatedTime: order.estimated_delivery_time || '18 - 25 Mins',
          offerExpiresInSeconds: remainingSeconds > 0 ? remainingSeconds : 300,
          createdMinutesAgo: Math.floor((now - new Date(order.created_at).getTime()) / 60000)
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      offers: eligibleOffers,
      totalAvailable: eligibleOffers.length,
      status: 'online'
    });
  } catch (err: any) {
    console.error('Dispatch offers route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
