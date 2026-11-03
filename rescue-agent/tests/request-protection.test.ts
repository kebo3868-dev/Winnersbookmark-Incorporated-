import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import { sourceAddress, sourceThrottle, throttleSlot, takeBudget, loginAccountBudget, THROTTLE_SLOTS } from '@/lib/frontdesk/security/throttle';
import { historicalDatetime } from '@/lib/validation/zod';

const mocks = vi.hoisted(() => ({
  raw: vi.fn(), user: vi.fn(), session: vi.fn(), update: vi.fn(), failure: vi.fn(), audit: vi.fn(), denial: vi.fn(),
  tenant: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: {
  $queryRaw: mocks.raw,
  fdUser: { findFirst: mocks.user, findUnique: mocks.user, update: mocks.update },
  fdSession: { create: mocks.session }, fdFailure: { upsert: mocks.failure },
  fdAuditLog: { create: mocks.audit, upsert: mocks.denial }, fdTenant: { findUnique: mocks.tenant },
} }));

const env = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  process.env.FRONTDESK_TRUSTED_SOURCE_HEADER = 'x-test-source';
  process.env.BASIC_AUTH_USER = 'operator';
  process.env.BASIC_AUTH_PASSWORD = 'local-verification-operator-password';
  mocks.raw.mockResolvedValue([{ count: 1 }]);
  mocks.user.mockResolvedValue(null);
  mocks.tenant.mockResolvedValue({ id: 'tenant-a', slug: 'a', status: 'ACTIVE', demoMode: true, config: demoTenantConfig });
});
afterEach(() => { process.env = { ...env }; });
const req = (email = 'owner@example.invalid', source = '192.0.2.1', tenantSlug?: string) => new Request('https://x.invalid/api/frontdesk/auth/login', {
  method: 'POST', headers: { 'x-test-source': source }, body: JSON.stringify({ email, password: 'correct-password', tenantSlug }),
});

describe('source trust and admission', () => {
  it('fails closed in production without an explicit trusted ingress contract', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.FRONTDESK_TRUSTED_SOURCE_HEADER;
    expect((await sourceThrottle(req(), 'login'))?.status).toBe(503);
    expect(mocks.raw).not.toHaveBeenCalled();
  });
  it.each(['', '192.0.2.1, 192.0.2.2', 'spoof', 'http://192.0.2.1', '192.0.2.1:123', 'fe80::1%eth0'])('refuses invalid source %j', async source => {
    expect((await sourceThrottle(req('owner@example.invalid', source), 'login'))?.status).toBe(503);
    expect(mocks.raw).not.toHaveBeenCalled();
  });
  it('ignores a forged forwarding chain', () => {
    expect(sourceAddress(new Headers({ 'x-forwarded-for': '192.0.2.9' }))).toBeNull();
  });
  it('refuses production admission with no shared collision-protection key', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.FRONTDESK_THROTTLE_SECRET;
    expect((await sourceThrottle(req(), 'login'))?.status).toBe(503);
    expect(mocks.raw).not.toHaveBeenCalled();
  });
  it('uses the deployment secret to prevent predictable slot collisions', () => {
    process.env.FRONTDESK_THROTTLE_SECRET = 'first-secret-for-local-verification-only';
    const first = Array.from({ length: 10 }, (_, i) => throttleSlot(`account-${i}`));
    process.env.FRONTDESK_THROTTLE_SECRET = 'second-secret-for-local-verification-only';
    expect(Array.from({ length: 10 }, (_, i) => throttleSlot(`account-${i}`))).not.toEqual(first);
  });
  it('canonicalizes IPv6 spellings and privacy addresses to one /64', () => {
    const source = (s: string) => sourceAddress(new Headers({ 'x-test-source': s }));
    expect(source('2001:db8::1')).toBe(source('2001:0db8:0000:0:abcd::99'));
    expect(source('2001:db8:1::1')).not.toBe(source('2001:db8::1'));
    expect(source('::ffff:192.0.2.1')).toBe(source('192.0.2.1'));
    expect(source('::ffff:192.0.2.2')).not.toBe(source('::ffff:192.0.2.1'));
  });
  it('fails closed when the counter database is unavailable', async () => {
    mocks.raw.mockRejectedValue(new Error('offline'));
    expect((await sourceThrottle(req(), 'login'))?.status).toBe(503);
  });
  it('returns a retry window and does no extra recording after exhaustion', async () => {
    mocks.raw.mockResolvedValue([]);
    const response = await sourceThrottle(req(), 'message');
    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBe('60');
    expect(mocks.denial).not.toHaveBeenCalled();
    expect(mocks.failure).not.toHaveBeenCalled();
  });
  it('has bounded slot cardinality even for random attacker inputs', () => {
    for (let i = 0; i < 100_000; i++) expect(throttleSlot(`untrusted-${i}`)).toBeLessThan(THROTTLE_SLOTS);
    expect(throttleSlot('same')).toBe(throttleSlot('same'));
  });
  it('passes source/account identities as a slot and a code-defined namespace', async () => {
    await loginAccountBudget(req('  Owner@Example.Invalid  '), 'tenant-a', '  Owner@Example.Invalid  ');
    const first = mocks.raw.mock.calls[0];
    mocks.raw.mockClear();
    await loginAccountBudget(req(), 'tenant-a', 'owner@example.invalid');
    expect(mocks.raw.mock.calls[0]).toEqual(first);
    expect(JSON.stringify(first)).not.toContain('owner@example.invalid');
    mocks.raw.mockClear();
    await loginAccountBudget(req(), 'tenant-b', 'owner@example.invalid');
    expect(mocks.raw.mock.calls[0][1]).toBe('login:tenant:tenant-b');
  });
  it('separates the platform from an existing tenant whose id is literally platform', async () => {
    await loginAccountBudget(req(), null, 'owner@example.invalid');
    const platform = mocks.raw.mock.calls.at(-1)?.[1];
    await loginAccountBudget(req(), 'platform', 'owner@example.invalid');
    expect(mocks.raw.mock.calls.at(-1)?.[1]).not.toBe(platform);
  });
});

