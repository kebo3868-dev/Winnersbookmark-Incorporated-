import { describe, expect, it } from 'vitest';
import { analyzeOwnerReviews, reviewEvidence } from '@/lib/audit/reviews';
import { analyzeJourney } from '@/lib/audit/journey';
import { calculateCategoryScores } from '@/lib/scoring/rescueScore';
import type { EvidenceRecordLike } from '@/types/audit';

/** End-to-end of the owner-review path: intake data → evidence → journey + score. */
function toRecords(inputs: ReturnType<typeof reviewEvidence>): EvidenceRecordLike[] {
  return inputs.map((e, i) => ({
    id: `r${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    supportingContext: e.supportingContext,
    confidence: e.confidence,
    sourceUrl: e.sourceUrl,
  }));
}

describe('owner-review path — evidence → journey → score', () => {
  it('a strong owner rating makes REVIEW HEALTHY and scores the reputation category', () => {
    const input = { rating: 4.6, reviewCount: 500, googleBusinessUrl: 'https://maps.example/x' };
    const evidence = toRecords(reviewEvidence(input, analyzeOwnerReviews(input)));

    const review = analyzeJourney(evidence).find((s) => s.stage === 'REVIEW')!;
    expect(review.status).toBe('HEALTHY');
    expect(review.manualValidationRequired).toBe(true); // response patterns still unverified

    const score = calculateCategoryScores(analyzeJourney(evidence), evidence).find((c) => c.category === 'REVIEW_REPUTATION_SYSTEM')!;
    expect(score.insufficientData).toBe(false);
    expect(score.score).toBe(92); // 4.6/5 × 100
    expect(score.explanation).toMatch(/owner-reported/i);
  });

  it('a weak rating makes REVIEW RISK but never a scraped/negative-review claim', () => {
    const input = { rating: 3.2, reviewCount: 40, googleBusinessUrl: null };
    const evidence = toRecords(reviewEvidence(input, analyzeOwnerReviews(input)));
    const review = analyzeJourney(evidence).find((s) => s.stage === 'REVIEW')!;
    expect(review.status).toBe('RISK');
    expect(review.finding).toMatch(/owner-reported/i);
    expect(review.finding).not.toMatch(/scraped/i);
  });

  it('no owner review data → REVIEW stays UNKNOWN and category stays INSUFFICIENT DATA', () => {
    const evidence: EvidenceRecordLike[] = [
      { id: 'a', evidenceType: 'PHONE_VISIBILITY', fact: 'A phone number is publicly displayed.', supportingContext: null, confidence: 90 },
    ];
    const review = analyzeJourney(evidence).find((s) => s.stage === 'REVIEW')!;
    expect(review.status).toBe('UNKNOWN');
    const score = calculateCategoryScores(analyzeJourney(evidence), evidence).find((c) => c.category === 'REVIEW_REPUTATION_SYSTEM')!;
    expect(score.insufficientData).toBe(true);
    expect(score.score).toBeNull();
  });
});
