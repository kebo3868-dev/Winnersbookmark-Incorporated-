/**
 * OPERATOR SIGN-IN ATTEMPTS ARE COUNTED, SHARED AND LIMITED (issue #73).
 *
 * The operator credential unlocks every client report, Sales Brief and lead.
 * The middleware used to compare it and answer every wrong guess with an
 * immediate 401, without counting, so the password's length was the only
 * thing between an attacker and the data.
 *
 * Two counters now sit in front of the comparison, both in one Postgres table
 * so every server instance shares them:
 *
 * - per source address: SOURCE_LIMIT wrong credentials within WINDOW lock that
 *   address for LOCK. An attacker locks out only themself; the operator on
 *   another network is unaffected.
 * - global: GLOBAL_LIMIT wrong credentials within WINDOW, from any number of
 *   addresses, lock sign-in for LOCK for every browser that has not already
 *   signed in successfully. That is the defence against a distributed attack,
 *   and the trusted-device cookie (see operatorDevice.ts) is what keeps the
 *   operator working through it.
 *
 * Rules that keep the legitimate operator safe:
 * - only a request that PRESENTS credentials can count. A browser's first,
 *   credential-less request is answered with the challenge and never counted;
 * - correct credentials never count, however many requests a page makes;
 * - a correct sign-in clears its own address's failures;
 * - locks expire on their own; `scripts/operator-unlock.mjs` clears them early.
 *
 * Rules that keep the limit honest:
 * - every count is ONE atomic statement on the database clock, so concurrent
 *   requests on any number of instances cannot over-admit;
 * - while locked, even the correct password is refused, with the same 429 as
 *   a wrong one: a lock that let the right answer through would tell an
 *   attacker which guess was right;
 * - a correct attempt reads the counters with FOR SHARE, so it waits for
 *   in-flight failures and is ordered after them.
 *
 * - an address that is already locked counts toward nothing, so a single
 *   address can never trip the global lockdown;
 * - the trusted-device cookie only ever helps a request carrying the RIGHT
 *   password; wrong guesses count and lock the same with or without it.
 *
 * Addresses are stored only as a SHA-256 digest. A refused request writes
 * nothing, so rows grow only while no lock applies (at most one per address
 * until the global limit trips), and are swept once untouched for a day
 * (whenever a new lock is set).
 */
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export const WINDOW_SECONDS = 15 * 60;
export const LOCK_SECONDS = 15 * 60;
export const SOURCE_LIMIT = 10;
export const GLOBAL_LIMIT = 100;
export const GLOBAL_KEY = 'global';

export interface CounterState {
  failures: number;
  /** Seconds until the lock expires; 0 when not locked. */
  lockedFor: number;
}

export interface ThrottleStore {
  /** Current counters for the keys. Ordered after any in-flight `fail` on them. */
  read(keys: string[]): Promise<Map<string, CounterState>>;
  /**
   * Count one failure; lock when it reaches `limit`. Never counts while
   * locked: `counted` is false when the key was already locked.
   */
  fail(key: string, limit: number): Promise<CounterState & { counted: boolean }>;
  /** Clear a key's failures, unless it is locked. */
  clear(key: string): Promise<void>;
}

const EMPTY: CounterState = { failures: 0, lockedFor: 0 };

// ── Source address ──────────────────────────────────────────────────────────

/**
 * The client address, from a header only a trusted proxy can set:
 * OPERATOR_TRUSTED_SOURCE_HEADER when configured, else Vercel's `x-real-ip`
 * on Vercel (Vercel overwrites it). Local development is one source. Anywhere
 * else nothing identifies the client, so only the global counter applies —
 * guessing from a caller-supplied X-Forwarded-For would let an attacker pick a
 * fresh address for every guess, or pick the operator's to lock them out.
 */
export function sourceAddress(headers: Headers, env: Record<string, string | undefined> = process.env): string | null {
  const header = env.OPERATOR_TRUSTED_SOURCE_HEADER || (env.VERCEL === '1' ? 'x-real-ip' : '');
  if (!header) return env.NODE_ENV === 'production' ? null : 'local';
  const value = headers.get(header)?.split(',')[0]?.trim();
  if (!value || value.includes('%')) return null;
  const family = isIP(value);
  if (family === 4) return value;
  if (family !== 6) return null;
  // One /64 is one source, so rotating IPv6 privacy addresses does not buy a
  // fresh budget per guess. IPv4-mapped addresses count as their IPv4 form.
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const front = left ? left.split(':') : [];
  const back = right ? right.split(':') : [];
  const words = right === undefined ? front : [...front, ...Array(8 - front.length - back.length).fill('0'), ...back];
  if (words.slice(0, 5).every((w) => parseInt(w, 16) === 0) && parseInt(words[5], 16) === 0xffff) {
    const hi = parseInt(words[6], 16);
    const lo = parseInt(words[7], 16);
    return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
  }
  return `${words.slice(0, 4).map((w) => w.padStart(4, '0')).join(':')}::/64`;
}

