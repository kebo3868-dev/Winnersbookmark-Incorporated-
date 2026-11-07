/**
 * OPERATOR SIGN-IN ATTEMPTS ARE LIMITED (issue #73) — rules and legitimate use.
 *
 * Driven through the real gate (src/lib/operatorGate.ts) with the in-memory
 * store and an injected clock. The shared Postgres store, concurrency and the
 * unlock script are exercised against a real database in
 * operator-login-throttle.db.test.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { authenticateOperator } from '@/lib/operatorGate';
import {
  GLOBAL_LIMIT,
  LOCK_SECONDS,
  SOURCE_LIMIT,
  WINDOW_SECONDS,
  memoryStore,
  sourceAddress,
  sourceKey,
  type ThrottleStore,
} from '@/lib/operatorThrottle';
import { DEVICE_COOKIE, DEVICE_DAYS, deviceCookieToSet, deviceValidFor } from '@/lib/operatorDevice';
import { throttleBackend } from '@/lib/operatorThrottleStore';

const ENV = {
  NODE_ENV: 'production',
  VERCEL: '1',
  BASIC_AUTH_USER: 'operator',
  BASIC_AUTH_PASSWORD: 'correct-horse-battery-staple-0001',
  OPERATOR_DEVICE_SECRET: 'device-secret-for-tests-0123456789abcdef',
};
const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const RIGHT = basic(ENV.BASIC_AUTH_USER, ENV.BASIC_AUTH_PASSWORD);
const WRONG = basic(ENV.BASIC_AUTH_USER, 'guess');

function clock(start = Date.UTC(2026, 10, 7, 12)) {
  let t = start;
  return { now: () => t, advance: (seconds: number) => (t += seconds * 1000) };
}

function request(ip: string | null, authorization?: string, cookie?: string) {
  const headers = new Headers();
  if (ip) headers.set('x-real-ip', ip);
  if (authorization) headers.set('authorization', authorization);
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest('https://rescue.example/audits', { headers });
}

async function attempt(store: ThrottleStore, ip: string | null, authorization?: string, cookie?: string, env: Record<string, string> = ENV) {
  const response = await authenticateOperator(request(ip, authorization, cookie), store, env);
  return { status: response.status, response };
}

/** Sign in once and return the trusted-device cookie the browser would keep. */
async function trustedCookie(store: ThrottleStore, ip: string) {
  const { response } = await attempt(store, ip, RIGHT);
  const set = response.headers.get('set-cookie') ?? '';
  return set.split(';')[0];
}

describe('the limit', () => {
  it(`locks an address on its ${SOURCE_LIMIT}th wrong password, and refuses even the right one while locked`, async () => {
    const store = memoryStore(clock().now);
    for (let i = 1; i < SOURCE_LIMIT; i++) expect((await attempt(store, '198.51.100.9', WRONG)).status, `attempt ${i}`).toBe(401);
    const locking = await attempt(store, '198.51.100.9', WRONG);
    expect(locking.status).toBe(429);
    expect(Number(locking.response.headers.get('retry-after'))).toBe(LOCK_SECONDS);
    expect(locking.response.headers.get('www-authenticate')).toBeNull();
    // The right password gets the same answer as a wrong one: no oracle.
    const right = await attempt(store, '198.51.100.9', RIGHT);
    expect(right.status).toBe(429);
    expect(await right.response.text()).toBe(await (await attempt(store, '198.51.100.9', WRONG)).response.text());
  });

  it('a request without credentials is challenged and never counted', async () => {
    const store = memoryStore(clock().now);
    for (let i = 0; i < SOURCE_LIMIT * 5; i++) {
      const r = await attempt(store, '198.51.100.9');
      expect(r.status).toBe(401);
      expect(r.response.headers.get('www-authenticate')).toMatch(/^Basic realm=/);
    }
    expect((await attempt(store, '198.51.100.9', RIGHT)).status).toBe(200);
  });

  it('counts within a 15-minute window: slow guessing below the limit is never locked', async () => {
    const c = clock();
    const store = memoryStore(c.now);
    for (let round = 0; round < 5; round++) {
      for (let i = 1; i < SOURCE_LIMIT; i++) expect((await attempt(store, '198.51.100.9', WRONG)).status).toBe(401);
      c.advance(WINDOW_SECONDS + 1);
    }
  });

  it(`locks every untrusted browser after ${GLOBAL_LIMIT} wrong passwords from many addresses`, async () => {
    const store = memoryStore(clock().now);
    // A distributed attack: 4 guesses from each of 25 addresses, never tripping a per-address lock.
    let n = 0;
    for (let a = 0; a < GLOBAL_LIMIT / 4; a++) for (let i = 0; i < 4; i++) {
      n++;
      expect((await attempt(store, `203.0.113.${a}`, WRONG)).status, `guess ${n}`).toBe(n < GLOBAL_LIMIT ? 401 : 429);
    }
    expect((await attempt(store, '192.0.2.200', WRONG)).status).toBe(429);
    expect((await attempt(store, '192.0.2.200', RIGHT)).status).toBe(429);
  });
});

