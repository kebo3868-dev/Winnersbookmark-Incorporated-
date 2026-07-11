import { describe, expect, it } from 'vitest';
import { calculateOverallScore, scoreBand } from '@/lib/scoring/rescueScore';
import type { CategoryScoreInput } from '@/types/audit';

const cat = (category: string, weight: number, score: number | null, insufficientData = false): CategoryScoreInput => ({
  category: category as CategoryScoreInput['category'],
  weight,
  score,
  confidence: 70,
  insufficientData,
  explanation: 'test',
});

describe('calculateOverallScore', () => {
  it('computes weighted average when all categories have data', () => {
    const result = calculateOverallScore([
      cat('WEBSITE_CONVERSION', 50, 80),
      cat('CUSTOMER_RETENTION', 50, 40),
    ]);
    expect(result.overallScore).toBe(60);
    expect(result.coverageScore).toBe(100);
  });

  it('re-normalizes weights across available categories and reports coverage', () => {
    const result = calculateOverallScore([
      cat('WEBSITE_CONVERSION', 15, 80),
      cat('PHONE_RESPONSE_READINESS', 15, 40),
      cat('REVIEW_REPUTATION_SYSTEM', 10, null, true),
      cat('LOCAL_DIGITAL_PRESENCE', 10, null, true),
    ]);
    // usable weight = 30 of 50 → coverage 60%; score = (80*15 + 40*15)/30 = 60
    expect(result.overallScore).toBe(60);
    expect(result.coverageScore).toBe(60);
    expect(result.explanation).toContain('sufficient public evidence');
  });

  it('does NOT score zero for missing data — returns null overall when nothing is scorable', () => {
    const result = calculateOverallScore([
      cat('REVIEW_REPUTATION_SYSTEM', 10, null, true),
      cat('LOCAL_DIGITAL_PRESENCE', 10, null, true),
    ]);
    expect(result.overallScore).toBeNull();
    expect(result.coverageScore).toBe(0);
  });

  it('keeps Rescue Score and Coverage Score distinct', () => {
    const result = calculateOverallScore([
      cat('WEBSITE_CONVERSION', 15, 100),
      cat('REVIEW_REPUTATION_SYSTEM', 85, null, true),
    ]);
    expect(result.overallScore).toBe(100); // quality of what was measured
    expect(result.coverageScore).toBe(15); // how much was measured
  });
});

describe('scoreBand', () => {
  it('maps bands per spec', () => {
    expect(scoreBand(95)).toBe('ELITE DIGITAL OPERATOR');
    expect(scoreBand(85)).toBe('STRONG WITH OPTIMIZATION OPPORTUNITIES');
    expect(scoreBand(75)).toBe('MODERATE REVENUE LEAKAGE');
    expect(scoreBand(65)).toBe('SIGNIFICANT CUSTOMER JOURNEY FRICTION');
    expect(scoreBand(59)).toBe('RESTAURANT RESCUE PRIORITY');
  });
});
