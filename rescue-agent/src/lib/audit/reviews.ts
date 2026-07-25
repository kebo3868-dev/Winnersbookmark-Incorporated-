import type { EvidenceInput } from '@/types/audit';

/**
 * REVIEW & REPUTATION — owner-supplied only (Phase 3).
 *
 * Winners Bookmark does not scrape review platforms. When the restaurant owner
 * provides their public Google/Yelp rating, review count, and/or Business
 * Profile URL at intake, this module converts that into evidence and a
 * reputation signal — always clearly labeled "owner-reported". When nothing is
 * provided, no evidence is produced and the REVIEW stage stays INSUFFICIENT
 * DATA, exactly as before.
 */

export interface OwnerReviewInput {
  rating: number | null; // 0–5, owner-reported
  reviewCount: number | null; // owner-reported
  googleBusinessUrl: string | null;
}

export interface ReviewSignal {
  provided: boolean;
  rating: number | null;
  reviewCount: number | null;
  /** 0–100 reputation score derived deterministically from rating, or null. */
  reputationScore: number | null;
  /** 0–100 confidence — owner-reported data is capped below verified evidence. */
  confidence: number;
  responsePatternKnown: false; // never inferable from owner-supplied numbers
  summary: string;
}

const OWNER_REPORTED_CONFIDENCE = 55; // owner-reported, unverified against the platform

function clampRating(rating: number | null): number | null {
  if (rating === null || !Number.isFinite(rating)) return null;
  return Math.max(0, Math.min(5, rating));
}

/** Deterministic reputation score from a 5-star rating (3.0★→~50, 4.5★→~90). */
export function ratingToReputationScore(rating: number): number {
  return Math.round(Math.max(0, Math.min(100, (rating / 5) * 100)));
}

export function analyzeOwnerReviews(input: OwnerReviewInput): ReviewSignal {
  const rating = clampRating(input.rating);
  const reviewCount = input.reviewCount !== null && Number.isFinite(input.reviewCount) && input.reviewCount >= 0
    ? Math.round(input.reviewCount)
    : null;
  const hasAny = rating !== null || reviewCount !== null || Boolean(input.googleBusinessUrl);

  if (!hasAny) {
    return {
      provided: false,
      rating: null,
      reviewCount: null,
      reputationScore: null,
      confidence: 0,
      responsePatternKnown: false,
      summary: 'No owner-reported review data was provided; reputation was not scored.',
    };
  }

  const reputationScore = rating !== null ? ratingToReputationScore(rating) : null;
  const parts: string[] = [];
  if (rating !== null) parts.push(`owner-reported rating of ${rating.toFixed(1)}★`);
  if (reviewCount !== null) parts.push(`${reviewCount} review(s)`);
  const summary = parts.length > 0
    ? `Based on ${parts.join(' and ')} (owner-reported, not independently verified).`
    : 'A Google Business Profile URL was provided (owner-reported).';

  return {
    provided: true,
    rating,
    reviewCount,
    reputationScore,
    confidence: reputationScore !== null ? OWNER_REPORTED_CONFIDENCE : 30,
    responsePatternKnown: false,
    summary,
  };
}

/** Owner-reported review data → evidence records (clearly labeled). */
export function reviewEvidence(input: OwnerReviewInput, signal: ReviewSignal): EvidenceInput[] {
  if (!signal.provided) return [];
  const out: EvidenceInput[] = [];
  const src = input.googleBusinessUrl ?? null;

  if (signal.rating !== null) {
    out.push({
      sourceUrl: src,
      evidenceType: 'REVIEW_SIGNAL',
      fact: `Owner-reported public rating: ${signal.rating.toFixed(1)}★${signal.reviewCount !== null ? ` across ${signal.reviewCount} review(s)` : ''}.`,
      supportingContext: 'Provided by the restaurant at intake; not independently verified against the review platform.',
      confidence: OWNER_REPORTED_CONFIDENCE,
    });
  } else if (signal.reviewCount !== null) {
    out.push({
      sourceUrl: src,
      evidenceType: 'REVIEW_SIGNAL',
      fact: `Owner-reported review volume: ${signal.reviewCount} review(s).`,
      supportingContext: 'Provided by the restaurant at intake; rating not provided.',
      confidence: OWNER_REPORTED_CONFIDENCE,
    });
  }
  if (input.googleBusinessUrl) {
    out.push({
      sourceUrl: input.googleBusinessUrl,
      evidenceType: 'REVIEW_SIGNAL',
      fact: 'A Google Business Profile URL was provided by the restaurant.',
      supportingContext: 'Owner-reported. Response-pattern and recency analysis require direct platform access and are out of audit scope.',
      confidence: 60,
    });
  }
  return out;
}

/**
 * Owner-supplied social profile → evidence. The URL is attributed as the
 * source; follower/engagement analysis stays out of scope (no scraping).
 */
export function socialEvidence(socialUrl: string | null): EvidenceInput[] {
  if (!socialUrl) return [];
  return [
    {
      sourceUrl: socialUrl,
      evidenceType: 'SOCIAL_LINK',
      fact: `A social profile was provided by the restaurant: ${socialUrl}`,
      supportingContext: 'Owner-provided at intake. Follower/engagement analysis requires direct platform access and is out of audit scope.',
      confidence: 70,
    },
  ];
}
