import { describe, expect, it } from 'vitest';
import { analyzeOwnerReviews, reviewEvidence, ratingToReputationScore } from '@/lib/audit/reviews';

describe('analyzeOwnerReviews (owner-reported only)', () => {
  it('returns not-provided when nothing is supplied — REVIEW stays unscored', () => {
    const s = analyzeOwnerReviews({ rating: null, reviewCount: null, googleBusinessUrl: null });
    expect(s.provided).toBe(false);
    expect(s.reputationScore).toBeNull();
    expect(s.confidence).toBe(0);
  });

  it('scores reputation deterministically from a rating, capped as owner-reported', () => {
    const s = analyzeOwnerReviews({ rating: 4.5, reviewCount: 200, googleBusinessUrl: null });
    expect(s.provided).toBe(true);
    expect(s.reputationScore).toBe(90);
    expect(s.confidence).toBeLessThanOrEqual(60); // never as confident as verified evidence
    expect(s.summary).toMatch(/owner-reported/i);
  });

  it('clamps out-of-range ratings and rounds review counts', () => {
    expect(analyzeOwnerReviews({ rating: 7, reviewCount: 10.6, googleBusinessUrl: null }).rating).toBe(5);
    expect(analyzeOwnerReviews({ rating: -2, reviewCount: null, googleBusinessUrl: null }).rating).toBe(0);
    expect(analyzeOwnerReviews({ rating: null, reviewCount: 10.6, googleBusinessUrl: null }).reviewCount).toBe(11);
  });

  it('maps 5-star ratings to a 0–100 reputation score', () => {
    expect(ratingToReputationScore(5)).toBe(100);
    expect(ratingToReputationScore(4)).toBe(80);
    expect(ratingToReputationScore(3)).toBe(60);
    expect(ratingToReputationScore(0)).toBe(0);
  });

  it('never claims a response pattern (unknowable from owner numbers)', () => {
    const s = analyzeOwnerReviews({ rating: 4.0, reviewCount: 100, googleBusinessUrl: 'https://maps.example/x' });
    expect(s.responsePatternKnown).toBe(false);
  });
});

describe('reviewEvidence (clearly labeled owner-reported)', () => {
  it('produces no evidence when nothing was provided', () => {
    const input = { rating: null, reviewCount: null, googleBusinessUrl: null };
    expect(reviewEvidence(input, analyzeOwnerReviews(input))).toHaveLength(0);
  });

  it('labels rating evidence as owner-reported and unverified', () => {
    const input = { rating: 4.2, reviewCount: 318, googleBusinessUrl: null };
    const ev = reviewEvidence(input, analyzeOwnerReviews(input));
    expect(ev[0].evidenceType).toBe('REVIEW_SIGNAL');
    expect(ev[0].fact).toMatch(/owner-reported/i);
    expect(ev[0].fact).toMatch(/4\.2★/);
    expect(ev[0].supportingContext).toMatch(/not independently verified/i);
  });
});

describe('socialEvidence (review finding: supplied social URL must be used)', () => {
  it('produces a SOCIAL_LINK evidence attributed to the supplied URL', async () => {
    const { socialEvidence } = await import('@/lib/audit/reviews');
    const ev = socialEvidence('https://instagram.com/theplace');
    expect(ev).toHaveLength(1);
    expect(ev[0].evidenceType).toBe('SOCIAL_LINK');
    expect(ev[0].sourceUrl).toBe('https://instagram.com/theplace');
    expect(ev[0].fact).toContain('https://instagram.com/theplace');
  });

  it('produces nothing when no social URL is supplied', async () => {
    const { socialEvidence } = await import('@/lib/audit/reviews');
    expect(socialEvidence(null)).toHaveLength(0);
  });
});

describe('review evidence source attribution (review finding)', () => {
  it('attributes the Google Business URL as the evidence source, not prose', () => {
    const input = { rating: 4.4, reviewCount: 210, googleBusinessUrl: 'https://maps.google.com/place/abc' };
    const ev = reviewEvidence(input, analyzeOwnerReviews(input));
    // rating evidence sources to the Google profile (or null), never the homepage
    const profile = ev.find((e) => /Google Business Profile URL/.test(e.fact));
    expect(profile?.sourceUrl).toBe('https://maps.google.com/place/abc');
  });
});
