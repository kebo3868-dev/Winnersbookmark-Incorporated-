import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ATTENTION_STATUSES, classifyAudit } from '@/lib/audit/attention';

export const dynamic = 'force-dynamic';

export default async function CommandCenter() {
  const [totalAudits, completedAudits, newLeads, avgScore, recent, needsAttention] = await Promise.all([
    prisma.audit.count(),
    prisma.audit.count({ where: { status: { in: ['COMPLETED', 'PARTIALLY_COMPLETED'] } } }),
    prisma.auditLead.count({ where: { status: 'NEW' } }),
    prisma.audit.aggregate({ _avg: { overallScore: true }, where: { overallScore: { not: null } } }),
    prisma.audit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        restaurant: true,
        opportunities: { orderBy: { rescuePriorityScore: 'desc' }, take: 1 },
        salesIntelligence: { select: { priority: true } },
      },
    }),
    // Failures were recorded but never shown; surface them where they are seen.
    prisma.audit.findMany({
      where: { status: { in: ATTENTION_STATUSES } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        failureReason: true,
        createdAt: true,
        restaurant: { select: { name: true } },
      },
    }),
  ]);

  const attention = needsAttention
    .map((a) => ({ audit: a, item: classifyAudit(a) }))
    .filter((x): x is { audit: (typeof needsAttention)[number]; item: NonNullable<ReturnType<typeof classifyAudit>> } => x.item !== null);

  const stats = [
    { label: 'Total Audits', value: totalAudits },
    { label: 'Completed Audits', value: completedAudits },
    { label: 'New Leads', value: newLeads },
    { label: 'Average Rescue Score', value: avgScore._avg.overallScore ? Math.round(avgScore._avg.overallScore) : '—' },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label mb-2">Command Center</p>
          <h1 className="font-display text-3xl text-ivory">Restaurant Revenue Intelligence</h1>
          <p className="text-ivory-dim mt-2 max-w-xl text-sm">
            Find the revenue leak. Every finding traced to public evidence — nothing fabricated, nothing assumed without saying so.
          </p>
        </div>
        <Link href="/audits/new" className="btn-gold">Run New Restaurant Audit</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-6">
            <p className="label mb-3">{s.label}</p>
            <p className="font-display text-4xl text-gold">{s.value}</p>
          </div>
        ))}
      </div>

      {attention.length > 0 && (
        <div className="card overflow-hidden border-amber-300/30">
          <div className="px-6 py-4 border-b border-obsidian-line">
            <h2 className="label text-amber-300">Needs Attention</h2>
            <p className="text-ivory-faint text-xs mt-1">
              Audits that failed or completed with gaps. Review before sending anything to a client.
            </p>
          </div>
          <div className="divide-y divide-obsidian-line">
            {attention.map(({ audit, item }) => (
              <div key={audit.id} className="px-6 py-4 flex flex-wrap items-start gap-x-4 gap-y-2">
                <span
                  className={`shrink-0 mt-0.5 text-[10px] uppercase tracking-wider border rounded px-2 py-1 ${
                    item.level === 'FAILED'
                      ? 'text-red-300 border-red-300/40'
                      : 'text-amber-300 border-amber-300/40'
                  }`}
                >
                  {item.headline}
                </span>
                <div className="min-w-0">
                  <p className="text-ivory text-sm">{audit.restaurant.name}</p>
                  <p className="text-ivory-faint text-xs mt-1">{item.detail}</p>
                </div>
                <Link href={`/audits/${audit.id}`} className="ml-auto shrink-0 text-gold hover:underline text-xs">
                  Open
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-obsidian-line flex justify-between items-center">
          <h2 className="label">Recent Audits</h2>
        </div>
        {recent.length === 0 ? (
          <div className="p-10 text-center text-ivory-faint text-sm">
            No audits yet. Run your first Restaurant Rescue Audit, or{' '}
            <Link href="/audits/new" className="text-gold hover:underline">start with the demo</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {['Restaurant', 'Rescue Score', 'Coverage', 'Top Opportunity', 'Sales Priority', 'Status'].map((h) => (
                    <th key={h} className="label px-6 py-3 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((audit) => (
                  <tr key={audit.id} className="border-t border-obsidian-line hover:bg-obsidian-soft/60">
                    <td className="px-6 py-4">
                      <Link href={`/audits/${audit.id}`} className="text-ivory hover:text-gold">
                        {audit.restaurant.name}
                        {audit.demoMode && <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-dim border border-gold-dim/50 rounded px-1.5 py-0.5">Demo</span>}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-display text-gold">{audit.overallScore ?? '—'}</td>
                    <td className="px-6 py-4 text-ivory-dim">{audit.coverageScore !== null ? `${audit.coverageScore}%` : '—'}</td>
                    <td className="px-6 py-4 text-ivory-dim max-w-xs truncate">{audit.opportunities[0]?.title ?? '—'}</td>
                    <td className="px-6 py-4"><PriorityBadge priority={audit.salesIntelligence?.priority ?? null} /></td>
                    <td className="px-6 py-4"><StatusBadge status={audit.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'text-emerald-400 border-emerald-400/30',
    PARTIALLY_COMPLETED: 'text-amber-400 border-amber-400/30',
    FAILED: 'text-red-400 border-red-400/30',
    RUNNING: 'text-gold border-gold/30',
    PENDING: 'text-ivory-faint border-obsidian-line',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider border rounded px-2 py-1 ${styles[status] ?? styles.PENDING}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-ivory-faint">—</span>;
  const styles: Record<string, string> = {
    HOT: 'text-red-300 border-red-300/40',
    WARM: 'text-amber-300 border-amber-300/40',
    NURTURE: 'text-ivory-dim border-obsidian-line',
    LOW_PRIORITY: 'text-ivory-faint border-obsidian-line',
  };
  return <span className={`text-[10px] uppercase tracking-wider border rounded px-2 py-1 ${styles[priority]}`}>{priority.replace(/_/g, ' ')}</span>;
}
