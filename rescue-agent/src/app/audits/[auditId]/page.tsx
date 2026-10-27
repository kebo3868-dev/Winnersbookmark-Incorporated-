import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import AuditProgress from '@/components/AuditProgress';
import { scoreBand } from '@/lib/scoring/rescueScore';
import { displayDomain } from '@/lib/validation/urlSanitize';
import { presentFailure, shortRunId } from '@/lib/audit/failurePresentation';
// The same band function the client report and the PDF use. An internal page
// showing "85%" beside a client page showing "Strong" for the same fact is how
// two readings of the same evidence get into the same conversation.
import { classifyFinding, confidenceLabel, journeyStatusLabel, reportHeadlines } from '@/lib/reports/executive';
import { evidenceBasisFor, evidenceBasisRows } from '@/lib/audit/evidenceBasis';

export const dynamic = 'force-dynamic';

// Keyed by the client-facing label, so this page prints the same word for a
// stage that the Executive Report and the PDF print.
const STATUS_COLORS: Record<string, string> = {
  HEALTHY: 'text-emerald-400 border-emerald-400/30',
  'MANUAL VALIDATION': 'text-gold border-gold/40',
  FRICTION: 'text-amber-400 border-amber-400/30',
  RISK: 'text-red-400 border-red-400/30',
  'INSUFFICIENT DATA': 'text-ivory-faint border-obsidian-line',
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
          <div className="flex flex-wrap gap-3">
            <Link href={`/audits/${audit.id}/report`} className="btn-gold">Executive Report</Link>
            {(audit.status === 'COMPLETED' || audit.status === 'PARTIALLY_COMPLETED') && (
              <a href={`/api/audits/${audit.id}/report/pdf`} className="btn-outline">Export Executive PDF</a>
            )}
            <Link href={`/audits/${audit.id}/sales`} className="btn-outline">Internal Sales Brief</Link>
          </div>
        )}
      </div>

      {running && <AuditProgress auditId={audit.id} />}

      {audit.status === 'FAILED' && (() => {
        // The restaurant and the reason lead. The raw stored text is kept, but
        // demoted to diagnostics — a percent-encoded invisible character is
        // unreadable, and putting it where the failure state belongs made every
        // failed audit look identical and unexplained.
        const failure = presentFailure(audit.failureReason);
        return (
          <div className="card border-red-400/40 p-8 space-y-3">
            <p className="font-display text-xl text-red-300">{failure.state.toUpperCase()}</p>
            <p className="text-ivory">
              {audit.restaurant.name} · {displayDomain(audit.restaurant.websiteUrl)}
            </p>
            <p className="text-ivory-dim text-sm">{failure.reason}</p>
            {failure.nextStep && <p className="text-ivory-dim text-sm">{failure.nextStep}</p>}
            <details className="pt-2">
              <summary className="label cursor-pointer hover:text-gold">Diagnostics</summary>
              <p className="text-ivory-faint text-xs mt-2 break-all">Audited URL: {audit.restaurant.websiteUrl}</p>
              <p className="text-ivory-faint text-xs mt-1">Run: #{shortRunId(audit.id)}</p>
              {audit.failureReason && <p className="text-ivory-faint text-xs mt-1">Recorded reason: {audit.failureReason}</p>}
            </details>
          </div>
        );
      })()}

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
            <h2 className="label mb-4">{reportHeadlines(audit.opportunities.slice(0, 3).map(classifyFinding)).findings}</h2>
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
                    {(() => {
                      // The same three layers the client report and the PDF print
                      // for this finding — see evidenceBasis.ts.
                      const basis = evidenceBasisFor(opp.category);
                      return basis ? (
                        <dl className="border border-obsidian-line rounded px-4 py-3 mb-3 space-y-2 text-sm">
                          {evidenceBasisRows(basis).map(([label, text]) => (
                            <div key={label}>
                              <dt className="label">{label}</dt>
                              <dd className="text-ivory-dim">{text}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null;
                    })()}
                    <p className="text-ivory-dim text-sm mb-3">{opp.problem}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-ivory-faint">
                      <span>Impact {opp.impactScore}</span>
                      <span>Urgency {opp.urgencyScore}</span>
                      <span>{classifyFinding(opp)} · Finding confidence {confidenceLabel(opp.confidenceScore)}</span>
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
                    <span className={`text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 ${STATUS_COLORS[journeyStatusLabel(s.status)]}`}>{journeyStatusLabel(s.status)}</span>
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
                /*
                 * Stacked rather than side by side. A `whitespace-nowrap` badge
                 * in a flex row with the fact forced the row wider than a
                 * 360px viewport, and the whole page scrolled sideways. The
                 * supporting context is no longer truncated mid-sentence either
                 * — it wraps, and long URLs inside it break on any character.
                 */
                <div key={e.id} className="px-5 py-3">
                  <p className="text-sm text-ivory leading-relaxed break-words">{e.fact}</p>
                  {e.supportingContext && (
                    <p className="text-ivory-dim text-xs mt-1 leading-relaxed break-words">{e.supportingContext}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ivory-faint">
                    <span className="uppercase tracking-wider">{e.evidenceType.replace(/_/g, ' ')}</span>
                    <span>Confidence: {confidenceLabel(e.confidence)}</span>
                  </div>
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
