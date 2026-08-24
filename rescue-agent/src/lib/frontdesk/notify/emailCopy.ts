import type { TenantConfig } from '@/lib/frontdesk/config/schema';
import type { EmailProvider } from '@/lib/frontdesk/email/provider';
import { isPlausibleEmail, maskEmail } from '@/lib/frontdesk/email/provider';
import { renderStaffAlert } from '@/lib/frontdesk/email/render';
import type { DispatchPorts, NotificationRecord } from './dispatch';

/**
 * ESCALATION EMAIL COPY
 *
 * A second channel for staff escalation alerts. It is a COPY, and the word is
 * load-bearing: SMS remains the primary path and is never made contingent on
 * this succeeding.
 *
 * ── WHY THIS IS A SEPARATE MODULE ────────────────────────────────────────────
 *
 * The SMS path carries food-safety and emergency escalations. Editing
 * `attemptSend` to be channel-aware would have put email failure modes inside
 * the function that decides whether a manager hears about an allergy report.
 * Nothing here can reach that code: `attemptSend` and
 * `prepareEscalationNotification` are untouched, and this module is invoked
 * only AFTER an SMS attempt has completed and been recorded.
 *
 * That ordering is the guarantee behind "email must never suppress or delay an
 * SMS escalation". Email cannot delay SMS because SMS has already happened;
 * email cannot suppress SMS because it runs downstream of the outcome, and
 * every failure here is swallowed into the operator's failure queue rather than
 * thrown.
 */

export type PreparedEscalationEmail =
  | { ok: true; to: string; from: string; subject: string; text: string; html: string }
  | {
      ok: false;
      reason: 'EMAIL_DISABLED' | 'NO_FROM_ADDRESS' | 'NO_CONTACT_EMAIL' | 'INVALID_CONTACT_EMAIL';
      detail: string;
    };

/**
 * Whether an escalation can be emailed at all, and to whom.
 *
 * Disabled by default: `messaging.emailEnabled` defaults to false, so a
 * deployment that merely gains this code sends nothing. Every "no" carries a
 * reason so a misconfiguration is visible rather than silent — but unlike the
 * SMS equivalent, these reasons are NOT surfaced as failures when email is
 * simply switched off. A restaurant that never asked for email alerts should
 * not generate a failure-queue entry for every escalation.
 */
export function prepareEscalationEmail(
  escalation: { reason: string; severity: string; summary: string; customerName?: string | null; routeTo: string },
  config: TenantConfig,
): PreparedEscalationEmail {
  if (!config.messaging.emailEnabled) {
    return { ok: false, reason: 'EMAIL_DISABLED', detail: 'messaging.emailEnabled is false for this restaurant' };
  }

  const from = config.messaging.fromEmail?.trim();
  if (!from || !isPlausibleEmail(from)) {
    return { ok: false, reason: 'NO_FROM_ADDRESS', detail: 'messaging.fromEmail is missing or not a valid address' };
  }

  const contact = config.escalationContacts.find((c) => c.key === escalation.routeTo);
  if (!contact?.email) {
    return {
      ok: false,
      reason: 'NO_CONTACT_EMAIL',
      detail: `escalation contact "${escalation.routeTo}" has no email address configured`,
    };
  }
  if (!isPlausibleEmail(contact.email)) {
    return {
      ok: false,
      reason: 'INVALID_CONTACT_EMAIL',
      detail: `escalation contact "${escalation.routeTo}" has an unusable email address`,
    };
  }

  const rendered = renderStaffAlert({
    restaurantName: config.restaurantName,
    subject: `${escalation.severity} escalation — ${escalation.reason}`,
    summary: escalation.summary,
    details: [
      { label: 'Severity', value: escalation.severity },
      { label: 'Reason', value: escalation.reason },
      ...(escalation.customerName ? [{ label: 'Customer', value: escalation.customerName }] : []),
      { label: 'Routed to', value: escalation.routeTo },
    ],
  });

  return { ok: true, to: contact.email, from, ...rendered };
}

export type EmailCopyOutcome =
  | { outcome: 'SENT'; providerMessageId: string | null }
  | { outcome: 'SKIPPED'; reason: string }
  | { outcome: 'FAILED'; errorCode: string | null };

/**
 * Send the email copy of an escalation. NEVER THROWS.
 *
 * Every failure path — refused configuration, provider error, provider
 * exception — returns an outcome and, where it represents a real problem,
 * records it in the operator failure queue. Nothing propagates to the caller,
 * because the caller is the SMS dispatch loop and an email problem must not
 * become an SMS problem.
 *
 * There is no retry. The SMS carrying this escalation has its own bounded
 * retry; adding a second independent retry schedule for a duplicate of the same
 * alert would multiply noise without improving the odds a human is reached.
 */
