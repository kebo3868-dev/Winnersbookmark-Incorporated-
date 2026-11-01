import { describe, expect, it } from 'vitest';
import fixture from './fixtures/leverocks-77-report-evidence.json';
import { analyzeJourney } from '@/lib/audit/journey';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';

/**
 * WHY ONE LEVEROCK'S REPORT SAID 77/100 AND A LATER ONE SAYS 84/100.
 *
 * The earlier report (audit cmvoqcs6u0002kw08rfmgydre, generated on main
 * a00bbde) printed its full evidence chain; that chain is the fixture. Scored
 * by the current rules, the SAME evidence gives 84/100 at the same 80%
 * coverage. The 7-point difference is the scoring-rule change in PR #63
 * (1434f94), not different evidence and not a regression:
 *
 *  - Phone: a missing FAQ page no longer marks the Phone stage FRICTION (an
 *    owner decision recorded in #63). Phone readiness 60 -> 90, weight 15.
 *  - Follow-up / Return: a mechanism that is publicly present but whose use
 *    cannot be seen is RESOLVED_UNVERIFIED (shown as MANUAL VALIDATION), scored
 *    70 rather than FRICTION's 60. Customer retention 60 -> 70, weight 10.
 *
 * Old: 6190 / 80 = 77.4 -> 77.  New: 6190 + 15×30 + 10×10 = 6740 / 80 = 84.25 -> 84.
 *
 * This pins the explanation so a future change to either score is noticed and
 * explained rather than discovered in a client PDF. It does not force either
 * number: both are computed.
 */
type Rec = { type: string; source: string; fact: string; ctx: string; conf: 'Strong' | 'Moderate' | 'Preliminary' };
const records = (fixture as { records: Rec[] }).records;

// The PDF prints a confidence LABEL, not the stored number. Two different
// mappings into each label's band give the same result, so the explanation
// does not depend on the reconstruction of the numbers.
const MAPPINGS: Record<string, Record<Rec['conf'], number>> = {
  low: { Strong: 85, Moderate: 65, Preliminary: 55 },
  high: { Strong: 95, Moderate: 70, Preliminary: 45 },
};

function score(mapping: Record<Rec['conf'], number>) {
  const evidence = records.map((r, i) => ({
    id: `r${i}`, evidenceType: r.type, fact: r.fact, supportingContext: r.ctx || null, confidence: mapping[r.conf], sourceUrl: r.source,
  }));
  const journey = analyzeJourney(evidence as never);
  const categories = calculateCategoryScores(journey, evidence as never);
  return { journey, categories, overall: calculateOverallScore(categories) };
}

describe('Leverock\'s 77 vs 84: same evidence, PR #63 scoring rules', () => {
  it('the fixture is the 29-record evidence chain the 77 report printed', () => {
    expect(records).toHaveLength(29);
  });

  for (const [name, mapping] of Object.entries(MAPPINGS)) {
    it(`current rules score that evidence 84/100 at 80% coverage (${name} confidence mapping)`, () => {
      const { journey, categories, overall } = score(mapping);
      expect(overall.overallScore).toBe(84);
      expect(overall.coverageScore).toBe(80);
      const by = Object.fromEntries(categories.map((c) => [c.category, c.score]));
      expect(by).toMatchObject({
        DIGITAL_CUSTOMER_JOURNEY: 90, WEBSITE_CONVERSION: 90, PHONE_RESPONSE_READINESS: 90,
        ONLINE_ORDERING_EXPERIENCE: 60, CUSTOMER_RETENTION: 70, LOCAL_DIGITAL_PRESENCE: 100, AI_AUTOMATION_READINESS: 78,
        RESERVATION_EXPERIENCE: null, REVIEW_REPUTATION_SYSTEM: null,
      });
      const status = Object.fromEntries(journey.map((s) => [s.stage, s.status]));
      expect(status).toMatchObject({ PHONE: 'HEALTHY', ORDERING: 'FRICTION', FOLLOW_UP: 'RESOLVED_UNVERIFIED', RETURN: 'RESOLVED_UNVERIFIED' });
    });
  }

  it('the two #63 rule changes account for the whole difference: with their old values the same weights give 77', () => {
    const { categories } = score(MAPPINGS.low);
    const OLD_RULES: Record<string, number> = { PHONE_RESPONSE_READINESS: 60, CUSTOMER_RETENTION: 60 };
    const old = categories.map((c) => (c.category in OLD_RULES ? { ...c, score: OLD_RULES[c.category] } : c));
    expect(calculateOverallScore(old).overallScore).toBe(77);
    expect(calculateOverallScore(old).coverageScore).toBe(80);
    // Every other category is identical, so nothing else moved the score.
    const changed = categories.filter((c, i) => c.score !== old[i].score).map((c) => c.category).sort();
    expect(changed).toEqual(['CUSTOMER_RETENTION', 'PHONE_RESPONSE_READINESS']);
  });
});
