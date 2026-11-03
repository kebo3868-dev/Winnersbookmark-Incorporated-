import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Fixed slots are reused across windows, never appended per supplied address.
// Namespace is chosen by code (and, for accounts, an existing tenant id).
export const THROTTLE_SLOTS = 65_536;
export const LOGIN_SOURCE_LIMIT = 30;
export const LOGIN_ACCOUNT_LIMIT = 10;
export const MESSAGE_SOURCE_LIMIT = 120;

export function sourceAddress(headers: Headers): string | null {
  // Only a header overwritten by a trusted ingress may identify the client.
  // Never infer trust from an arbitrary X-Forwarded-For supplied by a caller.
  const header = process.env.FRONTDESK_TRUSTED_SOURCE_HEADER;
  if (!header) return process.env.NODE_ENV === 'production' ? null : 'local';
  const value = headers.get(header)?.trim();
  if (!value || value.includes('%') || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  // URL canonicalizes alternate IPv6 spellings; count a /64 together so
  // rotating privacy addresses cannot obtain a new source budget each time.
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const front = left ? left.split(':') : [];
  const back = right ? right.split(':') : [];
  const words = right === undefined ? front : [...front, ...Array(8 - front.length - back.length).fill('0'), ...back];
  if (words.slice(0, 5).every(word => parseInt(word, 16) === 0) && parseInt(words[5], 16) === 0xffff) {
    const high = parseInt(words[6], 16), low = parseInt(words[7], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
  }
  return words.slice(0, 4).map(word => word.padStart(4, '0')).join(':');
}

export function throttleSlot(subject: string): number {
  const secret = process.env.FRONTDESK_THROTTLE_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) throw new Error('Request protection key required');
  // A keyed digest prevents callers from calculating deliberate collisions
  // with another source/account in the bounded slot space.
  return createHmac('sha256', secret ?? 'development-only-request-protection').update(subject).digest().readUInt16BE(0);
}

export type ThrottleDb = Pick<typeof prisma, '$queryRaw'>;

/** One atomic Postgres statement arbitrates ALL workers. The predicate stops
 * increments at the ceiling, including simultaneous requests. DB time avoids
 * worker clock skew. A fixed primary key bounds rows even with random input.
 */
export async function takeBudget(namespace: string, subject: string, limit: number, seconds: number, db: ThrottleDb = prisma): Promise<boolean> {
  const slot = throttleSlot(subject);
  const result = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "FdSecurityBucket" ("namespace", "slot", "windowStart", "count")
    VALUES (${namespace}, ${slot}, floor(extract(epoch FROM statement_timestamp()) / ${seconds})::bigint, 1)
    ON CONFLICT ("namespace", "slot") DO UPDATE SET
      "windowStart" = GREATEST("FdSecurityBucket"."windowStart", EXCLUDED."windowStart"),
      "count" = CASE WHEN "FdSecurityBucket"."windowStart" < EXCLUDED."windowStart"
        THEN 1 ELSE "FdSecurityBucket"."count" + 1 END
    WHERE "FdSecurityBucket"."windowStart" < EXCLUDED."windowStart" OR "FdSecurityBucket"."count" < ${limit}
    RETURNING "count"
  `;
  if (result[0]?.count === limit) console.warn('[frontdesk] request budget exhausted', { namespace, slot, seconds });
  return result.length === 1 && result[0].count >= 1 && result[0].count <= limit;
}

/** Refused requests never generate another audit or failure row. The admitted
 * attempts retain normal security logging, including coalesced denials.
 * Database/configuration failures fail closed before credentials or writes.
 */
export async function sourceThrottle(request: Request, kind: 'login' | 'message'): Promise<Response | null> {
  const source = sourceAddress(request.headers);
  if (!source) return NextResponse.json({ error: 'REQUEST PROTECTION NOT CONFIGURED' }, { status: 503 });
  try {
    if (await takeBudget(`source:${kind}`, source, kind === 'login' ? LOGIN_SOURCE_LIMIT : MESSAGE_SOURCE_LIMIT, 60)) return null;
    return NextResponse.json({ error: 'TOO MANY REQUESTS' }, { status: 429, headers: { 'Retry-After': '60' } });
  } catch {
    console.error('[frontdesk] request protection unavailable');
    return NextResponse.json({ error: 'REQUEST PROTECTION UNAVAILABLE' }, { status: 503 });
  }
}

export async function loginAccountBudget(request: Request, tenantId: string | null, email: string): Promise<boolean> {
  const source = sourceAddress(request.headers);
  if (!source) return false;
  // Pairing with source prevents someone who knows an email from locking its
  // owner out at every other source. Tenant ids separate identical addresses.
  const namespace = tenantId === null ? 'login:platform' : `login:tenant:${tenantId}`;
  return takeBudget(namespace, JSON.stringify([source, email.trim().toLowerCase()]), LOGIN_ACCOUNT_LIMIT, 900);
}