export async function sendEscalationEmailCopy(
  notification: NotificationRecord,
  prepared: PreparedEscalationEmail,
  provider: EmailProvider,
  ports: DispatchPorts,
): Promise<EmailCopyOutcome> {
  try {
    if (!prepared.ok) {
      // A tenant that has not enabled email is not a failure to report.
      if (prepared.reason !== 'EMAIL_DISABLED') {
        await ports.recordFailure({
          tenantId: notification.tenantId,
          category: 'FAILED_NOTIFICATION',
          operation: 'dispatch.emailCopy',
          detail: prepared.detail,
          referenceId: notification.id,
          lastError: prepared.reason,
        });
      }
      return { outcome: 'SKIPPED', reason: prepared.reason };
    }

    const result = await provider.send({
      to: prepared.to,
      from: prepared.from,
      subject: prepared.subject,
      text: prepared.text,
      html: prepared.html,
      reference: notification.id,
      idempotencyKey: `${notification.id}:email`,
    });

    if (result.status === 'ACCEPTED') {
      return { outcome: 'SENT', providerMessageId: result.providerMessageId ?? null };
    }

    await ports.recordFailure({
      tenantId: notification.tenantId,
      category: 'FAILED_NOTIFICATION',
      operation: 'dispatch.emailCopy',
      detail: `Email copy rejected for ${maskEmail(prepared.to)}`,
      referenceId: notification.id,
      lastError: result.errorCode ?? result.errorMessage ?? 'Unknown provider error',
    });
    return { outcome: 'FAILED', errorCode: result.errorCode ?? null };
  } catch (error) {
    // The last line of defence. A vendor SDK that throws must not escape into
    // the SMS dispatch loop and abort the remaining escalations.
    try {
      await ports.recordFailure({
        tenantId: notification.tenantId,
        category: 'FAILED_NOTIFICATION',
        operation: 'dispatch.emailCopy',
        detail: 'Email copy threw',
        referenceId: notification.id,
        lastError: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
      });
    } catch {
      /* even the failure queue is unavailable — still must not throw */
    }
    return { outcome: 'FAILED', errorCode: 'EMAIL_EXCEPTION' };
  }
}

/**
 * What an email copy needs that a notification row does not carry.
 *
 * The queue row holds the rendered SMS body, not the escalation's severity,
 * reason or route. Rather than parse those back out of the SMS text — which
 * would make the email's contents depend on the SMS wording forever — the
 * caller supplies them.
 */
export interface EmailCopyContext {
  config: TenantConfig;
  escalation: {
    reason: string;
    severity: string;
    summary: string;
    customerName?: string | null;
    routeTo: string;
  };
}

export interface EmailCopyChannel {
  provider: EmailProvider;
  /**
   * Load the config and escalation behind a notification.
   *
   * Returning null means "no email for this one" and is not an error — a row
   * whose escalation has since been purged by retention is the ordinary case.
   * This runs on the dispatch worker's thread, so it must be cheap; a slow
   * lookup here cannot delay the SMS that already sent, but it does hold up the
   * rest of the batch.
   */
  resolve(notification: NotificationRecord): Promise<EmailCopyContext | null>;
}

export type EmailCopySkip = 'NOT_AN_ESCALATION' | 'NOT_FIRST_ATTEMPT' | 'NO_CONTEXT' | 'RESOLVE_FAILED';

/**
 * The single entry point the dispatch loop calls. NEVER THROWS.
 *
 * ── WHY ONLY THE FIRST ATTEMPT ───────────────────────────────────────────────
 *
 * SMS retries up to `maxAttempts` with backoff. Emailing on every one of those
 * passes would put three copies of the same alert in a manager's inbox — and an
 * alert channel that cries wolf is an alert channel people stop opening. The
 * first pass always happens, so the email goes out regardless of whether the
 * SMS then succeeds, retries, or is abandoned. The idempotency key is the
 * second line of defence, for a worker that crashed mid-pass and redid it.
 *
 * ── WHY ESCALATIONS ONLY ─────────────────────────────────────────────────────
 *
 * The same queue carries missed-call recovery and conversation replies, which
 * are addressed to CUSTOMERS. Those must never be copied to a staff inbox.
 * `escalationId` is the field that distinguishes them, and it is already on the
 * row, so the guard needs no new data and cannot drift out of sync.
 */
export async function maybeSendEmailCopy(
  notification: NotificationRecord,
  channel: EmailCopyChannel,
  ports: DispatchPorts,
): Promise<EmailCopyOutcome | { outcome: 'SKIPPED'; reason: EmailCopySkip }> {
  if (!notification.escalationId) return { outcome: 'SKIPPED', reason: 'NOT_AN_ESCALATION' };
  if (notification.attempts !== 0) return { outcome: 'SKIPPED', reason: 'NOT_FIRST_ATTEMPT' };

  let context: EmailCopyContext | null;
  try {
    context = await channel.resolve(notification);
  } catch (error) {
    try {
      await ports.recordFailure({
        tenantId: notification.tenantId,
        category: 'FAILED_NOTIFICATION',
        operation: 'dispatch.emailCopy',
        detail: 'Could not load the escalation behind a queued alert to email a copy',
        referenceId: notification.id,
        lastError: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
      });
    } catch {
      /* the failure queue is unavailable — still must not throw */
    }
    return { outcome: 'SKIPPED', reason: 'RESOLVE_FAILED' };
  }

  if (!context) return { outcome: 'SKIPPED', reason: 'NO_CONTEXT' };

  return sendEscalationEmailCopy(
    notification,
    prepareEscalationEmail(context.escalation, context.config),
    channel.provider,
    ports,
  );
}
