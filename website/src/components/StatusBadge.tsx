import { STATUS_PRESENTATION, FEATURE_STATE_LABEL, type AgentStatus, type FeatureState } from '@/data/agents';

/**
 * The honesty system, made visible.
 *
 * Every place an agent or a capability appears, its real state appears with it.
 * This is the component that stops the site implying that four agents are for
 * sale when two are — and it is why the status lives in the registry as data
 * rather than being written into each page's copy, where it would rot.
 */
export function StatusBadge({ status, className = '' }: { status: AgentStatus; className?: string }) {
  const s = STATUS_PRESENTATION[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border ${s.border} bg-night-soft/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${s.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function FeatureStateBadge({ state }: { state: FeatureState }) {
  const tone =
    state === 'LIVE'
      ? 'text-status-live border-status-live/35'
      : state === 'IN_DEVELOPMENT'
        ? 'text-status-building border-status-building/35'
        : 'text-status-planned border-status-planned/35';

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border ${tone} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]`}
    >
      {FEATURE_STATE_LABEL[state]}
    </span>
  );
}
