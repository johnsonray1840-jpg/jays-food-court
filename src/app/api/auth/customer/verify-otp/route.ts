import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { setCustomerSessionCookie } from '@/lib/session';

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  token: z.string().trim().min(6, { message: 'Verification code is required' }).max(10)
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { email, token } = parsed.data;
    const cleanEmail = email.toLowerCase();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Auth configuration error' }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    const { data: verifyData, error: verifyError } = await authClient.auth.verifyOtp({
      email: cleanEmail,
      token: token,
      type: 'email'
    });

    if (verifyError || !verifyData.user) {
      return NextResponse.json({ error: verifyError?.message || 'Invalid or expired code. Please try again.' }, { status: 401 });
    }

    // Connect with customers table
    const adminSupabase = getSupabaseAdminClient();
    let customerRecord = null;

    if (adminSupabase) {
      const { data: existingCust } = await adminSupabase
        .from('customers')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (!existingCust) {
        // Enforce: Email MUST already be registered in the database
        return NextResponse.json(
          { error: 'No registered customer account found for this email address.' },
          { status: 404 }
        );
      }

      customerRecord = existingCust;
    }

    const customerId = customerRecord?.id || verifyData.user.id;
    const customerPhone = customerRecord?.phone || '';

    // Issue session cookie
    const response = NextResponse.json({
      success: true,
      customer: {
        id: customerId,
        email: cleanEmail,
        fullName: customerRecord?.full_name || 'Valued Customer',
        phone: customerPhone
      }
    });

    await setCustomerSessionCookie(customerId, customerPhone);

    return response;
  } catch (err: any) {
    console.error('Verify OTP error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
