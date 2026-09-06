import { STATUS_PRESENTATION, FEATURE_STATE_LABEL, type AgentStatus, type FeatureState } from '@/data/agents';

/**
 * The honesty system, made visible.
 *
 * Wherever an agent or capability appears, its real state appears with it. This
 * is what stops the site implying four agents are purchasable when two are —
 * and it reads from the registry rather than page copy, so it cannot rot.
 */
export function StatusBadge({ status, className = '' }: { status: AgentStatus; className?: string }) {
  const s = STATUS_PRESENTATION[status];
  const live = status === 'LIVE' || status === 'PILOT';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border ${s.border} bg-ink-base/80 py-1 pl-2 pr-3 text-[0.625rem] font-semibold uppercase tracking-[0.11em] ${s.text} ${className}`}
    >
      {/* Only genuinely operational systems get the animated halo. A
          "coming soon" concept pulsing like a live service would be the
          animation lying about status. */}
      <span className={`${live ? 'status-dot' : 'inline-block h-1.5 w-1.5 rounded-full'} ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function FeatureStateBadge({ state }: { state: FeatureState }) {
  const tone =
    state === 'LIVE'
      ? 'text-signal-live border-signal-live/30 bg-signal-live/[0.07]'
      : state === 'IN_DEVELOPMENT'
        ? 'text-signal-building border-signal-building/30 bg-signal-building/[0.07]'
        : 'text-signal-planned border-signal-planned/30 bg-signal-planned/[0.07]';

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[5px] border ${tone} px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.09em]`}
    >
      {FEATURE_STATE_LABEL[state]}
    </span>
  );
}