describe('legitimate use is never locked out', () => {
  it('correct credentials never count, however many requests a page makes', async () => {
    const store = memoryStore(clock().now);
    const results = await Promise.all(Array.from({ length: 500 }, () => attempt(store, '192.0.2.10', RIGHT)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await store.read([sourceKey('192.0.2.10')])).toEqual(new Map());
  });

  it(`a typo streak of ${SOURCE_LIMIT - 1} followed by the right password resets the count`, async () => {
    const store = memoryStore(clock().now);
    for (let day = 0; day < 3; day++) {
      for (let i = 1; i < SOURCE_LIMIT; i++) expect((await attempt(store, '192.0.2.10', WRONG)).status).toBe(401);
      expect((await attempt(store, '192.0.2.10', RIGHT)).status).toBe(200);
    }
  });

  it('an attacker locking their own address does not affect the operator on another address', async () => {
    const store = memoryStore(clock().now);
    for (let i = 0; i < SOURCE_LIMIT * 3; i++) await attempt(store, '198.51.100.66', WRONG);
    expect((await attempt(store, '198.51.100.66', RIGHT)).status).toBe(429);
    expect((await attempt(store, '192.0.2.10', RIGHT)).status).toBe(200);
  });

  it('an attacker cannot choose the operator’s address: only the trusted header counts', async () => {
    const store = memoryStore(clock().now);
    for (let i = 0; i < SOURCE_LIMIT * 2; i++) {
      const forged = new NextRequest('https://rescue.example/audits', {
        headers: { 'x-real-ip': '198.51.100.66', 'x-forwarded-for': '192.0.2.10', authorization: WRONG },
      });
      await authenticateOperator(forged, store, ENV);
    }
    expect((await attempt(store, '192.0.2.10', RIGHT)).status).toBe(200);
  });

  it('during a global lockdown, a browser that signed in before keeps working', async () => {
    const store = memoryStore(clock().now);
    const cookie = await trustedCookie(store, '192.0.2.10');
    expect(cookie).toMatch(new RegExp(`^${DEVICE_COOKIE}=v1\\.`));
    for (let a = 0; a < GLOBAL_LIMIT; a++) await attempt(store, `203.0.113.${a % 250}`, WRONG);
    expect((await attempt(store, '192.0.2.99', RIGHT)).status).toBe(429); // new browser: refused
    expect((await attempt(store, '192.0.2.10', RIGHT, cookie)).status).toBe(200); // the operator's browser
    // The operator moving networks (phone off Wi-Fi) keeps working too.
    expect((await attempt(store, '198.51.100.200', RIGHT, cookie)).status).toBe(200);
    // The cookie is not a credential, and it helps only the RIGHT password:
    // a wrong guess from that browser during the lockdown is refused too.
    expect((await attempt(store, '192.0.2.10', WRONG, cookie)).status).toBe(429);
    expect((await attempt(store, '192.0.2.10', undefined, cookie)).status).toBe(401);
  });

  it('the trusted-device cookie never bypasses the per-address lock', async () => {
    const store = memoryStore(clock().now);
    const cookie = await trustedCookie(store, '192.0.2.10');
    for (let i = 0; i < SOURCE_LIMIT; i++) await attempt(store, '192.0.2.10', WRONG, cookie);
    expect((await attempt(store, '192.0.2.10', RIGHT, cookie)).status).toBe(429);
  });
});

describe('recovery', () => {
  it('a lock expires by itself, and the right password then works at once', async () => {
    const c = clock();
    const store = memoryStore(c.now);
    for (let i = 0; i < SOURCE_LIMIT; i++) await attempt(store, '192.0.2.10', WRONG);
    c.advance(LOCK_SECONDS - 1);
    expect((await attempt(store, '192.0.2.10', RIGHT)).status).toBe(429);
    c.advance(2);
    expect((await attempt(store, '192.0.2.10', RIGHT)).status).toBe(200);
    // The count starts again from zero.
    for (let i = 1; i < SOURCE_LIMIT; i++) expect((await attempt(store, '192.0.2.10', WRONG)).status).toBe(401);
  });

  it('a global lockdown also expires by itself', async () => {
    const c = clock();
    const store = memoryStore(c.now);
    for (let a = 0; a < GLOBAL_LIMIT; a++) await attempt(store, `203.0.113.${a % 250}`, WRONG);
    expect((await attempt(store, '192.0.2.99', RIGHT)).status).toBe(429);
    c.advance(LOCK_SECONDS + 1);
    expect((await attempt(store, '192.0.2.99', RIGHT)).status).toBe(200);
  });

  it('rotating the password revokes every trusted device', async () => {
    const store = memoryStore(clock().now);
    const cookie = (await trustedCookie(store, '192.0.2.10')).split('=')[1];
    expect(deviceValidFor(cookie, ENV)).toBeGreaterThan(0);
    expect(deviceValidFor(cookie, { ...ENV, BASIC_AUTH_PASSWORD: 'a-new-password-after-rotation-01' })).toBe(0);
  });

  it('documents the unlock script and the settings in the deployment guide', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../docs/DEPLOYMENT.md'), 'utf8');
    expect(doc).toMatch(/scripts\/operator-unlock\.mjs/);
    expect(doc).toMatch(/OPERATOR_DEVICE_SECRET/);
    expect(doc).toMatch(/OPERATOR_TRUSTED_SOURCE_HEADER/);
  });
});

