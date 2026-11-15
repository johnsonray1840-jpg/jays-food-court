import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';
import { normalizeNigerianPhone } from '@/lib/phone';
import { sendEmail } from '@/lib/email';
import { setRiderAssignedZones } from '@/lib/enugu-zones-service';

const inviteRiderSchema = z.object({
  fullName: z.string().trim().min(2, 'Full legal name is required'),
  email: z.string().trim().email('Valid email address is required'),
  phone: z.string().trim().min(10, 'Valid Nigerian phone number is required'),
  vehicleType: z.string().trim().default('Motorcycle'),
  operationalZoneId: z.string().optional()
});

// GET /api/riders - List all riders for Owner/Manager fleet console
export async function GET(req: NextRequest) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse) return errorResponse;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    // 1. Fetch riders from riders table
    const { data: riders } = await supabase
      .from('riders')
      .select('*')
      .order('created_at', { ascending: false });

    // 2. Fetch staff_profiles with role: 'rider' to guarantee complete profile metadata
    const { data: staffRiders } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('role', 'rider');

    // Merge or pair staff info
    const staffMap = new Map((staffRiders || []).map(s => [s.id, s]));

    const mergedRiders = (riders || []).map(r => {
      const staffInfo = staffMap.get(r.id);
      return {
        id: r.id,
        full_name: r.full_name || staffInfo?.full_name || 'Courier',
        phone: r.phone || '',
        email: staffInfo?.email || '',
        vehicle_type: r.vehicle_type || 'Motorcycle',
        rating: r.rating || 5.0,
        is_active: r.is_active ?? staffInfo?.is_active ?? false,
        is_available: r.is_available ?? false,
        status: r.status || (r.is_active ? 'active' : 'deactivated'),
        operational_zone_id: r.operational_zone_id || null,
        created_at: r.created_at || staffInfo?.created_at,
        updated_at: r.updated_at || staffInfo?.updated_at
      };
    });

    // Also include any staff profile riders that don't yet have a row in riders
    for (const sr of staffRiders || []) {
      if (!mergedRiders.some(m => m.id === sr.id)) {
        mergedRiders.push({
          id: sr.id,
          full_name: sr.full_name,
          phone: '',
          email: sr.email,
          vehicle_type: 'Motorcycle',
          rating: 5.0,
          is_active: sr.is_active,
          is_available: false,
          status: sr.is_active ? 'active' : 'deactivated',
          operational_zone_id: null,
          created_at: sr.created_at,
          updated_at: sr.updated_at
        });
      }
    }

    return NextResponse.json({ riders: mergedRiders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/riders - Owner/Manager issues secure rider onboarding invitation
export async function POST(req: NextRequest) {
  const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = inviteRiderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { fullName, email, phone, vehicleType, operationalZoneId } = parsed.data;
    const cleanEmail = email.toLowerCase();
    const normalizedPhone = normalizeNigerianPhone(phone) || phone;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // 1. Generate high-entropy single-use onboarding token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48-hour onboarding window

    // 2. Record onboarding invitation
    const { error: invErr } = await supabase.from('rider_invitations').insert({
      full_name: fullName,
      email: cleanEmail,
      phone: normalizedPhone,
      operational_zone_id: operationalZoneId || null,
      invitation_token_hash: tokenHash,
      status: 'pending',
      invited_by: staff?.id || null,
      expires_at: expiresAt
    });

    if (invErr) {
      console.warn('Could not record rider_invitations table, proceeding with direct profile invite', invErr.message);
    }

    if (operationalZoneId) {
      setRiderAssignedZones(rawToken, [operationalZoneId], staff?.fullName);
    }

    // 3. Dispatch official onboarding email via Resend
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const onboardingUrl = `${origin}/rider/onboard?token=${rawToken}&email=${encodeURIComponent(cleanEmail)}`;

    const emailResult = await sendEmail({
      to: cleanEmail,
      subject: "Courier Onboarding Invitation • Jay's Food Court",
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #F0E9D6; border-radius: 20px; background-color: #FFFFFF;">
          <h2 style="color: #17140D; font-size: 22px; font-weight: 800;">Welcome to Jay's Food Court Courier Fleet</h2>
          <p style="color: #57534E; font-size: 14px; line-height: 1.6;">
            Hello <strong>${fullName}</strong>, you have been invited by store management to join our official courier fleet in Agbani, Enugu.
          </p>
          <div style="background-color: #FFFBEF; padding: 18px; border-radius: 14px; margin: 20px 0; border: 1px solid #FFE494;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #92400E; letter-spacing: 1px;">Assigned Vehicle Type</div>
            <div style="font-size: 15px; font-weight: 800; color: #17140D; margin-top: 4px;">${vehicleType}</div>
            <div style="font-size: 12px; color: #78716C; margin-top: 2px;">Registered Phone: ${normalizedPhone}</div>
          </div>
          <p style="color: #57534E; font-size: 14px; line-height: 1.6;">
            Please click the button below to set your confidential password and activate your courier account. This invitation link is valid for 48 hours.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${onboardingUrl}" target="_blank" style="background-color: #FFB800; color: #17140D; text-decoration: none; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 14px 32px; border-radius: 999px; display: inline-block;">
              Activate Courier Account
            </a>
          </div>
          <p style="color: #A8A29E; font-size: 11px; text-align: center;">
            Never share this link with anyone. Jay's Food Court will never ask for your password.
          </p>
        </div>
      `
    });

    return NextResponse.json({
      success: true,
      message: `Onboarding invitation sent successfully to ${cleanEmail}`,
      onboardingUrl: process.env.NODE_ENV !== 'production' ? onboardingUrl : undefined
    }, { status: 201 });
  } catch (err: any) {
    console.error('Invite rider error:', err);
    return NextResponse.json({ error: err.message || 'Failed to issue rider invitation' }, { status: 500 });
  }
}
