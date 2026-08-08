/**
 * LEAD PII RETENTION
 *
 * A captured lead holds personal data — name, email, phone — belonging to a
 * person who is not the customer. Keeping it indefinitely with no expiry is the
 * part of this system most likely to be a problem under GDPR/CCPA, and the part
 * hardest to fix retrospectively.
 *
 * Two mechanisms:
 *
 * 1. Erasure on request — a hard delete, exposed as DELETE /api/leads/[id].
 *    That is what an individual asking to be removed is entitled to.
 *
 * 2. Retention expiry — this module. Rather than deleting the row, it REDACTS
 *    the personal fields and keeps the record. The lead stays linked to its
 *    audit so pipeline history and conversion counts survive, while the data
 *    that identifies a person does not. Redaction is the standard answer when
 *    the business record and the personal data have different lifetimes.
 *
 * Retention is OFF unless LEAD_RETENTION_DAYS is set. Silently deleting a
 * user's data because of a default they never chose would be the wrong
 * trade-off; the operator picks the window deliberately.
 */

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650; // ten years

/**
 * Retention window in days, or null when retention is disabled.
 * Invalid or non-positive values disable it rather than guessing a window.
 */
export function resolveLeadRetentionDays(env: Record<string, string | undefined> = process.env): number | null {
  const raw = env.LEAD_RETENTION_DAYS;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, Math.round(parsed)));
}

/** The subset of the Prisma client this needs — keeps it unit-testable. */
export interface LeadRetentionClient {
  auditLead: {
    updateMany(args: {
      where: {
        createdAt: { lt: Date };
        OR: ({ contactName: { not: null } } | { email: { not: null } } | { phone: { not: null } })[];
      };
      data: { contactName: null; email: null; phone: null };
    }): Promise<{ count: number }>;
  };
}

/**
 * Redact personal fields on leads older than the retention window.
 *
 * Idempotent: the OR clause matches only rows that still hold personal data, so
 * repeated sweeps do not rewrite already-redacted rows. Returns how many were
 * redacted by this call.
 */
export async function redactExpiredLeads(
  client: LeadRetentionClient,
  retentionDays: number,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const { count } = await client.auditLead.updateMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ contactName: { not: null } }, { email: { not: null } }, { phone: { not: null } }],
    },
    data: { contactName: null, email: null, phone: null },
  });
  return count;
}
