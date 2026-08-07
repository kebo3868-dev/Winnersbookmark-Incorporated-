import type { TenantConfig } from '../config/schema';
import type { EscalationDraft } from '../types';
import { maskNumber, normaliseNumber, type SmsProvider } from './provider';
import { classifyResult, decideRetry, MAX_ATTEMPTS } from './retry';

/**
 * ESCALATION → SMS DISPATCH
 *
 * The gap this closes: before Phase 2, an escalation wrote a dashboard row and
 * nothing else. If nobody was watching the dashboard, a food-safety report sat
 * unseen. This turns an escalation into an actual message to the routed staff
 * contact — with delivery tracking, bounded retries, and a visible failure
 * whenever it does not work.
 *
 * Written against injected ports rather than Prisma directly, so every branch
 * (no contact configured, unroutable number, transient failure, permanent
 * failure, retry exhaustion) is unit-testable without a database or a network.
 */

export interface NotificationRecord {
  id: string;
  tenantId: string;
  escalationId: string | null;
  toNumber: string;
  fromNumber: string;
  body: string;
  attempts: number;
  maxAttempts: number;
}

export interface NotificationUpdate {
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'UNDELIVERED' | 'ABANDONED';
  attempts: number;
  nextAttemptAt?: Date | null;
  providerName?: string | null;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  simulated?: boolean;
  lastAttemptAt?: Date;
}

/** Mirrors the FdFailureCategory enum; kept local so this module stays pure. */
export type FailureCategory =
  | 'FAILED_SMS'
  | 'FAILED_NOTIFICATION'
  | 'FAILED_INTEGRATION'
  | 'FAILED_BOOKING'
  | 'FAILED_DATA_WRITE'
  | 'FAILED_WEBHOOK'
  | 'FAILED_AI_RESPONSE';

export interface FailureInput {
  tenantId: string | null;
  category: FailureCategory;
  operation: string;
  detail: string;
  referenceId?: string | null;
  attempts?: number;
  lastError?: string | null;
}

/** Everything dispatch needs from the outside world. */
export interface DispatchPorts {
  updateNotification(id: string, update: NotificationUpdate): Promise<void>;
  recordFailure(failure: FailureInput): Promise<void>;
  now(): Date;
}

/**
 * The message a manager actually receives.
 *
 * Constraints that matter: it must be readable on a lock screen, it must say
 * which restaurant it concerns (a manager may cover several), and it must
 * carry a callback number when one was captured. It must NOT contain the
 * customer's verbatim complaint — that is on the dashboard, and a lock-screen
 * preview is not the place for it.
 */
export function buildEscalationMessage(
  escalation: Pick<EscalationDraft, 'reason' | 'severity' | 'summary' | 'customerName'> & {
    contact: string | null;
  },
  config: TenantConfig,
): string {
  const restaurant = config.brandVoice.restaurantDisplayName ?? config.restaurantName;
  const urgency = escalation.severity === 'CRITICAL' ? 'URGENT' : escalation.severity === 'HIGH' ? 'Priority' : '';
  const reason = escalation.reason.replace(/_/g, ' ').toLowerCase();

  const parts = [
    `${urgency ? `${urgency}: ` : ''}${restaurant} front desk`,
    escalation.summary,
    escalation.customerName ? `Customer: ${escalation.customerName}` : null,
    escalation.contact ? `Call back: ${escalation.contact}` : 'No callback number captured',
    `(${reason})`,
  ].filter(Boolean);

  // Kept under a single SMS segment where possible; truncated hard otherwise
  // so a carrier cannot split it into an unreadable fragment.
  const message = parts.join('\n');
  return message.length <= 320 ? message : `${message.slice(0, 317)}...`;
}

export type PreparedNotification =
  | { ok: true; toNumber: string; fromNumber: string; body: string }
  | { ok: false; reason: 'SMS_DISABLED' | 'NO_FROM_NUMBER' | 'NO_CONTACT' | 'INVALID_CONTACT_NUMBER'; detail: string };

/**
 * Work out whether an escalation can be messaged at all, and to whom.
 *
 * Every "no" here is a configuration problem the operator must see, not a
 * silent skip — each one is surfaced to the failure queue by the caller.
 */
export function prepareEscalationNotification(
  escalation: Pick<EscalationDraft, 'reason' | 'severity' | 'summary' | 'customerName' | 'routeTo'> & {
    contact: string | null;
  },
  config: TenantConfig,
): PreparedNotification {
  if (!config.messaging.smsEnabled) {
    return { ok: false, reason: 'SMS_DISABLED', detail: 'messaging.smsEnabled is false for this restaurant' };
  }

  const fromNumber = config.messaging.fromNumber ? normaliseNumber(config.messaging.fromNumber) : null;
  if (!fromNumber) {
    return { ok: false, reason: 'NO_FROM_NUMBER', detail: 'messaging.fromNumber is missing or not a valid number' };
  }

  const contact = config.escalationContacts.find((c) => c.key === escalation.routeTo);
  if (!contact?.phone) {
    return {
      ok: false,
      reason: 'NO_CONTACT',
      detail: `escalation contact "${escalation.routeTo}" has no phone number configured`,
    };
  }

  const toNumber = normaliseNumber(contact.phone);
  if (!toNumber) {
    return {
      ok: false,
      reason: 'INVALID_CONTACT_NUMBER',
      detail: `escalation contact "${escalation.routeTo}" has an unusable phone number`,
    };
  }

  return { ok: true, toNumber, fromNumber, body: buildEscalationMessage(escalation, config) };
}

