import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOrigin } from '@/lib/auth/owner';
import { authConfig, issueSession, OWNER_ACTOR, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from '@/lib/auth/session';
import { clientIp, failure, jsonError, readJson } from '@/lib/http/api';
import { getStore } from '@/lib/store';

// PUBLIC ROUTE: sign-in cannot sit behind the session it creates. It is
// same-origin only and rate limited per address and globally.
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ password: z.string().min(1).max(1024) });
const WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  const config = authConfig();
  if (!config.ok) return jsonError(503, 'ACCESS NOT CONFIGURED');
  if (!isSameOrigin(request)) return jsonError(403, 'CROSS-ORIGIN REQUEST REFUSED');
  try {
    const store = getStore();
    const ip = clientIp(request);
    const perIp = await store.hitRateLimit(`login:ip:${ip}`, WINDOW_SECONDS, 10);
    const global = await store.hitRateLimit('login:global', WINDOW_SECONDS, 50);
    if (!perIp.allowed || !global.allowed) {
      await store.audit({ actor: 'anonymous', action: 'auth.login_throttled', entity: 'session', entityId: null, details: { ip } });
      return jsonError(429, 'TOO MANY ATTEMPTS — try again later');
    }
    const body = await readJson(request, bodySchema, 2_048);
    if (!body.ok) return body.response;
    if (!verifyPassword(body.data.password, config.passwordHash)) {
      await store.audit({ actor: 'anonymous', action: 'auth.login_failed', entity: 'session', entityId: null, details: { ip } });
      return jsonError(401, 'INCORRECT PASSWORD');
    }
    await store.audit({ actor: OWNER_ACTOR, action: 'auth.login', entity: 'session', entityId: null, details: { ip } });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, issueSession(config), sessionCookieOptions());
    return response;
  } catch (error) {
    return failure(error);
  }
}
