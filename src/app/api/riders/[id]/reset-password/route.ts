import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireStaffAuthorization } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export async function POST(
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

    // 1. Fetch rider details
    const { data: staffMember, error: staffErr } = await supabase
      .from('staff_profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', riderId)
      .maybeSingle();

    if (staffErr || !staffMember) {
      return NextResponse.json({ error: 'Courier profile not found' }, { status: 404 });
    }

    if (staffMember.role !== 'rider') {
      return NextResponse.json({ error: 'Target staff member is not a courier' }, { status: 400 });
    }

    // 2. Generate secure recovery link via Supabase Auth Admin
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: staffMember.email,
      options: {
        redirectTo: `${origin}/rider/reset-password`
      }
    });

    if (linkErr || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: linkErr?.message || 'Failed to generate secure reset link' }, { status: 500 });
    }

    const resetLink = linkData.properties.action_link;

    // 3. Dispatch confidential reset link via Resend (Never exposed in plaintext to admin)
    const emailResult = await sendEmail({
      to: staffMember.email,
      subject: "Password Reset Request • Jay's Food Court Courier Fleet",
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #F0E9D6; border-radius: 20px; background-color: #FFFFFF;">
          <h2 style="color: #17140D; font-size: 22px; font-weight: 800;">Courier Password Reset</h2>
          <p style="color: #57534E; font-size: 14px; line-height: 1.6;">
            Hello <strong>${staffMember.full_name}</strong>, a password reset request was initiated by store management for your Jay's Food Court courier account.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetLink}" target="_blank" style="background-color: #FFB800; color: #17140D; text-decoration: none; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 14px 32px; border-radius: 999px; display: inline-block;">
              Set New Password
            </a>
          </div>
          <p style="color: #A8A29E; font-size: 11px; text-align: center;">
            This link is valid for 1 hour. If you did not request this, please notify your manager immediately.
          </p>
        </div>
      `
    });

    return NextResponse.json({
      success: true,
      message: `Password reset instructions have been dispatched securely to ${staffMember.email}.`
    });
  } catch (err: any) {
    console.error('Password reset route error:', err);
    return NextResponse.json({ error: err.message || 'Failed to trigger password reset' }, { status: 500 });
  }
}
