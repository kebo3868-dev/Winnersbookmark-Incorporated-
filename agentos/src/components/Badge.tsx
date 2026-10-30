export function Badge({ tone, children, testId }: { tone: string; children: React.ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {children}
    </span>
  );
}

/** Shown on anything produced by the mock adapter. Deliberately loud. */
export function SimulatedBadge() {
  return (
    <span data-testid="simulated-badge" className="inline-flex items-center rounded-full border border-fuchsia-400/60 bg-fuchsia-500/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-fuchsia-200">
      Simulated
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
      Live
    </span>
  );
}
