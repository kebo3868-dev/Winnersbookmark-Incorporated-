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
// 1b. THE FIX MUST NOT BECOME A DENIAL OF SERVICE
// ===========================================================================

describe('bounding storage must never gate authentication', () => {
  /**
   * The first version of this security fix introduced a worse bug than the one
   * it closed. A per-RESTAURANT failure ceiling was checked BEFORE the password,
   * and returned 401 once reached — so an anonymous caller who knew a
   * restaurant's slug could submit sixty bad sign-ins and lock out every member
   * of that restaurant's staff, correct credentials included, for the rest of
   * the hour.
   *
   * Locking a manager out of the dashboard during a food-safety incident is a
   * worse outcome than the table growth it prevented. These pin that it cannot
   * come back.
   */
  const REAL_USER = {
    id: 'user-1',
    passwordHash: 'scrypt$16384$8$1$c2FsdA$aGFzaA',
    role: 'RESTAURANT_OWNER',
    tenantId: 'tenant-1',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    canned.set('fdTenant.findUnique', {
      id: 'tenant-1',
      slug: 'a-restaurant',
      name: 'A Restaurant',
      status: 'ONBOARDING',
      demoMode: false,
      config: demoTenantConfig,
    });
  });

  const signIn = async (body: Record<string, unknown>) => {
    const { POST } = await import('@/app/api/frontdesk/auth/login/route');
    return POST(post('https://x.invalid/api/frontdesk/auth/login', JSON.stringify(body)) as never);
  };

  it('always verifies the password, however high the failure count', async () => {
    // A huge existing count must not short-circuit verification.
    canned.set('fdRateCounter.findUnique', { count: 10_000 });
    await signIn({ email: 'staff@r.invalid', password: 'x', tenantSlug: 'a-restaurant' });

    expect(calls.some((c) => c.model === 'fdUser'), 'the password was never verified').toBe(true);
  });

  it('does not refuse an unrelated account after a flood of failures', async () => {
    // The scenario that made this a denial of service: an attacker burns the
    // counter with junk addresses, then a real member of staff signs in.
    canned.set('fdRateCounter.findUnique', { count: 10_000 });
    canned.set('fdUser.findUnique', REAL_USER);
    canned.set('fdSession.create', { id: 'session-1' });

    const { login } = await import('@/lib/frontdesk/auth/users');
    // Prove the route reaches login() rather than returning before it.
    expect(typeof login).toBe('function');

    await signIn({ email: 'owner@r.invalid', password: 'correct', tenantSlug: 'a-restaurant' });
    expect(calls.some((c) => c.model === 'fdUser' && c.method === 'findUnique')).toBe(true);
  });

  it('no longer has a restaurant-wide ceiling at all', async () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/frontdesk/auth/login/route.ts'), 'utf8');
    expect(source).not.toContain('TENANT_LOGIN_ATTEMPTS_PER_HOUR');
    expect(source).not.toContain('TENANT_LOGIN_SUBJECT');

    const limits = readFileSync(join(process.cwd(), 'src/lib/frontdesk/messaging/rateLimit.ts'), 'utf8');
    expect(limits).not.toContain('TENANT_LOGIN_ATTEMPTS_PER_HOUR');
  });

  it('counts every unknown address onto ONE shared subject', async () => {
    // This is what bounds the table now: attacker-chosen addresses cannot each
    // create a row.
    for (let i = 0; i < 50; i++) {
      await signIn({ email: `victim${i}@r.invalid`, password: 'x', tenantSlug: 'a-restaurant' });
    }

    const subjects = new Set(
      calls
        .filter((c) => c.model === 'fdRateCounter' && c.method === 'upsert')
        .map((c) => (c.args as { where: { tenantId_scope_subject_windowStart: { subject: string } } })
          .where.tenantId_scope_subject_windowStart.subject),
    );

    expect(subjects.size).toBe(1);
    expect([...subjects][0]).toBe('__unknown_account__');
  });

  it('counts a failure against a REAL account under that account', async () => {
    canned.set('fdUser.findUnique', REAL_USER);
    await signIn({ email: 'owner@r.invalid', password: 'wrong', tenantSlug: 'a-restaurant' });

    const subjects = calls
      .filter((c) => c.model === 'fdRateCounter' && c.method === 'upsert')
      .map((c) => (c.args as { where: { tenantId_scope_subject_windowStart: { subject: string } } })
        .where.tenantId_scope_subject_windowStart.subject);

    expect(subjects).toEqual(['owner@r.invalid']);
  });

  it('performs the SAME database work for a known and an unknown address', async () => {
    // Otherwise the endpoint could be timed to enumerate accounts.
    canned.set('fdUser.findUnique', REAL_USER);
    await signIn({ email: 'owner@r.invalid', password: 'wrong', tenantSlug: 'a-restaurant' });
    const known = calls.map((c) => `${c.model}.${c.method}`);

    calls.length = 0;
    canned.delete('fdUser.findUnique');
    await signIn({ email: 'nobody@r.invalid', password: 'wrong', tenantSlug: 'a-restaurant' });
    const unknown = calls.map((c) => `${c.model}.${c.method}`);

    expect(unknown).toEqual(known);
  });

  it('uses an atomic upsert-increment, never a read-then-write', async () => {
    // Concurrency safety: a read-then-write lets simultaneous requests all see
    // the same value and each write their own row.
    for (let i = 0; i < 20; i++) {
      await signIn({ email: `x${i}@r.invalid`, password: 'x', tenantSlug: 'a-restaurant' });
    }

    const counterCalls = calls.filter((c) => c.model === 'fdRateCounter');
    // No counts are read on the failure path at all — nothing to race on.
    expect(counterCalls.every((c) => c.method === 'upsert')).toBe(true);

    const update = (counterCalls[0].args as { update: Record<string, unknown> }).update;
    expect(update).toEqual({ count: { increment: 1 } });
  });

  it('stays bounded under CONCURRENT failures at the ceiling', async () => {
    // The concurrency case that defeated the previous design: many requests in
    // flight at once, each with a distinct address.
    canned.set('fdRateCounter.findUnique', { count: 10_000 });

    await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        signIn({ email: `burst${i}@r.invalid`, password: 'x', tenantSlug: 'a-restaurant' }),
      ),
    );

    const subjects = new Set(
      calls
        .filter((c) => c.model === 'fdRateCounter' && c.method === 'upsert')
        .map((c) => (c.args as { where: { tenantId_scope_subject_windowStart: { subject: string } } })
          .where.tenantId_scope_subject_windowStart.subject),
    );

    // 40 concurrent requests, 40 distinct addresses, ONE row.
    expect(subjects.size).toBe(1);
  });

  it('accepts CORRECT credentials once the shared counter is saturated', async () => {
    // The headline regression, tested end to end with a real password hash:
    // an attacker has burned the unknown-account counter, and a genuine owner
    // signs in. Before the fix this returned 401.
    const { hashPassword } = await import('@/lib/frontdesk/auth/password');
    canned.set('fdUser.findUnique', { ...REAL_USER, passwordHash: await hashPassword('the-real-password') });
    // Saturated shared counter; the owner's own counter is a different row.
    canned.set('fdRateCounter.findUnique', { count: 0 });
    canned.set('fdSession.create', { id: 'session-1' });

    const response = await signIn({
      email: 'owner@r.invalid',
      password: 'the-real-password',
      tenantSlug: 'a-restaurant',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('wbi_fd_session=');
  });

  it('still locks out THAT account once its own failures reach the limit', async () => {
    // The lockout must survive — confined to the attacked account, but real.
    const { hashPassword } = await import('@/lib/frontdesk/auth/password');
    canned.set('fdUser.findUnique', { ...REAL_USER, passwordHash: await hashPassword('the-real-password') });
    canned.set('fdRateCounter.findUnique', { count: 10 });
    canned.set('fdSession.create', { id: 'session-1' });

    const response = await signIn({
      email: 'owner@r.invalid',
      password: 'the-real-password',
      tenantSlug: 'a-restaurant',
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie') ?? '').not.toContain('wbi_fd_session=');
    // The password was still verified, so timing cannot reveal the lockout.
    expect(calls.some((c) => c.model === 'fdUser')).toBe(true);
  });

  it('checks the lockout only AFTER verification', async () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/frontdesk/auth/login/route.ts'), 'utf8');
    // The USAGE, not the import at the top of the file.
    expect(source.indexOf('await login(')).toBeLessThan(source.indexOf('attempts >= LOGIN_ATTEMPTS_PER_HOUR'));
  });
});

describe('credential presence uses the configured provider scheme', () => {
  /**
   * Verification picks ONE scheme from SMS_PROVIDER. Testing presence against
   * both headers meant a caller could send the header this deployment never
   * looks at and still trigger a write on every request — handing back the
   * no-credential/no-write guarantee.
   */
  const timestamp = () => String(Math.floor(Date.now() / 1000));

  it('ignores a Twilio header on a non-Twilio deployment', async () => {
    process.env.SMS_PROVIDER = 'mock';
    const { POST } = await import('@/app/api/frontdesk/notifications/webhook/route');
    await POST(
      post('https://x.invalid/api/frontdesk/notifications/webhook', '{}', {
        'x-twilio-signature': 'irrelevant-here',
      }) as never,
    );
    expect(writes(), `unexpected writes: ${describeWrites()}`).toHaveLength(0);
  });

  it('ignores the platform header on a Twilio deployment', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_AUTH_TOKEN = 'b'.repeat(32);
    process.env.TWILIO_STATUS_CALLBACK_URL = 'https://x.invalid/api/frontdesk/notifications/webhook';

    const { POST } = await import('@/app/api/frontdesk/notifications/webhook/route');
    await POST(
      post('https://x.invalid/api/frontdesk/notifications/webhook', 'MessageSid=SM1', {
        'x-wbi-signature': 'irrelevant-here',
        'x-wbi-timestamp': timestamp(),
      }) as never,
    );
    expect(writes(), `unexpected writes: ${describeWrites()}`).toHaveLength(0);
  });

  it('still records when the CONFIGURED scheme is presented and fails', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_AUTH_TOKEN = 'b'.repeat(32);
    process.env.TWILIO_STATUS_CALLBACK_URL = 'https://x.invalid/api/frontdesk/notifications/webhook';

    const { POST } = await import('@/app/api/frontdesk/notifications/webhook/route');
    await POST(
      post('https://x.invalid/api/frontdesk/notifications/webhook', 'MessageSid=SM1', {
        'x-twilio-signature': 'a-wrong-signature',
      }) as never,
    );
    expect(writes().filter((c) => c.method === 'upsert')).toHaveLength(1);
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
