import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';
import { recordFleetAuditLog } from '@/lib/fleet-audit';
import { setRiderAssignedZones } from '@/lib/enugu-zones-service';

const fleetActionSchema = z.object({
  action: z.enum([
    'suspend_rider',
    'reactivate_rider',
    'mark_unavailable',
    'reassign_order',
    'investigate_failed_assignment',
    'update_rider_zone'
  ]),
  targetId: z.string(), // riderId or orderId
  reason: z.string().min(3, 'Audit justification reason is required'),
  newRiderId: z.string().optional(), // required for reassign_order
  zoneId: z.string().optional() // required for update_rider_zone
});

export async function POST(req: NextRequest) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const parsed = fleetActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { action, targetId, reason, newRiderId, zoneId } = parsed.data;

    // 0. UPDATE RIDER ZONE
    if (action === 'update_rider_zone') {
      const riderId = targetId;
      setRiderAssignedZones(riderId, zoneId ? [zoneId] : [], staff.fullName);

      await recordFleetAuditLog({
        action: 'zone_update',
        actorId: staff.id,
        actorEmail: staff.email,
        actorRole: staff.role,
        targetId: riderId,
        targetType: 'rider',
        reason,
        metadata: { zoneId: zoneId || 'all_zones' }
      });

      return NextResponse.json({
        success: true,
        message: `Courier service zone updated. Reason logged: "${reason}".`
      });
    }

    // 1. SUSPEND RIDER
    if (action === 'suspend_rider') {
      const riderId = targetId;
      await supabase
        .from('riders')
        .update({ is_active: false, is_available: false, updated_at: new Date().toISOString() })
        .eq('id', riderId);

      await supabase
        .from('staff_profiles')
        .update({ is_active: false })
        .eq('id', riderId);

      try {
        await supabase.auth.admin.updateUserById(riderId, { ban_duration: '87600h' });
      } catch {}

      await recordFleetAuditLog({
        action: 'suspend_rider',
        actorId: staff.id,
        actorEmail: staff.email,
        actorRole: staff.role,
        targetId: riderId,
        targetType: 'rider',
        reason,
        metadata: { status: 'suspended' }
      });

      return NextResponse.json({
        success: true,
        message: `Rider account suspended successfully. Reason logged: "${reason}".`
      });
    }

    // 2. REACTIVATE RIDER
    if (action === 'reactivate_rider') {
      const riderId = targetId;
      await supabase
        .from('riders')
        .update({ is_active: true, is_available: true, updated_at: new Date().toISOString() })
        .eq('id', riderId);

      await supabase
        .from('staff_profiles')
        .update({ is_active: true })
        .eq('id', riderId);

      try {
        await supabase.auth.admin.updateUserById(riderId, { ban_duration: 'none' });
      } catch {}

      await recordFleetAuditLog({
        action: 'reactivate_rider',
        actorId: staff.id,
        actorEmail: staff.email,
        actorRole: staff.role,
        targetId: riderId,
        targetType: 'rider',
        reason,
        metadata: { status: 'active' }
      });

      return NextResponse.json({
        success: true,
        message: `Rider account reactivated successfully. Reason logged: "${reason}".`
      });
    }

    // 3. MARK RIDER UNAVAILABLE (Operationally Justified)
    if (action === 'mark_unavailable') {
      const riderId = targetId;
      await supabase
        .from('riders')
        .update({ is_available: false, updated_at: new Date().toISOString() })
        .eq('id', riderId);

      await recordFleetAuditLog({
        action: 'mark_unavailable',
        actorId: staff.id,
        actorEmail: staff.email,
        actorRole: staff.role,
        targetId: riderId,
        targetType: 'rider',
        reason,
        metadata: { is_available: false }
      });

      return NextResponse.json({
        success: true,
        message: `Rider marked temporarily unavailable. Reason logged: "${reason}".`
      });
    }

    // 4. INVESTIGATE FAILED ASSIGNMENT
    if (action === 'investigate_failed_assignment') {
      const orderId = targetId;
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_code, status, assigned_rider_id, updated_at')
        .or(`id.eq.${orderId},order_code.eq.${orderId}`)
        .maybeSingle();

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const { data: statusHistory } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });

      await recordFleetAuditLog({
        action: 'investigate_failed_assignment',
        actorId: staff.id,
        actorEmail: staff.email,
        actorRole: staff.role,
        targetId: order.id,
        targetType: 'order',
        reason,
        metadata: { orderCode: order.order_code, historyCount: statusHistory?.length || 0 }
      });

      return NextResponse.json({
        success: true,
        order,
        statusHistory: statusHistory || [],
        message: `Investigation completed for order #${order.order_code}. Audit entry recorded.`
      });
    }

    // 5. INITIATE AUTHORIZED REASSIGNMENT
    if (action === 'reassign_order') {
      const orderId = targetId;
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_code, status, assigned_rider_id')
        .or(`id.eq.${orderId},order_code.eq.${orderId}`)
        .maybeSingle();

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const previousRiderId = order.assigned_rider_id;

      if (newRiderId) {
        // Direct reassignment to specific active rider
        const { data: newRider } = await supabase
          .from('riders')
          .select('id, full_name, is_active')
          .eq('id', newRiderId)
          .maybeSingle();

        if (!newRider || !newRider.is_active) {
          return NextResponse.json({ error: 'Selected replacement rider is inactive or invalid.' }, { status: 422 });
        }

        const { error: updateErr } = await supabase
          .from('orders')
          .update({
            assigned_rider_id: newRiderId,
            status: 'assigned_to_rider',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (updateErr) throw updateErr;

        await recordFleetAuditLog({
          action: 'reassign_order',
          actorId: staff.id,
          actorEmail: staff.email,
          actorRole: staff.role,
          targetId: order.id,
          targetType: 'order',
          reason,
          metadata: {
            orderCode: order.order_code,
            previousRiderId,
            newRiderId,
            newRiderName: newRider.full_name,
            fromStatus: order.status,
            toStatus: 'assigned_to_rider'
          }
        });

        return NextResponse.json({
          success: true,
          message: `Order #${order.order_code} reassigned to ${newRider.full_name}. Previous assignment preserved in audit logs.`
        });
      } else {
        // Return order back to shared dispatch pool for eligible couriers
        const { error: updateErr } = await supabase
          .from('orders')
          .update({
            assigned_rider_id: null,
            status: 'ready_for_pickup',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (updateErr) throw updateErr;

        await recordFleetAuditLog({
          action: 'reassign_order',
          actorId: staff.id,
          actorEmail: staff.email,
          actorRole: staff.role,
          targetId: order.id,
          targetType: 'order',
          reason,
          metadata: {
            orderCode: order.order_code,
            previousRiderId,
            releasedToPool: true,
            fromStatus: order.status,
            toStatus: 'ready_for_pickup'
          }
        });

        return NextResponse.json({
          success: true,
          message: `Order #${order.order_code} released back to the shared dispatch pool. Previous assignment preserved in audit logs.`
        });
      }
    }

    return NextResponse.json({ error: 'Invalid fleet action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Action execution failed' }, { status: 500 });
  }
}
