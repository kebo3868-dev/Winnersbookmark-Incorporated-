/**
 * NO ROUTE IS AN UNTHROTTLED PLACE TO TEST THE OPERATOR PASSWORD.
 *
 * Independent adversarial review of PR #80 found two ways around the sign-in
 * limit, each giving unlimited guesses at the one operator password:
 *
 * 1. /api/health is outside the middleware, yet answered the right password
 *    with a configuration block. It no longer reads a credential at all;
 *    diagnostics moved to /api/diagnostics, inside the middleware.
 * 2. A cookie merely SHAPED like a Front Desk session let any /frontdesk or
 *    /api/frontdesk request skip the middleware; those surfaces then fell back
 *    to the operator credential, uncounted. The middleware now sends every
 *    exempt request that presents a Basic credential through the counted gate.
 *
 * It also found that one already-locked address kept feeding the global
 * counter, so a single attacker could trip the global lockdown and lock the
 * operator out everywhere. A locked address now counts toward nothing.
 *
 * These tests drive the real middleware, with its real (per-instance memory)
 * store, as the attacks did.
 */
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GLOBAL_LIMIT, SOURCE_LIMIT, decide, memoryStore } from '@/lib/operatorThrottle';

const PASSWORD = 'correct-horse-battery-staple-0001';
const basic = (pass: string) => `Basic ${Buffer.from(`operator:${pass}`).toString('base64')}`;
const FORGED_SESSION = `wbi_fd_session=${'A'.repeat(43)}`;

async function freshMiddleware() {
  vi.resetModules(); // a fresh per-instance counter for every test
  return (await import('@/middleware')).middleware;
}

beforeEach(() => {
  // A preview-like target: the gate runs, counting in per-instance memory.
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('BASIC_AUTH_USER', 'operator');
  vi.stubEnv('BASIC_AUTH_PASSWORD', PASSWORD);
});
afterEach(() => vi.unstubAllEnvs());

const request = (path: string, headers: Record<string, string>, method = 'GET') =>
  new NextRequest(`https://rescue.example${path}`, { method, headers: { 'x-real-ip': '198.51.100.7', ...headers } });
const passedThrough = (response: Response) => response.headers.get('x-middleware-next') === '1';

describe('1. /api/health is not an oracle', () => {
  it('is outside the middleware, and its source never reads a credential', async () => {
    const { config } = await import('@/middleware');
    expect(unstable_doesMiddlewareMatch({ config, url: '/api/health' })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: '/api/diagnostics' })).toBe(true);
  });
});

describe('2. exempt routes count a presented Basic credential', () => {
  const exempt = [
    ['a Front Desk API with a forged session cookie', '/api/frontdesk/tenants', { cookie: FORGED_SESSION }, 'POST'],
    ['a Front Desk page with a forged session cookie', '/frontdesk', { cookie: FORGED_SESSION }, 'GET'],
    ['Front Desk sign-out (always exempt)', '/api/frontdesk/auth/logout', {}, 'POST'],
  ] as const;

  it.each(exempt)('%s: wrong passwords are counted and lock at the limit; then even the right one is refused', async (_name, path, extra, method) => {
    const middleware = await freshMiddleware();
    const statuses: number[] = [];
    for (let i = 0; i < SOURCE_LIMIT + 2; i++) {
      statuses.push((await middleware(request(path, { ...extra, authorization: basic(`guess-${i}`) }, method))).status);
    }
    expect(statuses.slice(0, SOURCE_LIMIT - 1).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(SOURCE_LIMIT - 1).every((s) => s === 429)).toBe(true);
    expect((await middleware(request(path, { ...extra, authorization: basic(PASSWORD) }, method))).status).toBe(429);
  });

  it('the right password on an exempt route is let through to the route', async () => {
    const middleware = await freshMiddleware();
    expect(passedThrough(await middleware(request('/api/frontdesk/tenants', { cookie: FORGED_SESSION, authorization: basic(PASSWORD) }, 'POST')))).toBe(true);
  });

  it('requests without a Basic credential pass exactly as before: sessions, webhooks, bearer secrets', async () => {
    const middleware = await freshMiddleware();
    for (const [path, headers] of [
      ['/api/frontdesk/tenants', { cookie: FORGED_SESSION }],
      ['/frontdesk', { cookie: FORGED_SESSION }],
      ['/api/frontdesk/notifications/webhook', { 'x-wbi-signature': 'sig' }],
      ['/api/frontdesk/notifications/cron', { authorization: 'Bearer scheduler-secret' }],
      ['/api/retention/sweep', { authorization: 'Bearer scheduler-secret' }],
      ['/api/frontdesk/auth/login', {}],
    ] as const) {
      expect(passedThrough(await middleware(request(path, headers, 'POST'))), path).toBe(true);
    }
  });
});

