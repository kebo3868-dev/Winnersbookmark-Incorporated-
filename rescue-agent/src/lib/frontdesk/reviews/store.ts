import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { TenantConfig } from '../config/schema';
import { getConsent, getRateCounts } from '../messaging/store';
import { queueMessage } from '../messaging/send';
import { resolveLimits } from '../messaging/rateLimit';
import { normaliseNumber } from '../notify/provider';
import { recordFailure } from '../notify/store';
import { checkReviewEligibility, reviewRequestBody } from './eligibility';

/**
 * REVIEW REQUEST ACTIVATION — SMS (§XIII)
 *
 * M7c decided WHO may be asked and recorded the decision. Nothing sent. This is
 * the part that sends, over the SMS infrastructure that already exists.
 *
 * ── WHAT THIS FILE IS NOT ALLOWED TO DO ──────────────────────────────────────
 *
 * It does not decide eligibility. `checkReviewEligibility` is imported and
 * called with the inputs it already takes, and no new input is invented here.
 * That matters more than it looks: the one input a reasonable person would be
 * tempted to add at the SENDING layer is "was the customer happy", and adding
 * it here rather than in eligibility.ts would smuggle review gating past the
 * tests guarding that module. There is no sentiment value anywhere in this
 * file, and a test asserts its absence against the source.
 *
 * ── ORDER OF OPERATIONS ──────────────────────────────────────────────────────
 *
 * The row is written BEFORE the message is queued, and the database's unique
 * index on (tenantId, conversationId) is what makes that safe. A duplicate call
 * — a retried request, a double-clicked button, two workers — loses the insert
 * and returns without sending. An in-memory guard would not survive either
 * process restarting; the constraint does.
 *
 * Refusals are recorded too, as SUPPRESSED rows carrying their reason. A
 * decision that leaves no trace is indistinguishable from never having
 * considered the customer, and §XIII's audit requirement is precisely that the
 * pattern of who was asked is inspectable after the fact.
 */

/**
 * Sends of hourly headroom a restaurant must still have before a review request
 * is allowed to consume one.
 *
 * Review requests are the lowest-priority message the platform sends. Without
 * this, a restaurant near its cap could spend its last few sends on review
 * solicitation and have a HIGH-severity escalation refused for rate limit
 * minutes later — a non-critical alert is not exempt from the cap. Reserving a
 * slice costs a few review requests; not reserving it costs an alert.
 */
export const REVIEW_TENANT_HEADROOM = 5;

export type ReviewRequestOutcome =
  | { outcome: 'SENT'; reviewRequestId: string; notificationId: string }
  | { outcome: 'SUPPRESSED'; reviewRequestId: string | null; reason: string; detail: string }
  | { outcome: 'ALREADY_REQUESTED'; reviewRequestId: string | null }
  | { outcome: 'CONVERSATION_NOT_FOUND' };

/**
 * Ask one customer for a review, if they may be asked.
 *
 * NEVER THROWS. The caller is an operator action, and a failure here must
 * produce a recorded refusal rather than an exception that leaves the operator
 * unable to tell whether a message went out.
 */