/** Storage key for a source. The address itself is never stored. */
export function sourceKey(source: string): string {
  return `source:${createHash('sha256').update(`operator-source|${source}`).digest('hex')}`;
}

// ── Decision ────────────────────────────────────────────────────────────────

export type ThrottleDecision =
  | { outcome: 'allow' }
  | { outcome: 'wrong' }
  | { outcome: 'locked'; retryAfter: number; scope: 'source' | 'global' };

/**
 * Decide one request that presents credentials. `credentialsOk` is the result
 * of the constant-time comparison; `trustedDevice` is a valid device cookie.
 */
export async function decide(
  store: ThrottleStore,
  { source, credentialsOk, trustedDevice }: { source: string | null; credentialsOk: boolean; trustedDevice: boolean },
): Promise<ThrottleDecision> {
  const key = source ? sourceKey(source) : null;

  if (credentialsOk) {
    const state = await store.read(key ? [GLOBAL_KEY, key] : [GLOBAL_KEY]);
    const own = key ? state.get(key) ?? EMPTY : EMPTY;
    const global = state.get(GLOBAL_KEY) ?? EMPTY;
    if (own.lockedFor > 0) return { outcome: 'locked', retryAfter: own.lockedFor, scope: 'source' };
    if (global.lockedFor > 0 && !trustedDevice) return { outcome: 'locked', retryAfter: global.lockedFor, scope: 'global' };
    if (key && own.failures > 0) await store.clear(key);
    return { outcome: 'allow' };
  }

  // A wrong password. The trusted-device cookie exempts nothing here: it only
  // ever helps a request that also carries the RIGHT password.
  //
  // Read first, write only when neither lock applies: a locked address, or any
  // address during a global lockdown, is refused without writing a row. That
  // keeps the table bounded under a distributed attack (one row per address
  // only until the global limit trips), and makes a refused wrong password cost
  // the same single read as a refused right one, so latency reveals nothing.
  const state = await store.read(key ? [GLOBAL_KEY, key] : [GLOBAL_KEY]);
  const ownState = key ? state.get(key) ?? EMPTY : EMPTY;
  const globalState = state.get(GLOBAL_KEY) ?? EMPTY;
  if (ownState.lockedFor > 0) return { outcome: 'locked', retryAfter: ownState.lockedFor, scope: 'source' };
  if (globalState.lockedFor > 0) return { outcome: 'locked', retryAfter: globalState.lockedFor, scope: 'global' };
  if (key) {
    const own = await store.fail(key, SOURCE_LIMIT);
    // Locked between the read and this write by a concurrent request: refused
    // without counting toward the global limit, so one address cannot trip
    // the global lockdown (independent review of PR #80).
    if (!own.counted) return { outcome: 'locked', retryAfter: own.lockedFor, scope: 'source' };
    const global = await store.fail(GLOBAL_KEY, GLOBAL_LIMIT);
    if (global.lockedFor > 0) return { outcome: 'locked', retryAfter: global.lockedFor, scope: 'global' };
    if (own.lockedFor > 0) return { outcome: 'locked', retryAfter: own.lockedFor, scope: 'source' };
    return { outcome: 'wrong' };
  }
  const global = await store.fail(GLOBAL_KEY, GLOBAL_LIMIT);
  if (global.lockedFor > 0) return { outcome: 'locked', retryAfter: global.lockedFor, scope: 'global' };
  return { outcome: 'wrong' };
}

// ── Postgres store (production) ─────────────────────────────────────────────

type RawDb = { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> };

/**
 * One statement per operation, on the database clock. The ON CONFLICT update
 * takes the row lock, so concurrent failures on any instance serialise on it.
 */
