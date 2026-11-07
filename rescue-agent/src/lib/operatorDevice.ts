/**
 * TRUSTED-DEVICE COOKIE: THE OPERATOR KEEPS WORKING THROUGH A GLOBAL LOCKDOWN.
 *
 * A distributed attack can trip the global sign-in counter
 * (operatorThrottle.ts) and lock everyone out, including the operator. To
 * stop that, a browser that has signed in successfully receives this cookie,
 * and a browser presenting a valid one is exempt from the GLOBAL lockdown
 * only. It is never a credential: the operator password is still required on
 * every request, and the per-address limit still applies.
 *
 * - Signed with OPERATOR_DEVICE_SECRET (at least 32 characters). Without that
 *   secret no cookie is issued or honoured, and the global lockdown applies to
 *   everyone — the safe default.
 * - Bound to the operator user name and a digest of the current password, so
 *   rotating the password revokes every device. Because the secret is separate
 *   from the password, a stolen cookie is no help in guessing the password.
 * - Expires after DEVICE_DAYS; renewed when fewer than RENEW_DAYS remain.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const DEVICE_COOKIE = 'wb_operator_device';
export const DEVICE_DAYS = 30;
const RENEW_DAYS = 7;
const DAY = 86_400;

type Env = Record<string, string | undefined>;

function secretOf(env: Env): string | null {
  const secret = env.OPERATOR_DEVICE_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function mac(secret: string, expires: number, env: Env): string {
  const passwordDigest = createHash('sha256').update(env.BASIC_AUTH_PASSWORD ?? '').digest('hex');
  return createHmac('sha256', secret).update(`v1|${expires}|${env.BASIC_AUTH_USER ?? ''}|${passwordDigest}`).digest('base64url');
}

/** Seconds until the cookie expires; 0 when absent, forged, expired or unsupported. */
export function deviceValidFor(value: string | undefined, env: Env = process.env, nowSeconds = Math.floor(Date.now() / 1000)): number {
  const secret = secretOf(env);
  if (!secret || !value) return 0;
  const match = /^v1\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) return 0;
  const expires = Number(match[1]);
  if (expires <= nowSeconds || expires > nowSeconds + (DEVICE_DAYS + 1) * DAY) return 0;
  const expected = Buffer.from(mac(secret, expires, env));
  const given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? expires - nowSeconds : 0;
}

/** A Set-Cookie value to issue or renew the device cookie, or null if not needed. */
export function deviceCookieToSet(current: string | undefined, env: Env = process.env, nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  const secret = secretOf(env);
  if (!secret) return null;
  if (deviceValidFor(current, env, nowSeconds) > RENEW_DAYS * DAY) return null;
  const expires = nowSeconds + DEVICE_DAYS * DAY;
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${DEVICE_COOKIE}=v1.${expires}.${mac(secret, expires, env)}; Path=/; Max-Age=${DEVICE_DAYS * DAY}; HttpOnly; SameSite=Strict${secure}`;
}
