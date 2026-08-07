import type { TenantConfig } from '../config/schema';

/**
 * SEND RATE LIMITING
 *
 * Two separate protections, because they fail differently:
 *
 *   PER NUMBER — stops one customer being messaged repeatedly, whether from a
 *     bug, a webhook redelivery storm, or a loop. This is the one that
 *     protects a person.
 *   PER TENANT — caps a restaurant's total outbound in a window. This is the
 *     one that protects the bill, and contains the blast radius of a
 *     misconfiguration to a single client.
 *
 * A fixed hourly window is used rather than a sliding one on purpose: an
 * operator asking "why was this throttled?" can be shown the exact counter,
 * and the behaviour is deterministic to test. The tradeoff — up to 2x the
 * limit across a window boundary — is acceptable for these volumes and is
 * documented rather than hidden.
 */

export const WINDOW_MS = 60 * 60 * 1000;

export const DEFAULT_PER_NUMBER_PER_HOUR = 5;
export const DEFAULT_PER_TENANT_PER_HOUR = 200;

/** Start of the fixed window containing `now`. */
export function windowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
}

export interface RateLimits {
  perNumberPerHour: number;
  perTenantPerHour: number;
}

export function resolveLimits(config: TenantConfig): RateLimits {
  return {
    perNumberPerHour: config.messaging.rateLimitPerNumberPerHour ?? DEFAULT_PER_NUMBER_PER_HOUR,
    perTenantPerHour: config.messaging.rateLimitPerTenantPerHour ?? DEFAULT_PER_TENANT_PER_HOUR,
  };
}

export type RateVerdict =
  | { allowed: true }
  | { allowed: false; scope: 'NUMBER' | 'TENANT'; limit: number; used: number; detail: string };

export function checkRate(
  counts: { number: number; tenant: number },
  limits: RateLimits,
): RateVerdict {
  // The per-number limit is checked first: it protects a person, and its
  // breach is more serious than the spend one.
  if (counts.number >= limits.perNumberPerHour) {
    return {
      allowed: false,
      scope: 'NUMBER',
      limit: limits.perNumberPerHour,
      used: counts.number,
      detail: `Already sent ${counts.number} message(s) to this number this hour (limit ${limits.perNumberPerHour})`,
    };
  }
  if (counts.tenant >= limits.perTenantPerHour) {
    return {
      allowed: false,
      scope: 'TENANT',
      limit: limits.perTenantPerHour,
      used: counts.tenant,
      detail: `Restaurant has sent ${counts.tenant} message(s) this hour (limit ${limits.perTenantPerHour})`,
    };
  }
  return { allowed: true };
}
