/**
 * A FINDING WITH UNTRACEABLE WORDING DRIVES NOTHING DERIVED FROM ITS CATEGORY.
 *
 * Final review of d7f5fd2 (S1–S4). A stored finding whose wording could not be
 * traced to its evidence was published with neutral title, problem and impact,
 * but everything computed from its CATEGORY was still produced:
 *  S1/S2  a broken-pathway finding with unrelated or no evidence, in an audit
 *         with no broken link: "Fix the broken link(s) immediately" on the card
 *         and in Days 8–14 ("verified website fixes"), "Highest-priority
 *         verified finding" in the diagnosis, and the Sales Brief "It is
 *         verified, concrete";
 *  S3     an order-button finding with no evidence: "Read from the page markup:
 *         the ordering button … is a telephone (tel:) link", its fix in Days
 *         8–14, and "is set up as a phone link" in the Sales Brief openers;
 *  S4     a phone finding with no evidence: an AI Front Desk entry in Section 06.
 *
 * Now publication marks such a finding evidenceBound: false and every surface
 * treats it as unverified (executive.ts, sales.ts, recommendationTemplates.ts).
 * Its stored classification, scores and evidence are unchanged.
 */
import { describe, expect, it } from 'vitest';
import lev from './fixtures/leverocks-stored-audit.json';
import { publishAuditObservations } from '@/lib/reports/observationPublication';
import { buildExecutiveReport, type ExecutiveReportInput } from '@/lib/reports/executive';
import { UNVERIFIED_FINDING_ACTION } from '@/lib/reports/recommendationTemplates';
import { generateSalesBrief } from '@/lib/reports/sales';
import type { RankedOpportunity } from '@/lib/reports/owner';

type Audit = typeof lev;
type Opp = Audit['opportunities'][number];
const BROKEN_ADVICE = 'Fix the broken link(s) immediately. This is a direct website repair, not an AI project.';
const ORDER = 'ORDER BUTTON LABEL MISMATCH';
const PHONE = 'PHONE-DEPENDENT CUSTOMER JOURNEY';
const FAQ = lev.evidence.find((e) => e.evidenceType === 'FAQ_SIGNAL')!.id;

const brokenFinding = (base: Opp, evidenceIds: string[]): Opp => ({
  ...base, category: 'BROKEN CUSTOMER PATHWAY', title: 'x', problem: 'x', businessImpact: 'x', customerJourneyStage: 'WEBSITE',
  evidenceIds, recommendedSolution: BROKEN_ADVICE, manualValidationRequired: false, confidenceScore: 95, aiFitScore: 20,
  rescuePriorityScore: 99, impactScore: 70, urgencyScore: 90,
});
const scenarios: Record<string, (s: Audit) => void> = {
  S1: (s) => s.opportunities.push(brokenFinding(s.opportunities[0], [FAQ])),
  S2: (s) => s.opportunities.push(brokenFinding(s.opportunities[0], [])),
  S3: (s) => {
    const order = s.opportunities.find((o) => o.category === ORDER)!;
    const ids = new Set(order.evidenceIds);
    s.evidence = s.evidence.filter((e) => !ids.has(e.id));
    s.opportunities = s.opportunities.filter((o) => o !== order);
    s.opportunities.push({ ...order, evidenceIds: [], title: 'x', problem: 'x', rescuePriorityScore: 99 });
  },
  S4: (s) => {
    const phone = s.opportunities.find((o) => o.category === PHONE)!;
    s.opportunities = s.opportunities.filter((o) => o !== phone);
    s.opportunities.push({ ...phone, evidenceIds: [], title: 'x', problem: 'x' });
  },
};

function build(edit?: (s: Audit) => void) {
  const s: Audit = structuredClone(lev);
  edit?.(s);
  const before = JSON.stringify(s);
  const p = publishAuditObservations({
    evidence: s.evidence.map((e) => ({ ...e, sourceUrl: null })), journey: s.journeyStages, opportunities: s.opportunities, scores: s.scores,
    context: { sources: s.sources, restaurant: s.restaurant },
  });
  const dto = buildExecutiveReport({
    auditId: 'audit', restaurantId: 'restaurant', restaurantName: s.restaurant.name, websiteUrl: s.restaurant.websiteUrl, location: null,
    auditDate: '2026-11-01', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: 'Winnersbookmark', consultantName: 'K', phone: '1', email: null, bookingUrl: null, fallbackText: 'x' } as never,
    bookingQrDataUrl: null, avgTicket: null, overallScore: s.overallScore, coverageScore: s.coverageScore, sourcesCollected: 8, sourcesFailed: 0,
    evidence: p.evidence.map(({ provenance: _p, auditSourceId: _s, ...e }) => e), opportunities: p.opportunities, journey: p.journey,
    categoryScores: p.scores, storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
  } as unknown as ExecutiveReportInput);
  expect(JSON.stringify(s), 'stored records are not changed').toBe(before);
  const brief = generateSalesBrief({
    restaurantName: s.restaurant.name, overallScore: s.overallScore, coverageScore: s.coverageScore,
    topLeaks: [...p.opportunities].sort((a, b) => b.rescuePriorityScore - a.rescuePriorityScore).slice(0, 3).map((o) => ({ ...o, recommendedSolution: '' })) as RankedOpportunity[],
    journey: p.journey as never, evidence: p.evidence as never, recommendedTier: 'AI DISCOVERY AUDIT',
  });
  return { s, p, dto, brief, text: JSON.stringify(dto), briefText: JSON.stringify(brief) };
}
const planPhase = (dto: ReturnType<typeof build>['dto'], prefix: string) => dto.thirtyDayPlan.find((x) => x.phase.startsWith(prefix))!.actions.join('\n');

