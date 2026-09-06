/**
 * THE WINNERS BOOKMARK SYSTEM VISUALIZATION
 *
 * The hero's signature element, and the one thing on the page that has to say
 * "proprietary technology" before a word is read.
 *
 * WHAT IT SHOWS — the actual path a lost customer takes back to revenue:
 *
 *   CUSTOMER SIGNAL → AI AGENT → QUALIFIED RESPONSE → BOOKING / ORDER / LEAD
 *                                                   → REVENUE RECOVERED
 *
 * DESIGN DECISIONS WORTH KNOWING
 *
 *  - It is a SERVER COMPONENT. No JavaScript ships for it at all. Every moving
 *    part is CSS on an inline SVG, so it costs nothing in bundle size, nothing
 *    on the main thread, and cannot delay interactivity.
 *
 *  - The animation is INFORMATIONAL. Packets travel the connectors in the
 *    direction data actually flows, and node pulses are staggered along that
 *    path so the eye follows the sequence. Nothing moves for spectacle.
 *
 *  - It reserves its own aspect ratio, so it cannot cause layout shift while
 *    the page settles.
 *
 *  - NO INVENTED METRICS. The row labels describe system states ("Missed call
 *    detected", "Response sent"), never results ("$4,200 recovered"). The one
 *    numeric element is a relative bar with no units — it shows the SHAPE of
 *    leakage, not a claimed quantity.
 *
 *  - The whole thing is aria-hidden with a text summary for assistive tech: a
 *    screen reader gets the pipeline as a sentence rather than 40 SVG nodes.
 */

interface StageNode {
  id: string;
  label: string;
  detail: string;
  /** Position on the 0-100 vertical rail. */
  y: number;
  /** Animation offset so pulses travel down the pipeline in order. */
  delay: number;
  tone: 'signal' | 'agent' | 'output' | 'revenue';
}

const STAGES: StageNode[] = [
  { id: 'signal', label: 'Customer signal', detail: 'Missed call · 7:42pm', y: 6, delay: 0, tone: 'signal' },
  { id: 'agent', label: 'AI agent', detail: 'Intent resolved', y: 32, delay: 600, tone: 'agent' },
  { id: 'response', label: 'Qualified response', detail: 'Reply sent · 9s', y: 58, delay: 1200, tone: 'output' },
  { id: 'captured', label: 'Booking captured', detail: 'Table · party of 4', y: 84, delay: 1800, tone: 'revenue' },
];

const TONE: Record<StageNode['tone'], { dot: string; ring: string; text: string }> = {
  signal: { dot: 'fill-signal-loss', ring: 'stroke-signal-loss/35', text: 'text-signal-loss' },
  agent: { dot: 'fill-cobalt-bright', ring: 'stroke-cobalt-bright/40', text: 'text-cobalt-light' },
  output: { dot: 'fill-cobalt-light', ring: 'stroke-cobalt-light/35', text: 'text-cobalt-light' },
  revenue: { dot: 'fill-signal-live', ring: 'stroke-signal-live/35', text: 'text-signal-live' },
};

