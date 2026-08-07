import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { FailureInput, NotificationRecord, NotificationUpdate } from './dispatch';

/**
 * Persistence for notifications and the failure queue.
 *
 * Same tenant-scoping discipline as the rest of the front desk store: the
 * tenant is an argument and appears in the WHERE clause. The one exception is
 * the dispatch queue read, which is cross-tenant by nature — see below.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export async function enqueueNotification(
  tenantId: string,
  input: {
    escalationId: string | null;
    toNumber: string;
    fromNumber: string;
    body: string;
    maxAttempts?: number;
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
      status: 'QUEUED',
    },
    select: { id: true },
  });
}

/**
 * Notifications due for a send attempt.
 *
 * Intentionally NOT tenant-filtered: the dispatcher is a platform-level worker
 * that drains every tenant's queue. Each row carries its own tenantId, which
 * is what every downstream write is scoped by, so no cross-tenant data is
 * mixed — a tenant filter here would simply mean some restaurants' alerts
 * never get sent.
 */
export async function claimDueNotifications(
  now: Date,
  limit = 25,
  db: Db = prisma,
): Promise<NotificationRecord[]> {
  const rows = await db.fdNotification.findMany({
    where: {
      status: 'QUEUED',
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      tenantId: true,
      escalationId: true,
      toNumber: true,
      fromNumber: true,
      body: true,
      attempts: true,
      maxAttempts: true,
    },
  });
  return rows;
}

export async function updateNotification(
  id: string,
  update: NotificationUpdate,
  db: Db = prisma,
): Promise<void> {
  await db.fdNotification.update({
    where: { id },
    data: {
      status: update.status,
      attempts: update.attempts,
      nextAttemptAt: update.nextAttemptAt ?? null,
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
): Promise<{ updated: boolean; tenantId: string | null }> {
  const existing = await db.fdNotification.findUnique({
    where: { providerMessageId },
    select: { id: true, tenantId: true, status: true },
  });
  if (!existing) return { updated: false, tenantId: null };

  // Already terminal and already correct — a duplicate callback.
  if (existing.status === status) return { updated: false, tenantId: existing.tenantId };
  if (existing.status === 'DELIVERED' && status === 'UNDELIVERED') {
    return { updated: false, tenantId: existing.tenantId };
  }

  await db.fdNotification.update({
    where: { id: existing.id },
    data: {
      status,
      deliveredAt: status === 'DELIVERED' ? options.at : null,
      errorCode: options.errorCode ?? null,
      errorMessage: options.errorMessage ?? null,
    },
  });

  return { updated: true, tenantId: existing.tenantId };
}

// --- Operator views --------------------------------------------------------

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
