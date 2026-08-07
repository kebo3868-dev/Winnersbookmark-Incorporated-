import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { TenantConfig } from '../config/schema';
import type { EscalationDraft } from '../types';
import { queueMessage } from '../messaging/send';
import { normaliseNumber } from './provider';
import { buildEscalationMessage, prepareEscalationNotification } from './dispatch';
import { recordFailure } from './store';

/**
 * Turn recorded escalations into queued notifications.
 *
 * Runs AFTER the escalation rows are committed, so a messaging problem can
 * never prevent the escalation itself from being recorded. The dashboard entry
 * is the durable record; the SMS is the thing that makes someone look at it.
 *
 * Every reason an escalation cannot be messaged is written to the failure
 * queue. "SMS is switched off for this restaurant" is a configuration state an
 * operator should see, not a silent no-op — otherwise onboarding a client with
 * `smsEnabled: false` produces a front desk that looks fully armed and alerts
 * nobody.
 */
export interface EscalationToNotify {
  escalationId: string;
  reason: EscalationDraft['reason'];
  severity: EscalationDraft['severity'];
  summary: string;
  customerName: string | null;
  contact: string | null;
  routeTo: string;
}

export interface EnqueueSummary {
  queued: number;
  skipped: number;
}

export async function enqueueEscalationNotifications(
  tenantId: string,
  config: TenantConfig,
  escalations: EscalationToNotify[],
  db: PrismaClient = prisma,
): Promise<EnqueueSummary> {
  const summary: EnqueueSummary = { queued: 0, skipped: 0 };

  for (const escalation of escalations) {
    const prepared = prepareEscalationNotification(escalation, config);
    const critical = escalation.severity === 'CRITICAL';

    if (!prepared.ok) {
      await recordFailure(
        {
          tenantId,
          category: 'FAILED_NOTIFICATION',
          operation: 'escalation.notify',
          detail: `No alert sent for "${escalation.summary}": ${prepared.detail}`,
          referenceId: escalation.escalationId,
          lastError: prepared.reason,
        },
        db,
      );

      // The ROUTED contact is unusable, but SMS itself still works. This is
      // exactly the case `hasAlertPath` counts as reachable — it looks past the
      // routed contact to any contact with a number — so the fallback chain has
      // to run here too. Otherwise the engine promises a customer that a
      // food-safety report was flagged while dispatch quietly gives up.
      const routeOnlyProblem =
        critical && prepared.reason !== 'SMS_DISABLED' && prepared.reason !== 'NO_FROM_NUMBER';

      if (routeOnlyProblem) {
        const fallback = await tryFallbackContacts(
          tenantId,
          config,
          escalation,
          null,
          buildEscalationMessage(escalation, config),
          db,
        );
        if (fallback) {
          summary.queued++;
          continue;
        }
      }

      summary.skipped++;
      continue;
    }

    try {
      // Through the gated path: an alert to a manager who texted STOP must be
      // suppressed and surfaced, not sent because it is "operational".
      const result = await queueMessage(
        {
          tenantId,
          config,
          toNumber: prepared.toNumber,
          body: prepared.body,
          purpose: 'ESCALATION_ALERT',
          escalationId: escalation.escalationId,
          critical,
        },
        db,
      );

      if (result.queued) {
        summary.queued++;
      } else if (critical) {
        // FALLBACK CHAIN, critical only. If the routed contact cannot be
        // reached — they opted out, their number is unusable — a food-safety
        // or emergency alert must still find a person. Every other contact
        // with a phone number is tried in turn.
        const fallback = await tryFallbackContacts(
          tenantId,
          config,
          escalation,
          prepared.toNumber,
          prepared.body,
          db,
        );
        if (fallback) summary.queued++;
        else summary.skipped++;
      } else {
        summary.skipped++;
      }
    } catch (error) {
      summary.skipped++;
      await recordFailure(
        {
          tenantId,
          category: 'FAILED_NOTIFICATION',
          operation: 'escalation.enqueue',
          detail: `Could not queue an alert for "${escalation.summary}"`,
          referenceId: escalation.escalationId,
          lastError: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
        },
        db,
      );
    }
  }

  return summary;
}

/**
 * Try every other configured contact for a CRITICAL alert.
 *
 * Only reached when the primary route was refused. Ordinary alerts do not do
 * this: messaging three managers about a routine complaint is noise, and noise
 * is what makes an alert channel get ignored. A food-safety report is the case
 * where reaching *someone* outranks reaching the right someone.
 */
async function tryFallbackContacts(
  tenantId: string,
  config: TenantConfig,
  escalation: EscalationToNotify,
  /** The number the primary route already refused, or null if it had none. */
  alreadyTried: string | null,
  body: string,
  db: PrismaClient,
): Promise<boolean> {
  const candidates = config.escalationContacts
    .filter((contact) => Boolean(contact.phone))
    .map((contact) => ({ key: contact.key, phone: contact.phone as string }));

  for (const candidate of candidates) {
    const normalised = normaliseNumber(candidate.phone);
    if (!normalised || normalised === alreadyTried) continue;

    const result = await queueMessage(
      {
        tenantId,
        config,
        toNumber: normalised,
        body,
        purpose: 'ESCALATION_ALERT',
        escalationId: escalation.escalationId,
        critical: true,
      },
      db,
    );

    if (result.queued) {
      await recordFailure(
        {
          tenantId,
          category: 'FAILED_NOTIFICATION',
          operation: 'escalation.fallback',
          detail:
            `Primary contact "${escalation.routeTo}" could not be alerted about ` +
            `"${escalation.summary}"; reached fallback contact "${candidate.key}" instead. ` +
            'Check the primary contact\'s configuration.',
          referenceId: escalation.escalationId,
        },
        db,
      );
      return true;
    }
  }

  // Nobody could be reached at all. This is the loudest failure the system has.
  await recordFailure(
    {
      tenantId,
      category: 'FAILED_SMS',
      operation: 'escalation.critical_unreachable',
      detail:
        `CRITICAL ALERT REACHED NOBODY: "${escalation.summary}". No configured contact ` +
        'could be messaged. Someone must review this on the dashboard immediately.',
      referenceId: escalation.escalationId,
      lastError: 'NO_REACHABLE_CONTACT',
    },
    db,
  );
  return false;
}
