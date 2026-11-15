import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';
import { normalizeNigerianPhone } from '@/lib/phone';
import { recordFleetAuditLog } from '@/lib/fleet-audit';
import { setRiderAssignedZones } from '@/lib/enugu-zones-service';

export const dynamic = 'force-dynamic';

const updateRiderSchema = z.object({
  fullName: z.string().trim().min(2, 'Full legal name is required').optional(),
  phone: z.string().trim().min(10, 'Valid Nigerian phone number is required').optional(),
  vehicleType: z.string().trim().optional(),
  vehicleRegistration: z.string().trim().optional().nullable(),
  operationalZoneId: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  status: z.enum(['active', 'suspended', 'deactivated', 'archived']).optional()
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse) return errorResponse;

  try {
    const { id: riderId } = await params;
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // 1. Fetch rider operational profile
    const { data: rider } = await supabase
      .from('riders')
      .select('*')
      .eq('id', riderId)
      .maybeSingle();

    // 2. Fetch staff profile
    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('id', riderId)
      .maybeSingle();

    if (!rider && !staffProfile) {
      return NextResponse.json({ error: 'Courier not found' }, { status: 404 });
    }

    // 3. Fetch delivery history for this courier
    const { data: orderHistory } = await supabase
      .from('orders')
      .select('id, order_code, status, total_amount, delivery_address, created_at, updated_at')
      .eq('assigned_rider_id', riderId)
      .order('created_at', { ascending: false });

    const completedOrders = (orderHistory || []).filter(o => o.status === 'delivered');
    const activeOrder = (orderHistory || []).find(o =>
      ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status)
    );
    const failedOrCancelledOrders = (orderHistory || []).filter(o =>
      ['cancelled', 'failed'].includes(o.status)
    );

    return NextResponse.json({
      rider: {
        id: riderId,
        fullName: rider?.full_name || staffProfile?.full_name || 'Courier',
        phone: rider?.phone || '',
        email: staffProfile?.email || '',
        vehicleType: rider?.vehicle_type || 'Motorcycle',
        vehicleRegistration: rider?.vehicle_registration || null,
        operationalZoneId: rider?.operational_zone_id || null,
        rating: rider?.rating || 5.0,
        isActive: rider?.is_active ?? staffProfile?.is_active ?? false,
        isAvailable: rider?.is_available ?? false,
        status: rider?.status || (staffProfile?.is_active ? 'active' : 'deactivated'),
        createdAt: rider?.created_at || staffProfile?.created_at,
        updatedAt: rider?.updated_at || staffProfile?.updated_at
      },
      metrics: {
        totalAssigned: (orderHistory || []).length,
        completedCount: completedOrders.length,
        cancelledCount: failedOrCancelledOrders.length,
        hasActiveDelivery: !!activeOrder
      },
      activeDelivery: activeOrder || null,
      history: orderHistory || []
    });
  } catch (err: any) {
    console.error('Fetch rider profile error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch courier details' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Update Rider Profile & Vehicle Information
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const { id: riderId } = await params;
    const body = await req.json();
    const parsed = updateRiderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 });
    }

    const {
      fullName,
      phone,
      vehicleType,
      vehicleRegistration,
      operationalZoneId,
      isActive,
      isAvailable,
      status
    } = parsed.data;

    const normalizedPhone = phone ? normalizeNigerianPhone(phone) || phone : undefined;
    const nowIso = new Date().toISOString();

    // 1. Update riders table
    const riderUpdates: any = { updated_at: nowIso };
    if (fullName !== undefined) riderUpdates.full_name = fullName;
    if (normalizedPhone !== undefined) riderUpdates.phone = normalizedPhone;
    if (vehicleType !== undefined) riderUpdates.vehicle_type = vehicleType;
    if (vehicleRegistration !== undefined) riderUpdates.vehicle_registration = vehicleRegistration;
    if (operationalZoneId !== undefined) riderUpdates.operational_zone_id = operationalZoneId;
    if (isActive !== undefined) riderUpdates.is_active = isActive;
    if (isAvailable !== undefined) riderUpdates.is_available = isAvailable;
    if (status !== undefined) riderUpdates.status = status;

    await supabase.from('riders').update(riderUpdates).eq('id', riderId);

    // 2. Update staff_profiles table
    const staffUpdates: any = {};
    if (fullName !== undefined) staffUpdates.full_name = fullName;
    if (isActive !== undefined) staffUpdates.is_active = isActive;

    if (Object.keys(staffUpdates).length > 0) {
      await supabase.from('staff_profiles').update(staffUpdates).eq('id', riderId);
    }

    // 3. Update zone service if provided
    if (operationalZoneId !== undefined) {
      setRiderAssignedZones(riderId, operationalZoneId ? [operationalZoneId] : [], staff.fullName);
    }

    // 4. Record Audit Log
    await recordFleetAuditLog({
      action: 'courier_profile_update',
      actorId: staff.id,
      actorEmail: staff.email,
      actorRole: staff.role,
      targetId: riderId,
      targetType: 'rider',
      reason: 'Administrator updated courier profile and operational settings',
      metadata: riderUpdates
    });

    return NextResponse.json({
      success: true,
      message: `Courier details updated successfully by ${staff.fullName}`
    });
  } catch (err: any) {
    console.error('Update rider error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update courier profile' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SAFE RIDER DELETION / ARCHIVAL
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const { id: riderId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason?.trim() || 'Administrative courier deactivation';

    // REQUIREMENT: Do not allow deletion of a rider with an active delivery until that delivery is safely reassigned or resolved!
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, order_code, status')
      .eq('assigned_rider_id', riderId)
      .in('status', ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched']);

    if (activeOrders && activeOrders.length > 0) {
      const activeCode = activeOrders[0].order_code || activeOrders[0].id.slice(0, 8);
      return NextResponse.json({
        error: `Cannot deactivate or delete courier: Courier is currently responsible for active delivery #${activeCode}. Please reassign or complete the delivery before deactivating.`
      }, { status: 409 });
    }

    // Check if courier has historical completed orders
    const { count: historicalOrdersCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_rider_id', riderId);

    const nowIso = new Date().toISOString();

    // SOFT DELETION / ARCHIVAL: Preserve historical accountability and audit logs
    if (historicalOrdersCount && historicalOrdersCount > 0) {
      await supabase
        .from('riders')
        .update({
          is_active: false,
          is_available: false,
          status: 'archived',
          updated_at: nowIso
        })
        .eq('id', riderId);

      await supabase
        .from('staff_profiles')
        .update({ is_active: false })
        .eq('id', riderId);

      try {
        await supabase.auth.admin.updateUserById(riderId, { ban_duration: '87600h' });
      } catch {}

      await recordFleetAuditLog({
        action: 'courier_archived',
        actorId: staff.id,
        actorEmail: staff.email,
        actorRole: staff.role,
        targetId: riderId,
        targetType: 'rider',
        reason,
        metadata: { historicalOrdersCount, action: 'soft_delete_archive' }
      });

      return NextResponse.json({
        success: true,
        archived: true,
        message: `Courier has historical delivery records and was safely archived. Account is permanently deactivated and barred from dispatch.`
      });
    }

    // If completely new with 0 order history, remove from operational tables safely
    await supabase.from('riders').delete().eq('id', riderId);
    await supabase.from('staff_profiles').delete().eq('id', riderId);
    try {
      await supabase.auth.admin.deleteUser(riderId);
    } catch {}

    await recordFleetAuditLog({
      action: 'courier_deleted',
      actorId: staff.id,
      actorEmail: staff.email,
      actorRole: staff.role,
      targetId: riderId,
      targetType: 'rider',
      reason,
      metadata: { action: 'hard_delete_clean' }
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      message: `Courier record successfully removed.`
    });
  } catch (err: any) {
    console.error('Delete rider error:', err);
    return NextResponse.json({ error: err.message || 'Failed to safely remove courier' }, { status: 500 });
  }
}
