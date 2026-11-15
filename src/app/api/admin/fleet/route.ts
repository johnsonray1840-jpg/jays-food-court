import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';
import { getOfferStats } from '@/lib/dispatch-pool-service';
import { getFleetAuditLogs } from '@/lib/fleet-audit';
import { getRiderAssignedZones, getEnuguZoneById } from '@/lib/enugu-zones-service';

export async function GET(req: NextRequest) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    // 1. Fetch all couriers from riders table
    const { data: ridersData, error: ridersErr } = await supabase
      .from('riders')
      .select('id, full_name, phone, vehicle_type, rating, is_active, is_available, created_at, updated_at')
      .order('full_name', { ascending: true });

    if (ridersErr) throw ridersErr;

    // 2. Fetch associated staff_profiles for account status & emails (excluding sensitive credentials/tokens)
    const { data: staffData } = await supabase
      .from('staff_profiles')
      .select('id, email, is_active, role')
      .in('id', (ridersData || []).map((r) => r.id));

    const staffMap = new Map((staffData || []).map((s) => [s.id, s]));

    // 3. Fetch active orders and orders awaiting assignment
    const { data: activeOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, order_code, customer_name, delivery_address, status, payment_status, total_amount, assigned_rider_id, created_at, updated_at')
      .in('status', ['ready_for_pickup', 'assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched']);

    if (ordersErr) throw ordersErr;

    // 4. Fetch completed delivery count per rider
    const { data: completedOrders } = await supabase
      .from('orders')
      .select('assigned_rider_id')
      .eq('status', 'delivered')
      .not('assigned_rider_id', 'is', null);

    const completedCounts: Record<string, number> = {};
    (completedOrders || []).forEach((o) => {
      if (o.assigned_rider_id) {
        completedCounts[o.assigned_rider_id] = (completedCounts[o.assigned_rider_id] || 0) + 1;
      }
    });

    // 5. Compute Fleet Metrics
    const totalActiveRiders = (ridersData || []).filter((r) => r.is_active).length;
    const ridersOnline = (ridersData || []).filter((r) => r.is_active && r.is_available).length;

    // Riders currently delivering (have an order in assigned_to_rider, picked_up, out_for_delivery)
    const inFlightOrderRiderIds = new Set(
      (activeOrders || [])
        .filter((o) => o.assigned_rider_id && ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status))
        .map((o) => o.assigned_rider_id)
    );

    const ridersDelivering = (ridersData || []).filter((r) => r.is_active && inFlightOrderRiderIds.has(r.id)).length;
    const ridersAvailable = (ridersData || []).filter(
      (r) => r.is_active && r.is_available && !inFlightOrderRiderIds.has(r.id)
    ).length;
    const ridersTemporarilyUnavailable = (ridersData || []).filter(
      (r) => r.is_active && !r.is_available
    ).length;

    const ordersAwaitingAssignment = (activeOrders || []).filter(
      (o) => o.status === 'ready_for_pickup' && !o.assigned_rider_id && o.payment_status === 'paid'
    );

    const activeDeliveryAssignments = (activeOrders || []).filter(
      (o) => o.assigned_rider_id && ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status)
    );

    const offerStats = getOfferStats();

    // 6. Build Rider Monitoring Rows
    const ridersRoster = (ridersData || []).map((rider) => {
      const staffInfo = staffMap.get(rider.id);
      const activeOrder = activeDeliveryAssignments.find((o) => o.assigned_rider_id === rider.id);

      // Account status: active, suspended, deactivated
      let accountStatus: 'active' | 'suspended' | 'deactivated' = 'active';
      if (!rider.is_active || staffInfo?.is_active === false) {
        accountStatus = 'suspended';
      }

      // Online/Offline status
      const isOnline = Boolean(rider.is_active && rider.is_available);
      const isDelivering = inFlightOrderRiderIds.has(rider.id);

      const assignedZoneIds = getRiderAssignedZones(rider.id);
      let assignedZoneName = 'All Enugu Zones';
      if (assignedZoneIds.length > 0) {
        assignedZoneName = assignedZoneIds.map(zid => getEnuguZoneById(zid).name).join(', ');
      }

      return {
        id: rider.id,
        fullName: rider.full_name,
        phone: rider.phone,
        email: staffInfo?.email || null,
        vehicleType: rider.vehicle_type || 'Motorcycle',
        accountStatus,
        isOnline,
        isAvailable: Boolean(rider.is_available),
        isDelivering,
        assignedServiceZone: assignedZoneName,
        assignedZoneIds,
        currentDelivery: activeOrder
          ? {
              orderId: activeOrder.id,
              orderCode: activeOrder.order_code,
              status: activeOrder.status,
              totalAmount: activeOrder.total_amount,
              deliveryAddress: activeOrder.delivery_address
            }
          : null,
        lastGps: null,
        completedDeliveriesCount: completedCounts[rider.id] || 0
      };
    });

    const recentAuditLogs = getFleetAuditLogs(15);

    return NextResponse.json({
      success: true,
      metrics: {
        totalActiveRiders,
        ridersOnline,
        ridersAvailable,
        ridersDelivering,
        ridersTemporarilyUnavailable,
        ordersAwaitingAssignmentCount: ordersAwaitingAssignment.length,
        activeDeliveryAssignmentsCount: activeDeliveryAssignments.length,
        expiredOffersCount: offerStats.expiredOfferCount,
        rejectedOffersCount: offerStats.rejectedOfferCount
      },
      ordersAwaitingAssignment: ordersAwaitingAssignment.map((o) => ({
        id: o.id,
        orderCode: o.order_code,
        deliveryAddress: o.delivery_address,
        status: o.status,
        totalAmount: o.total_amount,
        createdAt: o.created_at
      })),
      activeDeliveryAssignments: activeDeliveryAssignments.map((o) => ({
        id: o.id,
        orderCode: o.order_code,
        assignedRiderId: o.assigned_rider_id,
        status: o.status,
        deliveryAddress: o.delivery_address,
        totalAmount: o.total_amount,
        updatedAt: o.updated_at
      })),
      riders: ridersRoster,
      auditLogs: recentAuditLogs,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch fleet overview' }, { status: 500 });
  }
}
