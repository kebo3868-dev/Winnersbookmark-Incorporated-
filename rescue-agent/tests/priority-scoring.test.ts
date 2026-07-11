import { describe, expect, it } from 'vitest';
import { rescuePriorityScore, rankOpportunities, topThree } from '@/lib/scoring/priority';

describe('rescuePriorityScore', () => {
  it('is 0 when all inputs are 0', () => {
    expect(rescuePriorityScore({ impactScore: 0, urgencyScore: 0, confidenceScore: 0, aiFitScore: 0 })).toBe(0);
  });

  it('is 100 when all inputs are 100', () => {
    expect(rescuePriorityScore({ impactScore: 100, urgencyScore: 100, confidenceScore: 100, aiFitScore: 100 })).toBe(100);
  });

  it('applies the 35/25/25/15 weighting on mixed scores', () => {
    // 80*.35 + 60*.25 + 70*.25 + 40*.15 = 28 + 15 + 17.5 + 6 = 66.5 → 67
    expect(rescuePriorityScore({ impactScore: 80, urgencyScore: 60, confidenceScore: 70, aiFitScore: 40 })).toBe(67);
  });

  it('rounds to the nearest whole number', () => {
    // 50*.35 + 50*.25 + 50*.25 + 51*.15 = 37.65 → 38... use case: verify rounding, not truncation
    expect(rescuePriorityScore({ impactScore: 51, urgencyScore: 51, confidenceScore: 51, aiFitScore: 51 })).toBe(51);
    expect(rescuePriorityScore({ impactScore: 1, urgencyScore: 1, confidenceScore: 1, aiFitScore: 1 })).toBe(1);
  });

  it('rejects negative scores', () => {
    expect(() => rescuePriorityScore({ impactScore: -1, urgencyScore: 0, confidenceScore: 0, aiFitScore: 0 })).toThrow(RangeError);
  });

  it('rejects scores above 100', () => {
    expect(() => rescuePriorityScore({ impactScore: 0, urgencyScore: 101, confidenceScore: 0, aiFitScore: 0 })).toThrow(RangeError);
  });

  it('rejects non-finite scores', () => {
    expect(() => rescuePriorityScore({ impactScore: NaN, urgencyScore: 0, confidenceScore: 0, aiFitScore: 0 })).toThrow(RangeError);
  });
});

describe('rankOpportunities / topThree', () => {
  const make = (impact: number) => ({ impactScore: impact, urgencyScore: 50, confidenceScore: 50, aiFitScore: 50 });

  it('sorts descending by priority', () => {
    const ranked = rankOpportunities([make(10), make(90), make(50)]);
    expect(ranked.map((r) => r.impactScore)).toEqual([90, 50, 10]);
    expect(ranked[0].rescuePriorityScore).toBeGreaterThan(ranked[2].rescuePriorityScore);
  });

  it('selects exactly the top three', () => {
    const top = topThree([make(10), make(90), make(50), make(70), make(30)]);
    expect(top).toHaveLength(3);
    expect(top.map((t) => t.impactScore)).toEqual([90, 70, 50]);
  });

  it('returns fewer than three when fewer exist', () => {
    expect(topThree([make(10)])).toHaveLength(1);
    expect(topThree([])).toHaveLength(0);
  });
});