describe.each([undefined, 'a'])('login for %s (platform when omitted)', tenantSlug => {
  it('reserves source and account budgets before looking up credentials', async () => {
    const { POST } = await import('@/app/api/frontdesk/auth/login/route');
    expect((await POST(req(undefined, undefined, tenantSlug) as never)).status).toBe(401);
    expect(mocks.raw).toHaveBeenCalledTimes(2);
    expect(mocks.raw.mock.invocationCallOrder[1]).toBeLessThan(mocks.user.mock.invocationCallOrder[0]);
    expect(mocks.failure).toHaveBeenCalledOnce();
  });
  it.each(['source', 'account'])('blocks %s exhaustion before password work or sessions', async exhausted => {
    mocks.raw.mockResolvedValueOnce(exhausted === 'source' ? [] : [{ count: 1 }]);
    if (exhausted === 'account') mocks.raw.mockResolvedValueOnce([]);
    const { POST } = await import('@/app/api/frontdesk/auth/login/route');
    const response = await POST(req(undefined, undefined, tenantSlug) as never);
    expect(response.status).toBe(exhausted === 'source' ? 429 : 401);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.failure).not.toHaveBeenCalled();
  });
  it('issues exactly one session after valid credentials and admission', async () => {
    const { hashPassword } = await import('@/lib/frontdesk/auth/password');
    mocks.user.mockResolvedValue({ id: 'owner', tenantId: tenantSlug ? 'tenant-a' : null,
      role: tenantSlug ? 'RESTAURANT_OWNER' : 'WBI_ADMIN', status: 'ACTIVE', passwordHash: await hashPassword('correct-password') });
    const { POST } = await import('@/app/api/frontdesk/auth/login/route');
    const response = await POST(req(undefined, undefined, tenantSlug) as never);
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('wbi_fd_session=');
    expect(mocks.session).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it('rejects suspended accounts without session side effects', async () => {
    const { hashPassword } = await import('@/lib/frontdesk/auth/password');
    mocks.user.mockResolvedValue({ id: 'owner', tenantId: tenantSlug ? 'tenant-a' : null,
      role: tenantSlug ? 'RESTAURANT_OWNER' : 'WBI_ADMIN', status: 'SUSPENDED', passwordHash: await hashPassword('correct-password') });
    const { POST } = await import('@/app/api/frontdesk/auth/login/route');
    expect((await POST(req(undefined, undefined, tenantSlug) as never)).status).toBe(401);
    expect(mocks.session).not.toHaveBeenCalled();
  });
});

describe('historical tenant timestamps', () => {
  const fields = ['ownerVerifiedAt', 'telecomAttestedAt', 'failureReviewAttestedAt'];
  it.each(['2026-08-07T10:00Z', '2026-08-07T10:00:00Z', '2026-08-07T10:00:00.123Z'])('loads all historical fields with %s without an incorrect 404', async timestamp => {
    mocks.tenant.mockResolvedValue({ id: 'tenant-a', slug: 'a', config: { restaurantName: 'A', pilot: Object.fromEntries(fields.map(f => [f, timestamp])) } });
    const { getTenantBySlug } = await import('@/lib/frontdesk/store');
    expect((await getTenantBySlug('a'))?.config.pilot.ownerVerifiedAt).toBe(timestamp);
    const { POST } = await import('@/app/api/frontdesk/[tenantSlug]/message/route');
    const response = await POST(new Request('http://x.invalid', { method: 'POST', headers: { 'x-test-source': '192.0.2.1' }, body: JSON.stringify({ message: 'hello' }) }) as never,
      { params: Promise.resolve({ tenantSlug: 'a' }) });
    expect(response.status).toBe(401);
    expect(mocks.denial).toHaveBeenCalledOnce();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each(['2026-08-07T10:00.1Z', '2026-08-07T10:00:00.Z', '2026-02-30T10:00Z', '2026-08-07T25:00Z', '2026-08-07T10:00+01:00', 'bad', '2026-08-07T10:00'])('rejects malformed/disallowed timestamp %s', timestamp => {
    expect(historicalDatetime().safeParse(timestamp).success).toBe(false);
  });
});

it('never treats a malformed counter response as admission', async () => {
  mocks.raw.mockResolvedValue([{ count: undefined }]);
  expect(await takeBudget('source:login', 'source', 30, 60)).toBe(false);
});
