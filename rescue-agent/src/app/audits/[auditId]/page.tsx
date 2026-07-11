import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import AuditProgress from '@/components/AuditProgress';
import { scoreBand } from '@/lib/scoring/rescueScore';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  HEALTHY: 'text-emerald-400 border-emerald-400/30',
  FRICTION: 'text-amber-400 border-amber-400/30',
  RISK: 'text-red-400 border-red-400/30',
  UNKNOWN: 'text-ivory-faint border-obsidian-line',
};

export default async function AuditDetailPage({ params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      restaurant: true,
      job: true,
      sources: { orderBy: { createdAt: 'asc' } },
      evidence: { orderBy: { createdAt: 'asc' } },
      opportunities: { orderBy: { rescuePriorityScore: 'desc' } },
      journeyStages: true,
      scores: true,
    },
  });
  if (!audit) notFound();

  const running = audit.status === 'PENDING' || audit.status === 'RUNNING';

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label mb-2">Audit · {audit.createdAt.toISOString().slice(0, 10)}</p>
          <h1 className="font-display text-3xl">{audit.restaurant.name}</h1>
          <p className="text-ivory-dim text-sm mt-1">{audit.restaurant.websiteUrl}</p>
          {audit.demoMode && (
            <p className="mt-3 inline-block border border-gold-dim/60 text-gold-dim rounded px-3 py-1 text-xs uppercase tracking-widest">
              Demonstration Data — fictional restaurant, not a real business
            </p>
          )}
        </div>
        {!running && (
          <div className="flex gap-3">
            <Link href={`/audits/${audit.id}/report`} className="btn-gold">Owner Report</Link>
            <Link href={`/audits/${audit.id}/sales`} className="btn-outline">Internal Sales Brief</Link>
          </div>
        )}
      </div>

      {running && <AuditProgress auditId={audit.id} />}

      {audit.status === 'FAILED' && (
        <div className="card border-red-400/40 p-8">
          <p className="font-display text-xl text-red-300 mb-2">AUDIT FAILED</p>
          <p className="text-ivory-dim text-sm">{audit.failureReason}</p>
        </div>
      )}

      {audit.status === 'PARTIALLY_COMPLETED' && (
        <div className="card border-amber-400/40 p-6">
          <p className="font-display text-lg text-amber-300 mb-1">AUDIT PARTIALLY COMPLETED</p>
          <p className="text-ivory-dim text-sm">{audit.failureReason} Findings below are limited to what was actually collected.</p>
        </div>
      )}

      {!running && audit.status !== 'FAILED' && (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="card p-6">
              <p className="label mb-2">Restaurant Rescue Score</p>
              <p className="font-display text-5xl text-gold">{audit.overallScore ?? '—'}</p>
              {audit.overallScore !== null && <p className="text-ivory-dim text-xs mt-2 uppercase tracking-wide">{scoreBand(audit.overallScore)}</p>}
            </div>
            <div className="card p-6">
              <p className="label mb-2">Audit Coverage Score</p>
              <p className="font-display text-5xl text-ivory">{audit.coverageScore ?? '—'}<span className="text-xl text-ivory-faint">%</span></p>
              <p className="text-ivory-faint text-xs mt-2">Share of intended audit categories with sufficient public evidence.</p>
            </div>
            <div className="card p-6">
              <p className="label mb-2">Evidence Collected</p>
              <p className="font-display text-5xl text-ivory">{audit.evidence.length}</p>
              <p className="text-ivory-faint text-xs mt-2">{audit.sources.filter((s) => s.status === 'COLLECTED').length} pages collected · {audit.sources.filter((s) => s.status !== 'COLLECTED').length} failed</p>
            </div>
          </div>

          <section>
            <h2 className="label mb-4">Top Revenue Leaks</h2>
            {audit.opportunities.length === 0 ? (
              <div className="card p-8 text-ivory-dim text-sm">
                No revenue leaks were confirmed from public evidence. This is a legitimate outcome — remaining risk sits in areas public analysis cannot see.
              </div>
            ) : (
              <div className="space-y-4">
                {audit.opportunities.slice(0, 3).map((opp, i) => (
                  <div key={opp.id} className="card p-6">
                    <div className="flex flex-wrap justify-between gap-4 mb-3">
                      <p className="font-display text-lg text-ivory">
                        <span className="text-gold mr-3">#{i + 1}</span>
                        {opp.title}
                      </p>
                      <div className="text-right">
                        <p className="font-display text-2xl text-gold">{opp.rescuePriorityScore}</p>
                        <p className="label">Rescue Priority</p>
                      </div>
                    </div>
                    <p className="text-ivory-dim text-sm mb-3">{opp.problem}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-ivory-faint">
                      <span>Impact {opp.impactScore}</span>
                      <span>Urgency {opp.urgencyScore}</span>
                      <span>Confidence {opp.confidenceScore}</span>
                      <span>AI Fit {opp.aiFitScore}</span>
                      <span>Stage: {opp.customerJourneyStage}</span>
                      {opp.manualValidationRequired && <span className="text-amber-400 uppercase tracking-wide">Manual validation required</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="label mb-4">Customer Journey</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {audit.journeyStages.map((s) => (
                <div key={s.id} className="card p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-ivory tracking-wide">{s.stage.replace(/_/g, ' ')}</p>
                    <span className={`text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                  </div>
                  <p className="text-ivory-dim text-xs">{s.finding}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="label mb-4">Evidence Chain ({audit.evidence.length})</h2>
            <div className="card divide-y divide-obsidian-line max-h-[420px] overflow-y-auto">
              {audit.evidence.map((e) => (
                <div key={e.id} className="px-5 py-3">
                  <div className="flex justify-between gap-4">
                    <p className="text-sm text-ivory">{e.fact}</p>
                    <span className="label whitespace-nowrap">{e.confidence}%</span>
                  </div>
                  <p className="text-ivory-faint text-xs mt-1">{e.evidenceType}{e.supportingContext ? ` · ${e.supportingContext.slice(0, 140)}` : ''}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="label mb-4">Sources Analyzed</h2>
            <div className="card divide-y divide-obsidian-line">
              {audit.sources.map((s) => (
                <div key={s.id} className="px-5 py-3 flex flex-wrap justify-between gap-3 text-sm">
                  <span className="text-ivory-dim break-all">{s.url}</span>
                  <span className={s.status === 'COLLECTED' ? 'text-emerald-400 text-xs uppercase' : 'text-red-400 text-xs uppercase'}>
                    {s.status}{s.httpStatus ? ` (${s.httpStatus})` : ''}{s.note ? ` — ${s.note.slice(0, 80)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
