import { BookmarkNotch } from './Logo';

/**
 * REVENUE INTELLIGENCE — the leakage model
 *
 * The company's central argument, made visual: businesses rarely need more
 * traffic; they need to stop losing the people already reaching them.
 *
 * The funnel narrows left to right, and each stage carries a leak marker where
 * customers are lost — with the WBI systems that intervene named beneath.
 *
 * Honesty constraints, deliberately observed:
 *  - The widths are a SHAPE, not measured data. They carry no percentages and
 *    no axis, and the caption says so in plain words. A funnel labeled
 *    "68% lost at ordering" would be inventing a statistic.
 *  - Leak causes are the failure modes the audit engine genuinely detects.
 *
 * Server component: no JavaScript, all motion in CSS.
 */

const STAGES = [
  {
    id: 'traffic',
    label: 'Traffic',
    body: 'People find the business.',
    width: 100,
    leak: null,
  },
  {
    id: 'inquiry',
    label: 'Inquiry',
    body: 'They call, message, or start an order.',
    width: 76,
    leak: { cause: 'Nobody answers the phone', system: 'AI Front Desk' },
  },
  {
    id: 'response',
    label: 'Response',
    body: 'Someone answers — or nobody does.',
    width: 55,
    leak: { cause: 'After-hours inquiry goes unanswered', system: 'AI Front Desk' },
  },
  {
    id: 'conversion',
    label: 'Conversion',
    body: 'The order or booking completes.',
    width: 38,
    leak: { cause: 'Broken ordering path, PDF menu, booking friction', system: 'Restaurant Rescue Agent' },
  },
  {
    id: 'revenue',
    label: 'Revenue',
    body: 'The business gets paid.',
    width: 26,
    leak: null,
  },
];

export default function RevenueJourney() {
  return (
    <div className="surface-raised overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-line px-5 py-4 sm:px-7">
        <div className="flex items-center gap-2.5">
          <BookmarkNotch size={11} className="text-cobalt-core" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
            The leakage model
          </span>
        </div>
        <span className="font-mono text-[0.6875rem] text-text-muted">Traffic → Revenue</span>
      </div>

      <div className="p-5 sm:p-7 lg:p-9">
        <ol className="space-y-0">
          {STAGES.map((stage, i) => (
            <li key={stage.id} className="relative">
              <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
                {/* Stage name + index */}
                <div className="flex shrink-0 items-center gap-3 sm:w-[168px]">
                  <span className="font-mono text-[0.6875rem] text-text-faint">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-title text-text-bright">{stage.label}</span>
                </div>

                {/* The narrowing band. Width is the shape of attrition. */}
                <div className="min-w-0 flex-1">
                  <div className="relative h-8 overflow-hidden rounded-[6px] bg-ink-base">
                    <div
                      className="animate-count-bar h-full origin-left rounded-[6px] border border-cobalt-core/25"
                      style={{
                        width: `${stage.width}%`,
                        animationDelay: `${i * 110}ms`,
                        background:
                          'linear-gradient(90deg, rgba(36,84,235,0.30), rgba(36,84,235,0.13))',
                      }}
                    />
                    {/* Where the band ends, the loss begins. */}
                    {stage.leak && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-y-0 border-l border-dashed border-signal-loss/50"
                        style={{ left: `${stage.width}%` }}
                      />
                    )}
                  </div>
                  <p className="mt-2 text-[0.8125rem] text-text-muted">{stage.body}</p>
                </div>
              </div>

              {/* Leak marker + the system that closes it */}
              {stage.leak && (
                <div className="mb-1 ml-0 rounded-[8px] border border-ink-line bg-ink-base/60 p-3 sm:ml-[192px]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-signal-loss">
                      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-signal-loss" />
                      Customers lost
                    </span>
                    <span className="text-[0.8125rem] text-text-secondary">{stage.leak.cause}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span aria-hidden="true" className="text-text-faint">↳</span>
                    <span className="text-[0.8125rem] text-text-primary">
                      Closed by{' '}
                      <span className="font-semibold text-cobalt-light">{stage.leak.system}</span>
                    </span>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>

        <p className="mt-7 border-t border-ink-line pt-5 text-[0.8125rem] leading-relaxed text-text-muted">
          This diagram shows the <span className="text-text-secondary">shape</span> of how customers
          are lost, not measured results. We publish no percentages or revenue figures because we
          have no customer outcome data that would make them honest. Your audit reports what is
          actually happening in <em>your</em> business, with the evidence for every finding.
        </p>
      </div>
    </div>
  );
}
