import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * SESSIONS
 *
 * A session token is 32 random bytes. Only its SHA-256 digest is stored, so a
 * database leak yields no usable sessions — the same reasoning as the API
 * keys, and the same reason a fast digest is correct for a high-entropy token.
 *
 * The cookie is httpOnly (no JavaScript access), sameSite=lax (a cross-site
 * POST cannot ride the session), and Secure outside development. Sessions have
 * an absolute expiry rather than sliding indefinitely: a restaurant laptop left
 * signed in on a shared back-office machine is a real scenario.
 */

export const SESSION_COOKIE = 'wbi_fd_session';

/** Absolute session lifetime. Short enough to matter, long enough for a shift. */
export const SESSION_HOURS = 12;

export interface GeneratedSession {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export function createSessionToken(now: Date = new Date()): GeneratedSession {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000),
  };
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function tokenHashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Reject anything that is not shaped like one of our tokens before a DB hit. */
export function isPlausibleToken(value: string | undefined | null): value is string {
  if (!value) return false;
  return /^[A-Za-z0-9_-]{40,64}$/.test(value);
}

export interface StoredSession {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type SessionVerdict =
  | { valid: true; sessionId: string; userId: string }
  | { valid: false; reason: 'NO_SESSION' | 'REVOKED' | 'EXPIRED' };

export function verifySession(stored: StoredSession | null, now: Date): SessionVerdict {
  if (!stored) return { valid: false, reason: 'NO_SESSION' };
  if (stored.revokedAt) return { valid: false, reason: 'REVOKED' };
  if (stored.expiresAt.getTime() <= now.getTime()) return { valid: false, reason: 'EXPIRED' };
  return { valid: true, sessionId: stored.id, userId: stored.userId };
}

export function sessionCookieOptions(expiresAt: Date, isProduction: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
    expires: expiresAt,
  };
}
