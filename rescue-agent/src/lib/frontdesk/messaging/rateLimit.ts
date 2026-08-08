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

/**
 * Failed sign-in attempts allowed per account per hour.
 *
 * A login endpoint has to be publicly reachable, which makes it the one place
 * an attacker can guess passwords at will. This bounds that per (restaurant,
 * email) so credential-stuffing one account cannot run unbounded, while a
 * legitimate user fumbling their password a few times is unaffected.
 */
export const LOGIN_ATTEMPTS_PER_HOUR = 10;

/**
 * Counter subject for failures against an address that has NO account.
 *
 * This is what bounds the table. Keying a counter on an attacker-chosen email
 * lets anyone create unlimited rows by varying the address; folding every
 * unknown address onto one subject caps the whole thing at
 * (real accounts at this restaurant + 1) rows per hour.
 *
 * A failure is still counted for an unknown address rather than skipped, so
 * every failed sign-in performs exactly the same database work and the
 * endpoint cannot be timed to discover which accounts exist.
 *
 * No `@`, and every real subject is an email address, so this can never
 * collide with one.
 */
export const UNKNOWN_ACCOUNT_SUBJECT = '__unknown_account__';