describe('trusted-device cookie', () => {
  const now = 1_800_000_000;
  it('is issued only with a strong secret, HttpOnly, SameSite=Strict, Secure in production', () => {
    expect(deviceCookieToSet(undefined, { ...ENV, OPERATOR_DEVICE_SECRET: undefined }, now)).toBeNull();
    expect(deviceCookieToSet(undefined, { ...ENV, OPERATOR_DEVICE_SECRET: 'short' }, now)).toBeNull();
    const set = deviceCookieToSet(undefined, ENV, now)!;
    expect(set).toMatch(/; HttpOnly; SameSite=Strict; Secure$/);
    expect(set).toContain(`Max-Age=${DEVICE_DAYS * 86_400}`);
  });

  it('is not re-issued on every request, only near expiry', () => {
    const value = deviceCookieToSet(undefined, ENV, now)!.split(';')[0].split('=')[1];
    expect(deviceCookieToSet(value, ENV, now + 86_400)).toBeNull();
    expect(deviceCookieToSet(value, ENV, now + (DEVICE_DAYS - 6) * 86_400)).not.toBeNull();
  });

  it('rejects forged, tampered, expired and other-secret cookies', () => {
    const value = deviceCookieToSet(undefined, ENV, now)!.split(';')[0].split('=')[1];
    expect(deviceValidFor(value, ENV, now)).toBe(DEVICE_DAYS * 86_400);
    const [v, exp, sig] = value.split('.');
    expect(deviceValidFor(`${v}.${Number(exp) + 999_999}.${sig}`, ENV, now)).toBe(0);
    expect(deviceValidFor(`${v}.${exp}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`, ENV, now)).toBe(0);
    expect(deviceValidFor(value, ENV, now + DEVICE_DAYS * 86_400)).toBe(0);
    expect(deviceValidFor(value, { ...ENV, OPERATOR_DEVICE_SECRET: 'another-secret-entirely-0123456789ab' }, now)).toBe(0);
    expect(deviceValidFor('v1.1.x', ENV, now)).toBe(0);
  });
});

