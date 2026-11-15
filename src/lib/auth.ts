import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from './supabase/admin';
import crypto from 'crypto';

export type StaffRole = 'owner' | 'admin' | 'manager' | 'kitchen_staff' | 'rider';

export interface AuthenticatedStaff {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
}

function getStaffSecret(): string {
  const secret = process.env.STAFF_JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY CONFIGURATION ERROR: STAFF_JWT_SECRET must be configured.');
    }
    return 'jfc-secure-staff-terminal-secret-2026';
  }
  return secret;
}

/**
 * Creates a cryptographically signed staff session token for terminal/desk logins.
 */
export function signStaffSessionToken(staff: AuthenticatedStaff): string {
  const secret = getStaffSecret();
  const payload = Buffer.from(
    JSON.stringify({
      ...staff,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days persistent session
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

/**
 * Verifies a staff session token.
 */
export function verifyStaffSessionToken(token: string): AuthenticatedStaff | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;
    const secret = getStaffSecret();
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    // Strict expiration check: exp must be present, number, and in the future
    if (!data.exp || typeof data.exp !== 'number' || Date.now() > data.exp) {
      return null;
    }

    if (!data.id || !data.role) {
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      fullName: data.fullName,
      role: data.role
    };
  } catch (e) {
    return null;
  }
}

/**
 * Verifies whether an incoming request belongs to an authenticated staff member.
 * Checks Supabase Auth Bearer Tokens, staff session cookies, and terminal headers.
 */
export async function getStaffSession(req: NextRequest): Promise<AuthenticatedStaff | null> {
  // 1. Check Bearer Token (Supabase Auth access token or signed staff token)
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();

    // Check signed staff token first
    const staffToken = verifyStaffSessionToken(token);
    if (staffToken) return staffToken;

    // Check Supabase Auth user
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
        if (user && !userErr) {
          const { data: profile } = await supabase
            .from('staff_profiles')
            .select('*')
            .eq('id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          if (profile) {
            return {
              id: profile.id,
              email: profile.email,
              fullName: profile.full_name,
              role: profile.role as StaffRole
            };
          }
        }
      } catch (err) {
        // Fall through
      }
    }
  }

  // 2. Check HTTP-only Staff Session Cookie
  const staffCookie = req.cookies.get('jfc_staff_session')?.value;
  if (staffCookie) {
    const staffFromCookie = verifyStaffSessionToken(staffCookie);
    if (staffFromCookie) {
      // Server-side active account and suspension verification
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          // If the staff user is a courier/rider, check riders table active state
          if (staffFromCookie.role === 'rider') {
            const { data: riderProfile } = await supabase
              .from('riders')
              .select('id, full_name, is_active')
              .eq('id', staffFromCookie.id)
              .maybeSingle();

            if (!riderProfile || !riderProfile.is_active) {
              return null; // Suspended or deactivated rider session rejected
            }
          } else {
            // Check staff_profiles table for owner, manager, admin, kitchen_staff
            const { data: staffProfile } = await supabase
              .from('staff_profiles')
              .select('id, full_name, role, is_active')
              .eq('id', staffFromCookie.id)
              .maybeSingle();

            if (!staffProfile || !staffProfile.is_active) {
              return null; // Suspended or deactivated staff session rejected
            }
          }
        } catch (dbErr) {
          // If database check fails due to transient connection, proceed with verified signed cryptographic session
        }
      }
      return staffFromCookie;
    }
  }

  // 3. Check Kitchen Terminal Key Header (For authorized kitchen station display ONLY - role strictly fixed to kitchen_staff)
  const terminalKey = req.headers.get('x-kitchen-key');
  const configuredTerminalKey =
    process.env.KITCHEN_TERMINAL_KEY ||
    (process.env.NODE_ENV !== 'production' ? 'jfc-agbani-kitchen-2026' : '');
  if (terminalKey && configuredTerminalKey && configuredTerminalKey.length >= 16) {
    const reqBuf = Buffer.from(terminalKey);
    const cfgBuf = Buffer.from(configuredTerminalKey);
    if (reqBuf.length === cfgBuf.length && crypto.timingSafeEqual(reqBuf, cfgBuf)) {
      return {
        id: 'kitchen-station-agbani',
        email: 'kitchen@jaysfoodcourt.com',
        fullName: "Jay's Kitchen Station",
        role: 'kitchen_staff'
      };
    }
  }

  return null;
}

/**
 * Guardrail asserting that the requester is an authorized staff member with a permitted role.
 * Returns null if authorized, or a 401/403 NextResponse if unauthorized.
 */
export async function requireStaffAuthorization(
  req: NextRequest,
  allowedRoles: StaffRole[] = ['owner', 'admin', 'manager', 'kitchen_staff', 'rider']
): Promise<{ staff: AuthenticatedStaff | null; errorResponse: NextResponse | null }> {
  const staff = await getStaffSession(req);

  if (!staff) {
    return {
      staff: null,
      errorResponse: NextResponse.json(
        {
          error: 'Authentication required. This administrative endpoint is restricted to authorized staff.',
          code: 'UNAUTHENTICATED'
        },
        { status: 401 }
      )
    };
  }

  if (!allowedRoles.includes(staff.role)) {
    return {
      staff: null,
      errorResponse: NextResponse.json(
        {
          error: `Permission denied. Your role "${staff.role}" is not authorized for this operation. Required: [${allowedRoles.join(', ')}].`,
          code: 'FORBIDDEN'
        },
        { status: 403 }
      )
    };
  }

  return { staff, errorResponse: null };
}

/**
 * Checks role-based capability for specific staff actions.
 */
export function hasStaffPermission(
  role: StaffRole,
  action: 'manage_menu' | 'manage_orders' | 'dispatch'
): boolean {
  switch (action) {
    case 'manage_menu':
      return ['owner', 'admin', 'manager', 'kitchen_staff'].includes(role);
    case 'manage_orders':
      return ['owner', 'admin', 'manager', 'kitchen_staff'].includes(role);
    case 'dispatch':
      return ['owner', 'admin', 'manager', 'rider'].includes(role);
    default:
      return false;
  }
}
