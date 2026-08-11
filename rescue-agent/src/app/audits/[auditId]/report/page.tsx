import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadExecutiveReport } from '@/lib/reports/executiveData';
import type { ExecutiveFinding, RevenueScenario, JourneyMapStage } from '@/lib/reports/executive';

export const dynamic = 'force-dynamic';

const CLASSIFICATION_STYLES: Record<string, string> = {
  'VERIFIED FINDING': 'text-emerald-400 border-emerald-400/40',
  'INFERRED OPPORTUNITY': 'text-gold border-gold/40',
  'MANUAL VALIDATION REQUIRED': 'text-amber-400 border-amber-400/40',
  'INSUFFICIENT DATA': 'text-ivory-faint border-obsidian-line',
  'ILLUSTRATIVE SCENARIO': 'text-gold border-gold/40',
};

const STATUS_STYLES: Record<string, string> = {
  HEALTHY: 'text-emerald-400 border-emerald-400/40',
  FRICTION: 'text-amber-400 border-amber-400/40',
  RISK: 'text-red-400 border-red-400/40',
  'MANUAL VALIDATION': 'text-amber-400 border-amber-400/40',
  'INSUFFICIENT DATA': 'text-ivory-faint border-obsidian-line',
  UNKNOWN: 'text-ivory-faint border-obsidian-line',
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
    <div className="max-w-3xl mx-auto space-y-16">
      {dto.cover.demoMode && (
        <div className="border border-gold-dim/60 text-gold-dim rounded px-4 py-3 text-center text-xs uppercase tracking-widest">
          Demonstration Data — this report describes a fictional restaurant
        </div>
      )}

      {/* COVER */}
      <header className="card border-gold-dim/30 px-10 py-14 text-center space-y-5 relative overflow-hidden">
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
        {/* Cover value block */}
        <div className="flex flex-wrap justify-center gap-3 pt-6">
          {[
            [dto.score.rescueScore ?? '—', 'Rescue Score'],
            [dto.score.coverage !== null ? `${dto.score.coverage}%` : '—', 'Coverage'],
            [dto.score.evidenceCount, 'Evidence Items'],
            [dto.score.sourcesAnalyzed, 'Pages Analyzed'],
          ].map(([v, l]) => (
            <div key={String(l)} className="border border-obsidian-line rounded px-5 py-3 min-w-[110px]">
              <p className="font-display text-2xl text-gold">{v}</p>
              <p className="label mt-1">{l}</p>
            </div>
          ))}
        </div>
        <div className="pt-6 flex flex-wrap justify-center gap-4">
          <a href={`/api/audits/${auditId}/report/pdf`} className="btn-gold">Download Executive Audit (PDF)</a>
          <Link href={`/audits/${auditId}`} className="btn-outline">Internal Audit View</Link>
        </div>
        <p className="label pt-4">{dto.cover.preparedBy}</p>
      </header>

      {/* EXECUTIVE REVENUE SNAPSHOT */}
      <Section kicker="At a Glance" title="Executive Revenue Snapshot">
        <p className="text-ivory-dim text-sm mb-5">The whole audit in sixty seconds: the top priorities, the score, and the single most important thing to validate.</p>
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {dto.snapshot.priorities.map((p) => (
            <div key={p.rank} className="card p-5 border-gold-dim/20">
              <p className="label text-gold-dim">Priority {String(p.rank).padStart(2, '0')}</p>
              <p className="font-display text-ivory text-lg mt-1 leading-tight">{p.title}</p>
              <p className="text-[10px] uppercase tracking-widest text-amber-400 mt-2">{p.priorityLabel}</p>
              <p className="text-ivory-dim text-xs mt-3">{p.summary}</p>
              <p className="text-ivory-faint text-[11px] mt-3"><span className="label">Validate:</span> {p.validationRequired}</p>
            </div>
          ))}
          {dto.snapshot.priorities.length === 0 && (
            <div className="card p-5 sm:col-span-3 text-ivory-dim text-sm">No high-priority revenue leaks were confirmed from public evidence. The recommended next step is validating what public analysis cannot see.</div>
          )}
        </div>
        <div className="card p-6 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <SnapshotRow label="Rescue Score">{dto.snapshot.rescueScore ?? '—'}{dto.snapshot.band ? ` · ${dto.snapshot.band}` : ''}</SnapshotRow>
          <SnapshotRow label="Coverage">{dto.snapshot.coverage !== null ? `${dto.snapshot.coverage}%` : '—'}</SnapshotRow>
          <SnapshotRow label="Top Recommended Automation">{dto.snapshot.topRecommendedAutomation ?? 'Validate first — no automation recommended yet'}</SnapshotRow>
          <SnapshotRow label="Primary Validation">{dto.snapshot.primaryValidationRequirement}</SnapshotRow>
          <SnapshotRow label="Recommended Next Step">{dto.snapshot.recommendedNextStep}</SnapshotRow>
        </div>
      </Section>

      {/* EXECUTIVE SUMMARY */}
      <Section kicker="Section 01" title="Executive Summary">
        <p className="text-ivory-dim leading-relaxed">{dto.executiveSummary}</p>
      </Section>

      {/* SCORE */}
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
            [dto.score.evidenceCount, 'Evidence items collected'],
            [dto.score.sourcesAnalyzed, 'Pages analyzed'],
            [dto.score.findingsCount, 'Revenue-leak findings'],
          ].map(([n, label]) => (
            <div key={String(label)} className="border border-obsidian-line rounded px-4 py-2 text-center">
              <p className="font-display text-lg text-ivory">{n}</p>
              <p className="label">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-ivory-faint text-xs mt-5 mb-2">
          How the {dto.score.findingsCount} revenue-leak finding(s) in Section 04 are classified. These describe the findings, not the {dto.score.evidenceCount} evidence items above — every evidence item carries its own confidence score and is listed in the Appendix.
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            [dto.score.verifiedCount, 'Verified from public evidence'],
            [dto.score.inferredCount, 'Inferred opportunities'],
            [dto.score.manualValidationCount, 'Need your data to confirm'],
          ].map(([n, label]) => (
            <div key={String(label)} className="border border-obsidian-line rounded px-4 py-2 text-center">
              <p className="font-display text-lg text-ivory">{n}</p>
              <p className="label">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* WHAT THIS COULD BE COSTING YOU */}
      {dto.scenarios.length > 0 && (
        <Section kicker="Section 03" title="What This Could Be Costing You">
          <div className="border border-gold-dim/40 rounded px-4 py-3 mb-5 text-gold-dim text-xs uppercase tracking-widest text-center">
            Illustrative scenarios — not confirmed losses. Every assumption is shown so you can replace it with your real numbers.
          </div>
          <div className="space-y-5">
            {dto.scenarios.map((sc) => <ScenarioCard key={sc.key} scenario={sc} />)}
          </div>
        </Section>
      )}

      {/* TOP REVENUE LEAKS */}
      <Section kicker="Section 04" title="Top Revenue Leaks">
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

      {/* VISUAL CUSTOMER JOURNEY */}
      <Section kicker="Section 05" title="Customer Journey Map">
        <p className="text-ivory-dim text-sm mb-5">Where guest friction clusters across the journey, from discovery to return.</p>
        <div className="flex flex-col gap-2">
          {dto.journeyMap.map((stage, i) => <JourneyMapRow key={stage.stage} stage={stage} isLast={i === dto.journeyMap.length - 1} />)}
        </div>
        <details className="card mt-6">
          <summary className="px-6 py-4 cursor-pointer label hover:text-gold">Detailed journey findings</summary>
          <div className="divide-y divide-obsidian-line">
            {dto.journeyScorecard.map((row) => (
              <div key={row.stage} className="px-6 py-3 flex items-start gap-5">
                <span className={`w-32 shrink-0 text-xs uppercase tracking-wide pt-0.5 ${STATUS_STYLES[row.status]?.split(' ')[0] ?? 'text-ivory-faint'}`}>{row.status}</span>
                <div>
                  <p className="text-sm text-ivory">{row.label}</p>
                  <p className="text-ivory-faint text-xs mt-0.5">{row.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      </Section>

      {/* RANKED AI OPPORTUNITIES */}
      <Section kicker="Section 06" title="AI Automation Opportunities">
        {dto.rankedAiOpportunities.length === 0 ? (
          <p className="text-ivory-dim text-sm">No automation is recommended from current public evidence. Automation should follow validated demand, not precede it.</p>
        ) : (
          <div className="space-y-4">
            {dto.rankedAiOpportunities.map((opp) => (
              <div key={opp.rank} className="card p-6 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <p className="font-display text-lg text-gold">#{opp.rank} · {opp.solutionCategory}</p>
                  <span className="text-[10px] uppercase tracking-widest border border-gold/40 text-gold rounded px-2.5 py-1">Fit: {opp.fit}</span>
                </div>
                <Field label="Problem addressed">{opp.problemAddressed}</Field>
                <Field label="Why it fits">{opp.whyItFits}</Field>
                <div className="mt-3">
                  <p className="label mb-1">What it can do</p>
                  <ul className="list-disc list-inside text-ivory-dim space-y-0.5">{opp.capabilities.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
                <div className="mt-3"><Field label="Validation before implementation">{opp.validationBeforeImplementation}</Field></div>
                <div className="flex flex-wrap gap-6 mt-3 pt-3 border-t border-obsidian-line">
                  <div><p className="label">Complexity</p><p className="text-ivory text-sm">{opp.implementationComplexity}</p></div>
                  <div className="flex-1 min-w-[200px]"><p className="label">Measurement</p><p className="text-ivory-dim text-xs">{opp.measurement.join(' · ')}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* WINNERS BOOKMARK PRESCRIPTION */}
      <Section kicker="Section 07" title="Winners Bookmark Prescription">
        <div className="space-y-4">
          <PrescriptionBlock label="Diagnosis">{dto.prescription.diagnosis}</PrescriptionBlock>
          <PrescriptionBlock label="Validation">{dto.prescription.validation}</PrescriptionBlock>
          <PrescriptionBlock label="Prescription" highlight>{dto.prescription.prescription}</PrescriptionBlock>
          <div className="card p-6">
            <p className="label mb-3">Expected Operational Role</p>
            <ul className="list-disc list-inside text-ivory-dim text-sm space-y-1">
              {dto.prescription.expectedOperationalRole.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      </Section>

      {/* DECISION BOX */}
      <Section kicker="Section 08" title="The Decision">
        <div className="grid sm:grid-cols-3 gap-4">
          <DecisionCard heading={dto.decisionBox.doNothing.heading} tone="muted">
            <p className="text-ivory-dim">{dto.decisionBox.doNothing.detail}</p>
            <p className="mt-3"><span className="label">Risk:</span> <span className="text-ivory-dim">{dto.decisionBox.doNothing.risk}</span></p>
          </DecisionCard>
          <DecisionCard heading={dto.decisionBox.validate.heading} tone="gold">
            <p className="text-ivory-dim">{dto.decisionBox.validate.detail}</p>
            <p className="mt-3"><span className="label">Cost:</span> <span className="text-ivory-dim">{dto.decisionBox.validate.cost}</span></p>
            <p className="mt-1"><span className="label">Benefit:</span> <span className="text-ivory-dim">{dto.decisionBox.validate.benefit}</span></p>
          </DecisionCard>
          <DecisionCard heading={dto.decisionBox.implement.heading} tone="emerald">
            <p className="text-ivory-dim">{dto.decisionBox.implement.detail}</p>
            <p className="mt-3"><span className="label">Benefit:</span> <span className="text-ivory-dim">{dto.decisionBox.implement.benefit}</span></p>
          </DecisionCard>
        </div>
      </Section>

      {/* 30-DAY PLAN */}
      <Section kicker="Section 09" title="30-Day Restaurant Rescue Plan">
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

      {/* CTA + QR */}
      <section className="card border-gold-dim/40 p-10 text-center space-y-5">
        <p className="font-display text-2xl text-gold">{dto.cta.headline}</p>
        <p className="text-ivory-dim text-sm max-w-xl mx-auto">{dto.cta.subtext}</p>
        {dto.cta.qrDataUrl ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dto.cta.qrDataUrl} alt="Scan to book your Restaurant Rescue Review" width={132} height={132} className="rounded bg-white p-2" />
            <p className="label">Scan to book</p>
          </div>
        ) : dto.cta.bookingUrl ? (
          <a href={dto.cta.bookingUrl} className="btn-gold inline-block">Book Your Review</a>
        ) : (
          <p className="text-ivory text-sm">{dto.cta.fallbackText}</p>
        )}
        <div className="border-t border-obsidian-line pt-5 mt-2">
          <p className="text-ivory">{dto.cta.consultantName} · {dto.cta.company}</p>
          <p className="text-ivory-dim text-sm">{dto.cta.phone}{dto.cta.email ? ` · ${dto.cta.email}` : ''}</p>
        </div>
      </section>

      {/* METHODOLOGY */}
      <Section kicker="Section 10" title="Methodology & Limitations">
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

      {/* VALUE SIGNALS FOOTER */}
      <footer className="text-center pb-10 space-y-3">
        <a href={`/api/audits/${auditId}/report/pdf`} className="btn-gold inline-block">Download Executive Audit (PDF)</a>
        <p className="text-ivory-faint text-xs">
          {dto.valueSignals.confidentialityNote} · Prepared for {dto.valueSignals.preparedFor} · {dto.valueSignals.pagesAnalyzed} pages, {dto.valueSignals.evidenceItems} evidence items · Audit {dto.valueSignals.auditId}
        </p>
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
    <div className="mt-3 first:mt-0">
      <p className="label mb-1">{label}</p>
      <p className="text-ivory-dim">{children}</p>
    </div>
  );
}

function SnapshotRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-0.5">{label}</p>
      <p className="text-ivory-dim">{children}</p>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: RevenueScenario }) {
  return (
    <div className="card p-7 border-gold-dim/30">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h3 className="font-display text-lg text-ivory">{scenario.pathwayTitle}</h3>
        <span className={`text-[10px] uppercase tracking-widest border rounded px-2.5 py-1 ${CLASSIFICATION_STYLES['ILLUSTRATIVE SCENARIO']}`}>{scenario.classification}</span>
      </div>
      <Field label="Observed friction">{scenario.observedFriction}</Field>
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <div>
          <p className="label mb-1">Illustrative assumptions</p>
          <ul className="text-ivory-dim text-sm space-y-0.5">
            {scenario.assumptions.map((a: RevenueScenario['assumptions'][number], i: number) => (
              <li key={i} className="flex justify-between gap-4 border-b border-obsidian-line/60 py-1">
                <span>{a.label}</span><span className="text-ivory font-semibold whitespace-nowrap">{a.value}</span>
              </li>
            ))}
          </ul>
          <p className="text-ivory-faint text-[11px] mt-2">Formula: {scenario.formula}</p>
        </div>
        <div className="flex flex-col justify-center items-center bg-obsidian-soft/60 rounded p-4">
          <p className="label">Illustrative monthly exposure</p>
          <p className="font-display text-2xl text-gold">{scenario.monthlyExposure}</p>
          <p className="label mt-3">Illustrative annual exposure</p>
          <p className="font-display text-3xl text-gold">{scenario.annualExposure}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="label mb-1">Data required to validate</p>
        <p className="text-ivory-dim text-sm">{scenario.dataRequiredToValidate.join(' · ')}</p>
      </div>
      <p className="text-gold-dim text-xs mt-4 border-t border-gold-dim/20 pt-3">{scenario.confidenceStatement}</p>
    </div>
  );
}

function JourneyMapRow({ stage, isLast }: { stage: JourneyMapStage; isLast: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className={`shrink-0 w-40 text-xs uppercase tracking-widest border rounded px-3 py-2 text-center ${STATUS_STYLES[stage.status] ?? STATUS_STYLES.UNKNOWN}`}>{stage.status}</span>
        <div className="flex-1">
          <p className="text-ivory text-sm font-semibold">{stage.label}</p>
          <p className="text-ivory-faint text-xs">{stage.note}</p>
        </div>
      </div>
      {!isLast && <div className="ml-[4.5rem] h-3 border-l border-obsidian-line" aria-hidden />}
    </div>
  );
}

function PrescriptionBlock({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`card p-6 ${highlight ? 'border-gold-dim/50' : ''}`}>
      <p className={`label mb-2 ${highlight ? 'text-gold' : 'text-gold-dim'}`}>{label}</p>
      <p className="text-ivory-dim text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function DecisionCard({ heading, tone, children }: { heading: string; tone: 'muted' | 'gold' | 'emerald'; children: React.ReactNode }) {
  const border = tone === 'gold' ? 'border-gold-dim/50' : tone === 'emerald' ? 'border-emerald-400/40' : 'border-obsidian-line';
  const head = tone === 'gold' ? 'text-gold' : tone === 'emerald' ? 'text-emerald-400' : 'text-ivory-dim';
  return (
    <div className={`card p-5 ${border}`}>
      <p className={`font-display text-lg mb-3 ${head}`}>{heading}</p>
      <div className="text-sm space-y-1">{children}</div>
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
        <Field label="The business problem">{finding.problem}</Field>
        <Field label="Why it matters">{finding.whyItMatters}</Field>
        <Field label="Potential commercial effect">{finding.commercialEffect}</Field>
        <div>
          <p className="label mb-1">What we know</p>
          <ul className="list-disc list-inside text-ivory-dim space-y-1">
            {finding.whatWeKnow.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
        <Field label="What we do not yet know">{finding.whatWeDoNotKnow}</Field>
        <Field label="Recommended next action">{finding.recommendedAction}</Field>
      </div>
      {finding.scenario && (
        <div className="mt-5 border-t border-gold-dim/20 pt-4">
          <ScenarioCard scenario={finding.scenario} />
        </div>
      )}
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
