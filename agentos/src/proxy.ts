import { NextResponse, type NextRequest } from 'next/server';
import { authConfig, SESSION_COOKIE, verifySession } from '@/lib/auth/session';

/**
 * Outer wall. Everything except sign-in and the liveness probe needs a valid
 * owner session. Pages redirect to /login; API routes answer 401. Production
 * without auth configuration answers 503 everywhere (fail closed).
 *
 * This is not the only check — every page and route re-verifies through
 * src/lib/auth/owner.ts.
 */
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/health']);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!authConfig().ok) {
    return new NextResponse(
      'ACCESS NOT CONFIGURED: set AGENTOS_OWNER_PASSWORD_HASH and AGENTOS_SESSION_SECRET (see docs/ENVIRONMENT.md).',
      { status: 503, headers: { 'content-type': 'text/plain' } },
    );
  }
  if (verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'AUTHENTICATION REQUIRED' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  // '/' listed explicitly: a single negative-lookahead pattern does not match
  // the root path (see rescue-agent/src/middleware.ts for the incident).
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
