import Link from 'next/link';
import { prisma } from '@/lib/db';
import LocalTime from '@/components/LocalTime';
import { displayDomain } from '@/lib/validation/urlSanitize';
import { presentFailure, shortRunId } from '@/lib/audit/failurePresentation';

export const dynamic = 'force-dynamic';

/**
 * AUDIT HISTORY
 *
 * Repeated audits of the same restaurant used to be indistinguishable: the same
 * name, the same URL, the same date, and — for a failed run — a wall of
 * percent-encoded characters where the identity should be. Choosing the right
 * one out of four meant opening all four.
 *
 * Every row now carries the resolved restaurant name, the normalized domain,
 * the date and local time, the status, the score when there is one, and a short
 * run ID. Failed audits are kept, and shown as a readable failure rather than as
 * their raw URL.
 */

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'text-emerald-400 border-emerald-400/40',
  PARTIALLY_COMPLETED: 'text-amber-400 border-amber-400/40',
  RUNNING: 'text-gold border-gold/40',
  PENDING: 'text-ivory-dim border-obsidian-line',
  FAILED: 'text-red-400 border-red-400/40',
};

export default async function AuditsPage() {
  const audits = await prisma.audit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { restaurant: true },
  });

  // The newest run that actually produced findings. Marked so an operator
  // reaching for "the current one" does not have to compare timestamps.
  const latestCompletedId = audits.find((a) => a.status === 'COMPLETED' || a.status === 'PARTIALLY_COMPLETED')?.id ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label mb-2">Audits</p>
          <h1 className="font-display text-3xl">All Restaurant Audits</h1>
        </div>
        <Link href="/audits/new" className="btn-gold">Run New Audit</Link>
      </div>
      <div className="card divide-y divide-obsidian-line">
        {audits.length === 0 && <p className="p-10 text-center text-ivory-faint text-sm">No audits yet.</p>}
        {audits.map((audit) => {
          const failed = audit.status === 'FAILED';
          const failure = failed ? presentFailure(audit.failureReason) : null;
          return (
            <Link
              key={audit.id}
              href={`/audits/${audit.id}`}
              className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-5 sm:px-6 py-4 hover:bg-obsidian-soft/60"
            >
              <div className="min-w-0">
                <p className="text-ivory flex flex-wrap items-center gap-2">
                  <span className="truncate">{audit.restaurant.name}</span>
                  {audit.id === latestCompletedId && (
                    <span className="text-[10px] uppercase tracking-wider text-gold border border-gold/50 rounded px-1.5 py-0.5">Latest</span>
                  )}
                  {audit.demoMode && (
                    <span className="text-[10px] uppercase tracking-wider text-gold-dim border border-gold-dim/50 rounded px-1.5 py-0.5">Demo</span>
                  )}
                </p>
                <p className="text-ivory-faint text-xs mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {/* The normalized domain, never the raw submitted string. */}
                  <span>{displayDomain(audit.restaurant.websiteUrl)}</span>
                  <span aria-hidden="true">·</span>
                  <LocalTime iso={audit.createdAt.toISOString()} />
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">#{shortRunId(audit.id)}</span>
                </p>
                {failure && <p className="text-red-300/90 text-xs mt-1.5">{failure.reason}</p>}
              </div>
              <div className="flex items-center gap-5 text-sm shrink-0">
                {!failed && (
                  <span className="font-display text-gold text-xl tabular-nums">{audit.overallScore ?? '—'}</span>
                )}
                <span
                  className={`text-[10px] uppercase tracking-wider border rounded px-2 py-1 ${
                    STATUS_STYLES[audit.status] ?? 'text-ivory-dim border-obsidian-line'
                  }`}
                >
                  {failure ? failure.state : audit.status.replace(/_/g, ' ')}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
