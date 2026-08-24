import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { FailureInput, NotificationRecord, NotificationUpdate } from './dispatch';
import type { MessagePurpose } from '../messaging/consent';

/**
 * Persistence for notifications and the failure queue.
 *
 * Same tenant-scoping discipline as the rest of the front desk store: the
 * tenant is an argument and appears in the WHERE clause. The one exception is
 * the dispatch queue read, which is cross-tenant by nature — see below.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Low-level enqueue. Do NOT call this directly from feature code — go through
 * messaging/send.ts, which applies consent, rate limits and the follow-up cap.
 * This exists only as the write that gated path performs.
 */
export async function enqueueNotification(
  tenantId: string,
  input: {
    escalationId: string | null;
    toNumber: string;
    fromNumber: string;
    body: string;
    maxAttempts?: number;
    purpose?: MessagePurpose;
    conversationId?: string | null;
  },
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.fdNotification.create({
    data: {
      tenantId,
      escalationId: input.escalationId,
      toNumber: input.toNumber,
      fromNumber: input.fromNumber,
      body: input.body,
      maxAttempts: input.maxAttempts ?? 3,
      purpose: input.purpose ?? 'ESCALATION_ALERT',
      status: 'QUEUED',
    },
    select: { id: true },
  });
}

/**
 * How long a worker's claim on a row is honoured. A worker that dies mid-send
 * leaves its row in SENDING; after this it is reclaimed so the alert is not
 * lost forever. Long enough that a slow provider call is not stolen from a
 * live worker, short enough that a crash does not strand a food-safety alert.
 */
export const LEASE_MINUTES = 5;

/**
 * Atomically claim notifications due for a send attempt.
 *
 * DUPLICATE-SEND PROTECTION. The previous implementation was a plain SELECT,
 * which meant two workers running at once — a cron overlapping with a manual
 * dispatch, or two container replicas — would both read the same rows and both
 * send them. A manager would get the same alert twice, and every send would be
 * billed twice.
 *
 * This claims in one statement:
 *   - `FOR UPDATE SKIP LOCKED` lets concurrent workers take disjoint rows
 *     instead of blocking on each other or colliding.
 *   - The UPDATE flips rows to SENDING in the same statement that selects
 *     them, so there is no window where a row looks claimable but is claimed.
 *   - Rows stuck in SENDING past the lease are reclaimed, which is how a
 *     crashed worker's backlog is recovered.
 *
 * Intentionally NOT tenant-filtered: this is a platform worker draining every
 * restaurant's queue. Each row carries its own tenantId, which scopes every
 * write that follows — a tenant filter here would just mean some restaurants'
 * alerts never get sent.
 *
 * ORDERING. Review requests sort last; everything else stays strict FIFO.
 *
 * The batch is capped, so whatever fills it delays whatever does not. Without
 * the first sort key, a restaurant that queued twenty-five review requests
 * would push a food-safety alert into the next cycle — review solicitation
 * delaying an escalation, which is exactly backwards.
 *
 * `(purpose = 'REVIEW_REQUEST')` is constant-false across any set of rows
 * containing no review requests, so for every queue that existed before this
 * feature the ordering is byte-for-byte the old `createdAt ASC`. The relative
 * order of alerts, missed-call recovery and conversation replies is untouched;
 * only review requests move, and only ever backwards.
 */
