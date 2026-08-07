import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { TenantConfig } from '../config/schema';
import { maskNumber, normaliseNumber } from '../notify/provider';
import { enqueueNotification, recordFailure } from '../notify/store';
import { isCustomerDirected, maySend, type MessagePurpose } from './consent';
import { checkRate, resolveLimits } from './rateLimit';
import { countUnansweredOutbound, getConsent, getRateCounts, recordSend } from './store';

/**
 * THE ONLY WAY AN OUTBOUND MESSAGE IS QUEUED.
 *
 * Consent, rate limits and the follow-up cap are checked HERE rather than at
 * each call site, so a future feature that wants to send something cannot
 * accidentally skip them. Every caller — escalation alerts, missed-call
 * recovery, conversation replies — goes through this one function.
 *
 * Every refusal is written to the failure queue. A blocked message is not a
 * no-op: the operator needs to know that a manager's alerts are being
 * suppressed because they texted STOP, or that a restaurant is hitting its
 * hourly cap. Silence here would recreate exactly the invisible-failure
 * problem the failure queue exists to solve.
 */

export type SendRequest = {
  tenantId: string;
  config: TenantConfig;
  toNumber: string;
  body: string;
  purpose: MessagePurpose;
  conversationId?: string | null;
  escalationId?: string | null;
  /** Set for carrier-mandated replies (STOP/HELP acknowledgements). */
  bypassConsent?: boolean;
  /**
   * A life-safety or food-safety alert. Exempts the message from the SPEND
   * rate limits — never from consent. The per-tenant cap exists to bound a
   * bill and contain a misconfiguration; letting it silence a food-safety
   * alert would be trading a few cents against someone's health. A STOP still
   * wins, because that is a legal obligation rather than a cost control, and
   * the refusal is surfaced loudly so the routing gets fixed.
   */
  critical?: boolean;
};

export type SendResult =
  | { queued: true; notificationId: string }
  | { queued: false; reason: string; detail: string };

export async function queueMessage(request: SendRequest, db: PrismaClient = prisma): Promise<SendResult> {
  const { tenantId, config, purpose, body } = request;

  const toNumber = normaliseNumber(request.toNumber);
  if (!toNumber) {
    await fileBlocked(tenantId, purpose, 'INVALID_NUMBER', `Destination is not a usable number`, null, db);
    return { queued: false, reason: 'INVALID_NUMBER', detail: 'Destination is not a usable number' };
  }

  const fromNumber = config.messaging.fromNumber ? normaliseNumber(config.messaging.fromNumber) : null;
  if (!config.messaging.smsEnabled || !fromNumber) {
    const detail = !config.messaging.smsEnabled
      ? 'SMS is switched off for this restaurant'
      : 'No sending number is configured';
    await fileBlocked(tenantId, purpose, 'SMS_UNAVAILABLE', detail, toNumber, db);
    return { queued: false, reason: 'SMS_UNAVAILABLE', detail };
  }

  const now = new Date();

  // --- Consent -------------------------------------------------------------
  // A STOP/HELP acknowledgement is the one message an opted-out number should
  // still receive; carriers expect it. Everything else is gated.
  if (!request.bypassConsent) {
    const consent = await getConsent(tenantId, toNumber, db);
    const unanswered = isCustomerDirected(purpose)
      ? await countUnansweredOutbound(tenantId, toNumber, consent.lastInboundAt, db)
      : 0;

    const verdict = maySend({ status: consent.status, purpose, unansweredOutbound: unanswered, config });
    if (!verdict.allowed) {
      await fileBlocked(tenantId, purpose, verdict.reason, verdict.detail, toNumber, db);
      return { queued: false, reason: verdict.reason, detail: verdict.detail };
    }
  }

  // --- Rate limits ---------------------------------------------------------
  // Skipped for critical alerts. The counter is still incremented below, so
  // the spend stays visible; it simply does not get to block this message.
  if (!request.critical) {
    const counts = await getRateCounts(tenantId, toNumber, now, db);
    const rate = checkRate(counts, resolveLimits(config));
    if (!rate.allowed) {
      await fileBlocked(tenantId, purpose, `RATE_LIMIT_${rate.scope}`, rate.detail, toNumber, db);
      return { queued: false, reason: `RATE_LIMIT_${rate.scope}`, detail: rate.detail };
    }
  }

  // --- Queue ---------------------------------------------------------------
  const notification = await enqueueNotification(
    tenantId,
    {
      escalationId: request.escalationId ?? null,
      toNumber,
      fromNumber,
      body,
      purpose,
      conversationId: request.conversationId ?? null,
    },
    db,
  );

  // Counted at QUEUE time, not send time. Counting later would let a burst
  // queue thousands of messages before any of them incremented a counter.
  await recordSend(tenantId, toNumber, now, db);

  return { queued: true, notificationId: notification.id };
}

/** Record a blocked send where an operator will see it. */
async function fileBlocked(
  tenantId: string,
  purpose: MessagePurpose,
  reason: string,
  detail: string,
  toNumber: string | null,
  db: PrismaClient,
): Promise<void> {
  // An escalation alert blocked by consent is the most serious case: a manager
  // is not being told about incidents. Called out explicitly so it does not
  // read like routine throttling.
  const isAlert = purpose === 'ESCALATION_ALERT';
  const prefix = isAlert ? 'STAFF ALERT NOT SENT' : 'Message not sent';

  await recordFailure(
    {
      tenantId,
      category: isAlert ? 'FAILED_SMS' : 'FAILED_NOTIFICATION',
      operation: `messaging.blocked.${purpose.toLowerCase()}`,
      detail: `${prefix} to ${toNumber ? maskNumber(toNumber) : 'an invalid number'}: ${detail}`,
      lastError: reason,
    },
    db,
  );
}