describe('source address', () => {
  it('uses only the trusted header, never a caller-supplied X-Forwarded-For', () => {
    expect(sourceAddress(new Headers({ 'x-forwarded-for': '1.2.3.4' }), { NODE_ENV: 'production', VERCEL: '1' })).toBeNull();
    expect(sourceAddress(new Headers({ 'x-real-ip': '1.2.3.4' }), { NODE_ENV: 'production', VERCEL: '1' })).toBe('1.2.3.4');
    expect(sourceAddress(new Headers({ 'cf-connecting-ip': '1.2.3.4' }), { NODE_ENV: 'production', OPERATOR_TRUSTED_SOURCE_HEADER: 'cf-connecting-ip' })).toBe('1.2.3.4');
    // Self-hosted with no trusted header configured: no per-address counter, global only.
    expect(sourceAddress(new Headers({ 'x-real-ip': '1.2.3.4' }), { NODE_ENV: 'production' })).toBeNull();
    expect(sourceAddress(new Headers(), { NODE_ENV: 'development' })).toBe('local');
  });

  it('refuses junk, and counts an IPv6 /64 and an IPv4-mapped address as one source', () => {
    const at = (v: string) => sourceAddress(new Headers({ 'x-real-ip': v }), { VERCEL: '1' });
    expect(at('not-an-ip')).toBeNull();
    expect(at('fe80::1%eth0')).toBeNull();
    expect(at('2001:db8:1:2:aaaa::1')).toBe(at('2001:0db8:0001:0002:bbbb:cccc:dddd:eeee'));
    expect(at('2001:db8:1:3::1')).not.toBe(at('2001:db8:1:2::1'));
    expect(at('::ffff:192.0.2.7')).toBe('192.0.2.7');
  });

  it('without a known source, the global counter still applies', async () => {
    const store = memoryStore(clock().now);
    const env = { ...ENV, VERCEL: undefined } as unknown as Record<string, string>;
    for (let i = 1; i < GLOBAL_LIMIT; i++) expect((await attempt(store, null, WRONG, undefined, env)).status).toBe(401);
    expect((await attempt(store, null, WRONG, undefined, env)).status).toBe(429);
  });

  it('stores a digest, never the address', () => {
    expect(sourceKey('192.0.2.10')).toMatch(/^source:[0-9a-f]{64}$/);
    expect(sourceKey('192.0.2.10')).not.toContain('192.0.2.10');
  });
});

describe('a production database failure fails closed', () => {
  const broken: ThrottleStore = {
    read: () => Promise.reject(new Error('connection refused postgresql://secret@host')),
    fail: () => Promise.reject(new Error('relation "OperatorLoginThrottle" does not exist')),
    clear: () => Promise.reject(new Error('down')),
  };

  it('refuses the right password and a wrong one with 503 — never admits, never downgrades', async () => {
    for (const auth of [RIGHT, WRONG]) {
      const r = await attempt(broken, '192.0.2.10', auth);
      expect(r.status).toBe(503);
      expect(r.response.headers.get('x-middleware-next')).toBeNull();
      expect(r.response.headers.get('cache-control')).toBe('no-store');
      expect(await r.response.text()).not.toMatch(/postgres|relation|secret/i);
    }
    // A request presenting no credentials is still just challenged.
    expect((await attempt(broken, '192.0.2.10')).status).toBe(401);
  });

  it('a store that fails only when counting a failure also fails closed', async () => {
    const half: ThrottleStore = { ...memoryStore(clock().now), fail: broken.fail };
    expect((await attempt(half, '192.0.2.10', WRONG)).status).toBe(503);
  });

  it('production always uses the shared store; memory only for previews and local development', () => {
    expect(throttleBackend({ NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production' })).toBe('shared-postgres');
    expect(throttleBackend({ NODE_ENV: 'production' })).toBe('shared-postgres'); // Docker / self-hosted
    expect(throttleBackend({ NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production', DATABASE_URL: undefined })).toBe('shared-postgres');
    expect(throttleBackend({ NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview' })).toBe('per-instance-memory');
    expect(throttleBackend({ NODE_ENV: 'production', VERCEL: '1' })).toBe('per-instance-memory'); // unknown Vercel target: no database
    expect(throttleBackend({ NODE_ENV: 'development' })).toBe('per-instance-memory');
  });

  it('there is no fallback path from the shared store to memory', () => {
    const src = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
    expect(src('src/lib/operatorThrottle.ts')).not.toMatch(/resilientStore|fallback\(/);
    const selector = src('src/lib/operatorThrottleStore.ts');
    expect(selector.match(/memoryStore\(\)/g)).toHaveLength(1);
    expect(selector).toMatch(/if \(throttleBackend\(\) === 'per-instance-memory'\) \{\s*chosen = memoryStore\(\);\s*\} else \{\s*const \{ prisma \} = await import\('@\/lib\/db'\);\s*chosen = postgresStore\(prisma\);/);
  });
});

describe('wiring', () => {
  const src = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  it('the middleware runs on Node.js and sends every credentialed request through the gate', () => {
    const mw = src('src/middleware.ts');
    expect(mw).toMatch(/runtime: 'nodejs'/);
    expect(mw).toMatch(/return authenticateOperator\(request, operatorThrottleStore\);/);
    expect(mw).not.toMatch(/checkBasicAuth\(/);
  });

});
