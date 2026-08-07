import { NextResponse, type NextRequest } from 'next/server';
import { checkBasicAuth, resolveAuthMode } from '@/lib/auth';

/**
 * App-wide access control. This application exposes confidential internal
 * sales intelligence, so production deployments MUST set BASIC_AUTH_USER and
 * BASIC_AUTH_PASSWORD; without them, production requests are refused (fail
 * closed) rather than served openly. Local development stays open.
 * /api/health is exempt so orchestrators can probe liveness.
 */
/**
 * Routes that authenticate themselves per tenant and may therefore bypass the
 * app-wide operator credential — but ONLY when the deployment has explicitly
 * opted in via FRONTDESK_PUBLIC_ENDPOINT_ENABLED=true.
 *
 * The flag defaults to false, so a deployment that merely receives this code
 * does not become publicly reachable. Building per-tenant authentication and
 * exposing the endpoint to the internet are two separate decisions, and this
 * is where the second one is made.
 *
 * The route behind this still requires a valid tenant key: bypassing Basic
 * Auth means "authenticated differently", never "unauthenticated".
 */
const PER_TENANT_AUTH_ROUTES = [/^\/api\/frontdesk\/[^/]+\/message$/];

/**
 * The delivery-status webhook authenticates every request with an HMAC over
 * the raw body and fails closed when no secret is configured, so a shared
 * password in front of it would add nothing. Unlike the message endpoint this
 * is NOT behind the exposure flag: a provider callback has to be reachable for
 * delivery tracking to work at all, and it has no useful surface without a
 * valid signature.
 */
const SIGNED_WEBHOOK_ROUTES = [/^\/api\/frontdesk\/notifications\/webhook$/];

function isSelfAuthenticatingRoute(pathname: string): boolean {
  if (SIGNED_WEBHOOK_ROUTES.some((pattern) => pattern.test(pathname))) return true;
  if (process.env.FRONTDESK_PUBLIC_ENDPOINT_ENABLED !== 'true') return false;
  return PER_TENANT_AUTH_ROUTES.some((pattern) => pattern.test(pathname));
}

export function middleware(request: NextRequest) {
  if (isSelfAuthenticatingRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

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