describe('3. one address cannot trip the global lockdown', () => {
  it(`${GLOBAL_LIMIT * 2} wrong passwords from one address count only ${SOURCE_LIMIT} toward the global limit`, async () => {
    const store = memoryStore();
    for (let i = 0; i < GLOBAL_LIMIT * 2; i++) await decide(store, { source: '198.51.100.7', credentialsOk: false, trustedDevice: false });
    const global = (await store.read(['global'])).get('global')!;
    expect(global.failures).toBe(SOURCE_LIMIT);
    expect(global.lockedFor).toBe(0);
    // The operator, anywhere else, is unaffected.
    expect(await decide(store, { source: '192.0.2.10', credentialsOk: true, trustedDevice: false })).toEqual({ outcome: 'allow' });
  });

  it('through the real middleware: the operator on another network still signs in', async () => {
    const middleware = await freshMiddleware();
    for (let i = 0; i < GLOBAL_LIMIT * 2; i++) await middleware(request('/audits', { authorization: basic(`g${i}`) }));
    const operator = new NextRequest('https://rescue.example/audits', { headers: { 'x-real-ip': '192.0.2.10', authorization: basic(PASSWORD) } });
    expect(passedThrough(await middleware(operator))).toBe(true);
  });
});

describe('4. the table stays bounded and refusals reveal nothing (independent re-review)', () => {
  it('during a global lockdown, wrong passwords from thousands of new addresses write no rows', async () => {
    const store = memoryStore();
    let n = 0;
    while ((await store.read(['global'])).get('global')?.lockedFor === undefined || (await store.read(['global'])).get('global')!.lockedFor === 0) {
      await decide(store, { source: `203.0.${n >> 8}.${n & 255}`, credentialsOk: false, trustedDevice: false });
      n++;
    }
    const writes = { n: 0 };
    const counting = { ...store, fail: (k: string, l: number) => { writes.n++; return store.fail(k, l); } };
    for (let i = 0; i < 5000; i++) {
      const d = await decide(counting, { source: `2001:db8:${i.toString(16)}::1`, credentialsOk: false, trustedDevice: false });
      expect(d).toMatchObject({ outcome: 'locked', scope: 'global' });
    }
    expect(writes.n).toBe(0);
  });

  it('a refused right password and a refused wrong password cost the same: one read, no writes', async () => {
    for (const lock of ['source', 'global'] as const) {
      const store = memoryStore();
      if (lock === 'source') for (let i = 0; i < SOURCE_LIMIT; i++) await decide(store, { source: '198.51.100.7', credentialsOk: false, trustedDevice: false });
      else for (let i = 0; i < GLOBAL_LIMIT; i++) await decide(store, { source: `203.0.113.${i}`, credentialsOk: false, trustedDevice: false });
      const calls: string[] = [];
      const spy = { read: (k: string[]) => { calls.push('read'); return store.read(k); }, fail: (k: string, l: number) => { calls.push('fail'); return store.fail(k, l); }, clear: (k: string) => { calls.push('clear'); return store.clear(k); } };
      for (const credentialsOk of [true, false]) {
        calls.length = 0;
        expect(await decide(spy, { source: '198.51.100.7', credentialsOk, trustedDevice: false })).toMatchObject({ outcome: 'locked', scope: lock });
        expect(calls, `${lock}, right=${credentialsOk}`).toEqual(['read']);
      }
    }
  });
});

