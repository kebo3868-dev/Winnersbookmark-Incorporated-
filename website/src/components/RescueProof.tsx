import Link from 'next/link';
import { BookmarkNotch } from './Logo';

/**
 * RESTAURANT RESCUE — WORKED EXAMPLE
 *
 * Shows what an audit finding actually looks like: the chain from a detected
 * problem, through the evidence supporting it, to the business impact and the
 * recommended fix.
 *
 * WHY THIS IS LABELED AS AN EXAMPLE, TWICE
 * The company has no consented customer audit it can publish. Presenting a
 * constructed walkthrough as a real client result would be exactly the
 * fabricated proof this site refuses everywhere else — and it is the kind of
 * claim a prospect can check. So the module carries a visible "worked example"
 * badge in its chrome AND a plain-language disclosure at the foot. Neither is
 * removable without editing this file, which is deliberate.
 *
 * WHAT IS AND IS NOT INVENTED
 *  - The failure modes, evidence types and recommended fixes are real: they are
 *    the checks the Restaurant Rescue Agent genuinely performs.
 *  - The restaurant is fictional and named as such.
 *  - IMPACT CARRIES NO NUMBERS. No "loses $3,400/month", no "62% of visitors".
 *    Impact is described as exposure — the mechanism by which customers are
 *    lost — because a figure here would be invented and unverifiable.
 *
 * Server component: no JavaScript, no client cost.
 */

interface Finding {
  id: string;
  problem: string;
  evidence: { source: string; detail: string; confidence: string };
  impact: string;
  fix: string;
  severity: 'high' | 'medium';
}

const FINDINGS: Finding[] = [
  {
    id: 'F-01',
    problem: 'Online ordering link resolves to a missing page',
    evidence: {
      source: '/order',
      detail: 'The “Order Online” button on the homepage was followed and returned HTTP 404.',
      confidence: 'High — destination tested directly',
    },
    impact:
      'Every customer who chooses to order online reaches a dead end at the moment of purchase. This is the last step before revenue, so the loss is total for anyone who gets there.',
    fix: 'Repoint the ordering button at the current provider, or remove it and route customers to the channel that works today.',
    severity: 'high',
  },
  {
    id: 'F-02',
    problem: 'Menu is only available as a PDF',
    evidence: {
      source: '/menu.pdf',
      detail: 'The only detected menu links point to PDF files. No HTML menu was found on the analyzed pages.',
      confidence: 'High — link taxonomy across 6 pages',
    },
    impact:
      'A PDF menu forces a download, opens in a separate viewer, and is hard to read on a phone. Customers deciding where to eat frequently abandon at this step rather than pinch-and-zoom.',
    fix: 'Publish the menu as a web page. Keep the PDF as a secondary download for printing.',
    severity: 'high',
  },
  {
    id: 'F-03',
    problem: 'Phone number is not tappable on mobile',
    evidence: {
      source: '/',
      detail: 'A phone number is displayed as plain text. No click-to-call (tel:) link was detected on any analyzed page.',
      confidence: 'Medium — based on 6 analyzed pages',
    },
    impact:
      'A mobile visitor ready to call has to memorize or copy the number. Each additional step is a place the intention can lapse.',
    fix: 'Wrap the displayed number in a tel: link so a tap starts the call.',
    severity: 'medium',
  },
];

const STAGES = ['Problem', 'Evidence', 'Impact', 'Recommended fix'];

export default function RescueProof() {
  return (
    <div className="surface-raised overflow-hidden">
      {/* Chrome — carries the first of two example disclosures */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-line px-5 py-4 sm:px-7">
        <div className="flex items-center gap-2.5">
          <BookmarkNotch size={11} className="text-cobalt-core" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
            Restaurant Rescue · sample findings
          </span>
        </div>
        <span className="rounded-full border border-signal-building/40 bg-signal-building/[0.07] px-3 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.11em] text-signal-building">
          Worked example
        </span>
      </div>

      {/* Stage legend — names the chain the reader is about to follow */}
      <div className="hidden border-b border-ink-line px-7 py-3 md:block">
        <ol className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-text-muted">
          {STAGES.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              {s}
              {i < STAGES.length - 1 && <span aria-hidden="true" className="text-ink-steel">→</span>}
            </li>
          ))}
        </ol>
      </div>

      <ol className="divide-y divide-ink-line">
        {FINDINGS.map((f) => (
          <li key={f.id} className="p-5 sm:p-7">
            {/* Problem */}
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
              <span className="font-mono text-[0.6875rem] tracking-[0.1em] text-text-faint">{f.id}</span>
              <h3 className="min-w-0 flex-1 text-title text-text-bright">{f.problem}</h3>
              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.09em] ${
                  f.severity === 'high'
                    ? 'border-signal-loss/35 bg-signal-loss/[0.07] text-signal-loss'
                    : 'border-signal-building/35 bg-signal-building/[0.07] text-signal-building'
                }`}
              >
                {f.severity === 'high' ? 'High' : 'Medium'}
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {/* Evidence */}
              <div className="rounded-[10px] border border-ink-line bg-ink-base/70 p-4">
                <p className="metric-label">Evidence</p>
                <p className="mt-2.5 font-mono text-[0.75rem] text-cobalt-light">{f.evidence.source}</p>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-text-secondary">
                  {f.evidence.detail}
                </p>
                <p className="mt-3 border-t border-ink-line pt-2.5 text-[0.6875rem] text-text-muted">
                  {f.evidence.confidence}
                </p>
              </div>

              {/* Impact — described, never quantified */}
              <div className="rounded-[10px] border border-ink-line bg-ink-base/70 p-4">
                <p className="metric-label">Impact</p>
                <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-text-secondary">{f.impact}</p>
              </div>

              {/* Fix */}
              <div className="rounded-[10px] border border-cobalt-core/25 bg-cobalt-wash/25 p-4">
                <p className="metric-label text-cobalt-light">Recommended fix</p>
                <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-text-primary">{f.fix}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Second disclosure — plain language, not a footnote in grey 10px */}
      <div className="border-t border-ink-line bg-ink-base/50 px-5 py-5 sm:px-7">
        <p className="text-[0.8125rem] leading-relaxed text-text-secondary">
          <span className="font-semibold text-text-primary">This is an example, not a client.</span>{' '}
          The restaurant is fictional. The checks, evidence types and recommendations shown are the
          real ones the Restaurant Rescue Agent performs — but no customer results are represented
          here, and no figures are attached to impact because any number we printed would be
          invented. Your audit reports what is actually happening on your own site.
        </p>
        <Link href="/contact?interest=restaurant-rescue-agent" className="btn-text mt-4">
          Get these findings for your restaurant
          <span aria-hidden="true" className="arrow">→</span>
        </Link>
      </div>
    </div>
  );
}
