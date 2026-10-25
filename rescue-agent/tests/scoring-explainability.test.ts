/**
 * THE SCORE MUST EXPLAIN ITSELF.
 *
 * The arithmetic was correct and documented nowhere the client could see. A
 * 0–100 figure under the words "Rescue Score" invites exactly one reading — that
 * something about the business's performance has been measured — and nothing in
 * the report said otherwise.
 *
 * These tests check the published explanation against the ACTUAL calculation,
 * not against itself. If a weight changes in SCORE_WEIGHTS and the methodology
 * text does not, these fail.
 */
import { describe, expect, it } from 'vitest';
import { calculateOverallScore, calculateCategoryScores, scoreBand } from '@/lib/scoring/rescueScore';
import {
  CATEGORY_WEIGHTS,
  CONFIDENCE_BANDS,
  COVERAGE_EXPLANATION,
  SCORE_DIRECTION,
  SCORE_MEANING,
  UNKNOWN_EXPLANATION,
  scoringMethodology,
} from '@/lib/scoring/methodology';
import { buildExecutiveReport, confidenceLabel, type ExecutiveReportInput } from '@/lib/reports/executive';
import { analyzeJourney } from '@/lib/audit/journey';
import { SCORE_WEIGHTS, type CategoryScoreInput, type EvidenceRecordLike } from '@/types/audit';

const cat = (category: string, weight: number, score: number | null, insufficientData = false): CategoryScoreInput => ({
  category: category as CategoryScoreInput['category'],
  weight,
  score,
  confidence: 70,
  insufficientData,
  explanation: 'test',
});

describe('score direction and meaning are stated', () => {
  it('says which way the scale runs', () => {
    expect(SCORE_DIRECTION).toMatch(/0 to 100/);
    expect(SCORE_DIRECTION).toMatch(/higher is better/i);
  });

  it('says the score measures audit signals, not financial performance', () => {
    expect(SCORE_MEANING).toMatch(/not a measurement of revenue/i);
    expect(SCORE_MEANING).toMatch(/defined set of public signals/i);
    // The specific misreading the report invited: a low score as a measured loss.
    expect(SCORE_MEANING).toMatch(/does not mean the business is losing a measured amount/i);
  });

  it('the direction it claims is the direction the code computes', () => {
    const better = calculateOverallScore([cat('WEBSITE_CONVERSION', 50, 90), cat('CUSTOMER_RETENTION', 50, 90)]);
    const worse = calculateOverallScore([cat('WEBSITE_CONVERSION', 50, 30), cat('CUSTOMER_RETENTION', 50, 30)]);
    expect(better.overallScore!).toBeGreaterThan(worse.overallScore!);
  });

  it('no band names money, so the number is never read as one', () => {
    for (const score of [100, 95, 85, 75, 65, 59, 20, 0]) {
      expect(scoreBand(score), `band for ${score}`).not.toMatch(/revenue|leakage|loss|cost|\$/i);
    }
  });
});

describe('the published weights are the weights in use', () => {
  it('lists every scoring category exactly once', () => {
    const listed = CATEGORY_WEIGHTS.map(([category]) => category).sort();
    expect(listed).toEqual((Object.keys(SCORE_WEIGHTS) as string[]).sort());
  });

  it('quotes each weight from SCORE_WEIGHTS, so the text cannot drift', () => {
    for (const [category, weight] of CATEGORY_WEIGHTS) {
      expect(weight, category).toBe(SCORE_WEIGHTS[category]);
    }
  });

  it('the weights total 100, so a percentage reading of them is correct', () => {
    expect(CATEGORY_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0)).toBe(100);
  });
});