export function postgresStore(db: RawDb): ThrottleStore {
  const LOCKED = `t."lockedUntil" IS NOT NULL AND t."lockedUntil" > now()`;
  const FRESH = `(t."windowStart" <= now() - make_interval(secs => ${WINDOW_SECONDS}) OR t."lockedUntil" IS NOT NULL)`;
  const NEXT = `(CASE WHEN ${FRESH} THEN 1 ELSE t."failures" + 1 END)`;
  const LOCKED_FOR = `GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("lockedUntil" - now()))))::int`;
  // The update runs only on a row that is NOT locked (the ON CONFLICT ... WHERE
  // is evaluated on the row-locked, latest version), so a row coming back from
  // `up` means exactly "this failure was counted". A locked row is left
  // untouched and read back as not counted.
  const FAIL = `
    WITH up AS (
      INSERT INTO "OperatorLoginThrottle" AS t ("key", "failures", "windowStart", "lockedUntil", "updatedAt")
      VALUES ($1, 1, now(), CASE WHEN 1 >= $2 THEN now() + make_interval(secs => ${LOCK_SECONDS}) END, now())
      ON CONFLICT ("key") DO UPDATE SET
        "failures"    = ${NEXT},
        "windowStart" = CASE WHEN ${FRESH} THEN now() ELSE t."windowStart" END,
        "lockedUntil" = CASE WHEN ${NEXT} >= $2 THEN now() + make_interval(secs => ${LOCK_SECONDS}) ELSE NULL END,
        "updatedAt"   = now()
      WHERE NOT (${LOCKED})
      RETURNING "failures", "lockedUntil"
    )
    SELECT "failures", ${LOCKED_FOR} AS "lockedFor", true AS "counted" FROM up
    UNION ALL
    SELECT "failures", ${LOCKED_FOR}, false FROM "OperatorLoginThrottle"
     WHERE "key" = $1 AND NOT EXISTS (SELECT 1 FROM up)`;

  return {
    async read(keys) {
      const rows = await db.$queryRawUnsafe<Array<{ key: string; failures: number; lockedFor: number }>>(
        `SELECT "key", "failures",
           CASE WHEN "lockedUntil" > now() THEN CEIL(EXTRACT(EPOCH FROM ("lockedUntil" - now())))::int ELSE 0 END AS "lockedFor",
           CASE WHEN "windowStart" <= now() - make_interval(secs => ${WINDOW_SECONDS}) THEN true ELSE false END AS "stale"
         FROM "OperatorLoginThrottle" WHERE "key" = ANY($1::text[]) FOR SHARE`,
        keys,
      );
      return new Map(
        (rows as Array<{ key: string; failures: number; lockedFor: number; stale?: boolean }>).map((r) => [
          r.key,
          { failures: r.stale && !r.lockedFor ? 0 : Number(r.failures), lockedFor: Number(r.lockedFor) },
        ]),
      );
    },
    async fail(key, limit) {
      const [row] = await db.$queryRawUnsafe<Array<{ failures: number; lockedFor: number; counted: boolean }>>(FAIL, key, limit);
      // Not counted means locked. The read-back uses the statement's snapshot, so
      // under a race it can lag the lock that refused the update: never report a
      // locked key as unlocked.
      const state = row?.counted === true
        ? { failures: Number(row.failures), lockedFor: Number(row.lockedFor), counted: true }
        : { failures: Number(row?.failures ?? limit), lockedFor: Number(row?.lockedFor) || LOCK_SECONDS, counted: false };
      if (state.counted && state.lockedFor > 0) {
        // A lock was just set (rare): sweep rows nobody has touched for a day.
        await db
          .$queryRawUnsafe(
            `DELETE FROM "OperatorLoginThrottle" WHERE "updatedAt" < now() - interval '1 day'
               AND ("lockedUntil" IS NULL OR "lockedUntil" < now()) RETURNING 1`,
          )
          .catch(() => undefined);
      }
      return state;
    },
    async clear(key) {
      await db.$queryRawUnsafe(
        `UPDATE "OperatorLoginThrottle" SET "failures" = 0, "lockedUntil" = NULL, "windowStart" = now(), "updatedAt" = now()
         WHERE "key" = $1 AND "failures" > 0 AND ("lockedUntil" IS NULL OR "lockedUntil" <= now()) RETURNING 1`,
        key,
      );
    },
  };
}

// ── In-memory store (preview deployments and local development only) ────────

/**
 * The same rules, per server instance. Used ONLY where there is no production
 * database by design: Vercel preview/development deployments and local
 * development (see operatorThrottleStore.ts). Production never uses it — not
 * even when the database fails: a production outage refuses sign-in (503)
 * instead of silently weakening the limit to a per-instance count that an
 * attacker could multiply by spreading guesses across instances.
 */
export function memoryStore(now: () => number = Date.now): ThrottleStore {
  const rows = new Map<string, { failures: number; windowStart: number; lockedUntil: number }>();
  const state = (r?: { failures: number; windowStart: number; lockedUntil: number }): CounterState => {
    if (!r) return EMPTY;
    const t = now();
    const lockedFor = r.lockedUntil > t ? Math.ceil((r.lockedUntil - t) / 1000) : 0;
    const stale = r.windowStart <= t - WINDOW_SECONDS * 1000;
    return { failures: stale && !lockedFor ? 0 : r.failures, lockedFor };
  };
  return {
    async read(keys) {
      return new Map(keys.filter((k) => rows.has(k)).map((k) => [k, state(rows.get(k))]));
    },
    async fail(key, limit) {
      const t = now();
      const r = rows.get(key);
      if (r && r.lockedUntil > t) return { ...state(r), counted: false };
      const fresh = !r || r.windowStart <= t - WINDOW_SECONDS * 1000 || r.lockedUntil > 0;
      const failures = fresh ? 1 : r.failures + 1;
      const next = { failures, windowStart: fresh ? t : r!.windowStart, lockedUntil: failures >= limit ? t + LOCK_SECONDS * 1000 : 0 };
      rows.set(key, next);
      if (rows.size > 10_000) for (const [k, v] of rows) if (v.lockedUntil <= t && v.windowStart <= t - WINDOW_SECONDS * 1000) rows.delete(k);
      return { ...state(next), counted: true };
    },
    async clear(key) {
      const r = rows.get(key);
      if (r && r.lockedUntil <= now()) rows.delete(key);
    },
  };
}
