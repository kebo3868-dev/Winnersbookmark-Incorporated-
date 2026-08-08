import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';

/**
 * UNAUTHENTICATED WRITE PREVENTION
 *
 * The vulnerability these tests exist to prevent:
 *
 *   Four front desk routes must be reachable without the operator credential —
 *   two provider webhooks, the scheduler trigger, and sign-in. Every one of
 *   them recorded a database row BEFORE returning 401. So anyone on the
 *   internet could write to a production database, one row per request, with
 *   no credential, forever. The cron route answered GET, so an ordinary
 *   crawler did it by accident.
 *
 *   Storage growth was the lesser half. The failure queue is the surface the
 *   operations runbook makes the linchpin of every safety guarantee, and an
 *   outsider could bury a genuine "critical alert reached nobody" entry under
 *   an unlimited number of junk rows. That turns a denial-of-service into a
 *   safety failure.
 *
 * The property under test is therefore stronger than "returns 401": it is
 * "performs no unbounded database write". A 401 that still writes is exactly
 * the bug that existed.
 *
 * These call the REAL exported route handlers against a Prisma double that
 * records every call, so they exercise the shipped code rather than a description of
 * it.
 */

// --- Prisma call recorder ---------------------------------------------------

/** Prisma methods that create, modify or delete rows. */
const WRITE_METHODS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

type Call = { model: string; method: string; args: unknown };

const calls: Call[] = [];

/** Rows the double pretends already exist, keyed by `model.method`. */
const canned = new Map<string, unknown>();

function modelProxy(model: string) {
  return new Proxy(
    {},
    {
      get(_target, method: string) {
        return (args: unknown) => {
          calls.push({ model, method, args });
          const key = `${model}.${method}`;
          if (canned.has(key)) return Promise.resolve(canned.get(key));
          if (method === 'findMany') return Promise.resolve([]);
          if (method === 'count') return Promise.resolve(0);
          return Promise.resolve(null);
        };
      },
    },
  );
}

const prismaDouble = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (prop === '$queryRaw' || prop === '$queryRawUnsafe') {
        return (...args: unknown[]) => {
          calls.push({ model: '$raw', method: prop, args });
          return Promise.resolve([{ '?column?': 1 }]);
        };
      }
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe') {
        return (...args: unknown[]) => {
          calls.push({ model: '$raw', method: prop, args });
          return Promise.resolve(0);
        };
      }
      if (prop === '$transaction') {
        return async (fn: (tx: unknown) => unknown) =>
          typeof fn === 'function' ? fn(prismaDouble) : Promise.resolve([]);
      }
      if (prop === 'then') return undefined;
      return modelProxy(prop);
    },
  },
);

/**
 * The route handlers read the cookie and the authorization header through
 * `next/headers`, which only works inside a real request scope. These are
 * driven from a mutable context so a test can present a forged cookie — and
 * genuinely reach the authorization check rather than stopping earlier.
 */
const requestContext = { cookies: new Map<string, string>(), headers: new Map<string, string>() };

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = requestContext.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
  headers: async () => ({
    get: (name: string) => requestContext.headers.get(name.toLowerCase()) ?? null,
  }),
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaDouble,
  resolveDatabaseUrl: () => 'postgresql://localhost:5432/test',
  resolveDatabaseUrlSource: () => 'DATABASE_URL',
  RUNTIME_URL_SOURCES: ['DATABASE_URL'],
}));

function writes(): Call[] {
  return calls.filter((c) => WRITE_METHODS.has(c.method) || c.method.startsWith('$executeRaw'));
}

function describeWrites(): string {
  return writes()
    .map((c) => `${c.model}.${c.method}`)
    .join(', ');
}

// --- Fixtures ---------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  calls.length = 0;
  canned.clear();
  requestContext.cookies.clear();
  requestContext.headers.clear();
  process.env.SMS_PROVIDER = 'mock';
  process.env.SMS_WEBHOOK_SECRET = 'a-configured-platform-webhook-secret';
  process.env.CRON_SECRET = 'a-configured-cron-secret-value';
  process.env.BASIC_AUTH_USER = 'operator';
  process.env.BASIC_AUTH_PASSWORD = 'a-long-enough-operator-password';
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_STATUS_CALLBACK_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

const post = (url: string, body: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });

// ===========================================================================
// 1. THE VULNERABILITY, ROUTE BY ROUTE
// ===========================================================================

