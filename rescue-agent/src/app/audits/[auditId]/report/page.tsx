import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadExecutiveReport } from '@/lib/reports/executiveData';
import type { ExecutiveFinding } from '@/lib/reports/executive';

export const dynamic = 'force-dynamic';

const CLASSIFICATION_STYLES: Record<string, string> = {
  'VERIFIED FINDING': 'text-emerald-400 border-emerald-400/40',
  'INFERRED OPPORTUNITY': 'text-gold border-gold/40',
  'MANUAL VALIDATION REQUIRED': 'text-amber-400 border-amber-400/40',
  'INSUFFICIENT DATA': 'text-ivory-faint border-obsidian-line',
};

const STATUS_STYLES: Record<string, string> = {
  HEALTHY: 'text-emerald-400',
  FRICTION: 'text-amber-400',
  RISK: 'text-red-400',
  'INSUFFICIENT DATA': 'text-ivory-faint',
};

export default async function ExecutiveReportPage({ params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const result = await loadExecutiveReport(auditId);
  if (result.status === 'not_found') notFound();
  if (result.status === 'not_ready') {
    return (
      <div className="max-w-2xl mx-auto card p-10 text-center space-y-3">
        <p className="font-display text-xl text-ivory">Executive report not ready</p>
        <p className="text-ivory-dim text-sm">This audit is currently {result.auditStatus.replace(/_/g, ' ').toLowerCase()}. The executive report becomes available when the audit completes.</p>
        <Link href={`/audits/${auditId}`} className="btn-outline inline-block mt-4">Back to Audit</Link>
      </div>
    );
  }
  const dto = result.dto;

  return (
    <div className="max-w-3xl mx-auto space-y-14">
      {dto.cover.demoMode && (
        <div className="border border-gold-dim/60 text-gold-dim rounded px-4 py-3 text-center text-xs uppercase tracking-widest">
          Demonstration Data — this report describes a fictional restaurant
        </div>
      )}

      {/* COVER */}
      <header className="card border-gold-dim/30 px-10 py-14 text-center space-y-5">
        <p className="label text-gold">Winners Bookmark</p>
        <h1 className="font-display text-4xl text-ivory tracking-wide">RESTAURANT RESCUE AUDIT</h1>
        <p className="text-gold-dim text-sm">{dto.cover.subtitle}</p>
        <div className="pt-6 space-y-1">
          <p className="font-display text-2xl text-ivory">{dto.cover.restaurantName}</p>
          <p className="text-ivory-dim text-sm">{dto.cover.websiteUrl}{dto.cover.location ? ` · ${dto.cover.location}` : ''}</p>
          <p className="text-ivory-faint text-xs">Audit date: {dto.cover.auditDate}</p>
          {dto.cover.auditStatus === 'PARTIALLY_COMPLETED' && (
            <p className="text-amber-300 text-xs uppercase tracking-widest pt-2">Audit partially completed — see Methodology &amp; Limitations</p>
          )}
        </div>
        <div className="pt-6 flex justify-center gap-4">
          <a href={`/api/audits/${auditId}/report/pdf`} className="btn-gold">Download Executive Audit (PDF)</a>
          <Link href={`/audits/${auditId}`} className="btn-outline">Internal Audit View</Link>
        </div>
        <p className="label pt-4">{dto.cover.preparedBy}</p>
      </header>

      {/* 1 — EXECUTIVE SUMMARY */}
      <Section kicker="Section 01" title="Executive Summary">
        <p className="text-ivory-dim leading-relaxed">{dto.executiveSummary}</p>
      </Section>

      {/* 2 — SCORE */}
      <Section kicker="Section 02" title="Restaurant Rescue Score">
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="card p-8 text-center">
            <p className="font-display text-6xl text-gold">{dto.score.rescueScore ?? '—'}<span className="text-xl text-ivory-faint"> / 100</span></p>
            <p className="label mt-3">Rescue Score</p>
            {dto.score.band && <p className="text-ivory-dim text-xs mt-1 uppercase tracking-wide">{dto.score.band}</p>}
          </div>
          <div className="card p-8 text-center">
            <p className="font-display text-6xl text-ivory">{dto.score.coverage ?? '—'}<span className="text-xl text-ivory-faint">%</span></p>
            <p className="label mt-3">Audit Coverage</p>
            <p className="text-ivory-faint text-xs mt-1">Share of the intended audit scope with sufficient public evidence</p>
          </div>
        </div>
        <p className="text-ivory-dim text-sm mb-5">{dto.score.interpretation}</p>
        <div className="flex flex-wrap gap-3">
          {[
            [dto.score.evidenceCount, 'Evidence items'],
            [dto.score.sourcesAnalyzed, 'Pages analyzed'],
            [dto.score.verifiedCount, 'Verified findings'],
            [dto.score.inferredCount, 'Inferred opportunities'],
            [dto.score.manualValidationCount, 'Require manual validation'],
          ].map(([n, label]) => (
            <div key={String(label)} className="border border-obsidian-line rounded px-4 py-2 text-center">
              <p className="font-display text-lg text-ivory">{n}</p>
              <p className="label">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 3 — TOP REVENUE LEAKS */}
      <Section kicker="Section 03" title="Top Revenue Leaks">
        {dto.findings.length === 0 ? (
          <p className="text-ivory-dim text-sm">
            No high-priority revenue leaks were confirmed from public evidence. Remaining risk sits in areas a public audit cannot see — phone handling, follow-up, and repeat business — which we recommend validating directly.
          </p>
        ) : (
          <div className="space-y-6">
            {dto.findings.map((f) => <FindingCard key={f.number} finding={f} />)}
          </div>
        )}
      </Section>

      {/* 4 — JOURNEY SCORECARD */}
      <Section kicker="Section 04" title="Customer Journey Scorecard">
        <div className="card divide-y divide-obsidian-line">
          {dto.journeyScorecard.map((row) => (
            <div key={row.stage} className="px-6 py-3 flex items-start gap-5">
              <span className={`w-32 shrink-0 text-xs uppercase tracking-wide pt-0.5 ${STATUS_STYLES[row.status] ?? 'text-ivory-faint'}`}>{row.status}</span>
              <div>
                <p className="text-sm text-ivory">{row.label}</p>
                <p className="text-ivory-faint text-xs mt-0.5">{row.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 5 — AI OPPORTUNITIES */}
      <Section kicker="Section 05" title="AI & Automation Opportunities">
        {dto.aiOpportunities.length === 0 ? (
          <p className="text-ivory-dim text-sm">No automation is recommended from current public evidence. Automation should follow validated demand, not precede it.</p>
        ) : (
          <div className="space-y-4">
            {dto.aiOpportunities.map((opp, i) => (
              <div key={i} className="card p-6 text-sm space-y-3">
                <p className="font-display text-lg text-gold">{opp.solutionCategory}</p>
                <Field label="Problem addressed">{opp.problemAddressed}</Field>
                <Field label="Why it fits this restaurant">{opp.whyItFits}</Field>
                <Field label="Validation required first">{opp.validationRequired}</Field>
                <p className="text-ivory-faint text-xs">Implementation complexity: {opp.complexity}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 6 — 30-DAY PLAN */}
      <Section kicker="Section 06" title="30-Day Restaurant Rescue Plan">
        <div className="space-y-4">
          {dto.thirtyDayPlan.map((phase) => (
            <div key={phase.phase} className="card p-6">
              <p className="font-display text-gold mb-3">{phase.phase} — {phase.heading}</p>
              <ul className="list-disc list-inside text-ivory-dim text-sm space-y-1">
                {phase.actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* 7 — RECOMMENDATION */}
      <Section kicker="Section 07" title="Winners Bookmark Recommendation">
        <div className="card border-gold-dim/40 p-8 space-y-4">
          <p className="text-ivory-dim text-sm leading-relaxed">{dto.recommendation.body}</p>
          <div>
            <p className="font-display text-xl text-ivory mb-1">NEXT STEP</p>
            <p className="text-ivory-dim text-sm">{dto.recommendation.nextStep}</p>
          </div>
          <div className="border-t border-obsidian-line pt-4">
            <p className="text-ivory text-sm">{dto.recommendation.company}</p>
            <p className="text-ivory-dim text-sm">{dto.recommendation.contactName} · {dto.recommendation.contactPhone}</p>
          </div>
        </div>
      </Section>

      {/* 8 — METHODOLOGY */}
      <Section kicker="Section 08" title="Methodology & Limitations">
        <ul className="list-disc list-inside text-ivory-faint text-sm space-y-2">
          {dto.methodologyAndLimitations.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </Section>

      {/* APPENDIX */}
      <Section kicker="Appendix" title="Full Evidence Chain">
        <details className="card">
          <summary className="px-6 py-4 cursor-pointer label hover:text-gold">Show all {dto.appendix.length} evidence items</summary>
          <div className="divide-y divide-obsidian-line max-h-[480px] overflow-y-auto">
            {dto.appendix.map((e, i) => (
              <div key={i} className="px-6 py-3">
                <p className="text-sm text-ivory">{e.fact}</p>
                <p className="text-ivory-faint text-xs mt-1">
                  {e.evidenceType}{e.sourceUrl ? ` · ${e.sourceUrl}` : ''} · confidence {e.confidence}%
                </p>
              </div>
            ))}
          </div>
        </details>
      </Section>

      <footer className="text-center pb-10 space-y-3">
        <a href={`/api/audits/${auditId}/report/pdf`} className="btn-gold inline-block">Download Executive Audit (PDF)</a>
        <p className="label">{dto.cover.footer}</p>
      </footer>
    </div>
  );
}

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="label text-gold-dim mb-1">{kicker}</p>
      <h2 className="font-display text-2xl text-ivory mb-1">{title}</h2>
      <div className="gold-rule w-12 mb-6 border-t-2" />
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-1">{label}</p>
      <p className="text-ivory-dim">{children}</p>
    </div>
  );
}

function FindingCard({ finding }: { finding: ExecutiveFinding }) {
  return (
    <div className="card p-7">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-2">
        <h3 className="font-display text-xl text-ivory flex-1">
          <span className="text-gold mr-3">{finding.number}.</span>{finding.title}
        </h3>
        <span className={`text-[10px] uppercase tracking-widest border rounded px-2.5 py-1 ${CLASSIFICATION_STYLES[finding.classification]}`}>
          {finding.classification}
        </span>
      </div>
      <p className="text-ivory-faint text-xs mb-4">Customer journey stage: {finding.journeyStage} · Priority: {finding.labels.priority}</p>
      <div className="space-y-4 text-sm">
        <Field label="The problem">{finding.problem}</Field>
        <Field label="Why it matters">{finding.whyItMatters}</Field>
        <div>
          <p className="label mb-1">What we know</p>
          <ul className="list-disc list-inside text-ivory-dim space-y-1">
            {finding.whatWeKnow.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
        <Field label="What we do not yet know">{finding.whatWeDoNotKnow}</Field>
        <Field label="Recommended next action">{finding.recommendedAction}</Field>
      </div>
      <div className="flex flex-wrap gap-6 border-t border-obsidian-line mt-5 pt-4">
        {[
          ['Business impact', finding.labels.businessImpact],
          ['Urgency', finding.labels.urgency],
          ['Evidence confidence', finding.labels.evidenceConfidence],
          ['Automation opportunity', finding.labels.automationOpportunity],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="label">{label}</p>
            <p className="text-ivory text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