export type SendOutcome =
  | { outcome: 'SENT'; providerMessageId: string | null }
  | { outcome: 'RETRY_SCHEDULED'; nextAttemptAt: Date; attempt: number }
  | { outcome: 'ABANDONED'; reason: 'NON_RETRYABLE' | 'MAX_ATTEMPTS_EXCEEDED'; errorCode: string | null };

/**
 * Attempt one send and record what happened.
 *
 * A provider that throws is treated as a retryable failure rather than being
 * allowed to escape: an exception from a vendor SDK must not abort the loop
 * and leave the remaining notifications unprocessed.
 */
export async function attemptSend(
  notification: NotificationRecord,
  provider: SmsProvider,
  ports: DispatchPorts,
): Promise<SendOutcome> {
  const now = ports.now();
  const attempts = notification.attempts + 1;

  let result;
  try {
    result = classifyResult(
      await provider.send({
        to: notification.toNumber,
        from: notification.fromNumber,
        body: notification.body,
        reference: notification.id,
      }),
    );
  } catch (error) {
    result = classifyResult({
      status: 'FAILED' as const,
      errorCode: 'PROVIDER_EXCEPTION',
      errorMessage: error instanceof Error ? error.message.slice(0, 200) : 'Unknown provider error',
      retryable: true,
    });
  }

  if (result.status === 'ACCEPTED') {
    await ports.updateNotification(notification.id, {
      status: 'SENT',
      attempts,
      nextAttemptAt: null,
      providerName: provider.name,
      providerMessageId: result.providerMessageId ?? null,
      errorCode: null,
      errorMessage: null,
      simulated: provider.simulated,
      lastAttemptAt: now,
    });
    return { outcome: 'SENT', providerMessageId: result.providerMessageId ?? null };
  }

  const decision = decideRetry(result, attempts, now, notification.id, notification.maxAttempts);

  if (decision.action === 'RETRY') {
    await ports.updateNotification(notification.id, {
      status: 'QUEUED',
      attempts,
      nextAttemptAt: decision.nextAttemptAt,
      providerName: provider.name,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      simulated: provider.simulated,
      lastAttemptAt: now,
    });
    return { outcome: 'RETRY_SCHEDULED', nextAttemptAt: decision.nextAttemptAt, attempt: decision.attempt };
  }

  await ports.updateNotification(notification.id, {
    status: 'ABANDONED',
    attempts,
    nextAttemptAt: null,
    providerName: provider.name,
    errorCode: result.errorCode ?? null,
    errorMessage: result.errorMessage ?? null,
    simulated: provider.simulated,
    lastAttemptAt: now,
  });

  // An abandoned escalation notification means a human was never told. That is
  // exactly what the failure queue exists to make impossible to miss.
  await ports.recordFailure({
    tenantId: notification.tenantId,
    category: 'FAILED_SMS',
    operation: 'escalation.notify',
    detail:
      decision.reason === 'NON_RETRYABLE'
        ? `Permanent send failure to ${maskNumber(notification.toNumber)}: ${result.errorCode ?? 'unknown'}`
        : `Gave up after ${attempts} attempts to ${maskNumber(notification.toNumber)}: ${result.errorCode ?? 'unknown'}`,
    referenceId: notification.id,
    attempts,
    lastError: result.errorMessage ?? result.errorCode ?? null,
  });

  return { outcome: 'ABANDONED', reason: decision.reason, errorCode: result.errorCode ?? null };
}

export interface DispatchSummary {
  processed: number;
  sent: number;
  retryScheduled: number;
  abandoned: number;
}

/**
 * Process a batch of due notifications.
 *
 * One failing notification never stops the batch — the loop is the thing that
 * gets a manager told, so it has to survive a bad row.
 */
export async function dispatchBatch(
  due: NotificationRecord[],
  provider: SmsProvider,
  ports: DispatchPorts,
): Promise<DispatchSummary> {
  const summary: DispatchSummary = { processed: 0, sent: 0, retryScheduled: 0, abandoned: 0 };

  for (const notification of due) {
    summary.processed++;
    try {
      const result = await attemptSend(notification, provider, ports);
      if (result.outcome === 'SENT') summary.sent++;
      else if (result.outcome === 'RETRY_SCHEDULED') summary.retryScheduled++;
      else summary.abandoned++;
    } catch (error) {
      summary.abandoned++;
      await ports.recordFailure({
        tenantId: notification.tenantId,
        category: 'FAILED_NOTIFICATION',
        operation: 'dispatch.batch',
        detail: 'Notification could not be processed',
        referenceId: notification.id,
        lastError: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
      });
    }
  }

  return summary;
}

export { MAX_ATTEMPTS };
