import { NextResponse } from 'next/server';
import { requireOwnerRequest } from '@/lib/auth/owner';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const check = requireOwnerRequest(request, { mutating: true });
  if (!check.ok) return check.response;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