describe('coverage explains its own denominator', () => {
  it('names the denominator as all nine categories', () => {
    expect(COVERAGE_EXPLANATION).toMatch(/all nine categories/i);
    expect(CATEGORY_WEIGHTS).toHaveLength(9);
  });

  it('states that an unscored category is not scored zero', () => {
    expect(COVERAGE_EXPLANATION).toMatch(/not scored zero/i);
    expect(COVERAGE_EXPLANATION).toMatch(/lowers coverage and leaves the score itself untouched/i);
  });

  it('and that is what the code does — the score is untouched, coverage falls', () => {
    const full = calculateOverallScore([cat('WEBSITE_CONVERSION', 15, 80), cat('CUSTOMER_RETENTION', 10, 80)]);
    const partial = calculateOverallScore([
      cat('WEBSITE_CONVERSION', 15, 80),
      cat('CUSTOMER_RETENTION', 10, null, true),
    ]);
    expect(partial.overallScore).toBe(full.overallScore);
    expect(partial.coverageScore).toBeLessThan(full.coverageScore);
    // The alternative the explanation rules out.
    expect(partial.overallScore).not.toBe(Math.round((80 * 15) / 25));
  });

  it('separates "how good" from "how much was looked at"', () => {
    const result = calculateOverallScore([
      cat('WEBSITE_CONVERSION', 15, 100),
      cat('REVIEW_REPUTATION_SYSTEM', 85, null, true),
    ]);
    expect(result.overallScore).toBe(100);
    expect(result.coverageScore).toBe(15);
  });
});

describe('unknown stays distinct from a confirmed failure', () => {
  it('says so in the words the client reads', () => {
    expect(UNKNOWN_EXPLANATION).toMatch(/never scored as zero/i);
    expect(UNKNOWN_EXPLANATION).toMatch(/never counted as a confirmed failure/i);
    expect(UNKNOWN_EXPLANATION).toMatch(/reduce coverage/i);
  });

  it('an UNKNOWN stage scores nothing; a RISK stage scores something', () => {
    const unknownOnly = calculateCategoryScores(
      [{ stage: 'RESERVATION', status: 'UNKNOWN', finding: 'x', confidence: 30, manualValidationRequired: true, evidenceIds: [] }],
      [],
    ).find((c) => c.category === 'RESERVATION_EXPERIENCE')!;
    const riskOnly = calculateCategoryScores(
      [{ stage: 'RESERVATION', status: 'RISK', finding: 'x', confidence: 80, manualValidationRequired: false, evidenceIds: [] }],
      [],
    ).find((c) => c.category === 'RESERVATION_EXPERIENCE')!;

    expect(unknownOnly.insufficientData).toBe(true);
    expect(unknownOnly.score).toBeNull();
    expect(riskOnly.insufficientData).toBe(false);
    expect(riskOnly.score).toBe(30);
    // The collapse this guards against: unknown rendered as the lowest grade.
    expect(unknownOnly.score).not.toBe(0);
  });

  it('a wholly unobservable audit returns no score rather than zero', () => {
    const result = calculateOverallScore([
      cat('REVIEW_REPUTATION_SYSTEM', 10, null, true),
      cat('LOCAL_DIGITAL_PRESENCE', 10, null, true),
    ]);
    expect(result.overallScore).toBeNull();
    expect(result.overallScore).not.toBe(0);
    expect(result.coverageScore).toBe(0);
  });
});

describe('confidence is a documented rubric, not a printed probability', () => {
  it('defines each band by how the fact was obtained', () => {
    const byLabel = new Map(CONFIDENCE_BANDS);
    expect(byLabel.get('Strong')).toMatch(/read directly from a page|response to a request/i);
    expect(byLabel.get('Moderate')).toMatch(/outside public view/i);
    expect(byLabel.get('Preliminary')).toMatch(/does not establish it/i);
  });

  it('covers exactly the labels confidenceLabel can return', () => {
    const produced = new Set([confidenceLabel(100), confidenceLabel(70), confidenceLabel(10)]);
    expect(new Set(CONFIDENCE_BANDS.map(([label]) => label))).toEqual(produced);
  });

  it('no band is defined by a numeric range', () => {
    for (const [label, definition] of CONFIDENCE_BANDS) {
      expect(definition, label).not.toMatch(/\d{2}\s*[–-]\s*\d{2,3}%?/);
    }
  });
});

