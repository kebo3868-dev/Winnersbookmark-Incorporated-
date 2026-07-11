import Link from 'next/link';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AuditsPage() {
  const audits = await prisma.audit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { restaurant: true },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="label mb-2">Audits</p>
          <h1 className="font-display text-3xl">All Restaurant Audits</h1>
        </div>
        <Link href="/audits/new" className="btn-gold">Run New Audit</Link>
      </div>
      <div className="card divide-y divide-obsidian-line">
        {audits.length === 0 && <p className="p-10 text-center text-ivory-faint text-sm">No audits yet.</p>}
        {audits.map((audit) => (
          <Link key={audit.id} href={`/audits/${audit.id}`} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-obsidian-soft/60">
            <div>
              <p className="text-ivory">
                {audit.restaurant.name}
                {audit.demoMode && <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-dim border border-gold-dim/50 rounded px-1.5 py-0.5">Demo</span>}
              </p>
              <p className="text-ivory-faint text-xs mt-1">{audit.restaurant.websiteUrl} · {audit.createdAt.toISOString().slice(0, 10)}</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <span className="font-display text-gold text-xl">{audit.overallScore ?? '—'}</span>
              <span className="label">{audit.status.replace(/_/g, ' ')}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