export async function claimDueNotifications(
  now: Date,
  limit = 25,
  db: Db = prisma,
  workerId = 'worker',
): Promise<NotificationRecord[]> {
  const staleBefore = new Date(now.getTime() - LEASE_MINUTES * 60_000);

  const rows = await db.$queryRaw<
    {
      id: string;
      tenantId: string;
      escalationId: string | null;
      toNumber: string;
      fromNumber: string;
      body: string;
      attempts: number;
      maxAttempts: number;
    }[]
  >`
    UPDATE "FdNotification" AS n
       SET status = 'SENDING',
           "lockedAt" = ${now},
           "lockedBy" = ${workerId}
     WHERE n.id IN (
       SELECT c.id
         FROM "FdNotification" AS c
        WHERE (c.status = 'QUEUED'
                AND (c."nextAttemptAt" IS NULL OR c."nextAttemptAt" <= ${now}))
           OR (c.status = 'SENDING' AND c."lockedAt" < ${staleBefore})
        ORDER BY (c.purpose = 'REVIEW_REQUEST') ASC, c."createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING n.id,
              n."tenantId"      AS "tenantId",
              n."escalationId"  AS "escalationId",
              n."toNumber"      AS "toNumber",
              n."fromNumber"    AS "fromNumber",
              n.body,
              n.attempts,
              n."maxAttempts"   AS "maxAttempts"
  `;

  return rows;
}

/**
 * Release rows a worker claimed but never processed (e.g. the provider could
 * not be loaded). Without this they would sit in SENDING until the lease
 * expired, delaying alerts for no reason.
 */
export async function releaseClaims(ids: string[], db: Db = prisma): Promise<void> {
  if (ids.length === 0) return;
  await db.fdNotification.updateMany({
    where: { id: { in: ids }, status: 'SENDING' },
    data: { status: 'QUEUED', lockedAt: null, lockedBy: null },
  });
}

export async function updateNotification(
  id: string,
  update: NotificationUpdate,
  db: Db = prisma,
  tenantId?: string,
): Promise<void> {
  // updateMany so the tenant can join the WHERE clause. The worker always has
  // it from the claimed row; it is optional only so the signature stays
  // compatible with callers that already proved ownership.
  await db.fdNotification.updateMany({
    where: { id, ...(tenantId ? { tenantId } : {}) },
    data: {
      status: update.status,
      attempts: update.attempts,
      nextAttemptAt: update.nextAttemptAt ?? null,
      // Every terminal or requeued state releases the worker's claim. Leaving
      // a lease behind would make the row unclaimable until it expired.
      lockedAt: null,
      lockedBy: null,
      providerName: update.providerName ?? undefined,
      providerMessageId: update.providerMessageId ?? undefined,
      errorCode: update.errorCode ?? null,
      errorMessage: update.errorMessage ?? null,
      simulated: update.simulated ?? undefined,
      lastAttemptAt: update.lastAttemptAt ?? undefined,
    },
  });
}

export async function recordFailure(failure: FailureInput, db: Db = prisma): Promise<void> {
  try {
    await db.fdFailure.create({
      data: {
        tenantId: failure.tenantId,
        category: failure.category,
        operation: failure.operation,
        detail: failure.detail.slice(0, 500),
        referenceId: failure.referenceId ?? null,
        attempts: failure.attempts ?? 0,
        lastError: failure.lastError ? failure.lastError.slice(0, 500) : null,
      },
    });
  } catch (error) {
    // The failure queue failing is the one thing that cannot itself be queued.
    console.error('[frontdesk] failure-queue write failed', { operation: failure.operation, error });
  }
}

/**
 * Apply a provider delivery callback.
 *
 * Idempotent by construction: the update is keyed on providerMessageId and
 * guarded so a terminal state is never walked backwards. Providers retry
 * webhooks aggressively and deliver them out of order, so a late "sent"
 * arriving after "delivered" must not undo the delivery.
 */
