import type { SmsSendResult } from './provider';

/**
 * BOUNDED RETRY POLICY (§XVI)
 *
 * "Where safe, implement bounded retries. Never create infinite retry loops."
 *
 * Two ways this goes wrong in production, both guarded here:
 *
 *   - Retrying something that can never succeed (a malformed number, an
 *     opted-out recipient) burns quota and delays the operator learning that
 *     a manager will never be reached.
 *   - Retrying forever turns one bad number into an unbounded spend and an
 *     ever-growing queue.
 *
 * So a non-retryable failure is abandoned on the first attempt, and everything
 * else has a hard ceiling. This module is pure: no clock of its own, no I/O,
 * so every branch is directly testable.
 */

export const MAX_ATTEMPTS = 3;

/**
 * Backoff before attempt N (1-indexed: the delay AFTER attempt N fails).
 * 30s → 2m → done. Escalations are time-critical; an hour-long backoff on a
 * food-safety alert would be worse than useless.
 */
const BACKOFF_SECONDS = [30, 120];

/** Deterministic jitter derived from the id, to avoid a synchronised retry herd. */
export function jitterSeconds(reference: string, spreadSeconds = 10): number {
  let hash = 0;
  for (let i = 0; i < reference.length; i++) {
    hash = (hash * 31 + reference.charCodeAt(i)) >>> 0;
  }
  return hash % (spreadSeconds + 1);
}

export type RetryDecision =
  | { action: 'RETRY'; nextAttemptAt: Date; attempt: number }
  | { action: 'ABANDON'; reason: 'NON_RETRYABLE' | 'MAX_ATTEMPTS_EXCEEDED' };

/**
 * Decide what happens after a failed send.
 *
 * `attemptsSoFar` counts the attempt that just failed, so the first failure
 * arrives as 1.
 */
export function decideRetry(
  result: SmsSendResult,
  attemptsSoFar: number,
  now: Date,
  reference: string,
  maxAttempts: number = MAX_ATTEMPTS,
): RetryDecision {
  if (!result.retryable) return { action: 'ABANDON', reason: 'NON_RETRYABLE' };
  if (attemptsSoFar >= maxAttempts) return { action: 'ABANDON', reason: 'MAX_ATTEMPTS_EXCEEDED' };

  // Clamp so a raised maxAttempts cannot index past the backoff table.
  const index = Math.min(attemptsSoFar - 1, BACKOFF_SECONDS.length - 1);
  const delaySeconds = BACKOFF_SECONDS[index] + jitterSeconds(reference);
  return {
    action: 'RETRY',
    nextAttemptAt: new Date(now.getTime() + delaySeconds * 1000),
    attempt: attemptsSoFar + 1,
  };
}

/**
 * Provider error codes that are permanent regardless of what the provider
 * claims. A vendor marking "invalid number" as retryable would otherwise have
 * us retry it to the ceiling every time.
 */
const ALWAYS_PERMANENT = new Set([
  'INVALID_NUMBER',
  'RECIPIENT_OPTED_OUT',
  'BLOCKED',
  'UNSUBSCRIBED',
  'FORBIDDEN',
  'UNREACHABLE_DESTINATION',
]);

/** Normalise a provider result before the retry decision sees it. */
export function classifyResult(result: SmsSendResult): SmsSendResult {
  if (result.status === 'ACCEPTED') return result;
  if (result.errorCode && ALWAYS_PERMANENT.has(result.errorCode)) {
    return { ...result, retryable: false };
  }
  return result;
}