describe('baseline: findings bound to their evidence are unchanged', () => {
  it('the unaltered audit has every finding bound, its category advice, evidence statement and plan', () => {
    const { p, dto } = build();
    expect(p.opportunities.every((o) => o.evidenceBound)).toBe(true);
    expect(dto.findings.every((f) => f.evidenceBound)).toBe(true);
    const order = dto.findings.find((f) => f.category === ORDER)!;
    expect(order.recommendedAction).toMatch(/^Decide which experience is intended/);
    expect(order.evidenceBasis?.verified).toMatch(/^Read from the page markup/);
    expect(planPhase(dto, 'DAYS 8')).toMatch(/Decide which experience is intended/);
    expect(dto.prescription.diagnosis).toMatch(/Highest-priority finding: The online ordering button uses a telephone link/);
    expect(dto.rankedAiOpportunities.map((o) => o.solutionCategory)).toContain('AI Front Desk & Missed-Call Text Back');
  });
});

describe('S1 / S2: a broken-pathway finding with unrelated or no evidence', () => {
  for (const name of ['S1', 'S2']) {
    it(`${name}: no category fix on the card or in the plan, never "verified" in prose; classification unchanged`, () => {
      const { dto, text, brief, briefText } = build(scenarios[name]);
      const card = dto.findings.find((f) => f.category === 'BROKEN CUSTOMER PATHWAY')!;
      expect(card.evidenceBound).toBe(false);
      expect(card.recommendedAction).toBe(UNVERIFIED_FINDING_ACTION);
      expect(card.evidenceBasis).toBeNull();
      expect(card.commercialEffect).toBe('');
      expect(card.scenarioKind).toBeNull();
      expect(card.whatWeDoNotKnow).toMatch(/could not be traced to the audit evidence/);
      // The stored classification is preserved exactly.
      expect(card.classification).toBe('VERIFIED FINDING');
      expect(text).not.toContain('Fix the broken link');
      expect(planPhase(dto, 'DAYS 8')).not.toContain('broken link');
      expect(planPhase(dto, 'DAYS 1')).toMatch(/could not be traced to the audit evidence/);
      expect(dto.prescription.diagnosis).not.toMatch(/Broken customer pathway/i);
      expect(dto.executiveSummary).toMatch(/could not be traced to the audit evidence and should be checked against it before being acted on: broken customer pathway\./);
      expect(dto.executiveSummary).not.toMatch(/(verified|leaks)[^.]*: broken customer pathway/i);
      // Sales Brief: never the lead while a bound finding exists, never "verified".
      expect(brief.bestSalesAngle).not.toMatch(/Broken customer pathway/i);
      expect(briefText).not.toMatch(/"Broken customer pathway" — VERIFIED/);
      expect(briefText).not.toMatch(/found something[^"]*broken customer pathway/i);
    });
  }
});

describe('S3: an order-button finding with no evidence, in an audit with no ordering evidence', () => {
  it('no evidence statement, no category fix, no order-button validation, KPI or question', () => {
    const { dto, text, briefText } = build(scenarios.S3);
    const card = dto.findings.find((f) => f.category === ORDER)!;
    expect(card.evidenceBound).toBe(false);
    expect(card.evidenceBasis).toBeNull();
    expect(card.recommendedAction).toBe(UNVERIFIED_FINDING_ACTION);
    expect(card.whatWeKnow).toEqual([]);
    expect(card.labels.observedEvidence).toBe('Not recorded');
    expect(card.classification).toBe('STRONG EVIDENCE');
    for (const claim of ['Read from the page markup', 'Decide which experience is intended', 'Tap the online ordering button', 'Orders arriving online versus by phone', 'telephone (tel:) link']) {
      expect(text, claim).not.toContain(claim);
    }
    for (const claim of ['set up as a phone link', 'uses a phone link', 'page markup was read automatically']) {
      expect(briefText, claim).not.toContain(claim);
    }
  });
});

describe('S4: a phone finding with no evidence', () => {
  it('has no automation entry in Section 06 or the Days 15–21 decision, and no phone validation step drawn from it', () => {
    const { dto } = build(scenarios.S4);
    const card = dto.findings.find((f) => f.category === PHONE)!;
    expect(card.evidenceBound).toBe(false);
    expect(card.recommendedAction).toBe(UNVERIFIED_FINDING_ACTION);
    expect(dto.rankedAiOpportunities.map((o) => o.solutionCategory)).not.toContain('AI Front Desk & Missed-Call Text Back');
    expect(dto.aiOpportunities.map((o) => o.solutionCategory)).not.toContain('AI Front Desk & Missed-Call Text Back');
    expect(planPhase(dto, 'DAYS 15')).not.toMatch(/AI Front Desk/);
    expect(dto.snapshot.topRecommendedAutomation).not.toBe('AI Front Desk & Missed-Call Text Back');
  });
});

describe('scores, classifications and evidence are unchanged by the presentation', () => {
  for (const name of Object.keys(scenarios)) {
    it(`${name}: score object, classification and internal scores of every card match the stored record`, () => {
      const { s, dto } = build(scenarios[name]);
      expect(dto.score.rescueScore).toBe(s.overallScore);
      for (const f of dto.findings) {
        const stored = s.opportunities.find((o) => o.category === f.category && o.rescuePriorityScore === f.internalScores.rescuePriority)!;
        expect(f.internalScores).toEqual({ impact: stored.impactScore, urgency: stored.urgencyScore, confidence: stored.confidenceScore, aiFit: stored.aiFitScore, rescuePriority: stored.rescuePriorityScore });
      }
    });
  }
});
