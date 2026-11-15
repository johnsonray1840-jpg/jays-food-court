import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendMagicLinkEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const otpRequestSchema = z.object({
  email: z.string().trim().email({ message: 'Valid email address is required' })
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = otpRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { email } = parsed.data;
    const cleanEmail = email.toLowerCase();
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const adminSupabase = getSupabaseAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 503 });
    }

    // REQUIREMENT: Verify email exists in the database before sending any magic link or code.
    // Check both customers table and staff_profiles table.
    const [custRes, staffRes] = await Promise.all([
      adminSupabase
        .from('customers')
        .select('id, email, full_name')
        .eq('email', cleanEmail)
        .maybeSingle(),
      adminSupabase
        .from('staff_profiles')
        .select('id, email, full_name, role, is_active')
        .eq('email', cleanEmail)
        .maybeSingle()
    ]);

    const existingCustomer = custRes.data;
    const existingStaff = staffRes.data;

    if (!existingCustomer && !existingStaff) {
      // Email is not registered in the database
      return NextResponse.json(
        {
          error: 'No account found with this email address. Please place an order first or register before logging in.'
        },
        { status: 404 }
      );
    }

    // Generate link and OTP via Supabase Auth Admin
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
      options: {
        redirectTo: `${origin}/auth/callback`
      }
    });

    if (linkError || !linkData) {
      console.error('Supabase generateLink error:', linkError?.message);
      return NextResponse.json({ error: linkError?.message || 'Failed to generate authentication link' }, { status: 400 });
    }

    const actionLink = linkData.properties?.action_link;
    const otpCode = linkData.properties?.email_otp;

    if (!actionLink || !otpCode) {
      return NextResponse.json({ error: 'Failed to generate login token.' }, { status: 500 });
    }

    // Dispatch via Resend using Jay's Food Court luxury template
    const emailResult = await sendMagicLinkEmail({
      to: cleanEmail,
      magicLinkUrl: actionLink,
      otpCode: otpCode
    });

    if (!emailResult.success) {
      console.error('Resend delivery failure:', emailResult.error);
      return NextResponse.json({ error: 'Failed to dispatch login email via Resend.' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: 'A secure login magic link and 8-digit code has been sent to your email.'
    });
  } catch (err: any) {
    console.error('Error sending magic link:', err);
    return NextResponse.json({ error: 'Failed to send login email. Please retry.' }, { status: 500 });
  }
}
