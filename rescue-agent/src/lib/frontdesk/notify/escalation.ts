import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { TenantConfig } from '../config/schema';
import type { EscalationDraft } from '../types';
import { prepareEscalationNotification } from './dispatch';
import { enqueueNotification, recordFailure } from './store';

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
      await enqueueNotification(
        tenantId,
        {
          escalationId: escalation.escalationId,
          toNumber: prepared.toNumber,
          fromNumber: prepared.fromNumber,
          body: prepared.body,
        },
        db,
      );
      summary.queued++;
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