describe('the explanation reaches the report DTO', () => {
  const evidence: EvidenceRecordLike[] = [
    { id: 'e1', evidenceType: 'PHONE_VISIBILITY', fact: 'A phone number is publicly displayed ((555) 111-2222).', supportingContext: null, confidence: 90 },
    { id: 'e2', evidenceType: 'FAQ_SIGNAL', fact: 'No public FAQ pathway was detected on the analyzed website pages.', supportingContext: null, confidence: 55 },
  ];
  const reportInput = (): ExecutiveReportInput => ({
    auditId: 'c1',
    restaurantName: 'Test Grill',
    websiteUrl: 'https://testgrill.example',
    location: null,
    auditDate: '2026-10-25',
    auditStatus: 'COMPLETED',
    demoMode: false,
    contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null,
    avgTicket: null,
    overallScore: 70,
    coverageScore: 80,
    sourcesCollected: 3,
    sourcesFailed: 0,
    evidence: evidence.map((e) => ({ ...e, sourceUrl: 'https://testgrill.example' })),
    opportunities: [],
    journey: analyzeJourney(evidence),
    categoryScores: [],
    storedSummary: null,
    storedSummaryWasAiEnhanced: false,
    storedRecommendation: null,
  });

  it('publishes the methodology as renderable sections', () => {
    const dto = buildExecutiveReport(reportInput());
    const headings = dto.scoringMethodology.map((s) => s.heading);
    expect(headings).toContain('What the Rescue Score measures');
    expect(headings).toContain('How the categories are weighted');
    expect(headings).toContain('What coverage means');
    expect(headings).toContain('Unknown is not a failure');
    expect(headings).toContain('What confidence means');
    expect(dto.scoringMethodology).toEqual(scoringMethodology());
  });

  it('every section has body text, and every row has both halves', () => {
    for (const section of buildExecutiveReport(reportInput()).scoringMethodology) {
      expect(section.body.length, section.heading).toBeGreaterThan(40);
      for (const [term, definition] of section.rows ?? []) {
        expect(term.length, section.heading).toBeGreaterThan(0);
        expect(definition.length, `${section.heading}/${term}`).toBeGreaterThan(10);
      }
    }
  });

  it('the appendix still carries the number, while the label is what gets shown', () => {
    const dto = buildExecutiveReport(reportInput());
    expect(dto.appendix.map((e) => e.confidenceLabel)).toEqual(['Strong', 'Preliminary']);
    expect(dto.appendix.map((e) => e.confidence)).toEqual([90, 55]);
  });
});

describe('codex P2: the retention category stays a usable machine key', () => {
  it('report consumers still dispatch on it after the rename', async () => {
    // Renaming "WEAK PUBLIC RETENTION SIGNALS" silently unhooked eight
    // consumers that dispatch on /RETENTION/: the reactivation scenario
    // stopped being offered and the AI capabilities, validation steps and KPIs
    // fell back to a generic "Custom Automation Assessment".
    const { scenarioKindFor } = await import('@/lib/reports/scenarios');
    const { detectRevenueLeaks } = await import('@/lib/audit/leaks');
    const { normalizeEvidence } = await import('@/lib/audit/evidence');
    const { extractPage } = await import('@/lib/web/collector');

    const page = extractPage(
      'https://probe.test/',
      'https://probe.test/',
      200,
      'text/html',
      '<html><head><title>Probe</title></head><body><h1>Probe Grill</h1><p>Call (727) 555-0000</p></body></html>',
    );
    const records = normalizeEvidence({ pages: [page], failures: [], probes: [] }).map((e, i) => ({
      id: `k${i}`,
      evidenceType: e.evidenceType,
      fact: e.fact,
      supportingContext: e.supportingContext ?? null,
      confidence: e.confidence,
    }));
    const optIn = detectRevenueLeaks({ evidence: records, journey: analyzeJourney(records) }).find((l) =>
      /OPT-IN/i.test(l.category),
    );
    expect(optIn, 'the opt-in finding must exist for this fixture').toBeDefined();
    expect(optIn!.category, 'must carry the stable RETENTION token').toMatch(/RETENTION/i);
    expect(
      scenarioKindFor({ category: optIn!.category, classification: 'MANUAL VALIDATION REQUIRED' }),
      'the reactivation scenario must still be reachable',
    ).toBe('reactivation');
  });
});
