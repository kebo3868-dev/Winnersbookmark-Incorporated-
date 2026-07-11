import { NextResponse, type NextRequest } from 'next/server';
import { checkBasicAuth, resolveAuthMode } from '@/lib/auth';

/**
 * App-wide access control. This application exposes confidential internal
 * sales intelligence, so production deployments MUST set BASIC_AUTH_USER and
 * BASIC_AUTH_PASSWORD; without them, production requests are refused (fail
 * closed) rather than served openly. Local development stays open.
 * /api/health is exempt so orchestrators can probe liveness.
 */
export function middleware(request: NextRequest) {
  const mode = resolveAuthMode({
    BASIC_AUTH_USER: process.env.BASIC_AUTH_USER,
    BASIC_AUTH_PASSWORD: process.env.BASIC_AUTH_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (mode === 'open') return NextResponse.next();

  if (mode === 'misconfigured') {
    return new NextResponse(
      'ACCESS NOT CONFIGURED: set BASIC_AUTH_USER and BASIC_AUTH_PASSWORD to enable this deployment.',
      { status: 503, headers: { 'content-type': 'text/plain' } },
    );
  }

  const ok = checkBasicAuth(
    request.headers.get('authorization'),
    process.env.BASIC_AUTH_USER as string,
    process.env.BASIC_AUTH_PASSWORD as string,
  );
  if (ok) return NextResponse.next();
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: { 'www-authenticate': 'Basic realm="Winners Bookmark Rescue Agent", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ['/((?!api/health|_next/static|_next/image|favicon.ico).*)'],
};
