export interface PriorityInputs {
  impactScore: number;
  urgencyScore: number;
  confidenceScore: number;
  aiFitScore: number;
}

const WEIGHTS = { impact: 0.35, urgency: 0.25, confidence: 0.25, aiFit: 0.15 } as const;

function assertScore(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be between 0 and 100, received ${value}`);
  }
}

/** Rescue Priority Score — deterministic weighted blend, rounded to the nearest integer. */
export function rescuePriorityScore(inputs: PriorityInputs): number {
  assertScore(inputs.impactScore, 'impactScore');
  assertScore(inputs.urgencyScore, 'urgencyScore');
  assertScore(inputs.confidenceScore, 'confidenceScore');
  assertScore(inputs.aiFitScore, 'aiFitScore');
  return Math.round(
    inputs.impactScore * WEIGHTS.impact +
      inputs.urgencyScore * WEIGHTS.urgency +
      inputs.confidenceScore * WEIGHTS.confidence +
      inputs.aiFitScore * WEIGHTS.aiFit,
  );
}

/** Sort by priority descending (stable on ties) and return the top N. */
export function rankOpportunities<T extends PriorityInputs>(items: T[]): (T & { rescuePriorityScore: number })[] {
  return items
    .map((item) => ({ ...item, rescuePriorityScore: rescuePriorityScore(item) }))
    .sort((a, b) => b.rescuePriorityScore - a.rescuePriorityScore);
}

export function topThree<T extends PriorityInputs>(items: T[]): (T & { rescuePriorityScore: number })[] {
  return rankOpportunities(items).slice(0, 3);
}
