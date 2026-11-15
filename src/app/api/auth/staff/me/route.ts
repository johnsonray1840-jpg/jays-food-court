import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const staff = await getStaffSession(req);
  if (!staff) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, staff });
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
