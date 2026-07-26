import type { AuditLeadStatus } from '@prisma/client';

/**
 * Pipeline stages a captured lead can move through. Kept in one place so the
 * API and the UI cannot drift apart — the select and the validator are built
 * from this list.
 */
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Narrow untrusted input to a valid status, or null when it is not one. */
export function parseLeadStatus(value: unknown): AuditLeadStatus | null {
  if (typeof value !== 'string') return null;
  return (LEAD_STATUSES as readonly string[]).includes(value) ? (value as AuditLeadStatus) : null;
}
