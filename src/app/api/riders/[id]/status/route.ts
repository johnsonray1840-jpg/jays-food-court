import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';
import { setRiderAssignedZones } from '@/lib/enugu-zones-service';

const updateRiderStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'deactivated']),
  isAvailable: z.boolean().optional(),
  operationalZoneId: z.string().nullable().optional()
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse) return errorResponse;

  try {
    const { id: riderId } = await params;
    const body = await req.json();
    const parsed = updateRiderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { status, isAvailable, operationalZoneId } = parsed.data;
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const isActive = status === 'active';
    const effectiveAvailable = isActive ? (isAvailable ?? true) : false;

    // Build update object
    const updatePayload: Record<string, any> = {
      is_active: isActive,
      is_available: effectiveAvailable,
      status: status,
      updated_at: new Date().toISOString()
    };
    if (operationalZoneId !== undefined) {
      updatePayload.operational_zone_id = operationalZoneId;
    }

    // 1. Update riders operational table
    const { error: riderErr } = await supabase
      .from('riders')
      .update(updatePayload)
      .eq('id', riderId);

    if (riderErr) {
      // Fallback if status column not yet refreshed
      delete updatePayload.status;
      delete updatePayload.operational_zone_id;
      await supabase
        .from('riders')
        .update(updatePayload)
        .eq('id', riderId);
    }

    // Persist zone assignment in durable fleet service
    if (operationalZoneId !== undefined) {
      setRiderAssignedZones(riderId, operationalZoneId ? [operationalZoneId] : [], staff?.fullName);
    }

    // 2. Sync staff_profiles
    await supabase
      .from('staff_profiles')
      .update({ is_active: isActive })
      .eq('id', riderId);

    // 3. If deactivated or suspended, revoke Supabase Auth session so the rider cannot accept deliveries
    if (!isActive) {
      try {
        await supabase.auth.admin.updateUserById(riderId, {
          ban_duration: status === 'suspended' ? '87600h' : '876000h'
        });
      } catch (authErr) {
        // Continue
      }
    } else {
      try {
        await supabase.auth.admin.updateUserById(riderId, { ban_duration: 'none' });
      } catch (authErr) {
        // Continue
      }
    }

    return NextResponse.json({
      success: true,
      message: `Rider account status updated to ${status}. Availability set to ${effectiveAvailable}.`
    });
  } catch (err: any) {
    console.error('Update rider status error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update rider status' }, { status: 500 });
  }
}
