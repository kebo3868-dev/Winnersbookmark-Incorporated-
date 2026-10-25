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
 * Marketing enquiries carry MORE personal data than audit leads — name, email,
 * phone, company and a free-text message a member of the public typed — and
 * until now they had no expiry at all. The retention module only ever touched
 * `auditLead`, so every enquiry submitted through the public marketing site was
 * kept indefinitely. That is the same promise broken in a worse place: this
 * data belongs to people who contacted the business, not to its customers.
 *
 * `name`, `email` and `message` are NOT NULL in the schema, so they are
 * overwritten with a redaction marker rather than nulled. The row survives so
 * enquiry volume and conversion history stay intact.
 */
export interface MarketingRetentionClient {
  marketingLead: {
    updateMany(args: {
      where: {
        createdAt: { lt: Date };
        NOT: { name: string };
      };
      data: { name: string; email: string; message: string; company: null; phone: null; websiteUrl: null; notes: null };
    }): Promise<{ count: number }>;
  };
}

/** Written over fields the schema requires, so a redacted row is unmistakable. */
export const REDACTED_MARKER = '[redacted — retention window elapsed]';

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

/**
 * Redact personal fields on marketing enquiries older than the retention window.
 *
 * Idempotent via `NOT: { name: REDACTED_MARKER }` — an already-redacted row no
 * longer matches, so repeated sweeps do not rewrite it. Returns how many rows
 * this call redacted.
 */
export async function redactExpiredMarketingLeads(
  client: MarketingRetentionClient,
  retentionDays: number,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const { count } = await client.marketingLead.updateMany({
    where: {
      createdAt: { lt: cutoff },
      NOT: { name: REDACTED_MARKER },
    },
    data: {
      name: REDACTED_MARKER,
      email: REDACTED_MARKER,
      message: REDACTED_MARKER,
      company: null,
      phone: null,
      websiteUrl: null,
      notes: null,
    },
  });
  return count;
}

/** What a sweep did, so a caller can log or report it without re-querying. */
export interface RetentionSweepResult {
  retentionDays: number | null;
  auditLeadsRedacted: number;
  marketingLeadsRedacted: number;
}

/**
 * The read-only half of the client: counting and listing what a sweep WOULD
 * touch, so an operator can look before enabling a window in production.
 *
 * Redaction cannot be undone. Turning retention on against real data without
 * being able to see what it will hit first is a decision made blind, and the
 * blast radius is personal data belonging to people who are not customers.
 */
export interface RetentionPreviewClient {
  auditLead: {
    findMany(args: {
      where: {
        createdAt: { lt: Date };
        OR: ({ contactName: { not: null } } | { email: { not: null } } | { phone: { not: null } })[];
      };
      select: { id: true; createdAt: true; contactName: true; email: true; phone: true };
      orderBy: { createdAt: 'asc' };
      take: number;
    }): Promise<{ id: string; createdAt: Date; contactName: string | null; email: string | null; phone: string | null }[]>;
    count(args: {
      where: {
        createdAt: { lt: Date };
        OR: ({ contactName: { not: null } } | { email: { not: null } } | { phone: { not: null } })[];
      };
    }): Promise<number>;
  };
  marketingLead: {
    findMany(args: {
      where: { createdAt: { lt: Date }; NOT: { name: string } };
      select: { id: true; createdAt: true; name: true; email: true; phone: true };
      orderBy: { createdAt: 'asc' };
      take: number;
    }): Promise<{ id: string; createdAt: Date; name: string; email: string; phone: string | null }[]>;
    count(args: { where: { createdAt: { lt: Date }; NOT: { name: string } } }): Promise<number>;
  };
}

/** One record a sweep would redact, identified but not altered. */
export interface RetentionPreviewRow {
  table: 'AuditLead' | 'MarketingLead';
  id: string;
  createdAt: Date;
  ageDays: number;
  /** Which personal fields this row currently holds. Values are NOT returned. */
  fieldsHeld: string[];
}

export interface RetentionPreviewResult {
  retentionDays: number | null;
  cutoff: Date | null;
  auditLeadsAffected: number;
  marketingLeadsAffected: number;
  totalAffected: number;
  /** A bounded sample, oldest first. Never the whole table. */
  sample: RetentionPreviewRow[];
  /** Always true. A preview performs no writes, by construction. */
  dryRun: true;
}

