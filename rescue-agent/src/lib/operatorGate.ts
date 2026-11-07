import { NextResponse, type NextRequest } from 'next/server';
import { checkBasicAuth } from '@/lib/auth';
import { decide, sourceAddress, type ThrottleStore } from '@/lib/operatorThrottle';
import { DEVICE_COOKIE, deviceCookieToSet, deviceValidFor } from '@/lib/operatorDevice';

const CHALLENGE = { 'www-authenticate': 'Basic realm="Winnersbookmark Rescue Agent", charset="UTF-8"' };

/**
 * The operator credential, behind the shared attempt limit (issue #73; see
 * src/lib/operatorThrottle.ts). Exported so tests can drive it with a store.
 */
export async function authenticateOperator(
  request: NextRequest,
  store: ThrottleStore | (() => Promise<ThrottleStore>),
  env: Record<string, string | undefined> = process.env,
) {
  const header = request.headers.get('authorization');
  // No credentials presented: a browser's first request, or a signed-out one.
  // Challenge without counting, so merely opening the page can never lock anyone.
  if (!header) return new NextResponse('Authentication required.', { status: 401, headers: CHALLENGE });

  const credentialsOk = checkBasicAuth(header, env.BASIC_AUTH_USER as string, env.BASIC_AUTH_PASSWORD as string);
  const deviceCookie = request.cookies.get(DEVICE_COOKIE)?.value;
  let decision;
  try {
    decision = await decide(typeof store === 'function' ? await store() : store, {
      source: sourceAddress(request.headers, env),
      credentialsOk,
      trustedDevice: deviceValidFor(deviceCookie, env) > 0,
    });
  } catch {
    // FAIL CLOSED. The counters could not be read or written (database down,
    // table missing). Admitting the request would make the attempt limit
    // disappear exactly when it cannot be observed, so every credentialed
    // request — right password or wrong — is refused until they are back.
    // Never the error text: it can carry connection details.
    console.error('[operator-auth] sign-in protection unavailable; refusing credentialed requests');
    return new NextResponse('Sign-in is temporarily unavailable. Please try again shortly.', {
      status: 503,
      headers: { 'retry-after': '30', 'content-type': 'text/plain', 'cache-control': 'no-store' },
    });
  }

  if (decision.outcome === 'allow') {
    const response = NextResponse.next();
    const cookie = deviceCookieToSet(deviceCookie, env);
    if (cookie) response.headers.append('set-cookie', cookie);
    return response;
  }
  if (decision.outcome === 'locked') {
    if (decision.scope === 'global') console.warn('[operator-auth] global sign-in lockdown active', { retryAfter: decision.retryAfter });
    const minutes = Math.max(1, Math.ceil(decision.retryAfter / 60));
    // Same answer for a right or a wrong password while locked, and no
    // challenge header, so the browser does not keep re-prompting.
    return new NextResponse(`Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, {
      status: 429,
      headers: { 'retry-after': String(decision.retryAfter), 'content-type': 'text/plain', 'cache-control': 'no-store' },
    });
  }
  return new NextResponse('Authentication required.', { status: 401, headers: CHALLENGE });
}
