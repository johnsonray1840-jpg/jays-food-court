import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAuthorization } from '@/lib/auth';
import { ENUGU_LOCATION_ZONES } from '@/lib/enugu-geocoding';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  getActiveEnuguDeliveryZones,
  readZoneOverrides,
  writeZoneOverrides
} from '@/lib/enugu-zones-service';

const updateZoneSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  city: z.string().min(2).max(50).optional(),
  deliveryFee: z.number().int().min(0).max(50000).optional(),
  minOrderAmount: z.number().int().min(0).max(100000).optional(),
  estimatedTime: z.string().min(3).max(50).optional(),
  isActive: z.boolean().optional(),
  adminNotes: z.string().max(300).optional(),
  latitude: z.number().min(5.90).max(7.15).optional(),
  longitude: z.number().min(7.05).max(7.85).optional()
});

export async function GET(req: NextRequest) {
  try {
    const zones = getActiveEnuguDeliveryZones();
    return NextResponse.json({
      success: true,
      zones
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve delivery zones' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Only Restaurant Owner, Admin, or General Manager can alter delivery pricing
    const { staff, errorResponse } = await requireStaffAuthorization(req, [
      'owner',
      'admin',
      'manager'
    ]);

    if (errorResponse) return errorResponse;

    const rawBody = await req.json();
    const parseRes = updateZoneSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return NextResponse.json(
        { error: parseRes.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { zoneId, name, city, deliveryFee, minOrderAmount, estimatedTime, isActive, adminNotes, latitude, longitude } = parseRes.data;

    // Verify zone exists in canonical list
    const canonicalZone = ENUGU_LOCATION_ZONES.find((z) => z.id === zoneId);
    if (!canonicalZone) {
      return NextResponse.json(
        { error: `Zone with ID "${zoneId}" does not exist in Enugu territory catalog.` },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        await supabase
          .from('delivery_zones')
          .upsert({
            id: zoneId,
            name: name ?? canonicalZone.name,
            delivery_fee: deliveryFee ?? canonicalZone.deliveryFee,
            min_order_amount: minOrderAmount ?? canonicalZone.minOrderAmount,
            estimated_delivery_time: estimatedTime ?? canonicalZone.estimatedTime,
            updated_at: nowIso
          });
      } catch (dbErr) {
        console.warn('Supabase delivery_zones upsert failed, persisting to local store:', dbErr);
      }
    }

    // Persist to local overrides
    const currentOverrides = readZoneOverrides();
    const prevZone = currentOverrides[zoneId] || canonicalZone;
    const staffAudit = staff ? `${staff.fullName} (${staff.role})` : 'Authorized Owner/Manager';

    currentOverrides[zoneId] = {
      ...(currentOverrides[zoneId] || {}),
      ...(name !== undefined ? { name } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(deliveryFee !== undefined ? { deliveryFee } : {}),
      ...(minOrderAmount !== undefined ? { minOrderAmount } : {}),
      ...(estimatedTime !== undefined ? { estimatedTime } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(adminNotes !== undefined ? { adminNotes } : {}),
      ...(latitude !== undefined && longitude !== undefined ? { center: { latitude, longitude } } : {}),
      updatedAt: nowIso,
      lastModifiedBy: staffAudit,
      previousDeliveryFee: prevZone.deliveryFee
    };
    writeZoneOverrides(currentOverrides);

    const updatedZones = getActiveEnuguDeliveryZones();
    const updated = updatedZones.find((z) => z.id === zoneId);

    return NextResponse.json({
      success: true,
      message: `Zone "${canonicalZone.name}" delivery configuration updated successfully by ${staff?.fullName}`,
      zone: updated
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update delivery settings' },
      { status: 500 }
    );
  }
}
