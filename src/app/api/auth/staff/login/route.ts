import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { signStaffSessionToken, StaffRole } from '@/lib/auth';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Valid staff email is required' }),
  password: z.string().min(1, { message: 'Password is required' })
});

// Optional development-only mock credentials disabled in production
const IS_DEV_ENV = process.env.NODE_ENV !== 'production';
const DEV_STAFF_USERS = IS_DEV_ENV ? [
  {
    id: 's0000000-0000-0000-0000-000000000001',
    email: 'owner@jaysfoodcourt.com',
    fullName: "Jay (Owner)",
    role: 'owner' as StaffRole,
    passwordHash: 'jay2026foodcourt'
  },
  {
    id: 's0000000-0000-0000-0000-000000000002',
    email: 'manager@jaysfoodcourt.com',
    fullName: 'Manager Emeka',
    role: 'manager' as StaffRole,
    passwordHash: 'manager2026'
  },
  {
    id: 's0000000-0000-0000-0000-000000000003',
    email: 'kitchen@jaysfoodcourt.com',
    fullName: 'Head Chef Chioma',
    role: 'kitchen_staff' as StaffRole,
    passwordHash: 'kitchen2026'
  }
] : [];

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client';
    
    // Apply rate limiting: max 5 failed attempts per IP / email per 15 minutes
    const rateLimitKey = `staff_login:${ip}`;
    const rateLimitCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Please wait ${Math.ceil(rateLimitCheck.reset / 60)} minutes before trying again.`
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitCheck.reset)
          }
        }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid credentials provided. Please check and try again.' },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const cleanEmail = email.toLowerCase();

    // 1. Try Supabase Auth verification using an isolated anon client so admin client keeps service_role privileges
    const adminSupabase = getSupabaseAdminClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (adminSupabase && supabaseUrl && supabaseAnonKey) {
      try {
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });

        const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
          email: cleanEmail,
          password
        });

        if (!authError && authData.user) {
          // Check staff profile
          const { data: profile } = await adminSupabase
            .from('staff_profiles')
            .select('*')
            .eq('id', authData.user.id)
            .eq('is_active', true)
            .maybeSingle();

          let staffMember = null;

          if (profile) {
            staffMember = {
              id: profile.id,
              email: profile.email,
              fullName: profile.full_name,
              role: profile.role as StaffRole
            };
          } else {
            // Check riders table
            const { data: riderProfile } = await adminSupabase
              .from('riders')
              .select('*')
              .eq('id', authData.user.id)
              .eq('is_active', true)
              .maybeSingle();

            if (riderProfile) {
              staffMember = {
                id: riderProfile.id,
                email: riderProfile.email,
                fullName: riderProfile.full_name,
                role: 'rider' as StaffRole
              };
            }
          }

          if (staffMember) {
            // Successful login -> reset rate limit
            resetRateLimit(rateLimitKey);

            const token = signStaffSessionToken(staffMember);
            const response = NextResponse.json({ success: true, staff: staffMember, token });

            response.cookies.set({
              name: 'jfc_staff_session',
              value: token,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 60 * 60 * 24 * 30 // 30 days persistent login
            });

            return response;
          }
        }
      } catch (err) {
        console.warn('Supabase staff auth attempt failed, checking fallback credentials', err);
      }
    }

    // 2. Development-only mock staff fallback
    if (IS_DEV_ENV) {
      const localMatch = DEV_STAFF_USERS.find(
        (s) => s.email === cleanEmail && s.passwordHash === password
      );

      if (localMatch) {
        // Successful login -> reset rate limit
        resetRateLimit(rateLimitKey);

        const staff = {
          id: localMatch.id,
          email: localMatch.email,
          fullName: localMatch.fullName,
          role: localMatch.role
        };

        const token = signStaffSessionToken(staff);
        const response = NextResponse.json({ success: true, staff, token });

        response.cookies.set({
          name: 'jfc_staff_session',
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30 // 30 days persistent login
        });

        return response;
      }
    }

    // Generic error message: does NOT reveal whether the email exists or password was wrong
    return NextResponse.json(
      { error: 'Invalid credentials provided. Please check your email and password.' },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Authentication could not be completed. Please try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Signed out successfully' });
  response.cookies.set({
    name: 'jfc_staff_session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  return response;
}
