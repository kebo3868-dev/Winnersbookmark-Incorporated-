import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { dispatchBatch, type DispatchSummary } from './dispatch';
import { getSmsProvider, SmsProviderNotConfigured } from './provider';
import { claimDueNotifications, recordFailure, releaseClaims, updateNotification } from './store';

/**
 * THE DISPATCH WORKER
 *
 * Queued alerts do not send themselves. Milestone 2 built the pipeline but
 * left nothing driving it, which meant a food-safety alert sat in the queue
 * until a human called the dispatch endpoint — functionally the same as having
 * no alerting at all. This is the thing that runs it.
 *
 * One cycle = claim a batch, send it, record the outcomes. Every trigger (HTTP
 * cron, standalone loop, manual admin call) runs the same cycle, so there is
 * one code path to reason about and to test.
 */

export type CycleResult =
  | ({ ok: true; provider: string; simulated: boolean; workerId: string } & DispatchSummary)
  | { ok: false; reason: 'NO_PROVIDER' | 'PROVIDER_ERROR'; detail: string };

export interface CycleOptions {
  batchSize?: number;
  workerId?: string;
  env?: Record<string, string | undefined>;
}

export async function runDispatchCycle(options: CycleOptions = {}): Promise<CycleResult> {
  const { batchSize = 25, workerId = `worker-${randomUUID().slice(0, 8)}`, env = process.env } = options;

  let provider;
  try {
    provider = await getSmsProvider(env);
  } catch (error) {
    const detail = error instanceof SmsProviderNotConfigured ? error.message : 'SMS provider could not be loaded';
    // A misconfigured provider is an operator-visible failure, not a log line.
    await recordFailure({
      tenantId: null,
      category: 'FAILED_INTEGRATION',
      operation: 'notifications.dispatch',
      detail,
      lastError: detail,
    });
    return { ok: false, reason: 'PROVIDER_ERROR', detail };
  }

  if (!provider) {
    // Not an error: a deployment without SMS keeps escalations dashboard-only.
    // Nothing is claimed, so nothing is stranded in SENDING.
    return {
      ok: false,
      reason: 'NO_PROVIDER',
      detail: 'No SMS provider configured. Escalations remain visible on the dashboard only.',
    };
  }

  const now = new Date();
  const claimed = await claimDueNotifications(now, batchSize, prisma, workerId);

  if (claimed.length === 0) {
    return { ok: true, provider: provider.name, simulated: provider.simulated, workerId, processed: 0, sent: 0, retryScheduled: 0, abandoned: 0 };
  }

  try {
    const summary = await dispatchBatch(claimed, provider, {
      updateNotification: (id, update) =>
        // The tenant comes from the row this worker claimed, so the write is
        // scoped to it rather than trusting the id alone.
        updateNotification(id, update, prisma, claimed.find((n) => n.id === id)?.tenantId),
      recordFailure: (failure) => recordFailure(failure, prisma),
      now: () => new Date(),
    });
    return { ok: true, provider: provider.name, simulated: provider.simulated, workerId, ...summary };
  } catch (error) {
    // dispatchBatch already isolates per-notification failures, so reaching
    // here means something broke around the loop itself. Release the claims so
    // the next cycle retries them immediately instead of waiting out the lease.
    await releaseClaims(
      claimed.map((n) => n.id),
      prisma,
    );
    const detail = error instanceof Error ? error.message.slice(0, 200) : 'Unknown dispatch error';
    await recordFailure({
      tenantId: null,
      category: 'FAILED_NOTIFICATION',
      operation: 'notifications.cycle',
      detail: 'Dispatch cycle failed; claimed notifications were released for retry',
      lastError: detail,
    });
    return { ok: false, reason: 'PROVIDER_ERROR', detail };
  }
}

/**
 * Constant-time-ish comparison for the cron shared secret. Edge-safe (no
 * node:crypto), same shape as the Basic Auth check elsewhere in the app.
 */
export function cronSecretMatches(presented: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < 16) return false; // fail closed on a weak or absent secret
  if (!presented) return false;
  const match = presented.match(/^Bearer\s+(\S+)$/i);
  if (!match) return false;
  const token = match[1];
  const maxLength = Math.max(token.length, expected.length, 1);
  let diff = token.length === expected.length ? 0 : 1;
  for (let i = 0; i < maxLength; i++) {
    diff |= (token.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}
