/**
 * AUDIT TIME BUDGET
 *
 * Collection is network-bound: up to 10 pages plus 8 probes, fetched
 * sequentially, each able to spend FETCH_TIMEOUT_MS. On a slow or unresponsive
 * restaurant site that adds up to minutes — longer than a serverless function
 * is allowed to live. When the platform kills the function mid-run the audit is
 * simply lost: it sits RUNNING until the stale sweep marks it FAILED, with no
 * report at all.
 *
 * A budget makes that failure mode impossible. The collection phase gets a
 * deadline; every request is bounded by whatever time is left, and once the
 * deadline passes the remaining targets are skipped so scoring and the report
 * still run. The audit then completes as PARTIALLY_COMPLETED — an honest,
 * slightly thinner report instead of nothing.
 */

/** Default collection budget. Deliberately well under the shortest platform cap. */
export const DEFAULT_AUDIT_BUDGET_MS = 45_000;

/** Below this there is no point starting another request. */
export const MIN_USEFUL_REQUEST_MS = 1_000;

const MIN_BUDGET_MS = 5_000;
const MAX_BUDGET_MS = 280_000;

/**
 * Collection budget in ms, overridable with AUDIT_BUDGET_MS.
 *
 * Raise it only if the host genuinely allows longer execution (Vercel Pro with
 * Fluid Compute); on Hobby the function is capped far below the declared
 * maxDuration, so the default keeps the audit inside it.
 */
export function resolveAuditBudgetMs(env: Record<string, string | undefined> = process.env): number {
  const raw = env.AUDIT_BUDGET_MS;
  if (!raw) return DEFAULT_AUDIT_BUDGET_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_AUDIT_BUDGET_MS;
  return Math.min(MAX_BUDGET_MS, Math.max(MIN_BUDGET_MS, Math.round(parsed)));
}

export interface AuditBudget {
  /** Absolute epoch ms after which no new collection work may start. */
  readonly deadline: number;
  /** Milliseconds left, never negative. */
  remainingMs(now?: number): number;
  /** True once the deadline has passed. */
  expired(now?: number): boolean;
  /**
   * Timeout to apply to the next request: the smaller of the caller's cap and
   * the time actually left. Returns null when too little time remains to be
   * worth starting — the caller should skip the target instead.
   */
  timeoutFor(cap: number, now?: number): number | null;
}

export function createAuditBudget(budgetMs: number, startedAt: number = Date.now()): AuditBudget {
  const deadline = startedAt + budgetMs;
  const remainingMs = (now: number = Date.now()) => Math.max(0, deadline - now);
  return {
    deadline,
    remainingMs,
    expired: (now: number = Date.now()) => now >= deadline,
    timeoutFor: (cap: number, now: number = Date.now()) => {
      const left = remainingMs(now);
      if (left < MIN_USEFUL_REQUEST_MS) return null;
      return Math.min(cap, left);
    },
  };
}