export async function applyDeliveryStatus(
  providerMessageId: string,
  status: 'DELIVERED' | 'UNDELIVERED',
  options: { errorCode?: string | null; errorMessage?: string | null; at: Date },
  db: Db = prisma,
): Promise<{ updated: boolean; tenantId: string | null; notificationId: string | null }> {
  const existing = await db.fdNotification.findUnique({
    where: { providerMessageId },
    select: { id: true, tenantId: true, status: true },
  });
  if (!existing) return { updated: false, tenantId: null, notificationId: null };

  // Already terminal and already correct — a duplicate callback.
  if (existing.status === status) {
    return { updated: false, tenantId: existing.tenantId, notificationId: existing.id };
  }
  if (existing.status === 'DELIVERED' && status === 'UNDELIVERED') {
    return { updated: false, tenantId: existing.tenantId, notificationId: existing.id };
  }

  // Scoped by tenant as well as id. The row was found via an unguessable
  // provider message id, so this is belt-and-braces — but it keeps every write
  // in this file uniformly tenant-scoped rather than relying on one lookup
  // having been safe.
  await db.fdNotification.updateMany({
    where: { id: existing.id, tenantId: existing.tenantId },
    data: {
      status,
      deliveredAt: status === 'DELIVERED' ? options.at : null,
      errorCode: options.errorCode ?? null,
      errorMessage: options.errorMessage ?? null,
    },
  });

  return { updated: true, tenantId: existing.tenantId, notificationId: existing.id };
}

// --- Operator views --------------------------------------------------------

/**
 * Escalation alerts that did NOT reach a person.
 *
 * The plain notification list mixes these in with successes, where a single
 * UNDELIVERED row scrolls past unnoticed. This is the query behind the
 * dashboard's own section for them, because "an alert about a food-safety
 * report was never delivered" is not an item in a list — it is the most
 * important thing on the page.
 *
 * ABANDONED is included alongside UNDELIVERED: it means the retry ceiling was
 * reached, which is the same outcome for the manager who was never told.
 */
export async function listUndeliveredEscalations(tenantId: string, take = 20, db: Db = prisma) {
  return db.fdNotification.findMany({
    where: {
      tenantId,
      purpose: 'ESCALATION_ALERT',
      status: { in: ['UNDELIVERED', 'ABANDONED'] },
    },
    orderBy: { updatedAt: 'desc' },
    take,
    select: {
      id: true,
      status: true,
      toNumber: true,
      attempts: true,
      maxAttempts: true,
      errorCode: true,
      errorMessage: true,
      simulated: true,
      lastAttemptAt: true,
      createdAt: true,
      escalationId: true,
    },
  });
}

/**
 * Alerts handed to a provider that never came back with a receipt.
 *
 * SENT is not DELIVERED. A message stuck in SENT for hours usually means the
 * status callback is not wired up — a silent misconfiguration that makes every
 * alert look successful. Surfacing it by age is the only way to notice.
 */
export async function listStalledEscalations(
  tenantId: string,
  olderThan: Date,
  take = 20,
  db: Db = prisma,
) {
  return db.fdNotification.findMany({
    where: { tenantId, purpose: 'ESCALATION_ALERT', status: 'SENT', lastAttemptAt: { lt: olderThan } },
    orderBy: { lastAttemptAt: 'asc' },
    take,
    select: {
      id: true,
      toNumber: true,
      simulated: true,
      lastAttemptAt: true,
      escalationId: true,
    },
  });
}

export async function listNotifications(tenantId: string, take = 25, db: Db = prisma) {
  return db.fdNotification.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      status: true,
      toNumber: true,
      attempts: true,
      maxAttempts: true,
      simulated: true,
      errorCode: true,
      nextAttemptAt: true,
      deliveredAt: true,
      createdAt: true,
      escalationId: true,
    },
  });
}

export async function listOpenFailures(tenantId: string, take = 25, db: Db = prisma) {
  return db.fdFailure.findMany({
    where: { tenantId, status: { in: ['OPEN', 'RETRYING'] } },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function resolveFailure(tenantId: string, failureId: string, db: Db = prisma): Promise<boolean> {
  const result = await db.fdFailure.updateMany({
    where: { id: failureId, tenantId, status: { in: ['OPEN', 'RETRYING'] } },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
  return result.count > 0;
}

export async function countUnresolvedFailures(tenantId: string, db: Db = prisma): Promise<number> {
  return db.fdFailure.count({ where: { tenantId, status: { in: ['OPEN', 'RETRYING'] } } });
}
