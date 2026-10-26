import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadExecutiveReport } from '@/lib/reports/executiveData';
import type { ExecutiveFinding, JourneyMapStage } from '@/lib/reports/executive';
import { CONFIDENCE_EXPLANATION } from '@/lib/scoring/methodology';
import { SCENARIO_DISCLAIMER } from '@/lib/reports/scenarios';
import ScenarioCalculator from '@/components/ScenarioCalculator';

export const dynamic = 'force-dynamic';

const CLASSIFICATION_STYLES: Record<string, string> = {
  'VERIFIED FINDING': 'text-emerald-400 border-emerald-400/40',
  // Between verified and inferred: consistent, high-confidence public evidence
  // where the customer flow itself was not completed end to end.
  'STRONG EVIDENCE': 'text-emerald-300/90 border-emerald-300/30',
  'INFERRED OPPORTUNITY': 'text-gold border-gold/40',
  'MANUAL VALIDATION REQUIRED': 'text-amber-400 border-amber-400/40',
  'INSUFFICIENT DATA': 'text-ivory-faint border-obsidian-line',
};

const STATUS_STYLES: Record<string, string> = {
  HEALTHY: 'text-emerald-400 border-emerald-400/40',
  RESOLVED_UNVERIFIED: 'text-amber-400 border-amber-400/40',
  FRICTION: 'text-amber-400 border-amber-400/40',
  RISK: 'text-red-400 border-red-400/40',
  'MANUAL VALIDATION': 'text-gold border-gold/40',
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
      {/*
        * px-6 on mobile, not px-10. With 40px of padding each side a 360px
        * viewport leaves 238px for a 244px heading, so "RESTAURANT RESCUE
        * AUDIT" painted past its own box; the type scale drops a step at the
        * same width rather than breaking the word mid-way.
        */}
      <header className="card border-gold-dim/30 px-6 sm:px-10 py-14 text-center space-y-5 relative overflow-hidden">
        <p className="label text-gold">Winnersbookmark</p>
        <h1 className="font-display text-3xl sm:text-4xl text-ivory tracking-wide">RESTAURANT RESCUE AUDIT</h1>
        <p className="text-gold-dim text-sm">{dto.cover.subtitle}</p>
        <div className="pt-6 space-y-1">
          {/* A restaurant's own name can be one long word; it must wrap, not spill. */}
          <p className="font-display text-2xl text-ivory break-words">{dto.cover.restaurantName}</p>
          <p className="text-ivory-dim text-sm break-all">{dto.cover.websiteUrl}{dto.cover.location ? ` · ${dto.cover.location}` : ''}</p>
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

      {/* EXECUTIVE SNAPSHOT — titled by the evidence; see reportHeadlines. */}
      <Section kicker="At a Glance" title={dto.headlines.snapshot}>
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
            [dto.score.findingsCount, 'Priority findings'],
          ].map(([n, label]) => (
            <div key={String(label)} className="border border-obsidian-line rounded px-4 py-2 text-center">
              <p className="font-display text-lg text-ivory">{n}</p>
              <p className="label">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-ivory-faint text-xs mt-5 mb-2">
          How the {dto.score.findingsCount} finding(s) in Section 04 are classified. These describe the findings, not the {dto.score.evidenceCount} evidence items above — every evidence item carries its own confidence label and is listed in the Appendix.
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

        {/*
          * HOW THE SCORE IS CALCULATED, NEXT TO THE SCORE.
          *
          * A 0–100 figure under the words "Rescue Score" was printed with
          * nothing saying which direction it ran, what it measured, how the
          * categories were weighted, what coverage divided by, or that an
          * unassessed category is dropped from the average rather than scored
          * zero. Collapsed by default so it does not crowd the score, and on
          * the page rather than in a footnote.
          */}
        <details className="card mt-6">
          <summary className="px-4 sm:px-6 py-4 cursor-pointer label hover:text-gold">
            How this score is calculated
          </summary>
          <div className="px-4 sm:px-6 pb-5 space-y-5 border-t border-obsidian-line pt-4">
            {dto.scoringMethodology.map((section) => (
              <div key={section.heading}>
                <p className="text-ivory text-sm">{section.heading}</p>
                <p className="text-ivory-faint text-[13px] leading-relaxed mt-1">{section.body}</p>
                {section.rows && (
                  <dl className="mt-2.5 space-y-1.5">
                    {section.rows.map(([term, definition]) => (
                      <div key={term} className="text-[13px] leading-relaxed">
                        <dt className="text-gold-dim inline">{term}</dt>
                        <dd className="text-ivory-faint inline"> — {definition}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>
        </details>
      </Section>

      {/*
        * OPTIONAL SCENARIO CALCULATOR. The report used to print dollar
        * scenarios here computed from invented quantities. It now offers a
        * calculator, closed by default, that shows nothing until the reader
        * has entered every figure themselves.
        */}
      {dto.scenarioCalculators.length > 0 && (
        <Section kicker="Section 03" title="Optional Scenario Calculator">
          <p className="text-ivory-dim text-sm mb-4">
            This audit does not measure money. If you want to size a pathway, enter your own figures below; the calculator multiplies them and shows its working.
          </p>
          <details className="card">
            <summary className="px-4 sm:px-6 py-4 cursor-pointer label hover:text-gold">Open the calculator</summary>
            <div className="px-4 sm:px-6 pb-6 space-y-5 border-t border-obsidian-line pt-4">
              <p className="text-gold-dim text-xs">{SCENARIO_DISCLAIMER}</p>
              {dto.scenarioCalculators.map((c) => (
                <ScenarioCalculator key={c.kind} kind={c.kind} findingTitle={c.findingTitle} observedFriction={c.observedFriction} prefill={c.prefill} />
              ))}
            </div>
          </details>
        </Section>
      )}

      {/* FINDINGS — "Top Revenue Leaks" only when the findings are verified. */}
      <Section kicker="Section 04" title={dto.headlines.findings}>
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
        <p className="text-ivory-dim text-sm mb-3">Where guest friction clusters across the journey, from discovery to return.</p>
        <dl className="text-xs text-ivory-faint space-y-1 mb-5">
          {dto.journeyLegend.map(([label, meaning]) => (
            <div key={label}>
              <dt className={`inline uppercase tracking-wide ${STATUS_STYLES[label]?.split(' ')[0] ?? ''}`}>{label}</dt>
              <dd className="inline"> — {meaning}</dd>
            </div>
          ))}
        </dl>
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
      <Section kicker="Section 07" title="Winnersbookmark Prescription">
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
        {/*
          * The rubric as a definition list, not one run-on paragraph. As a
          * single string it rendered as nine wrapped lines on a 360px phone:
          * complete, but a reader checking what "Moderate" means on their own
          * badge had to read the whole block to find it.
          */}
        <p className="text-ivory-faint text-[13px] leading-relaxed mb-3">{CONFIDENCE_EXPLANATION}</p>
        <dl className="mb-5 space-y-2">
          {dto.confidenceBands.map(([label, definition]) => (
            <div key={label} className="text-[13px] leading-relaxed">
              <dt className="text-ivory-dim inline">{label}</dt>
              <dd className="text-ivory-faint inline break-words"> — {definition}</dd>
            </div>
          ))}
        </dl>
        <details className="card">
          <summary className="px-4 sm:px-6 py-4 cursor-pointer label hover:text-gold">Show all {dto.appendix.length} evidence items</summary>
          <div className="divide-y divide-obsidian-line max-h-[480px] overflow-y-auto">
            {dto.appendix.map((e, i) => (
              /*
               * Stacked, not a single metadata line. The type, a full untruncated
               * URL and the confidence used to be crammed into one 12px run, which
               * on a 360px phone wrapped into an unreadable block and buried the
               * fact above it. Each piece now gets its own row, the URL breaks on
               * any character instead of overflowing, and nothing renders below
               * 12px.
               */
              <div key={i} className="px-4 sm:px-6 py-4">
                {/*
                  * break-words on both. An evidence fact can carry an email
                  * address or a hostname as one unbreakable token — at 360px
                  * "harbourpointseafood@harbourpointgrill.test" pushed this
                  * paragraph 30px past its own box, and the row with it. The
                  * text wraps instead; nothing is truncated.
                  */}
                <p className="text-[15px] sm:text-sm text-ivory leading-relaxed break-words">{e.fact}</p>
                {e.supportingContext && (
                  <p className="text-ivory-dim text-[13px] leading-relaxed mt-1.5 break-words">{e.supportingContext}</p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                  <span className="text-gold-dim uppercase tracking-wider">{e.evidenceType.replace(/_/g, ' ')}</span>
                  {/*
                    * The label, without the percentage. "90%" and "85%" came
                    * from a hand-assigned constant per observation type, and
                    * nothing distinguished them — printing one invited the
                    * reader to treat it as a probability the audit never
                    * calculated. The band is defined in the legend above.
                    */}
                  <span className="text-ivory-faint">
                    Confidence: <span className="text-ivory-dim">{e.confidenceLabel}</span>
                  </span>
                </div>
                {e.sourceUrl && (
                  <p className="text-ivory-faint text-[12px] mt-1 break-all leading-snug">
                    <span className="text-ivory-faint/70">Source: </span>{e.sourceUrl}
                  </p>
                )}
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

function JourneyMapRow({ stage, isLast }: { stage: JourneyMapStage; isLast: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className={`shrink-0 w-40 text-xs uppercase tracking-widest border rounded px-3 py-2 text-center ${STATUS_STYLES[stage.status] ?? STATUS_STYLES.UNKNOWN}`}>{stage.status}</span>
        <div className="flex-1">
          <p className="text-ivory text-sm font-semibold">{stage.label}</p>
          <p className="text-ivory-faint text-xs break-words">{stage.note}</p>
          {/*
            * What the stage could not see, on the row with what it did see.
            * The map used to show only the first sentence of a finding, which
            * dropped the "Not assessed" half on the surface a client scans
            * fastest — leaving an observation to read as a conclusion.
            */}
          {stage.limitation && (
            <p className="text-ivory-faint/70 text-xs italic mt-0.5 break-words">{stage.limitation}</p>
          )}
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
      {finding.scenarioKind && (
        <p className="mt-5 border-t border-obsidian-line pt-4 text-ivory-faint text-xs">
          An optional calculator for this pathway is in Section 03. It uses only figures you enter and is not a measured loss, forecast or guaranteed recovery.
        </p>
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
