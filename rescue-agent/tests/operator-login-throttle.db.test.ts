/**
 * OPERATOR SIGN-IN LIMIT AGAINST A REAL POSTGRES (issue #73).
 *
 * Concurrency, multiple server instances, expiry and the unlock script, on the
 * shared store the production middleware uses. Runs only when
 * OPERATOR_THROTTLE_TEST_DATABASE_URL points at a LOCAL, disposable database
 * with the migrations applied; it truncates OperatorLoginThrottle there.
 * It refuses any other host, so it can never touch a real deployment.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authenticateOperator } from '@/lib/operatorGate';
import { GLOBAL_KEY, GLOBAL_LIMIT, SOURCE_LIMIT, decide, postgresStore, sourceKey } from '@/lib/operatorThrottle';

const URL_ = process.env.OPERATOR_THROTTLE_TEST_DATABASE_URL;
const LOCAL = URL_ ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(URL_).hostname) : false;
if (URL_ && !LOCAL) throw new Error('OPERATOR_THROTTLE_TEST_DATABASE_URL must point at a local database');

const ENV = { NODE_ENV: 'production', VERCEL: '1', BASIC_AUTH_USER: 'operator', BASIC_AUTH_PASSWORD: 'correct-horse-battery-staple-0001' };
const basic = (p: string) => `Basic ${Buffer.from(`operator:${p}`).toString('base64')}`;
const RIGHT = basic(ENV.BASIC_AUTH_PASSWORD);
const WRONG = basic('guess');
const ROOT = path.resolve(__dirname, '..');

describe.skipIf(!LOCAL)('shared Postgres store', () => {
  let a: PrismaClient; // two clients stand in for two server instances
  let b: PrismaClient;
  const statusOf = async (db: PrismaClient, ip: string, auth: string) =>
    (await authenticateOperator(new NextRequest('https://rescue.example/', { headers: { 'x-real-ip': ip, authorization: auth } }), postgresStore(db), ENV)).status;
  const row = async (key: string) =>
    (await a.$queryRawUnsafe<Array<{ failures: number; locked: boolean }>>(
      `SELECT "failures", ("lockedUntil" > now()) AS "locked" FROM "OperatorLoginThrottle" WHERE "key" = $1`, key))[0];
  const count = async () => Number((await a.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "OperatorLoginThrottle"`))[0].n);
  const tally = (statuses: number[]) => statuses.reduce<Record<number, number>>((t, s) => ({ ...t, [s]: (t[s] ?? 0) + 1 }), {});
  const unlock = (...args: string[]) =>
    spawnSync(process.execPath, ['scripts/operator-unlock.mjs', ...args], {
      cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH, DATABASE_URL: URL_ } as unknown as NodeJS.ProcessEnv,
    });

  beforeAll(() => {
    a = new PrismaClient({ datasourceUrl: URL_ });
    b = new PrismaClient({ datasourceUrl: URL_ });
  });
  afterAll(async () => { await a.$disconnect(); await b.$disconnect(); });
  beforeEach(async () => { await a.$executeRawUnsafe(`TRUNCATE "OperatorLoginThrottle"`); });

  it(`50 simultaneous wrong passwords from one address: exactly ${SOURCE_LIMIT - 1} get 401, the lock holds at ${SOURCE_LIMIT}`, async () => {
    const statuses = await Promise.all(Array.from({ length: 50 }, (_, i) => statusOf(i % 2 ? a : b, '198.51.100.9', WRONG)));
    expect(tally(statuses)).toEqual({ 401: SOURCE_LIMIT - 1, 429: 50 - (SOURCE_LIMIT - 1) });
    expect(await row(sourceKey('198.51.100.9'))).toEqual({ failures: SOURCE_LIMIT, locked: true });
    expect(await statusOf(a, '198.51.100.9', RIGHT)).toBe(429);
  });

  it(`300 simultaneous wrong passwords from 300 addresses: the global lock holds at exactly ${GLOBAL_LIMIT}`, async () => {
    const statuses = await Promise.all(Array.from({ length: 300 }, (_, i) => statusOf(i % 2 ? a : b, `203.0.${i >> 8}.${i & 255}`, WRONG)));
    expect(tally(statuses)).toEqual({ 401: GLOBAL_LIMIT - 1, 429: 300 - (GLOBAL_LIMIT - 1) });
    expect(await row(GLOBAL_KEY)).toEqual({ failures: GLOBAL_LIMIT, locked: true });
    // Refused requests during the lockdown create no per-address rows.
    expect(await count()).toBeLessThanOrEqual(GLOBAL_LIMIT + 1);
    expect(await statusOf(a, '192.0.2.10', RIGHT)).toBe(429);
  });

  it('200 simultaneous correct sign-ins: all allowed, nothing written', async () => {
    const statuses = await Promise.all(Array.from({ length: 200 }, (_, i) => statusOf(i % 2 ? a : b, '192.0.2.10', RIGHT)));
    expect(tally(statuses)).toEqual({ 200: 200 });
    expect(await count()).toBe(0);
  });

  it('a correct attempt waits for an in-flight failure and is ordered after it', async () => {
    const key = sourceKey('192.0.2.10');
    await a.$executeRawUnsafe(`INSERT INTO "OperatorLoginThrottle" ("key","failures") VALUES ($1, ${SOURCE_LIMIT - 1})`, key);
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    // Instance B is mid-way through the failure that reaches the limit.
    const inflight = b.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`UPDATE "OperatorLoginThrottle" SET "failures" = ${SOURCE_LIMIT}, "lockedUntil" = now() + interval '15 minutes' WHERE "key" = $1`, key);
      await held;
    }, { timeout: 20_000 });
    await new Promise((r) => setTimeout(r, 200));
    let settled = false;
    const correct = decide(postgresStore(a), { source: '192.0.2.10', credentialsOk: true, trustedDevice: false }).then((d) => { settled = true; return d; });
    await new Promise((r) => setTimeout(r, 500));
    expect(settled).toBe(false); // blocked on the row lock, not reading a stale count
    release();
    await inflight;
    expect(await correct).toMatchObject({ outcome: 'locked', scope: 'source' });
  });

  it('a correct sign-in clears its address; an expired lock lets the right password straight in', async () => {
    for (let i = 1; i < SOURCE_LIMIT; i++) await statusOf(a, '192.0.2.10', WRONG);
    expect(await statusOf(a, '192.0.2.10', RIGHT)).toBe(200);
    expect((await row(sourceKey('192.0.2.10'))).failures).toBe(0);

    for (let i = 0; i < SOURCE_LIMIT; i++) await statusOf(a, '192.0.2.10', WRONG);
    expect(await statusOf(a, '192.0.2.10', RIGHT)).toBe(429);
    await a.$executeRawUnsafe(`UPDATE "OperatorLoginThrottle" SET "lockedUntil" = now() - interval '1 second', "windowStart" = now() - interval '16 minutes'`);
    expect(await statusOf(a, '192.0.2.10', RIGHT)).toBe(200);
    expect(await statusOf(a, '192.0.2.10', WRONG)).toBe(401); // counting restarts at 1
    expect((await row(sourceKey('192.0.2.10'))).failures).toBe(1);
  });

  it('the unlock script clears one address (IPv4 and IPv6 /64), the global lock, and shows no raw address', async () => {
    for (let i = 0; i < SOURCE_LIMIT; i++) await statusOf(a, '203.0.113.7', WRONG);
    for (let i = 0; i < SOURCE_LIMIT; i++) await statusOf(a, '2001:db8:5:6::99', WRONG);
    expect(await statusOf(a, '203.0.113.7', RIGHT)).toBe(429);

    const status = unlock('--status');
    expect(status.status, status.stderr).toBe(0);
    expect(status.stdout).not.toContain('203.0.113.7');

    expect(unlock('--source', '203.0.113.7').stdout).toMatch(/Cleared 1 counter/);
    expect(await statusOf(a, '203.0.113.7', RIGHT)).toBe(200);
    // A different address in the same /64 names the same counter.
    expect(unlock('--source', '2001:db8:5:6:aaaa::1').stdout).toMatch(/Cleared 1 counter/);
    expect(await statusOf(a, '2001:db8:5:6::99', RIGHT)).toBe(200);

    for (let i = 0; i < GLOBAL_LIMIT; i++) await statusOf(a, `198.18.${i >> 8}.${i & 255}`, WRONG);
    expect(await statusOf(a, '192.0.2.10', RIGHT)).toBe(429);
    expect(unlock('--global').stdout).toMatch(/Cleared 1 counter/);
    expect(await statusOf(a, '192.0.2.10', RIGHT)).toBe(200);
    expect(unlock('--source', 'not-an-ip').status).toBe(2);
  });

  it('a real database failure fails closed: unreachable server, or the table missing', async () => {
    const down = new PrismaClient({ datasourceUrl: 'postgresql://postgres@127.0.0.1:1/none?connect_timeout=2' });
    const noTable = new PrismaClient({ datasourceUrl: URL_!.replace(/\/[^/?]+(\?|$)/, '/postgres$1') });
    try {
      for (const db of [down, noTable]) {
        for (const auth of [RIGHT, WRONG]) {
          const r = await authenticateOperator(new NextRequest('https://rescue.example/', { headers: { 'x-real-ip': '192.0.2.10', authorization: auth } }), postgresStore(db), ENV);
          expect(r.status).toBe(503);
        }
      }
    } finally {
      await down.$disconnect();
      await noTable.$disconnect();
    }
  });

  it('setting a new lock sweeps rows untouched for a day', async () => {
    await a.$executeRawUnsafe(
      `INSERT INTO "OperatorLoginThrottle" ("key","failures","updatedAt") SELECT 'source:old' || g, 3, now() - interval '2 days' FROM generate_series(1, 50) g`);
    for (let i = 0; i < SOURCE_LIMIT; i++) await statusOf(a, '198.51.100.9', WRONG);
    expect(await count()).toBe(2); // the global row and the newly locked address
  });
});
