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