export async function requestReviewForConversation(
  tenantId: string,
  conversationId: string,
  config: TenantConfig,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<ReviewRequestOutcome> {
  try {
    const conversation = await db.fdConversation.findFirst({
      // Tenant-scoped: a valid conversation id belonging to another restaurant
      // must read as absent, not as someone else's customer to message.
      where: { id: conversationId, tenantId },
      select: { id: true, customerPhone: true, escalated: true, demoMode: true },
    });
    if (!conversation) return { outcome: 'CONVERSATION_NOT_FOUND' };

    // Fast path for a repeat call. The unique index below is the real guard;
    // this just avoids a pointless failed insert on the ordinary duplicate.
    const existing = await db.fdReviewRequest.findUnique({
      where: { tenantId_conversationId: { tenantId, conversationId } },
      select: { id: true },
    });
    if (existing) return { outcome: 'ALREADY_REQUESTED', reviewRequestId: existing.id };

    const tenant = await db.fdTenant.findUnique({ where: { id: tenantId }, select: { demoMode: true } });
    const demoMode = Boolean(tenant?.demoMode || conversation.demoMode);

    // This milestone activates SMS only. A tenant that has set the channel to
    // EMAIL is refused rather than quietly served over SMS — the restaurant
    // asked for something that does not exist yet, and silently substituting a
    // different channel would be answering a question they did not ask.
    if (config.reviews?.enabled && config.reviews.channel !== 'SMS') {
      return await record(db, tenantId, conversationId, null, 'CHANNEL_UNAVAILABLE',
        `Review channel "${config.reviews.channel}" is not implemented; SMS is the only channel today.`);
    }

    const destination = conversation.customerPhone ? normaliseNumber(conversation.customerPhone) : null;

    const consent = destination
      ? await getConsent(tenantId, destination, db)
      : { status: 'UNKNOWN' as const, lastInboundAt: null };

    const lastRequestedAt = destination ? await lastRequestTo(db, tenantId, destination) : null;

    // THE eligibility decision. Same function, same inputs, no additions.
    const eligibility = checkReviewEligibility({
      config,
      escalated: conversation.escalated,
      consentStatus: consent.status,
      alreadyRequestedForInteraction: false, // already short-circuited above
      lastRequestedAt,
      now,
      demoMode,
    });

    if (!eligibility.eligible) {
      return await record(db, tenantId, conversationId, destination, eligibility.reason, eligibility.detail);
    }

    // Checked after eligibility so a refusal names the customer-facing reason
    // rather than a budget one, but before the insert so the row's final state
    // is decided in one place.
    if (!destination) {
      return await record(db, tenantId, conversationId, null, 'NO_DESTINATION',
        'The conversation has no usable customer phone number.');
    }

    const counts = await getRateCounts(tenantId, destination, now, db);
    const limits = resolveLimits(config);
    if (counts.tenant + REVIEW_TENANT_HEADROOM >= limits.perTenantPerHour) {
      return await record(db, tenantId, conversationId, destination, 'TENANT_BUDGET_RESERVED',
        `Restaurant has used ${counts.tenant} of ${limits.perTenantPerHour} sends this hour; ` +
          `the last ${REVIEW_TENANT_HEADROOM} are reserved for alerts and replies.`);
    }

    // ── The idempotency anchor ───────────────────────────────────────────────
    // Written before anything is queued. If this insert loses a race, the other
    // caller owns the send and this one returns without messaging anyone.
    let row: { id: string };
    try {
      row = await db.fdReviewRequest.create({
        data: {
          tenantId,
          conversationId,
          status: 'PENDING',
          channel: 'SMS',
          destination,
          reviewLink: eligibility.reviewLink,
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return { outcome: 'ALREADY_REQUESTED', reviewRequestId: null };
      throw error;
    }

    // Through the gated path, like every other outbound message: consent, the
    // follow-up cap and rate limits are applied there, not re-implemented here.
    // Never `critical` — a review request must never be exempted from a cap
    // that exists to protect a restaurant's bill and a customer's phone.
    const result = await queueMessage(
      {
        tenantId,
        config,
        toNumber: destination,
        body: reviewRequestBody(config, eligibility.reviewLink),
        purpose: 'REVIEW_REQUEST',
        conversationId,
      },
      db,
    );

    if (!result.queued) {
      await db.fdReviewRequest.update({
        where: { id: row.id },
        data: { status: 'SUPPRESSED', suppressedReason: `${result.reason}: ${result.detail}` },
      });
      return { outcome: 'SUPPRESSED', reviewRequestId: row.id, reason: result.reason, detail: result.detail };
    }

    await db.fdReviewRequest.update({
      where: { id: row.id },
      data: { status: 'SENT', requestedAt: now },
    });
    return { outcome: 'SENT', reviewRequestId: row.id, notificationId: result.notificationId };
  } catch (error) {
    // A review request failing must never surface as an exception to a caller
    // that may also be doing something that matters more.
    try {
      await recordFailure(
        {
          tenantId,
          category: 'FAILED_NOTIFICATION',
          operation: 'reviews.request',
          detail: 'A review request could not be processed',
          referenceId: conversationId,
          lastError: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
        },
        db,
      );
    } catch {
      /* the failure queue is unavailable — still must not throw */
    }
    return {
      outcome: 'SUPPRESSED',
      reviewRequestId: null,
      reason: 'ERROR',
      detail: 'The review request could not be processed.',
    };
  }
}

/**
 * Record a refusal as a SUPPRESSED row.
 *
 * The row is the point. §XIII's audit requirement is not satisfied by sending
 * correctly — it is satisfied by being able to show, later, why each customer
 * was or was not asked.
 *
 * CALL THIS AS `return await record(...)`, NEVER `return record(...)`.
 *
 * In an async function, `return promise` inside a `try` is not covered by the
 * enclosing `catch` — only `return await promise` is. Dropping the await here
 * is what made this function's "never throws" guarantee false: an insert
 * failing with anything other than P2002 escaped to the caller. The four call
 * sites are the whole reason that guarantee holds, and `no-return-await` style
 * rules will offer to remove them.
 */
async function record(
  db: PrismaClient,
  tenantId: string,
  conversationId: string,
  destination: string | null,
  reason: string,
  detail: string,
): Promise<ReviewRequestOutcome> {
  try {
    const row = await db.fdReviewRequest.create({
      data: {
        tenantId,
        conversationId,
        status: 'SUPPRESSED',
        channel: 'SMS',
        destination,
        suppressedReason: `${reason}: ${detail}`,
      },
      select: { id: true },
    });
    return { outcome: 'SUPPRESSED', reviewRequestId: row.id, reason, detail };
  } catch (error) {
    if (isUniqueViolation(error)) return { outcome: 'ALREADY_REQUESTED', reviewRequestId: null };
    throw error;
  }
}

/**
 * When this number was last actually asked, across every interaction.
 *
 * Only SENT and DELIVERED count. A SUPPRESSED row means the customer was never
 * messaged, and letting a refusal start a 90-day cooldown would turn one
 * misconfiguration into three months of silence.
 */
async function lastRequestTo(db: PrismaClient, tenantId: string, destination: string): Promise<Date | null> {
  const row = await db.fdReviewRequest.findFirst({
    where: { tenantId, destination, status: { in: ['SENT', 'DELIVERED'] } },
    orderBy: { requestedAt: 'desc' },
    select: { requestedAt: true },
  });
  return row?.requestedAt ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

/**
 * Recorded review requests for a set of conversations, keyed by conversation.
 *
 * READ ONLY, and the Command Center's source of truth for what it displays.
 * After an operator acts, the page re-reads through this rather than trusting
 * the response it just received — so what is on screen is the stored row, not
 * an optimistic guess about it.
 *
 * Tenant-scoped like every other read here. An empty id list short-circuits so
 * a page with no conversations issues no query.
 */
export async function listReviewRequestsForConversations(
  tenantId: string,
  conversationIds: string[],
  db: PrismaClient = prisma,
): Promise<Map<string, { status: string; suppressedReason: string | null; requestedAt: Date | null }>> {
  const ids = conversationIds.filter(Boolean);
  if (ids.length === 0) return new Map();

  const rows = await db.fdReviewRequest.findMany({
    where: { tenantId, conversationId: { in: ids } },
    select: { conversationId: true, status: true, suppressedReason: true, requestedAt: true },
  });

  const byConversation = new Map<string, { status: string; suppressedReason: string | null; requestedAt: Date | null }>();
  for (const row of rows) {
    if (!row.conversationId) continue;
    byConversation.set(row.conversationId, {
      status: row.status,
      suppressedReason: row.suppressedReason,
      requestedAt: row.requestedAt,
    });
  }
  return byConversation;
}
