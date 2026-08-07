import { describe, expect, it } from 'vitest';
import {
  ALL_SCOPES,
  KEY_PREFIX,
  SCOPES,
  extractBearerKey,
  generateApiKey,
  hashApiKey,
  hashesMatch,
  parseScopes,
  verifyStoredKey,
  type StoredKey,
} from '@/lib/frontdesk/auth/apiKey';
import { authenticateTenantRequest, isPublicEndpointEnabled } from '@/lib/frontdesk/auth/authenticate';
import { requireAdmin } from '@/lib/frontdesk/auth/admin';

/**
 * PER-TENANT AUTHENTICATION (Phase 2, milestone 1)
 *
 * The property under test throughout: possessing a valid credential proves
 * nothing about WHICH restaurant you may address. Every rejection path is
 * exercised, because a single missed one is a cross-tenant breach.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const now = new Date('2026-08-07T12:00:00Z');

function storedKey(overrides: Partial<StoredKey> = {}): StoredKey {
  return {
    id: 'key-1',
    tenantId: TENANT_A,
    keyHash: 'hash',
    scopes: [SCOPES.MESSAGE_WRITE],
    revokedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

describe('key generation', () => {
  it('produces a prefixed, high-entropy key', () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith(`${KEY_PREFIX}_`)).toBe(true);
    expect(key.plaintext.length).toBeGreaterThan(30);
    expect(key.prefix).toBe(key.plaintext.slice(0, KEY_PREFIX.length + 7));
  });

  it('never repeats a key', () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateApiKey().plaintext));
    expect(keys.size).toBe(200);
  });

  it('stores a digest, not the key itself', () => {
    const key = generateApiKey();
    expect(key.keyHash).not.toContain(key.plaintext);
    expect(key.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(key.keyHash).toBe(hashApiKey(key.plaintext));
  });

  it('digests differ for keys differing by one character', () => {
    const a = hashApiKey('wbifd_aaaaaaaaaaaaaaaaaaaaaaaa');
    const b = hashApiKey('wbifd_aaaaaaaaaaaaaaaaaaaaaaab');
    expect(a).not.toBe(b);
  });
});

describe('digest comparison', () => {
  it('matches identical digests and rejects different ones', () => {
    expect(hashesMatch('abc', 'abc')).toBe(true);
    expect(hashesMatch('abc', 'abd')).toBe(false);
  });

  it('rejects rather than throwing on a length mismatch', () => {
    expect(hashesMatch('abc', 'abcdef')).toBe(false);
  });
});

describe('bearer extraction', () => {
  it('accepts a well-formed header', () => {
    const key = generateApiKey().plaintext;
    expect(extractBearerKey(`Bearer ${key}`)).toBe(key);
    expect(extractBearerKey(`bearer ${key}`)).toBe(key);
  });

  it.each([
    ['null header', null],
    ['empty', ''],
    ['basic credential', 'Basic dXNlcjpwYXNz'],
    ['bearer with no token', 'Bearer '],
    ['token without our prefix', 'Bearer sk-some-other-vendor-key'],
    ['token too short', 'Bearer wbifd_abc'],
    ['two tokens', 'Bearer wbifd_aaaaaaaaaaaaaaaaaaaa extra'],
  ])('rejects %s', (_label, header) => {
    expect(extractBearerKey(header)).toBeNull();
  });

  it('rejects an absurdly long token before it reaches the database', () => {
    expect(extractBearerKey(`Bearer ${KEY_PREFIX}_${'a'.repeat(500)}`)).toBeNull();
  });
});

describe('stored key verification', () => {
  it('accepts the right key for the right tenant with the right scope', () => {
    const verdict = verifyStoredKey(storedKey(), TENANT_A, SCOPES.MESSAGE_WRITE, now);
    expect(verdict).toEqual({ ok: true, keyId: 'key-1', tenantId: TENANT_A });
  });

  it('REJECTS a valid key presented for another tenant', () => {
    // The central isolation guarantee of this milestone.
    const verdict = verifyStoredKey(storedKey(), TENANT_B, SCOPES.MESSAGE_WRITE, now);
    expect(verdict).toEqual({ ok: false, reason: 'WRONG_TENANT' });
  });

  it('rejects an unknown key', () => {
    expect(verifyStoredKey(null, TENANT_A, SCOPES.MESSAGE_WRITE, now)).toEqual({
      ok: false,
      reason: 'UNKNOWN_KEY',
    });
  });

  it('rejects a revoked key', () => {
    const verdict = verifyStoredKey(
      storedKey({ revokedAt: new Date('2026-08-01T00:00:00Z') }),
      TENANT_A,
      SCOPES.MESSAGE_WRITE,
      now,
    );
    expect(verdict).toEqual({ ok: false, reason: 'REVOKED_KEY' });
  });

  it('rejects an expired key', () => {
    const verdict = verifyStoredKey(
      storedKey({ expiresAt: new Date('2026-08-06T00:00:00Z') }),
      TENANT_A,
      SCOPES.MESSAGE_WRITE,
      now,
    );
    expect(verdict).toEqual({ ok: false, reason: 'EXPIRED_KEY' });
  });

  it('accepts a key that has not yet expired', () => {
    const verdict = verifyStoredKey(
      storedKey({ expiresAt: new Date('2026-09-01T00:00:00Z') }),
      TENANT_A,
      SCOPES.MESSAGE_WRITE,
      now,
    );
    expect(verdict.ok).toBe(true);
  });

  it('treats expiry as inclusive — a key expiring exactly now is dead', () => {
    const verdict = verifyStoredKey(storedKey({ expiresAt: now }), TENANT_A, SCOPES.MESSAGE_WRITE, now);
    expect(verdict).toEqual({ ok: false, reason: 'EXPIRED_KEY' });
  });

  it('rejects a key lacking the required scope', () => {
    const verdict = verifyStoredKey(
      storedKey({ scopes: [SCOPES.LEADS_READ] }),
      TENANT_A,
      SCOPES.MESSAGE_WRITE,
      now,
    );
    expect(verdict).toEqual({ ok: false, reason: 'MISSING_SCOPE' });
  });

  it('checks revocation before tenant match, so a dead key cannot probe tenants', () => {
    // A revoked key aimed at the wrong tenant must report REVOKED, not
    // WRONG_TENANT — otherwise the distinction leaks which tenant it belonged to.
    const verdict = verifyStoredKey(
      storedKey({ revokedAt: new Date('2026-08-01T00:00:00Z') }),
      TENANT_B,
      SCOPES.MESSAGE_WRITE,
      now,
    );
    expect(verdict).toEqual({ ok: false, reason: 'REVOKED_KEY' });
  });
});

describe('scope parsing', () => {
  it('accepts known scopes and de-duplicates', () => {
    expect(parseScopes([SCOPES.MESSAGE_WRITE, SCOPES.MESSAGE_WRITE])).toEqual([SCOPES.MESSAGE_WRITE]);
  });

  it.each([
    ['unknown scope', ['admin:everything']],
    ['empty list', []],
    ['not an array', 'message:write'],
    ['non-string member', [SCOPES.MESSAGE_WRITE, 42]],
  ])('rejects %s', (_label, value) => {
    expect(parseScopes(value)).toBeNull();
  });

  it('exposes no scope granting cross-tenant or admin access', () => {
    for (const scope of ALL_SCOPES) {
      expect(scope).not.toMatch(/admin|tenant:|global|\*/);
    }
  });
});

