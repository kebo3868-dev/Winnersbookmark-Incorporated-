import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { TenantConfig } from '../config/schema';
import type { EscalationDraft } from '../types';
import { queueMessage } from '../messaging/send';
import { prepareEscalationNotification } from './dispatch';
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

    if (!prepared.ok) {
      summary.skipped++;
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
        },
        db,
      );
      if (result.queued) summary.queued++;
      else summary.skipped++;
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