describe('delivery-status webhook', () => {
  it('writes NOTHING for a request with no signature', async () => {
    const { POST } = await import('@/app/api/frontdesk/notifications/webhook/route');
    const response = await POST(post('https://x.invalid/api/frontdesk/notifications/webhook', '{}') as never);

    expect(response.status).toBe(401);
    expect(writes(), `unexpected writes: ${describeWrites()}`).toHaveLength(0);
  });

  it('writes nothing across a burst of unsigned requests', async () => {
    const { POST } = await import('@/app/api/frontdesk/notifications/webhook/route');
    for (let i = 0; i < 50; i++) {
      await POST(post('https://x.invalid/api/frontdesk/notifications/webhook', `{"n":${i}}`) as never);
    }
    expect(writes()).toHaveLength(0);
  });

  it('DOES record a coalesced rejection when a signature was presented but failed', async () => {
    // A real misconfiguration — a rotated secret — must still reach an
    // operator. Silence here would trade one bug for another.
    const { POST } = await import('@/app/api/frontdesk/notifications/webhook/route');
    await POST(
      post('https://x.invalid/api/frontdesk/notifications/webhook', '{}', {
        'x-wbi-signature': 'deadbeef',
        'x-wbi-timestamp': String(Math.floor(Date.now() / 1000)),
      }) as never,
    );

    const upserts = writes().filter((c) => c.method === 'upsert');
    expect(upserts).toHaveLength(1);
    expect(writes().filter((c) => c.method === 'create')).toHaveLength(0);
  });

  it('coalesces a burst of bad signatures onto ONE row', async () => {
    const { POST } = await import('@/app/api/frontdesk/notifications/webhook/route');
    const timestamp = String(Math.floor(Date.now() / 1000));
    for (let i = 0; i < 40; i++) {
      await POST(
        post('https://x.invalid/api/frontdesk/notifications/webhook', `{"n":${i}}`, {
          'x-wbi-signature': `bad-${i}`,
          'x-wbi-timestamp': timestamp,
        }) as never,
      );
    }

    const keys = new Set(
      writes()
        .filter((c) => c.method === 'upsert')
        .map((c) => (c.args as { where: { dedupeKey: string } }).where.dedupeKey),
    );
    // 40 requests, one row.
    expect(keys.size).toBe(1);
    expect(writes().every((c) => c.method === 'upsert')).toBe(true);
  });
});

describe('scheduled dispatch trigger', () => {
  it('writes NOTHING for a bare GET — the crawler case', async () => {
    // This is how it happened by accident: the route answers GET, so any
    // scanner walking the site wrote a row.
    const { GET } = await import('@/app/api/frontdesk/notifications/cron/route');
    const response = await GET(
      new Request('https://x.invalid/api/frontdesk/notifications/cron') as never,
    );

    expect(response.status).toBe(401);
    expect(writes(), `unexpected writes: ${describeWrites()}`).toHaveLength(0);
  });

  it('writes NOTHING for a bare POST', async () => {
    const { POST } = await import('@/app/api/frontdesk/notifications/cron/route');
    const response = await POST(
      new Request('https://x.invalid/api/frontdesk/notifications/cron', { method: 'POST' }) as never,
    );
    expect(response.status).toBe(401);
    expect(writes()).toHaveLength(0);
  });

  it('records a coalesced rejection when a wrong secret WAS presented', async () => {
    const { POST } = await import('@/app/api/frontdesk/notifications/cron/route');
    await POST(
      new Request('https://x.invalid/api/frontdesk/notifications/cron', {
        method: 'POST',
        headers: { authorization: 'Bearer the-wrong-secret-entirely' },
      }) as never,
    );
    expect(writes().filter((c) => c.method === 'upsert')).toHaveLength(1);
  });

  it('never runs a dispatch cycle for an unauthenticated caller', async () => {
    const { GET } = await import('@/app/api/frontdesk/notifications/cron/route');
    await GET(new Request('https://x.invalid/api/frontdesk/notifications/cron') as never);
    // The claim query is the first thing a real cycle does.
    expect(calls.filter((c) => c.method.startsWith('$queryRaw'))).toHaveLength(0);
  });
});

