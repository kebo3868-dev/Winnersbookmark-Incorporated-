import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import type { OwnerReportContent } from '@/lib/reports/owner';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  HEALTHY: 'text-emerald-400',
  FRICTION: 'text-amber-400',
  RISK: 'text-red-400',
  UNKNOWN: 'text-ivory-faint',
};

export default async function OwnerReportPage({ params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const report = await prisma.report.findUnique({
    where: { auditId_reportType: { auditId, reportType: 'OWNER_AUDIT' } },
  });
  if (!report) notFound();
  const content = report.content as unknown as OwnerReportContent;

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      {content.header.demoMode && (
        <div className="border border-gold-dim/60 text-gold-dim rounded px-4 py-3 text-center text-xs uppercase tracking-widest">
          Demonstration Data — this report describes a fictional restaurant
        </div>
      )}

      {/* PAGE 1 — HEADER */}
      <header className="text-center space-y-4 pt-4">
        <p className="label">Winners Bookmark Restaurant Rescue Audit</p>
        <h1 className="font-display text-4xl text-ivory">{content.header.restaurantName}</h1>
        <p className="text-ivory-dim text-sm">
          {content.header.location ? `${content.header.location} · ` : ''}{content.header.websiteUrl} · {content.header.auditDate}
        </p>
        <div className="flex justify-center gap-10 pt-4">
          <div>
            <p className="font-display text-6xl text-gold">{content.header.rescueScore ?? '—'}</p>
            <p className="label mt-2">Restaurant Rescue Score</p>
            {content.header.scoreBand && <p className="text-ivory-dim text-xs mt-1 uppercase tracking-wide">{content.header.scoreBand}</p>}
          </div>
          <div>
            <p className="font-display text-6xl text-ivory">{content.header.coverageScore}%</p>
            <p className="label mt-2">Audit Coverage Score</p>
          </div>
        </div>
        {content.header.auditStatus === 'PARTIALLY_COMPLETED' && (
          <p className="text-amber-300 text-xs uppercase tracking-widest">Audit Partially Completed — see Assumptions & Limitations</p>
        )}
      </header>

      <section className="card p-8">
        <h2 className="label mb-4">Executive Summary</h2>
        <p className="text-ivory-dim leading-relaxed">{content.executiveSummary}</p>
        <p className="text-gold mt-4 font-display">{content.biggestOpportunity}</p>
      </section>

      {/* PAGE 2 — SCORECARD */}
      <section>
        <h2 className="label mb-4">Restaurant Rescue Scorecard</h2>
        <div className="card divide-y divide-obsidian-line">
          {content.scorecard.map((row) => (
            <div key={row.category} className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-ivory">{row.label} <span className="text-ivory-faint">({row.weight}%)</span></p>
                <p className="font-display text-xl text-gold">{row.insufficientData ? 'INSUFFICIENT DATA' : row.score}</p>
              </div>
              {!row.insufficientData && row.score !== null && (
                <div className="h-1.5 bg-obsidian-soft rounded mt-2 overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${row.score}%` }} />
                </div>
              )}
              <p className="text-ivory-faint text-xs mt-2">{row.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PAGE 3 — TOP LEAKS */}
      <section>
        <h2 className="label mb-4">Top {content.topLeaks.length || ''} Revenue Leaks</h2>
        {content.topLeaks.length === 0 ? (
          <div className="card p-8 text-ivory-dim text-sm">No high-priority revenue leaks were confirmed from public evidence.</div>
        ) : (
          <div className="space-y-6">
            {content.topLeaks.map((leak) => (
              <div key={leak.rank} className="card p-8">
                <div className="flex justify-between gap-4 mb-4">
                  <h3 className="font-display text-xl text-ivory"><span className="text-gold mr-3">#{leak.rank}</span>{leak.title}</h3>
                  <div className="text-right shrink-0">
                    <p className="font-display text-2xl text-gold">{leak.rescuePriorityScore}</p>
                    <p className="label">Priority</p>
                  </div>
                </div>
                <dl className="space-y-3 text-sm">
                  <div><dt className="label mb-1">Problem</dt><dd className="text-ivory-dim">{leak.problem}</dd></div>
                  <div>
                    <dt className="label mb-1">Evidence</dt>
                    <dd><ul className="list-disc list-inside text-ivory-dim space-y-1">{leak.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul></dd>
                  </div>
                  <div><dt className="label mb-1">Why It Matters</dt><dd className="text-ivory-dim">{leak.whyItMatters}</dd></div>
                  <div><dt className="label mb-1">Recommended Action</dt><dd className="text-ivory">{leak.recommendedAction}</dd></div>
                </dl>
                {leak.manualValidationRequired && (
                  <p className="mt-4 text-amber-400 text-xs uppercase tracking-widest">Manual validation required before treating as confirmed</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PAGE 4 — JOURNEY */}
      <section>
        <h2 className="label mb-4">Customer Journey Map</h2>
        <div className="card divide-y divide-obsidian-line">
          {content.journey.map((s) => (
            <div key={s.stage} className="px-6 py-3 flex items-start gap-4">
              <span className={`w-24 shrink-0 text-xs uppercase tracking-wide pt-0.5 ${STATUS_COLORS[s.status]}`}>{s.status}</span>
              <div>
                <p className="text-sm text-ivory">{s.stage.replace(/_/g, ' ')}</p>
                <p className="text-ivory-faint text-xs mt-0.5">{s.finding}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PAGE 5 — AI OPPORTUNITIES */}
      {content.aiOpportunities.length > 0 && (
        <section>
          <h2 className="label mb-4">AI Automation Opportunities</h2>
          <div className="space-y-4">
            {content.aiOpportunities.map((opp, i) => (
              <div key={i} className="card p-6 text-sm space-y-2">
                <p className="font-display text-ivory text-lg">{opp.title}</p>
                <p className="text-ivory-dim"><span className="label mr-2">Current friction</span>{opp.currentFriction}</p>
                <p className="text-ivory-dim"><span className="label mr-2">Automation opportunity</span>{opp.automationOpportunity}</p>
                <p className="text-ivory-dim"><span className="label mr-2">Expected benefit</span>{opp.expectedBenefit}</p>
                <p className="text-ivory-faint text-xs"><span className="label mr-2">Complexity</span>{opp.implementationComplexity}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PAGE 6 — 90 DAY PLAN */}
      <section>
        <h2 className="label mb-4">90-Day Restaurant Rescue Plan</h2>
        <div className="grid gap-4">
          {content.rescuePlan.map((phase) => (
            <div key={phase.phase} className="card p-6">
              <p className="font-display text-gold mb-3">{phase.phase}</p>
              <ul className="list-disc list-inside text-ivory-dim text-sm space-y-1">
                {phase.actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* PAGE 7 — ASSUMPTIONS */}
      <section className="card p-8">
        <h2 className="label mb-4">Assumptions & Limitations</h2>
        <ul className="list-disc list-inside text-ivory-faint text-xs space-y-2">
          {content.assumptionsAndLimitations.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </section>

      {/* PAGE 8 — RECOMMENDATION */}
      <section className="card p-8 border-gold-dim/40">
        <h2 className="label mb-4">Winners Bookmark Recommendation</h2>
        <p className="font-display text-2xl text-gold mb-3">{content.recommendation.tier}</p>
        <p className="text-ivory-dim text-sm">{content.recommendation.rationale}</p>
      </section>

      {/* PAGE 9 — NEXT STEP */}
      <section className="text-center space-y-4 pb-8">
        <p className="font-display text-2xl text-ivory">{content.nextStep.cta}</p>
        <p className="text-ivory-dim text-sm">{content.nextStep.company} · Founder: {content.nextStep.founder}</p>
        <p className="label">{content.nextStep.footer}</p>
        <div className="pt-4">
          <Link href={`/audits/${auditId}`} className="btn-outline">Back to Audit</Link>
        </div>
      </section>
    </div>
  );
}