const PREVIEW_SAMPLE_LIMIT = 25;

/**
 * Report exactly which records a sweep would redact — and change nothing.
 *
 * Only `findMany` and `count` are used; this function has no access to a write
 * method, so "it does not modify data" is a property of its type, not a promise
 * in a comment. Field VALUES are deliberately not returned: an operator needs
 * to know which rows and which fields are in scope, not to have the personal
 * data re-exported into a log or a browser tab to answer that.
 */
export async function previewExpiredPii(
  client: RetentionPreviewClient,
  retentionDays: number | null = resolveLeadRetentionDays(),
  now: Date = new Date(),
): Promise<RetentionPreviewResult> {
  if (retentionDays === null) {
    return {
      retentionDays: null,
      cutoff: null,
      auditLeadsAffected: 0,
      marketingLeadsAffected: 0,
      totalAffected: 0,
      sample: [],
      dryRun: true,
    };
  }
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const auditWhere = {
    createdAt: { lt: cutoff },
    OR: [{ contactName: { not: null } }, { email: { not: null } }, { phone: { not: null } }] as (
      | { contactName: { not: null } }
      | { email: { not: null } }
      | { phone: { not: null } }
    )[],
  };
  const marketingWhere = { createdAt: { lt: cutoff }, NOT: { name: REDACTED_MARKER } };

  const [auditLeadsAffected, marketingLeadsAffected, auditRows, marketingRows] = await Promise.all([
    client.auditLead.count({ where: auditWhere }),
    client.marketingLead.count({ where: marketingWhere }),
    client.auditLead.findMany({
      where: auditWhere,
      select: { id: true, createdAt: true, contactName: true, email: true, phone: true },
      orderBy: { createdAt: 'asc' },
      take: PREVIEW_SAMPLE_LIMIT,
    }),
    client.marketingLead.findMany({
      where: marketingWhere,
      select: { id: true, createdAt: true, name: true, email: true, phone: true },
      orderBy: { createdAt: 'asc' },
      take: PREVIEW_SAMPLE_LIMIT,
    }),
  ]);

  const ageDays = (d: Date) => Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  const sample: RetentionPreviewRow[] = [
    ...auditRows.map((r) => ({
      table: 'AuditLead' as const,
      id: r.id,
      createdAt: r.createdAt,
      ageDays: ageDays(r.createdAt),
      fieldsHeld: [r.contactName && 'contactName', r.email && 'email', r.phone && 'phone'].filter(
        (f): f is string => Boolean(f),
      ),
    })),
    ...marketingRows.map((r) => ({
      table: 'MarketingLead' as const,
      id: r.id,
      createdAt: r.createdAt,
      ageDays: ageDays(r.createdAt),
      fieldsHeld: ['name', 'email', r.phone && 'phone'].filter((f): f is string => Boolean(f)),
    })),
  ]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, PREVIEW_SAMPLE_LIMIT);

  return {
    retentionDays,
    cutoff,
    auditLeadsAffected,
    marketingLeadsAffected,
    totalAffected: auditLeadsAffected + marketingLeadsAffected,
    sample,
    dryRun: true,
  };
}

/**
 * Run every retention sweep the system owes.
 *
 * One entry point on purpose. Retention was previously a single call against a
 * single table, buried in a page render, and a second table holding personal
 * data was added later without anyone noticing it was uncovered. A caller that
 * asks for "retention" should not have to know how many tables that is.
 */
export async function sweepExpiredPii(
  client: LeadRetentionClient & MarketingRetentionClient,
  retentionDays: number | null = resolveLeadRetentionDays(),
  now: Date = new Date(),
): Promise<RetentionSweepResult> {
  if (retentionDays === null) {
    return { retentionDays: null, auditLeadsRedacted: 0, marketingLeadsRedacted: 0 };
  }
  const [auditLeadsRedacted, marketingLeadsRedacted] = await Promise.all([
    redactExpiredLeads(client, retentionDays, now),
    redactExpiredMarketingLeads(client, retentionDays, now),
  ]);
  return { retentionDays, auditLeadsRedacted, marketingLeadsRedacted };
}
