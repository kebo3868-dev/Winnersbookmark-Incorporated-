import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * REJECTED-REQUEST ACCOUNTING FOR PUBLICLY REACHABLE ENDPOINTS
 *
 * Four front desk routes have to be reachable without the operator credential:
 * two provider webhooks, the scheduler trigger, and sign-in. Each authenticates
 * itself and fails closed, so an attacker cannot read or change anything
 * through them.
 *
 * They could, however, make us WRITE. Every one of them recorded a failure row
 * before returning 401, which meant one database row per rejected request, from
 * anyone, forever — in a production database shared with other applications.
 * Two consequences, and the second is worse than the first:
 *
 *   1. Unbounded storage growth from an unauthenticated source.
 *   2. Unbounded noise in the failure queue — the surface the operations
 *      runbook makes the linchpin of every safety guarantee. An outsider could
 *      bury a genuine "critical alert reached nobody" entry under thousands of
 *      junk rows, which turns a DoS into a safety problem.
 *
 * The fix has two halves, and both matter:
 *
 *   SILENCE THE NOISE. A request that presents NO credential at all is a
 *   scanner, not a misconfiguration. It is rejected with no database work
 *   whatsoever. There is nothing an operator would do about it.
 *
 *   COALESCE THE SIGNAL. A request that DOES present a credential and fails is
 *   real information — a rotated secret, a provider pointed at the wrong URL.
 *   That still reaches the operator, but upserted on a per-hour key with an
 *   attempt counter, so the cost is one row per hour instead of one per
 *   request. "BAD_SIGNATURE ×4,812 this hour" is also a strictly more useful
 *   thing to read than 4,812 identical rows.
 *
 * §XVI ("never fail silently") is preserved: the operator still learns that
 * requests are being rejected, and how many. What changes is that the volume is
 * ours to bound rather than the caller's to choose.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Coalescing window. One row per scope/operation/reason per hour. */
const WINDOW_MS = 60 * 60 * 1000;

export function rejectionWindowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
}

/**
 * Build the coalescing key.
 *
 * `tenantId` is folded in as a literal so an unattributed rejection and a
 * tenant's rejection never collide. A NULL tenant would otherwise make the
 * unique index useless, because Postgres treats NULLs as distinct.
 */
export function rejectionKey(input: {
  tenantId: string | null;
  operation: string;
  reason: string;
  now: Date;
}): string {
  const scope = input.tenantId ?? 'platform';
  return `${scope}|${input.operation}|${input.reason}|${rejectionWindowStart(input.now).toISOString()}`;
}

export interface RejectionInput {
  tenantId: string | null;
  category: 'FAILED_WEBHOOK' | 'FAILED_INTEGRATION' | 'FAILED_NOTIFICATION' | 'FAILED_SMS';
  /** What was being attempted, e.g. "notifications.webhook". */
  operation: string;
  /** Why it was refused, e.g. "BAD_SIGNATURE". Part of the coalescing key. */
  reason: string;
  /** One line for the operator. Must not contain anything caller-controlled. */
  detail: string;
  /**
   * Did the caller present a credential of the right SHAPE — a signature
   * header, an authorization header — that then failed to verify?
   *
   * False means nothing was presented at all. That is a port scan, and it is
   * dropped without touching the database. This flag is the difference between
   * an endpoint an attacker can use as a write primitive and one they cannot.
   */
  credentialPresented: boolean;
  now?: Date;
}

/**
 * Record a rejected request, bounded.
 *
 * Returns whether anything was written, so tests can assert the silent path is
 * genuinely silent rather than merely quiet.
 */
export async function noteRejection(input: RejectionInput, db: Db = prisma): Promise<boolean> {
  // No credential presented: nothing to tell an operator, nothing written.
  if (!input.credentialPresented) return false;

  const now = input.now ?? new Date();
  const dedupeKey = rejectionKey({
    tenantId: input.tenantId,
    operation: input.operation,
    reason: input.reason,
    now,
  });

  try {
    await db.fdFailure.upsert({
      where: { dedupeKey },
      create: {
        tenantId: input.tenantId,
        category: input.category,
        operation: input.operation,
        detail: input.detail.slice(0, 500),
        dedupeKey,
        attempts: 1,
        lastError: input.reason.slice(0, 500),
      },
      // Only the counter moves. The detail and reason are ours, not the
      // caller's, so there is nothing to refresh and nothing to poison.
      update: { attempts: { increment: 1 } },
    });
    return true;
  } catch (error) {
    // The failure queue failing is the one thing that cannot itself be queued.
    console.error('[frontdesk] rejection-record write failed', { operation: input.operation, error });
    return false;
  }
}

/**
 * Was a credential of the expected shape presented at all?
 *
 * Deliberately shape-only and deliberately NOT a verification: this decides
 * whether a rejection is worth telling an operator about, never whether the
 * request is allowed. Verification happens separately and always.
 */
export function presentedAnyCredential(headers: Headers, names: string[]): boolean {
  return names.some((name) => {
    const value = headers.get(name);
    return typeof value === 'string' && value.trim().length > 0;
  });
}
