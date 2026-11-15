import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { signSessionToken } from '@/lib/session';

const SESSION_COOKIE_NAME = 'jfc_customer_session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, userId } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
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

    const customerId = customerRecord?.id || userId;
    const customerPhone = customerRecord?.phone || '';

    if (!customerId) {
      return NextResponse.json({ error: 'Failed to resolve customer identity' }, { status: 500 });
    }

    const token = signSessionToken({
      customerId,
      phone: customerPhone,
      createdAt: Date.now()
    });

    const response = NextResponse.json({
      success: true,
      customer: {
        id: customerId,
        email: cleanEmail,
        fullName: customerRecord?.full_name || 'Valued Customer',
        phone: customerPhone
      }
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 60 // 60 days
    });

    return response;
  } catch (err: any) {
    console.error('Session establishment error:', err);
    return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
  }
}
