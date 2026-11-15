import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';

const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean()
});

// GET /api/riders/me - Rider's own profile, availability status, active delivery & private delivery history
export async function GET(req: NextRequest) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['rider', 'admin', 'manager', 'owner']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const riderId = staff.id;

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

    // 3. Fetch strictly this rider's own orders (Privacy isolation)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_code, status, total_amount, delivery_address, created_at, updated_at')
      .eq('assigned_rider_id', riderId)
      .order('created_at', { ascending: false });

    const completed = (orders || []).filter(o => o.status === 'delivered');
    const cancelled = (orders || []).filter(o => ['cancelled', 'failed'].includes(o.status));
    const active = (orders || []).find(o =>
      ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status)
    );

    return NextResponse.json({
      rider: {
        id: riderId,
        fullName: rider?.full_name || staffProfile?.full_name || staff.fullName,
        email: staffProfile?.email || staff.email,
        phone: rider?.phone || '',
        vehicleType: rider?.vehicle_type || 'Motorcycle',
        rating: rider?.rating || 5.0,
        isActive: rider?.is_active ?? staffProfile?.is_active ?? true,
        isAvailable: rider?.is_available ?? false
      },
      activeDelivery: active || null,
      history: {
        completed,
        cancelled,
        totalDeliveries: completed.length
      }
    });
  } catch (err: any) {
    console.error('Fetch rider me error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/riders/me - Rider explicitly sets their operational availability (Online / Offline / Unavailable)
export async function PATCH(req: NextRequest) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['rider', 'admin', 'manager', 'owner']);
  if (errorResponse || !staff) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = updateAvailabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { isAvailable } = parsed.data;
    const riderId = staff.id;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // Verify rider account is active before allowing them to go online
    const { data: riderProfile } = await supabase
      .from('riders')
      .select('id, is_active, status')
      .eq('id', riderId)
      .maybeSingle();

    if (riderProfile && !riderProfile.is_active) {
      return NextResponse.json({ error: 'Account is suspended or inactive. You cannot go online.' }, { status: 403 });
    }

    const { error: updErr } = await supabase
      .from('riders')
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString()
      })
      .eq('id', riderId);

    if (updErr) {
      // If no row exists yet in riders table, upsert it
      await supabase.from('riders').upsert({
        id: riderId,
        full_name: staff.fullName,
        phone: '',
        vehicle_type: 'Motorcycle',
        is_active: true,
        is_available: isAvailable,
        updated_at: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      isAvailable,
      message: isAvailable ? 'You are now ONLINE and will receive delivery offers.' : 'You are now OFFLINE. Delivery offers paused.'
    });
  } catch (err: any) {
    console.error('Update availability error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