describe('inbound messaging webhook', () => {
  const body = JSON.stringify({
    kind: 'SMS_INBOUND',
    provider: 'test',
    eventId: 'evt-1',
    tenantSlug: 'demo-harbor-house',
    from: '+15555550123',
    body: 'hello',
  });

  it('writes NOTHING, and does not even READ, without a signature', async () => {
    // Before the fix this reached a tenant lookup (a read an attacker could
    // drive) and then a failure write.
    const { POST } = await import('@/app/api/frontdesk/sms/inbound/route');
    const response = await POST(post('https://x.invalid/api/frontdesk/sms/inbound', body) as never);

    expect(response.status).toBe(401);
    expect(writes()).toHaveLength(0);
    expect(calls, `unexpected database work: ${calls.map((c) => `${c.model}.${c.method}`).join(', ')}`).toHaveLength(0);
  });

  it('writes nothing across a burst of unsigned requests naming a real restaurant', async () => {
    const { POST } = await import('@/app/api/frontdesk/sms/inbound/route');
    for (let i = 0; i < 30; i++) {
      await POST(post('https://x.invalid/api/frontdesk/sms/inbound', body) as never);
    }
    expect(calls).toHaveLength(0);
  });

  it('never echoes the caller-supplied slug into an operator-visible record', async () => {
    // The slug is attacker-chosen. Writing it into the failure queue would let
    // an outsider put text on a restaurant's dashboard.
    const { POST } = await import('@/app/api/frontdesk/sms/inbound/route');
    const hostile = JSON.stringify({
      kind: 'SMS_INBOUND',
      provider: 'test',
      eventId: 'evt-2',
      tenantSlug: 'CALL-THIS-NUMBER-NOW',
      from: '+15555550123',
      body: 'x',
    });
    await POST(
      post('https://x.invalid/api/frontdesk/sms/inbound', hostile, {
        'x-wbi-signature': 'deadbeef',
        'x-wbi-timestamp': String(Math.floor(Date.now() / 1000)),
      }) as never,
    );

    expect(JSON.stringify(writes())).not.toContain('CALL-THIS-NUMBER-NOW');
  });
});

