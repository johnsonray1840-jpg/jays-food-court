import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const completeOnboardingSchema = z.object({
  email: z.string().trim().email(),
  token: z.string().trim().min(32),
  password: z.string().min(8, 'Password must be at least 8 characters long')
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = completeOnboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { email, token, password } = parsed.data;
    const cleanEmail = email.toLowerCase();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // 1. Verify invitation token and expiration
    const { data: invitation, error: invErr } = await supabase
      .from('rider_invitations')
      .select('*')
      .eq('email', cleanEmail)
      .eq('invitation_token_hash', tokenHash)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (invErr || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired courier invitation link.' }, { status: 400 });
    }

    // 2. Create actual Supabase Auth User with their confidential password
    let userId: string;
    const { data: newUser, error: createAuthErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: invitation.full_name,
        role: 'rider'
      }
    });

    if (createAuthErr) {
      // Check if user already exists in auth
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const match = existingUsers?.users?.find((u) => u.email === cleanEmail);
      if (match) {
        userId = match.id;
        await supabase.auth.admin.updateUserById(userId, { password });
      } else {
        return NextResponse.json({ error: createAuthErr.message }, { status: 400 });
      }
    } else {
      userId = newUser.user.id;
    }

    // 3. Create verified staff_profile
    await supabase.from('staff_profiles').upsert({
      id: userId,
      email: cleanEmail,
      full_name: invitation.full_name,
      role: 'rider',
      is_active: true
    });

    // 4. Create active rider record in riders table
    await supabase.from('riders').upsert({
      id: userId,
      full_name: invitation.full_name,
      phone: invitation.phone,
      vehicle_type: 'Motorcycle',
      rating: 5.0,
      is_active: true,
      is_available: true,
      status: 'active',
      operational_zone_id: invitation.operational_zone_id,
      activated_at: new Date().toISOString()
    });

    // 5. Mark invitation as accepted
    await supabase
      .from('rider_invitations')
      .update({
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', invitation.id);

    return NextResponse.json({
      success: true,
      message: 'Account successfully activated! You can now log into the Courier Portal.'
    });
  } catch (err: any) {
    console.error('Complete onboarding exception:', err);
    return NextResponse.json({ error: err.message || 'Onboarding failed' }, { status: 500 });
  }
}