describe('request authentication', () => {
  const env = { BASIC_AUTH_USER: 'wbi', BASIC_AUTH_PASSWORD: 'secret', NODE_ENV: 'production' };
  const lookup = (stored: StoredKey | null) => async () => stored;

  it('authenticates a tenant key bound to the path tenant', async () => {
    const result = await authenticateTenantRequest({
      authorizationHeader: `Bearer ${KEY_PREFIX}_aaaaaaaaaaaaaaaaaaaaaaaa`,
      expectedTenantId: TENANT_A,
      requiredScope: SCOPES.MESSAGE_WRITE,
      lookupKey: lookup(storedKey()),
      now,
      env,
    });
    expect(result).toEqual({ ok: true, actor: { kind: 'TENANT_KEY', tenantId: TENANT_A, keyId: 'key-1' } });
  });

  it("rejects tenant A's key on tenant B's endpoint with 401", async () => {
    const result = await authenticateTenantRequest({
      authorizationHeader: `Bearer ${KEY_PREFIX}_aaaaaaaaaaaaaaaaaaaaaaaa`,
      expectedTenantId: TENANT_B,
      requiredScope: SCOPES.MESSAGE_WRITE,
      lookupKey: lookup(storedKey()),
      now,
      env,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('WRONG_TENANT');
      expect(result.failure.status).toBe(401);
    }
  });

  it('does NOT fall back to admin access when a bearer key is invalid', async () => {
    // A browser session holding the admin cookie must not rescue a revoked key.
    const result = await authenticateTenantRequest({
      authorizationHeader: `Bearer ${KEY_PREFIX}_aaaaaaaaaaaaaaaaaaaaaaaa`,
      expectedTenantId: TENANT_A,
      requiredScope: SCOPES.MESSAGE_WRITE,
      lookupKey: lookup(storedKey({ revokedAt: new Date('2026-08-01T00:00:00Z') })),
      now,
      env,
    });
    expect(result.ok).toBe(false);
  });

  it('authenticates a WBI admin with Basic credentials', async () => {
    const header = `Basic ${Buffer.from('wbi:secret').toString('base64')}`;
    const result = await authenticateTenantRequest({
      authorizationHeader: header,
      expectedTenantId: TENANT_A,
      requiredScope: SCOPES.MESSAGE_WRITE,
      lookupKey: lookup(null),
      now,
      env,
    });
    expect(result).toEqual({ ok: true, actor: { kind: 'WBI_ADMIN' } });
  });

  it('rejects wrong Basic credentials', async () => {
    const header = `Basic ${Buffer.from('wbi:wrong').toString('base64')}`;
    const result = await authenticateTenantRequest({
      authorizationHeader: header,
      expectedTenantId: TENANT_A,
      requiredScope: SCOPES.MESSAGE_WRITE,
      lookupKey: lookup(null),
      now,
      env,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a request with no credentials at all', async () => {
    const result = await authenticateTenantRequest({
      authorizationHeader: null,
      expectedTenantId: TENANT_A,
      requiredScope: SCOPES.MESSAGE_WRITE,
      lookupKey: lookup(null),
      now,
      env,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.status).toBe(401);
  });

  it('fails closed in production when no admin credentials are configured', async () => {
    const result = await authenticateTenantRequest({
      authorizationHeader: null,
      expectedTenantId: TENANT_A,
      requiredScope: SCOPES.MESSAGE_WRITE,
      lookupKey: lookup(null),
      now,
      env: { NODE_ENV: 'production' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.status).toBe(503);
  });

  it('returns 403 only for an under-scoped key of the correct tenant', async () => {
    const result = await authenticateTenantRequest({
      authorizationHeader: `Bearer ${KEY_PREFIX}_aaaaaaaaaaaaaaaaaaaaaaaa`,
      expectedTenantId: TENANT_A,
      requiredScope: SCOPES.MESSAGE_WRITE,
      lookupKey: lookup(storedKey({ scopes: [SCOPES.LEADS_READ] })),
      now,
      env,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.status).toBe(403);
  });

  it('gives an unknown key and a wrong-tenant key the same status, so keys cannot be enumerated', async () => {
    const common = {
      authorizationHeader: `Bearer ${KEY_PREFIX}_aaaaaaaaaaaaaaaaaaaaaaaa`,
      requiredScope: SCOPES.MESSAGE_WRITE,
      now,
      env,
    };
    const unknown = await authenticateTenantRequest({
      ...common,
      expectedTenantId: TENANT_A,
      lookupKey: lookup(null),
    });
    const wrongTenant = await authenticateTenantRequest({
      ...common,
      expectedTenantId: TENANT_B,
      lookupKey: lookup(storedKey()),
    });
    expect(unknown.ok).toBe(false);
    expect(wrongTenant.ok).toBe(false);
    if (!unknown.ok && !wrongTenant.ok) {
      expect(unknown.failure.status).toBe(wrongTenant.failure.status);
    }
  });
});

describe('public endpoint exposure flag', () => {
  it('is OFF unless explicitly enabled', () => {
    expect(isPublicEndpointEnabled({})).toBe(false);
    expect(isPublicEndpointEnabled({ FRONTDESK_PUBLIC_ENDPOINT_ENABLED: 'false' })).toBe(false);
    expect(isPublicEndpointEnabled({ FRONTDESK_PUBLIC_ENDPOINT_ENABLED: '1' })).toBe(false);
    expect(isPublicEndpointEnabled({ FRONTDESK_PUBLIC_ENDPOINT_ENABLED: 'TRUE' })).toBe(false);
  });

  it('is on only for the exact string "true"', () => {
    expect(isPublicEndpointEnabled({ FRONTDESK_PUBLIC_ENDPOINT_ENABLED: 'true' })).toBe(true);
  });
});

describe('admin-only guard', () => {
  const env = { BASIC_AUTH_USER: 'wbi', BASIC_AUTH_PASSWORD: 'secret', NODE_ENV: 'production' };
  const request = (authorization: string | null) =>
    ({ headers: { get: (name: string) => (name === 'authorization' ? authorization : null) } }) as never;

  it('refuses a tenant API key outright, so a leaked key cannot mint more keys', () => {
    // In production the app-wide middleware rejects this first with a 401.
    // This asserts the route's own guard independently, so the property holds
    // even if that middleware is ever relaxed for this path.
    const guard = requireAdmin(request(`Bearer ${KEY_PREFIX}_aaaaaaaaaaaaaaaaaaaaaaaa`), env);
    expect(guard.ok).toBe(false);
    if (!guard.ok) expect(guard.response.status).toBe(403);
  });

  it('accepts the operator credential', () => {
    const header = `Basic ${Buffer.from('wbi:secret').toString('base64')}`;
    expect(requireAdmin(request(header), env).ok).toBe(true);
  });

  it('rejects a wrong operator credential', () => {
    const header = `Basic ${Buffer.from('wbi:wrong').toString('base64')}`;
    const guard = requireAdmin(request(header), env);
    expect(guard.ok).toBe(false);
    if (!guard.ok) expect(guard.response.status).toBe(401);
  });

  it('fails closed in production with no credentials configured', () => {
    const guard = requireAdmin(request(null), { NODE_ENV: 'production' });
    expect(guard.ok).toBe(false);
    if (!guard.ok) expect(guard.response.status).toBe(503);
  });
});