describe('sign-in', () => {
  it('does not write an audit row per failed attempt', async () => {
    // A sign-in endpoint cannot sit behind the credential it exists to obtain,
    // so it is reachable by anyone. One audit row per attempt made it an
    // unbounded write primitive.
    const { POST } = await import('@/app/api/frontdesk/auth/login/route');

    for (let i = 0; i < 40; i++) {
      await POST(
        post('https://x.invalid/api/frontdesk/auth/login', JSON.stringify({ email: `a${i}@b.invalid`, password: 'x' })) as never,
      );
    }

    expect(calls.filter((c) => c.model === 'fdAuditLog' && c.method === 'create')).toHaveLength(0);
  });

  it('coalesces failed sign-ins onto one row per hour', async () => {
    const { POST } = await import('@/app/api/frontdesk/auth/login/route');
    for (let i = 0; i < 40; i++) {
      await POST(
        post('https://x.invalid/api/frontdesk/auth/login', JSON.stringify({ email: `a${i}@b.invalid`, password: 'x' })) as never,
      );
    }

    const keys = new Set(
      writes()
        .filter((c) => c.method === 'upsert' && c.model === 'fdFailure')
        .map((c) => (c.args as { where: { dedupeKey: string } }).where.dedupeKey),
    );
    expect(keys.size).toBeLessThanOrEqual(1);
  });

  it('does not raise an unhandled error for an administrator sign-in', async () => {
    /**
     * A Winners Bookmark administrator has tenantId NULL, and a compound
     * unique lookup cannot take null: `findUnique({ tenantId_email: { tenantId:
     * null } })` throws at runtime. A `tenantId as string` cast hid that from
     * the compiler, so every administrator sign-in attempt raised an unhandled
     * Prisma error and returned 500 — on an endpoint reachable by anyone.
     *
     * Asserted on the QUERY rather than the response, because a Prisma double
     * cannot reproduce the real client's runtime validation: with the double,
     * the broken call would silently succeed and the test would pass.
     */
    const { login } = await import('@/lib/frontdesk/auth/users');
    await login(null, 'admin@example.invalid', 'x', prismaDouble as never);

    const lookup = calls.find((c) => c.model === 'fdUser');
    expect(lookup?.method).toBe('findFirst');
    expect(JSON.stringify(lookup?.args)).toContain('"tenantId":null');
  });

  it('still uses the compound unique lookup for a restaurant user', async () => {
    const { login } = await import('@/lib/frontdesk/auth/users');
    await login('tenant-1', 'staff@example.invalid', 'x', prismaDouble as never);

    const lookup = calls.find((c) => c.model === 'fdUser');
    expect(lookup?.method).toBe('findUnique');
  });

  it('rejects an unparseable body before any database work', async () => {
    const { POST } = await import('@/app/api/frontdesk/auth/login/route');
    const response = await POST(post('https://x.invalid/api/frontdesk/auth/login', 'not json') as never);
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

// ===========================================================================
// 2. THE MIDDLEWARE BYPASS
// ===========================================================================

describe('a forged session cookie reaches the surface but changes nothing', () => {
  /**
   * The middleware lets any `/api/frontdesk/*` request past Basic Auth when it
   * carries a cookie of the right SHAPE — it runs on the edge and cannot reach
   * the database to verify it. That is safe only because every surface behind
   * it authorizes for itself.
   *
   * A real tenant is canned in, so these reach the AUTHORIZATION check rather
   * than stopping at a 404 from an empty database. Without that the tests
   * would pass for the wrong reason and prove nothing.
   */
  const FORGED = 'a'.repeat(48);

  beforeEach(() => {
    requestContext.cookies.set('wbi_fd_session', FORGED);
    canned.set('fdTenant.findUnique', {
      id: 'tenant-1',
      slug: 'demo-harbor-house',
      name: 'Harbor House',
      status: 'ONBOARDING',
      demoMode: true,
      config: demoTenantConfig,
      webhookSecretHash: null,
    });
    // The forged token resolves to no session: the row does not exist.
    canned.set('fdSession.findUnique', null);
  });

  const forgedRequest = (url: string, body: string) =>
    post(url, body, { cookie: `wbi_fd_session=${FORGED}` });

  it('is refused by the session lookup rather than trusted by the middleware', async () => {
    const { getSessionActor } = await import('@/lib/frontdesk/auth/actor');
    const actor = await getSessionActor(prismaDouble as never);
    expect(actor).toBeNull();
    // It DID reach the database, which is the point: the edge cannot decide.
    expect(calls.some((c) => c.model === 'fdSession')).toBe(true);
  });

  it('cannot activate a restaurant', async () => {
    const { POST } = await import('@/app/api/frontdesk/[tenantSlug]/activate/route');
    const response = await POST(
      forgedRequest('https://x.invalid/api/frontdesk/demo-harbor-house/activate', '{"confirm":true}') as never,
      { params: Promise.resolve({ tenantSlug: 'demo-harbor-house' }) },
    );

    expect([401, 403]).toContain(response.status);
    expect(writes(), `unexpected writes: ${describeWrites()}`).toHaveLength(0);
  });

  it('cannot send a rota test message', async () => {
    const { POST } = await import('@/app/api/frontdesk/[tenantSlug]/rota/route');
    const response = await POST(
      forgedRequest('https://x.invalid/api/frontdesk/demo-harbor-house/rota', '{"contactKey":"manager"}') as never,
      { params: Promise.resolve({ tenantSlug: 'demo-harbor-house' }) },
    );

    expect([401, 403]).toContain(response.status);
    expect(writes()).toHaveLength(0);
  });

  it('cannot mint an API key', async () => {
    const { POST } = await import('@/app/api/frontdesk/[tenantSlug]/keys/route');
    const response = await POST(
      forgedRequest(
        'https://x.invalid/api/frontdesk/demo-harbor-house/keys',
        '{"name":"x","scopes":["message:write"]}',
      ) as never,
      { params: Promise.resolve({ tenantSlug: 'demo-harbor-house' }) },
    );
    expect([401, 403]).toContain(response.status);
    expect(writes()).toHaveLength(0);
  });

  it('cannot seed or purge demo data', async () => {
    const route = await import('@/app/api/frontdesk/demo/route');

    const seeded = await route.POST();
    expect([401, 403]).toContain(seeded.status);

    const purged = await route.DELETE(
      new Request('https://x.invalid/api/frontdesk/demo?confirm=true', { method: 'DELETE' }) as never,
    );
    expect([401, 403]).toContain(purged.status);
    expect(writes()).toHaveLength(0);
  });

  it('cannot change a lead', async () => {
    const { PATCH } = await import('@/app/api/frontdesk/[tenantSlug]/leads/[leadId]/route');
    const response = await PATCH(
      new Request('https://x.invalid/api/frontdesk/demo-harbor-house/leads/lead-1', {
        method: 'PATCH',
        body: '{"status":"WON"}',
        headers: { 'content-type': 'application/json', cookie: `wbi_fd_session=${FORGED}` },
      }) as never,
      { params: Promise.resolve({ tenantSlug: 'demo-harbor-house', leadId: 'lead-1' }) },
    );
    expect([401, 403]).toContain(response.status);
    expect(writes()).toHaveLength(0);
  });
});

// ===========================================================================
// 3. HEALTH DISCLOSURE
// ===========================================================================

describe('health endpoint', () => {
  it('serves liveness to anyone', async () => {
    const { GET } = await import('@/app/api/health/route');
    const body = await (await GET(new Request('https://x.invalid/api/health') as never)).json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('up');
  });

  it('does NOT disclose configuration to an unauthenticated caller', async () => {
    // "auth: MISSING" told an anonymous caller that every route was currently
    // unprotected — a signal an attacker could poll for.
    const { GET } = await import('@/app/api/health/route');
    const body = await (await GET(new Request('https://x.invalid/api/health') as never)).json();

    expect(body.config).toBeUndefined();
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('DATABASE_URL');
    expect(serialised).not.toContain('BASIC_AUTH');
    expect(serialised).not.toMatch(/MISSING|configured|open \(non-production\)/);
  });

  it('discloses configuration to an operator', async () => {
    const { GET } = await import('@/app/api/health/route');
    const authorization = `Basic ${Buffer.from('operator:a-long-enough-operator-password').toString('base64')}`;
    const body = await (
      await GET(new Request('https://x.invalid/api/health', { headers: { authorization } }) as never)
    ).json();

    expect(body.config).toBeDefined();
    expect(body.config.databaseSource).toBe('DATABASE_URL');
  });

  it('withholds configuration from EVERYONE when no credential is configured', async () => {
    // Strictest in the state it would be most damaging to disclose.
    delete process.env.BASIC_AUTH_USER;
    delete process.env.BASIC_AUTH_PASSWORD;
    const { GET } = await import('@/app/api/health/route');
    const authorization = `Basic ${Buffer.from('operator:a-long-enough-operator-password').toString('base64')}`;
    const body = await (
      await GET(new Request('https://x.invalid/api/health', { headers: { authorization } }) as never)
    ).json();

    expect(body.config).toBeUndefined();
  });

  it('never returns a secret value', async () => {
    process.env.CRON_SECRET = 'super-secret-cron-value-here';
    const { GET } = await import('@/app/api/health/route');
    const authorization = `Basic ${Buffer.from('operator:a-long-enough-operator-password').toString('base64')}`;
    const body = await (
      await GET(new Request('https://x.invalid/api/health', { headers: { authorization } }) as never)
    ).json();

    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('super-secret-cron-value-here');
    expect(serialised).not.toContain('a-long-enough-operator-password');
  });
});

// ===========================================================================
// 4. STRUCTURAL GUARD
// ===========================================================================

describe('structural guard: the exempt-route list is pinned', () => {
  /**
   * Adding a route to the middleware's bypass list makes it internet-reachable.
   * That decision should never be made incidentally, so the list is pinned
   * here: adding one fails this test and forces whoever added it to audit the
   * route's write paths.
   */
  const middleware = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8');

  it('exempts exactly the four known signed routes', () => {
    const block = middleware.slice(
      middleware.indexOf('const SIGNED_WEBHOOK_ROUTES'),
      middleware.indexOf('const SELF_AUTHORIZING_AREA'),
    );
    const patterns = [...block.matchAll(/\/\^\\\/([^/]*(?:\\\/[^/]*)*)\$\//g)].map((m) => m[0]);
    expect(patterns).toHaveLength(4);
    expect(block).toContain('notifications\\/webhook');
    expect(block).toContain('notifications\\/cron');
    expect(block).toContain('sms\\/inbound');
    expect(block).toContain('auth\\/(login|logout)');
  });

  it('keeps the public message endpoint behind an explicit opt-in', () => {
    expect(middleware).toContain("FRONTDESK_PUBLIC_ENDPOINT_ENABLED !== 'true'");
  });

  it('every exempt write-capable route routes rejections through noteRejection', () => {
    for (const file of [
      'src/app/api/frontdesk/notifications/webhook/route.ts',
      'src/app/api/frontdesk/notifications/cron/route.ts',
      'src/app/api/frontdesk/sms/inbound/route.ts',
      'src/app/api/frontdesk/auth/login/route.ts',
    ]) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, `${file} does not use the bounded recorder`).toContain('noteRejection');
    }
  });
});

// ===========================================================================
// 5. THE RECORDER ITSELF
// ===========================================================================

describe('noteRejection', () => {
  it('writes nothing at all when no credential was presented', async () => {
    const { noteRejection } = await import('@/lib/frontdesk/security/rejections');
    const wrote = await noteRejection(
      {
        tenantId: null,
        category: 'FAILED_WEBHOOK',
        operation: 'test.op',
        reason: 'NO_SIGNATURE',
        detail: 'x',
        credentialPresented: false,
      },
      prismaDouble as never,
    );

    expect(wrote).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('upserts, never creates, when a credential was presented', async () => {
    const { noteRejection } = await import('@/lib/frontdesk/security/rejections');
    await noteRejection(
      {
        tenantId: null,
        category: 'FAILED_WEBHOOK',
        operation: 'test.op',
        reason: 'BAD_SIGNATURE',
        detail: 'x',
        credentialPresented: true,
      },
      prismaDouble as never,
    );

    expect(calls.map((c) => c.method)).toEqual(['upsert']);
  });

  it('increments rather than rewriting, so a caller cannot poison the detail', async () => {
    const { noteRejection } = await import('@/lib/frontdesk/security/rejections');
    await noteRejection(
      {
        tenantId: null,
        category: 'FAILED_WEBHOOK',
        operation: 'test.op',
        reason: 'BAD_SIGNATURE',
        detail: 'x',
        credentialPresented: true,
      },
      prismaDouble as never,
    );

    const args = calls[0].args as { update: Record<string, unknown> };
    expect(Object.keys(args.update)).toEqual(['attempts']);
  });

  it('keys the same reason in the same hour onto one row', async () => {
    const { rejectionKey } = await import('@/lib/frontdesk/security/rejections');
    const base = { tenantId: null, operation: 'op', reason: 'R' };
    const a = rejectionKey({ ...base, now: new Date('2026-08-07T10:00:00Z') });
    const b = rejectionKey({ ...base, now: new Date('2026-08-07T10:59:59Z') });
    expect(a).toBe(b);
  });

  it('rolls over to a new row in the next hour', async () => {
    const { rejectionKey } = await import('@/lib/frontdesk/security/rejections');
    const base = { tenantId: null, operation: 'op', reason: 'R' };
    const a = rejectionKey({ ...base, now: new Date('2026-08-07T10:59:59Z') });
    const b = rejectionKey({ ...base, now: new Date('2026-08-07T11:00:00Z') });
    expect(a).not.toBe(b);
  });

  it('never collides an unattributed rejection with a tenant one', async () => {
    // Postgres treats NULLs as distinct, so the tenant is folded into the key
    // as a literal rather than left null.
    const { rejectionKey } = await import('@/lib/frontdesk/security/rejections');
    const now = new Date('2026-08-07T10:00:00Z');
    const platform = rejectionKey({ tenantId: null, operation: 'op', reason: 'R', now });
    const tenant = rejectionKey({ tenantId: 'tenant-1', operation: 'op', reason: 'R', now });
    expect(platform).not.toBe(tenant);
    expect(platform).toContain('platform');
  });

  it('separates different reasons, so one does not mask another', async () => {
    const { rejectionKey } = await import('@/lib/frontdesk/security/rejections');
    const now = new Date('2026-08-07T10:00:00Z');
    expect(rejectionKey({ tenantId: null, operation: 'op', reason: 'A', now })).not.toBe(
      rejectionKey({ tenantId: null, operation: 'op', reason: 'B', now }),
    );
  });

  it('never lets a queue-write failure escape into the response path', async () => {
    const { noteRejection } = await import('@/lib/frontdesk/security/rejections');
    const exploding = {
      fdFailure: {
        upsert: () => Promise.reject(new Error('database is down')),
      },
    };
    await expect(
      noteRejection(
        {
          tenantId: null,
          category: 'FAILED_WEBHOOK',
          operation: 'test.op',
          reason: 'BAD_SIGNATURE',
          detail: 'x',
          credentialPresented: true,
        },
        exploding as never,
      ),
    ).resolves.toBe(false);
  });

  it('detects a presented credential by shape only', async () => {
    const { presentedAnyCredential } = await import('@/lib/frontdesk/security/rejections');
    expect(presentedAnyCredential(new Headers({ 'x-sig': 'abc' }), ['x-sig'])).toBe(true);
    expect(presentedAnyCredential(new Headers({ 'x-sig': '   ' }), ['x-sig'])).toBe(false);
    expect(presentedAnyCredential(new Headers({}), ['x-sig'])).toBe(false);
    expect(presentedAnyCredential(new Headers({ other: 'v' }), ['x-sig'])).toBe(false);
  });
});
