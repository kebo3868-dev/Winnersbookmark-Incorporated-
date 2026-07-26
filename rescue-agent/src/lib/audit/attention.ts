import type { AuditStatus } from '@prisma/client';

/**
 * WHAT NEEDS LOOKING AT
 *
 * Audits can fail — a site refuses collection, the platform kills a run, a
 * probe times out. The system records all of it (`failureReason`, `SystemLog`)
 * but nothing ever showed it: the Command Center counted completions and said
 * nothing about failures, so a client-facing audit could fail and go unnoticed
 * until someone happened to open it.
 *
 * This classifies an audit into something worth surfacing, or nothing.
 */

export type AttentionLevel = 'FAILED' | 'PARTIAL';

export interface AttentionItem {
  level: AttentionLevel;
  headline: string;
  detail: string;
}

export interface AuditLike {
  status: AuditStatus;
  failureReason: string | null;
}

const NO_REASON =
  'No reason was recorded. Check the audit page for the last completed stage.';

const PARTIAL_DETAIL =
  'The audit completed but some pages or links could not be collected, so coverage is incomplete. ' +
  'The report is honest about the gap — findings are only drawn from what was actually collected.';

/**
 * Returns what to show for an audit, or null when it is healthy.
 *
 * PARTIALLY_COMPLETED is deliberately included: it is not an error, but it is
 * a coverage gap the operator should see before sending the report to a client.
 */
export function classifyAudit(audit: AuditLike): AttentionItem | null {
  if (audit.status === 'FAILED') {
    return {
      level: 'FAILED',
      headline: 'Audit failed',
      detail: audit.failureReason?.trim() || NO_REASON,
    };
  }
  if (audit.status === 'PARTIALLY_COMPLETED') {
    return {
      level: 'PARTIAL',
      headline: 'Completed with gaps',
      detail: audit.failureReason?.trim() || PARTIAL_DETAIL,
    };
  }
  return null;
}

/** Audit statuses worth querying for the attention panel. */
export const ATTENTION_STATUSES: AuditStatus[] = ['FAILED', 'PARTIALLY_COMPLETED'];
