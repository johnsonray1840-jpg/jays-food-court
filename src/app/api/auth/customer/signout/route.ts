import { NextRequest, NextResponse } from 'next/server';
import { clearCustomerSessionCookie } from '@/lib/session';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Signed out successfully' });
  await clearCustomerSessionCookie();
  response.cookies.set({
    name: 'jfc_customer_session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  return response;
}
