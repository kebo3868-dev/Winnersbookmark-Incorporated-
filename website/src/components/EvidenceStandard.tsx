import { BookmarkNotch } from './Logo';

/**
 * EVIDENCE BEFORE PROMISES
 *
 * Replaces the previous trust block, which led with "We would rather lose the
 * sale than overstate the product" and a paragraph beginning "Winners Bookmark
 * is a young company."
 *
 * That framing was honest but defensive — it argued from what the company
 * lacks (no logos, no case studies) and asked the reader to credit the
 * restraint. A buyer evaluating a $10k-$100k engagement does not award points
 * for modesty; they want to know what they will receive and how it is
 * substantiated.
 *
 * This block argues from what the company DOES: a standard every finding must
 * meet before it reaches a client. Same commitments, stated as a method rather
 * than an apology.
 *
 * The honesty is preserved rather than softened — including the commitment to
 * recommend a simpler non-AI fix when that is the correct answer, which stays
 * because it is the single most credible thing on the page.
 */

const STANDARD = [
  {
    id: '01',
    title: 'Every finding carries its source',
    body: 'A finding arrives with the page it came from, the surrounding context, and a confidence level. You can open the page and check it yourself. Anything we cannot attribute does not go in the report.',
  },
  {
    id: '02',
    title: 'Absence is reported as absence',
    body: 'When something cannot be determined from what is publicly available, the audit says so and explains what blocked it. A gap is never filled with an assumption to make the report look more complete.',
  },
  {
    id: '03',
    title: 'No projected numbers',
    body: 'You will not find a recovery percentage or a revenue projection anywhere in our work. We describe exposure — where customers are being lost, and the evidence for it — so you can weigh it against figures you actually have.',
  },
  {
    id: '04',
    title: 'Capability is stated at its real stage',
    body: 'Every system on this site shows whether it is live, in pilot, or still in development, down to individual features. You will not discover after signing that a capability was aspirational.',
  },
];

export default function EvidenceStandard() {
  return (
    <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <div>
        <p className="eyebrow mb-5">The evidence standard</p>
        <h2 className="text-display-2 text-text-bright">Evidence before promises.</h2>
        <p className="lede mt-5">
          Anyone can describe what AI might do for your business. We work the other way around:
          establish what is measurably happening first, show you the proof, and only then discuss
          what to build.
        </p>

        {/* The strongest credibility signal available to a young firm — kept
            prominent rather than buried, because it is the one claim a
            competitor is unlikely to copy. */}
        <div className="surface mt-9 border-l-2 border-cobalt-core p-6">
          <div className="flex items-center gap-2.5">
            <BookmarkNotch size={11} className="text-cobalt-core" />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-cobalt-light">
              Including when the answer is no
            </span>
          </div>
          <p className="mt-3 text-body text-text-primary">
            If the audit shows your problem is a broken link, an unpublished phone number, or a
            process nobody wrote down, we will tell you that and show you the fix. Not every
            revenue leak needs an AI system, and recommending one that does not is how trust gets
            spent.
          </p>
        </div>
      </div>

      <div>
        <ol className="grid gap-px overflow-hidden rounded-panel border border-ink-line bg-ink-line">
          {STANDARD.map((item) => (
            <li key={item.id} className="bg-ink-panel p-6 sm:p-7">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-cobalt-light">
                  {item.id}
                </span>
                <div className="min-w-0">
                  <h3 className="text-title text-text-bright">{item.title}</h3>
                  <p className="mt-2 text-body text-text-secondary">{item.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
