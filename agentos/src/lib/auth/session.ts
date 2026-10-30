import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * OWNER AUTHENTICATION PRIMITIVES. Pure functions over `env`, shared by the
 * proxy, pages, routes and tests.
 *
 * AgentOS has one user, the founder. Configuration:
 * - AGENTOS_OWNER_PASSWORD_HASH  scrypt hash from `npm run hash-password`
 * - AGENTOS_SESSION_SECRET       ≥ 32 random characters
 *
 * Without both, every surface refuses (fail closed) — in development too, so
 * the authentication path that ships is the one that gets exercised.
 *
 * Sessions are stateless signed tokens: `v1.<expires>.<nonce>.<mac>`. The MAC
 * key mixes the session secret with the password hash, so changing the
 * password signs out every session; rotating the secret does the same.
 */
export const SESSION_COOKIE = 'agentos_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const OWNER_ACTOR = 'owner';

type Env = Record<string, string | undefined>;

export type AuthConfig =
  | { ok: true; passwordHash: string; secret: string }
  | { ok: false; problem: string };

export function authConfig(env: Env = process.env): AuthConfig {
  const passwordHash = env.AGENTOS_OWNER_PASSWORD_HASH;
  const secret = env.AGENTOS_SESSION_SECRET;
  if (!passwordHash || !parseHash(passwordHash)) return { ok: false, problem: 'AGENTOS_OWNER_PASSWORD_HASH is missing or malformed' };
  if (!secret || secret.length < 32) return { ok: false, problem: 'AGENTOS_SESSION_SECRET is missing or shorter than 32 characters' };
  return { ok: true, passwordHash, secret };
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt, N=2^15, r=8, p=1)
// ---------------------------------------------------------------------------
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string, salt: Buffer = randomBytes(16)): string {
  const hash = scryptSync(password.normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function parseHash(stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every(Number.isInteger) || N < 16384 || N > 1048576 || r < 1 || r > 32 || p < 1 || p > 16) return null;
  const salt = Buffer.from(parts[4], 'base64url');
  const hash = Buffer.from(parts[5], 'base64url');
  if (salt.length < 16 || hash.length < 32) return null;
  return { N, r, p, salt, hash };
}

export function verifyPassword(password: string, stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed || typeof password !== 'string' || password.length === 0 || password.length > 1024) return false;
  const candidate = scryptSync(password.normalize('NFKC'), parsed.salt, parsed.hash.length, {
    N: parsed.N, r: parsed.r, p: parsed.p, maxmem: 128 * parsed.N * parsed.r * 2,
  });
  return timingSafeEqual(candidate, parsed.hash);
}

// ---------------------------------------------------------------------------
// Session tokens
// ---------------------------------------------------------------------------
function mac(payload: string, config: { passwordHash: string; secret: string }): string {
  const key = createHmac('sha256', config.secret).update(config.passwordHash).digest();
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export function issueSession(config: { passwordHash: string; secret: string }, nowMs: number = Date.now()): string {
  const expires = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${expires}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${mac(payload, config)}`;
}

export function verifySession(token: string | undefined, env: Env = process.env, nowMs: number = Date.now()): boolean {
  const config = authConfig(env);
  if (!config.ok || typeof token !== 'string' || token.length > 256) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;
  const expires = Number(parts[1]);
  if (!Number.isInteger(expires) || expires * 1000 <= nowMs) return false;
  const expected = Buffer.from(mac(parts.slice(0, 3).join('.'), config));
  const given = Buffer.from(parts[3]);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function sessionCookieOptions(env: Env = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
