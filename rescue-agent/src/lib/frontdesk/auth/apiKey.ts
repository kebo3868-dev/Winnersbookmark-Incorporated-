import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * PER-TENANT API KEYS
 *
 * Phase 1 protected the front desk with one shared Basic Auth credential for
 * the whole application. That is fine for internal use and useless the moment
 * a restaurant's website widget needs to reach the API: every tenant would be
 * sharing one secret, and revoking one client would lock out all of them.
 *
 * A key here identifies exactly one tenant. It is presented as
 * `Authorization: Bearer <key>`, and the tenant it resolves to must match the
 * tenant named in the request path — a valid key is never sufficient on its
 * own, it has to be the right key for the restaurant being addressed.
 *
 * STORAGE: only a SHA-256 digest is persisted. The plaintext is returned once,
 * at creation, and is unrecoverable afterwards.
 *
 * Why SHA-256 rather than bcrypt/argon2: those exist to make *low-entropy*
 * secrets expensive to brute-force. These keys are 32 bytes from a CSPRNG —
 * 256 bits of entropy — so brute force is not the threat model, and a slow KDF
 * would only add latency to every single inbound message. A fast digest is the
 * correct choice for a high-entropy bearer token. (A user-chosen password in
 * this codebase would need the opposite decision.)
 */

/** Distinguishes our keys in logs and secret scanners. */
export const KEY_PREFIX = 'wbifd';

/** Characters used for the random portion — unambiguous in copy/paste. */
const ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Bytes of randomness. 32 bytes ≈ 190 bits through this alphabet. */
const SECRET_BYTES = 32;

export interface GeneratedKey {
  /** Full plaintext key. Shown to the operator ONCE and never stored. */
  plaintext: string;
  /** Non-secret identifying fragment, safe to display and log. */
  prefix: string;
  /** What gets persisted. */
  keyHash: string;
}

/**
 * A key looks like `wbifd_a1B2c3...`. The prefix is stored separately so an
 * operator can tell two keys apart in the UI without either being revealed.
 */
export function generateApiKey(): GeneratedKey {
  const bytes = randomBytes(SECRET_BYTES);
  let secret = '';
  for (const byte of bytes) {
    secret += ALPHABET[byte % ALPHABET.length];
  }
  const plaintext = `${KEY_PREFIX}_${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, KEY_PREFIX.length + 1 + 6),
    keyHash: hashApiKey(plaintext),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

/** Compare two digests without leaking their divergence point through timing. */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Pull a bearer token out of an Authorization header.
 *
 * Deliberately strict: only `Bearer <token>` with our prefix is recognised, so
 * a Basic credential can never be mistaken for a tenant key, and a malformed
 * header fails closed rather than being coerced into something.
 */
export function extractBearerKey(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const token = match[1];
  if (!token.startsWith(`${KEY_PREFIX}_`)) return null;
  // Bound the length before it reaches a database lookup.
  if (token.length < 20 || token.length > 200) return null;
  return token;
}

export type KeyRejection =
  | 'NO_KEY'
  | 'MALFORMED_KEY'
  | 'UNKNOWN_KEY'
  | 'REVOKED_KEY'
  | 'EXPIRED_KEY'
  | 'WRONG_TENANT'
  | 'MISSING_SCOPE';

/** The stored fields needed to judge a presented key. */
export interface StoredKey {
  id: string;
  tenantId: string;
  keyHash: string;
  scopes: string[];
  revokedAt: Date | null;
  expiresAt: Date | null;
}

export type KeyVerdict =
  | { ok: true; keyId: string; tenantId: string }
  | { ok: false; reason: KeyRejection };

/**
 * Decide whether a stored key may act on a tenant.
 *
 * Pure, so every rejection path is unit-testable without a database. Order
 * matters: revocation and expiry are checked before tenant match so a
 * decommissioned key cannot be used to probe which tenants exist.
 */
export function verifyStoredKey(
  stored: StoredKey | null,
  expectedTenantId: string,
  requiredScope: string,
  now: Date,
): KeyVerdict {
  if (!stored) return { ok: false, reason: 'UNKNOWN_KEY' };
  if (stored.revokedAt) return { ok: false, reason: 'REVOKED_KEY' };
  if (stored.expiresAt && stored.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'EXPIRED_KEY' };
  }
  // The core isolation rule: holding a valid key proves nothing about which
  // restaurant you may address.
  if (stored.tenantId !== expectedTenantId) return { ok: false, reason: 'WRONG_TENANT' };
  if (!stored.scopes.includes(requiredScope)) return { ok: false, reason: 'MISSING_SCOPE' };
  return { ok: true, keyId: stored.id, tenantId: stored.tenantId };
}

/** Scopes a key can carry. Kept small and explicit (least privilege, §XXVI). */
export const SCOPES = {
  /** Send customer messages to the front desk. */
  MESSAGE_WRITE: 'message:write',
  /** Read this tenant's leads. */
  LEADS_READ: 'leads:read',
  /** Update this tenant's leads. */
  LEADS_WRITE: 'leads:write',
} as const;

export const ALL_SCOPES = Object.values(SCOPES);

export function parseScopes(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const scopes = value.filter((s): s is string => typeof s === 'string');
  if (scopes.length !== value.length || scopes.length === 0) return null;
  if (!scopes.every((s) => (ALL_SCOPES as readonly string[]).includes(s))) return null;
  return [...new Set(scopes)];
}
