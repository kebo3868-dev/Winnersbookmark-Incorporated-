import { describe, expect, it } from 'vitest';
import { authorize, authorizePlatform, type Actor } from '@/lib/frontdesk/auth/actor';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/frontdesk/auth/password';
import {
  PERMISSIONS,
  ROLES,
  can,
  isTenantRole,
  isWellFormedActor,
  mayActOnTenant,
  parseRole,
  type Permission,
  type Role,
} from '@/lib/frontdesk/auth/roles';
import {
  createSessionToken,
  hashSessionToken,
  isPlausibleToken,
  sessionCookieOptions,
  verifySession,
} from '@/lib/frontdesk/auth/session';
import { generateWebhookSecret, hashWebhookSecret, webhookSecretMatches } from '@/lib/frontdesk/auth/users';
import { signPayloadFromHash, verifyWebhookForTenant } from '@/lib/frontdesk/notify/webhook';

/**
 * TENANT AUTHORIZATION (Phase 4, milestone 4)
 *
 * The property under test throughout: a role held at one restaurant grants
 * NOTHING at another. Every test that mentions two tenants is asserting the
 * failure mode that actually ends a company — restaurant B seeing restaurant
 * A's customers.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const now = new Date('2026-08-07T12:00:00Z');

const user = (role: Role, tenantId: string | null): Actor => ({
  kind: 'USER',
  userId: 'u1',
  sessionId: 's1',
  email: 'someone@example.invalid',
  role,
  tenantId,
});

describe('cross-tenant access is refused for every restaurant role', () => {
  const tenantRoles = ROLES.filter(isTenantRole);

  it.each(tenantRoles)('%s at tenant A cannot read tenant B', (role) => {
    const result = authorize(user(role, TENANT_A), TENANT_B, 'tenant:read');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_TENANT');
  });

  it.each(tenantRoles)('%s at tenant A cannot write leads at tenant B', (role) => {
    expect(authorize(user(role, TENANT_A), TENANT_B, 'leads:write').ok).toBe(false);
  });

  it.each(tenantRoles)('%s at tenant A cannot manage keys at tenant B', (role) => {
    expect(authorize(user(role, TENANT_A), TENANT_B, 'keys:manage').ok).toBe(false);
  });

  it('an OWNER — the most privileged restaurant role — still cannot reach another restaurant', () => {
    // If any single assertion in this file matters, it is this one.
    expect(authorize(user('RESTAURANT_OWNER', TENANT_A), TENANT_B, 'tenant:read').ok).toBe(false);
    expect(authorize(user('RESTAURANT_OWNER', TENANT_A), TENANT_B, 'config:write').ok).toBe(false);
  });

  it('the tenant check runs BEFORE the role check', () => {
    // Otherwise the reason leaks whether the actor would have had permission,
    // which tells them something about a restaurant that is not theirs.
    const result = authorize(user('READ_ONLY', TENANT_A), TENANT_B, 'keys:manage');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_TENANT');
  });

  it('an unauthenticated request is refused before anything else', () => {
    const result = authorize(null, TENANT_A, 'tenant:read');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});

describe('a restaurant role is satisfied only by an exact tenant match', () => {
  it('grants access to its own restaurant', () => {
    expect(mayActOnTenant({ role: 'RESTAURANT_MANAGER', tenantId: TENANT_A }, TENANT_A)).toBe(true);
  });

  it.each([
    ['a different tenant', TENANT_B],
    ['an empty string', ''],
    ['a prefix of the real id', 'tenant-'],
    ['the id with a suffix', 'tenant-a-2'],
  ])('refuses %s', (_label, target) => {
    expect(mayActOnTenant({ role: 'RESTAURANT_MANAGER', tenantId: TENANT_A }, target)).toBe(false);
  });

  it('refuses a restaurant role carrying no tenant at all', () => {
    // A malformed row must fail closed rather than matching everything.
    expect(mayActOnTenant({ role: 'RESTAURANT_OWNER', tenantId: null }, TENANT_A)).toBe(false);
  });

  it('WBI_ADMIN is the single documented cross-tenant role', () => {
    expect(mayActOnTenant({ role: 'WBI_ADMIN', tenantId: null }, TENANT_A)).toBe(true);
    expect(mayActOnTenant({ role: 'WBI_ADMIN', tenantId: null }, TENANT_B)).toBe(true);
  });
});

describe('least privilege within a restaurant', () => {
  it('READ_ONLY cannot change anything', () => {
    expect(authorize(user('READ_ONLY', TENANT_A), TENANT_A, 'tenant:read').ok).toBe(true);
    for (const permission of ['leads:write', 'keys:manage', 'config:write'] as Permission[]) {
      expect(authorize(user('READ_ONLY', TENANT_A), TENANT_A, permission).ok).toBe(false);
    }
  });

  it('STAFF and MANAGER cannot mint credentials', () => {
    // A leaked key is permanent access; issuing one is an owner decision.
    expect(authorize(user('RESTAURANT_STAFF', TENANT_A), TENANT_A, 'keys:manage').ok).toBe(false);
    expect(authorize(user('RESTAURANT_MANAGER', TENANT_A), TENANT_A, 'keys:manage').ok).toBe(false);
  });

  it('STAFF and MANAGER cannot change the restaurant configuration', () => {
    expect(authorize(user('RESTAURANT_STAFF', TENANT_A), TENANT_A, 'config:write').ok).toBe(false);
    expect(authorize(user('RESTAURANT_MANAGER', TENANT_A), TENANT_A, 'config:write').ok).toBe(false);
  });

  it('OWNER may manage their own restaurant fully', () => {
    for (const permission of ['tenant:read', 'leads:write', 'keys:manage', 'config:write'] as Permission[]) {
      expect(authorize(user('RESTAURANT_OWNER', TENANT_A), TENANT_A, permission).ok).toBe(true);
    }
  });

  it('NO restaurant role holds platform:admin', () => {
    // The permission that reaches every tenant must belong to exactly one role.
    for (const role of ROLES.filter(isTenantRole)) {
      expect(can(role, 'platform:admin')).toBe(false);
      expect(authorizePlatform(user(role, TENANT_A)).ok).toBe(false);
    }
    expect(can('WBI_ADMIN', 'platform:admin')).toBe(true);
  });

  it('no restaurant role may manage demo data platform-wide', () => {
    for (const role of ROLES.filter(isTenantRole)) {
      expect(can(role, 'demo:manage')).toBe(false);
    }
  });

  it('every permission in the matrix is a declared permission', () => {
    for (const role of ROLES) {
      for (const permission of PERMISSIONS) {
        expect(typeof can(role, permission)).toBe('boolean');
      }
    }
  });
});

describe('actor well-formedness', () => {
  it('requires WBI_ADMIN to have no tenant and every other role to have one', () => {
    expect(isWellFormedActor({ role: 'WBI_ADMIN', tenantId: null })).toBe(true);
    expect(isWellFormedActor({ role: 'WBI_ADMIN', tenantId: TENANT_A })).toBe(false);
    expect(isWellFormedActor({ role: 'RESTAURANT_OWNER', tenantId: TENANT_A })).toBe(true);
    expect(isWellFormedActor({ role: 'RESTAURANT_OWNER', tenantId: null })).toBe(false);
  });

  it('rejects an unknown role string rather than coercing it', () => {
    expect(parseRole('SUPER_ADMIN')).toBeNull();
    expect(parseRole('')).toBeNull();
    expect(parseRole(null)).toBeNull();
    expect(parseRole('WBI_ADMIN')).toBe('WBI_ADMIN');
  });
});

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batteru', hash)).toBe(false);
  });

  it('salts, so identical passwords produce different hashes', async () => {
    const a = await hashPassword('the same password 1');
    const b = await hashPassword('the same password 1');
    expect(a).not.toBe(b);
    expect(await verifyPassword('the same password 1', b)).toBe(true);
  });

  it('never stores the password itself', async () => {
    const hash = await hashPassword('a memorable passphrase');
    expect(hash).not.toContain('memorable');
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('refuses a short password rather than hashing it', async () => {
    await expect(hashPassword('short')).rejects.toThrow();
  });

  it.each([
    ['malformed', 'not-a-hash'],
    ['wrong algorithm', 'bcrypt$1$2$3$4$5'],
    ['empty', ''],
    ['truncated', 'scrypt$16384$8$1$'],
  ])('returns false rather than throwing for a %s stored hash', async (_label, stored) => {
    // A corrupt row must deny access, not 500 and reveal that the account exists.
    expect(await verifyPassword('anything', stored)).toBe(false);
  });

  it('refuses absurd cost parameters from a tampered row', async () => {
    expect(await verifyPassword('x', 'scrypt$1$1$1$c2FsdA$aGFzaA')).toBe(false);
  });

  it('states a minimum bar for passwords protecting customer data', () => {
    expect(passwordProblem('short')).not.toBeNull();
    expect(passwordProblem('123456789012')).not.toBeNull();
    expect(passwordProblem('aaaaaaaaaaaa')).not.toBeNull();
    expect(passwordProblem('a reasonable passphrase')).toBeNull();
  });
});

describe('sessions', () => {
  it('stores only a digest of the token', () => {
    const session = createSessionToken(now);
    expect(session.tokenHash).not.toContain(session.token);
    expect(session.tokenHash).toBe(hashSessionToken(session.token));
    expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never issues the same token twice', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createSessionToken().token));
    expect(tokens.size).toBe(200);
  });

  it('expires absolutely rather than sliding forever', () => {
    const session = createSessionToken(now);
    expect(session.expiresAt.getTime()).toBeGreaterThan(now.getTime());
    const stored = { id: 's1', userId: 'u1', expiresAt: session.expiresAt, revokedAt: null };
    expect(verifySession(stored, new Date(session.expiresAt.getTime() + 1)).valid).toBe(false);
  });

  it.each([
    ['no session', null, 'NO_SESSION'],
    ['revoked', { id: 's', userId: 'u', expiresAt: new Date('2099-01-01'), revokedAt: now }, 'REVOKED'],
    ['expired', { id: 's', userId: 'u', expiresAt: new Date('2020-01-01'), revokedAt: null }, 'EXPIRED'],
  ])('refuses a %s session', (_label, stored, reason) => {
    const verdict = verifySession(stored as never, now);
    expect(verdict.valid).toBe(false);
    if (!verdict.valid) expect(verdict.reason).toBe(reason);
  });

  it('rejects an implausible token before it reaches the database', () => {
    expect(isPlausibleToken(undefined)).toBe(false);
    expect(isPlausibleToken('')).toBe(false);
    expect(isPlausibleToken('short')).toBe(false);
    expect(isPlausibleToken("'; DROP TABLE users --")).toBe(false);
    expect(isPlausibleToken(createSessionToken().token)).toBe(true);
  });

  it('sets a cookie a browser will not hand to JavaScript or a cross-site POST', () => {
    const options = sessionCookieOptions(now, true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.secure).toBe(true);
  });
});

describe('per-tenant webhook secrets', () => {
  it('gives each restaurant a distinct secret', () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).not.toBe(b.hash);
  });

  it('stores only a digest', () => {
    const secret = generateWebhookSecret();
    expect(secret.hash).not.toContain(secret.plaintext);
    expect(secret.hash).toBe(hashWebhookSecret(secret.plaintext));
  });

  it('matches its own secret and rejects another restaurant\'s', () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(webhookSecretMatches(a.plaintext, a.hash)).toBe(true);
    // The vulnerability this closes: one shared secret meant B's holder could
    // sign events naming restaurant A.
    expect(webhookSecretMatches(b.plaintext, a.hash)).toBe(false);
  });

  it('fails closed when a restaurant has no secret configured', () => {
    expect(webhookSecretMatches(generateWebhookSecret().plaintext, null)).toBe(false);
  });

  it('a signature made with one restaurant\'s secret does not verify for another', () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const body = JSON.stringify({ kind: 'SMS_INBOUND', tenantSlug: 'restaurant-a' });

    const signedByB = signPayloadFromHash(b.hash, timestamp, body);

    expect(
      verifyWebhookForTenant({ secretHash: a.hash, signature: signedByB, timestamp, rawBody: body, now }).ok,
    ).toBe(false);
    expect(
      verifyWebhookForTenant({
        secretHash: b.hash,
        signature: signedByB,
        timestamp,
        rawBody: body,
        now,
      }).ok,
    ).toBe(true);
  });

  it('a tenant with no secret cannot be impersonated by any signature', () => {
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const verdict = verifyWebhookForTenant({
      secretHash: null,
      signature: 'anything',
      timestamp,
      rawBody: '{}',
      now,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('NO_SECRET_CONFIGURED');
  });

  it('still rejects a replayed signature even with the right secret', () => {
    const secret = generateWebhookSecret();
    const stale = String(Math.floor(now.getTime() / 1000) - 3600);
    const body = '{}';
    const verdict = verifyWebhookForTenant({
      secretHash: secret.hash,
      signature: signPayloadFromHash(secret.hash, stale, body),
      timestamp: stale,
      rawBody: body,
      now,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('STALE_TIMESTAMP');
  });
});