export default function SystemVisualization() {
  return (
    <div className="relative w-full">
      {/* Ambient light behind the panel. Sits under everything and is masked so
          it never ends on a hard edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 mask-fade-radial sm:-inset-10"
        style={{
          background:
            'radial-gradient(closest-side, rgba(36,84,235,0.20), rgba(36,84,235,0.05) 55%, transparent 78%)',
        }}
      />

      <div className="surface-raised relative overflow-hidden">
        {/* Faint engineering grid inside the panel */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid opacity-[0.5] mask-fade-b" />

        {/* Panel chrome — reads as a real instrument, not a marketing graphic */}
        <div className="relative flex items-center justify-between border-b border-ink-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="status-dot bg-signal-live" />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-text-secondary">
              Recovery pipeline
            </span>
          </div>
          <span className="font-mono text-[0.6875rem] tracking-tight text-text-muted">WBI · live</span>
        </div>

        <div className="relative px-5 py-6 sm:px-7 sm:py-7">
          {/* ---- The pipeline ------------------------------------------- */}
          <div className="relative" style={{ aspectRatio: '5 / 4', minHeight: '272px' }}>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-y-0 left-[13px] h-full w-[26px] overflow-visible"
              aria-hidden="true"
            >
              {/* The rail every packet travels */}
              <line x1="50" y1="6" x2="50" y2="84" className="stroke-ink-border" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              {/* Progress trace — drawn on once, in flow direction */}
              <line
                x1="50" y1="6" x2="50" y2="84"
                className="animate-trace-in stroke-cobalt-core"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="100"
                style={{ ['--dash' as string]: '100' }}
              />
            </svg>

            {/* Travelling packets. Three, offset in time, so the pipeline reads
                as continuously processing rather than looping once. */}
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="absolute left-[23px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cobalt-bright"
                style={{
                  boxShadow: '0 0 10px 2px rgba(59,116,255,0.65)',
                  offsetPath: 'path("M 0 16 L 0 236")',
                  animation: `flow 3.6s cubic-bezier(0.65,0,0.35,1) ${i * 1.2}s infinite`,
                }}
              />
            ))}

            {/* Stage rows */}
            <ol className="relative flex h-full flex-col justify-between">
              {STAGES.map((stage) => {
                const tone = TONE[stage.tone];
                return (
                  <li key={stage.id} className="flex items-center gap-4">
                    {/* Node marker */}
                    <span className="relative flex h-[26px] w-[26px] shrink-0 items-center justify-center">
                      <svg viewBox="0 0 26 26" className="absolute inset-0 h-full w-full" aria-hidden="true">
                        <circle cx="13" cy="13" r="11" className={`fill-ink-base ${tone.ring}`} strokeWidth="1.5" />
                        <circle
                          cx="13" cy="13" r="3.5"
                          className={tone.dot}
                          style={{
                            animation: `pulse-node 2.8s cubic-bezier(0.65,0,0.35,1) ${stage.delay}ms infinite`,
                            transformOrigin: 'center',
                          }}
                        />
                      </svg>
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-semibold tracking-[-0.01em] text-text-primary">
                        {stage.label}
                      </p>
                      <p className={`truncate font-mono text-[0.6875rem] ${tone.text}`}>{stage.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ---- Outcome band ------------------------------------------- */}
          <div className="mt-6 rounded-[10px] border border-ink-line bg-ink-base/80 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="metric-label">Revenue recovered</span>
              <span className="font-mono text-[0.6875rem] text-text-muted">this signal</span>
            </div>

            {/* A SHAPE, not a claim. The bar has no axis and no units because
                the company publishes no outcome data — it communicates that
                recovery is the endpoint, without asserting an amount. */}
            <div className="mt-3 flex h-1.5 gap-1 overflow-hidden rounded-full">
              <span className="animate-count-bar origin-left rounded-full bg-signal-live/90" style={{ flex: '0 0 62%', animationDelay: '1.9s' }} />
              <span className="animate-count-bar origin-left rounded-full bg-cobalt-core/70" style={{ flex: '0 0 22%', animationDelay: '2.1s' }} />
              <span className="rounded-full bg-ink-border" style={{ flex: '1 1 auto' }} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {[
                { k: 'Recovered', c: 'bg-signal-live/90' },
                { k: 'In progress', c: 'bg-cobalt-core/70' },
                { k: 'Open', c: 'bg-ink-border' },
              ].map((l) => (
                <span key={l.k} className="flex items-center gap-1.5 text-[0.6875rem] text-text-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${l.c}`} aria-hidden="true" />
                  {l.k}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* A single slow sweep across the panel, suggesting an active scan.
            Low alpha and long duration — it should be felt, not watched. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sweep"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(59,116,255,0.05), transparent)',
          }}
        />
      </div>

      {/* Screen readers get the pipeline as one sentence instead of 40 nodes. */}
      <p className="sr-only">
        Diagram: a customer signal such as a missed call enters the system, an AI agent resolves
        the intent, a qualified response is sent, the booking or order is captured, and the
        revenue is recovered.
      </p>
    </div>
  );
}
