import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { ConsentStatus } from './consent';
import { windowStart } from './rateLimit';

/**
 * Persistence for consent, webhook de-duplication and rate counters.
 *
 * Tenant-scoped throughout, in the same way as the rest of the front desk
 * store. Consent especially: a number that opted out of one restaurant must
 * still be reachable by another, so every lookup is keyed on (tenant, phone).
 */

type Db = PrismaClient | Prisma.TransactionClient;

// --- Consent ---------------------------------------------------------------

export async function getConsent(
  tenantId: string,
  phone: string,
  db: Db = prisma,
): Promise<{ status: ConsentStatus; lastInboundAt: Date | null }> {
  const row = await db.fdConsent.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
    select: { status: true, lastInboundAt: true },
  });
  // No record means we have never interacted with this number.
  return row ? { status: row.status, lastInboundAt: row.lastInboundAt } : { status: 'UNKNOWN', lastInboundAt: null };
}

export async function setConsent(
  tenantId: string,
  phone: string,
  status: ConsentStatus,
  source: string,
  options: { touchInbound?: boolean } = {},
  db: Db = prisma,
): Promise<void> {
  const now = new Date();
  const timestamps = {
    ...(status === 'OPTED_OUT' ? { optedOutAt: now } : {}),
    ...(status === 'OPTED_IN' ? { optedInAt: now, optedOutAt: null } : {}),
    ...(options.touchInbound ? { lastInboundAt: now } : {}),
  };

  await db.fdConsent.upsert({
    where: { tenantId_phone: { tenantId, phone } },
    create: { tenantId, phone, status, source, ...timestamps },
    update: { status, source, ...timestamps },
  });
}

// --- Duplicate webhook protection ------------------------------------------

/**
 * Record an inbound provider event, returning false when it has been seen.
 *
 * The unique constraint on (provider, providerEventId) is what makes this
 * safe under concurrency: two simultaneous redeliveries race to insert and
 * exactly one wins. Checking-then-inserting would let both through.
 */
export async function claimInboundEvent(
  provider: string,
  providerEventId: string,
  kind: string,
  tenantId: string | null,
  db: Db = prisma,
): Promise<boolean> {
  try {
    await db.fdInboundEvent.create({ data: { provider, providerEventId, kind, tenantId } });
    return true;
  } catch (error) {
    // P2002 = unique violation = we have already processed this event.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
      return false;
    }
    throw error;
  }
}

// --- Rate counters ---------------------------------------------------------

export async function getRateCounts(
  tenantId: string,
  phone: string,
  now: Date,
  db: Db = prisma,
): Promise<{ number: number; tenant: number }> {
  const start = windowStart(now);
  const [numberRow, tenantRow] = await Promise.all([
    db.fdRateCounter.findUnique({
      where: { tenantId_scope_subject_windowStart: { tenantId, scope: 'NUMBER', subject: phone, windowStart: start } },
      select: { count: true },
    }),
    db.fdRateCounter.findUnique({
      where: { tenantId_scope_subject_windowStart: { tenantId, scope: 'TENANT', subject: tenantId, windowStart: start } },
      select: { count: true },
    }),
  ]);
  return { number: numberRow?.count ?? 0, tenant: tenantRow?.count ?? 0 };
}

/**
 * Increment both counters for a send.
 *
 * Uses upsert-with-increment so concurrent workers cannot lose a count to a
 * read-modify-write race — an undercounted limit is a limit that does not hold.
 */
export async function recordSend(tenantId: string, phone: string, now: Date, db: Db = prisma): Promise<void> {
  const start = windowStart(now);
  await Promise.all([
    db.fdRateCounter.upsert({
      where: { tenantId_scope_subject_windowStart: { tenantId, scope: 'NUMBER', subject: phone, windowStart: start } },
      create: { tenantId, scope: 'NUMBER', subject: phone, windowStart: start, count: 1 },
      update: { count: { increment: 1 } },
    }),
    db.fdRateCounter.upsert({
      where: { tenantId_scope_subject_windowStart: { tenantId, scope: 'TENANT', subject: tenantId, windowStart: start } },
      create: { tenantId, scope: 'TENANT', subject: tenantId, windowStart: start, count: 1 },
      update: { count: { increment: 1 } },
    }),
  ]);
}

/**
 * Outbound customer messages sent since that number's last inbound message.
 *
 * This is the follow-up cap's input: it answers "how many times have we
 * spoken into silence?" Staff alerts are excluded — they are not follow-ups to
 * a customer and must not consume a customer's allowance.
 */
export async function countUnansweredOutbound(
  tenantId: string,
  phone: string,
  since: Date | null,
  db: Db = prisma,
): Promise<number> {
  return db.fdNotification.count({
    where: {
      tenantId,
      toNumber: phone,
      purpose: { in: ['MISSED_CALL_RECOVERY', 'CONVERSATION_REPLY'] },
      status: { in: ['QUEUED', 'SENDING', 'SENT', 'DELIVERED'] },
      ...(since ? { createdAt: { gt: since } } : {}),
    },
  });
}

export async function listConsents(tenantId: string, take = 50, db: Db = prisma) {
  return db.fdConsent.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    take,
  });
}
