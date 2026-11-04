/**
 * PUBLISHED FINDING AND STAGE WORDING IS BOUND TO THE EVIDENCE BESIDE IT.
 *
 * Follow-up review of 07198e3 (five Medium findings), reproduced here as
 * cases A1–A5, B0–B8 and C1:
 *
 *  - A regenerated finding's wording was attached to any stored finding of the
 *    same category that shared ONE evidence record with it — or none, when the
 *    stored finding had no evidence — and one regenerated finding could be
 *    attached to several stored ones (A1, A3).
 *  - Where regeneration did not match, stored wording was published when it
 *    was an instance of wording some engine version once wrote for the stage
 *    and status or category. That proves the wording existed, not that it is
 *    true of this audit's evidence: a different authentic sentence could
 *    contradict the evidence on the same page (B1, B5), an authentic count
 *    could be changed (B6), and a finding's wording could sit beside evidence
 *    about something else (B8).
 *
 * Now (observationPublication.ts) a regenerated finding is published on a
 * stored finding only when their evidence-ID sets are equal and non-empty, and
 * each regenerated finding is used at most once. Stored historical wording is
 * not published: verifying it against the audit's evidence would require
 * replaying the engine version that wrote it, which the publication step does
 * not do. Such items get neutral wording that says only what the stored
 * status records. Stored records are not changed.
 */
import { describe, expect, it } from 'vitest';
import lev from './fixtures/leverocks-stored-audit.json';
import legacy from './fixtures/leverocks-legacy-audit.json';
import { publishAuditObservations } from '@/lib/reports/observationPublication';
import { buildExecutiveReport, type ExecutiveReportInput } from '@/lib/reports/executive';
import { neutralFindingTitle } from '@/lib/reports/canonicalIdentifiers';

type Audit = typeof lev;
type Opp = Audit['opportunities'][number];
const NEUTRAL_PROBLEM = 'The stored description of this finding could not be traced to the audit evidence and is not shown; its evidence is listed in the appendix.';
const NEUTRAL_FRICTION = 'Friction was recorded at this stage; see the evidence in the appendix.';
const NEUTRAL_RISK = 'A risk was recorded at this stage; see the evidence in the appendix.';

function publish(a: Audit, edit: (s: Audit) => void = () => {}) {
  const s: Audit = structuredClone(a);
  edit(s);
  const before = JSON.stringify(s);
  const p = publishAuditObservations({
    evidence: s.evidence.map((e) => ({ ...e, sourceUrl: null })),
    journey: s.journeyStages,
    opportunities: s.opportunities,
    scores: s.scores,
    context: { sources: s.sources, restaurant: s.restaurant },
  });
  // Publication never changes the stored records it reads.
  expect(JSON.stringify(s)).toBe(before);
  return { s, p };
}
function report(a: Audit, p: ReturnType<typeof publish>['p']) {
  return buildExecutiveReport({
    auditId: 'audit', restaurantId: 'restaurant', restaurantName: a.restaurant.name, websiteUrl: a.restaurant.websiteUrl, location: null,
    auditDate: '2026-11-01', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: 'Winnersbookmark', consultantName: 'K', phone: '1', email: null, bookingUrl: null, fallbackText: 'x' } as never,
    bookingQrDataUrl: null, avgTicket: null, overallScore: a.overallScore, coverageScore: a.coverageScore, sourcesCollected: 8, sourcesFailed: 0,
    evidence: p.evidence.map(({ provenance: _p, auditSourceId: _s, ...e }) => e), opportunities: p.opportunities, journey: p.journey,
    categoryScores: p.scores, storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
  } as unknown as ExecutiveReportInput);
}
const idOf = (a: Audit, type: string) => a.evidence.find((e) => e.evidenceType === type)!.id;
const ORDER = 'ORDER BUTTON LABEL MISMATCH';
const CTA = 'CONFUSING CTA HIERARCHY';
const ORDER_TITLE = 'The online ordering button uses a telephone link instead of an online checkout';

describe('A: regenerated wording reaches only the stored finding with exactly its evidence', () => {
  const base = publish(lev);
  const regenerated = (category: string) => base.p.opportunities.find((o) => o.category === category)!;

  it('baseline: the unaltered audit publishes every finding regenerated, unchanged', () => {
    expect(base.p.report.opportunities).toEqual({ total: 4, fallbacks: 0, historicalWithheld: 0 });
    expect(regenerated(ORDER).title).toBe(ORDER_TITLE);
  });

  it('A1: a same-category finding with NO evidence does not borrow the real finding\'s wording', () => {
    const order = lev.opportunities.find((o) => o.category === ORDER)!;
    const { p } = publish(lev, (s) => s.opportunities.push({ ...order, title: 'Invented', problem: 'Invented.', evidenceIds: [] }));
    const dup = p.opportunities[4];
    expect(dup.title).toBe(neutralFindingTitle(ORDER));
    expect(dup.problem).toBe(NEUTRAL_PROBLEM);
    expect(p.opportunities[0].title).toBe(ORDER_TITLE);
    const dto = report(lev, p);
    expect(dto.findings.filter((f) => f.title === ORDER_TITLE)).toHaveLength(1);
  });

  it('A2: unrelated evidence only — neutral (unchanged behaviour)', () => {
    const order = lev.opportunities.find((o) => o.category === ORDER)!;
    const { p } = publish(lev, (s) => s.opportunities.push({ ...order, title: 'Invented', problem: 'Invented.', evidenceIds: [idOf(lev, 'FAQ_SIGNAL')] }));
    expect(p.opportunities[4].title).toBe(neutralFindingTitle(ORDER));
    expect(p.opportunities[4].problem).toBe(NEUTRAL_PROBLEM);
  });

  it('A3: ONE shared fact plus unrelated facts no longer borrows the wording', () => {
    const order = lev.opportunities.find((o) => o.category === ORDER)!;
    const { p } = publish(lev, (s) =>
      s.opportunities.push({ ...order, title: 'Invented', problem: 'Invented.', evidenceIds: [idOf(lev, 'ORDERING_PATH'), idOf(lev, 'FAQ_SIGNAL'), idOf(lev, 'CTA_SIGNAL')] }),
    );
    expect(p.opportunities[4].title).toBe(neutralFindingTitle(ORDER));
    expect(p.opportunities[4].problem).toBe(NEUTRAL_PROBLEM);
    expect(report(lev, p).findings.filter((f) => f.title === ORDER_TITLE)).toHaveLength(1);
  });

  it('a regenerated finding is used once: a second stored finding with the same evidence gets neutral wording', () => {
    const order = lev.opportunities.find((o) => o.category === ORDER)!;
    const { p } = publish(lev, (s) => s.opportunities.push({ ...order }));
    expect(p.opportunities[0].title).toBe(ORDER_TITLE);
    expect(p.opportunities[4].title).toBe(neutralFindingTitle(ORDER));
    expect(p.opportunities[4].problem).toBe(NEUTRAL_PROBLEM);
  });

  it('A4 / B8: a finding whose evidence belongs to another finding gets neutral wording, not its category\'s wording', () => {
    const order = lev.opportunities.find((o) => o.category === ORDER)!;
    const { s, p } = publish(lev, (x) => {
      x.opportunities.find((o) => o.category === CTA)!.evidenceIds = [...order.evidenceIds];
    });
    const cta = p.opportunities[s.opportunities.findIndex((o) => o.category === CTA)];
    expect(cta.title).toBe(neutralFindingTitle(CTA));
    expect(cta.problem).toBe(NEUTRAL_PROBLEM);
    expect(cta.businessImpact).toBe('Not measured.');
  });

  it('A5: own evidence plus another finding\'s evidence is not the regenerated set: neutral', () => {
    const order = lev.opportunities.find((o) => o.category === ORDER)!;
    const { s, p } = publish(lev, (x) => {
      const c = x.opportunities.find((o) => o.category === CTA)!;
      c.evidenceIds = [...c.evidenceIds, ...order.evidenceIds];
    });
    const cta = p.opportunities[s.opportunities.findIndex((o) => o.category === CTA)];
    expect(cta.title).toBe(neutralFindingTitle(CTA));
  });

  it('the evidence order and duplicate ids do not matter; the set does', () => {
    const { s, p } = publish(lev, (x) => {
      const o = x.opportunities.find((y) => y.category === ORDER)!;
      o.evidenceIds = [...o.evidenceIds].reverse();
    });
    expect(p.opportunities[s.opportunities.findIndex((o) => o.category === ORDER)].title).toBe(ORDER_TITLE);
  });

  it('a stored recommendation is never taken from a regenerated finding it did not match', () => {
    const order = lev.opportunities.find((o) => o.category === ORDER)!;
    const { p } = publish(lev, (s) => s.opportunities.push({ ...order, recommendedSolution: 'stored', evidenceIds: [] }));
    expect(p.opportunities[4].recommendedSolution).toBe('stored');
  });
});

describe('B: stored historical wording is not published without verification against this audit\'s evidence', () => {
  const L = legacy as unknown as Audit;
  const phone = (p: ReturnType<typeof publish>['p']) => p.journey.find((j) => j.stage === 'PHONE')!;

  it('B0: the earlier audit\'s authentic historical stage wording is withheld (verification needs replay); statuses and stored text are unchanged', () => {
    const { s, p } = publish(L);
    for (const stage of ['PHONE', 'FOLLOW_UP', 'RETURN']) {
      const stored = s.journeyStages.find((j) => j.stage === stage)!;
      const shown = p.journey.find((j) => j.stage === stage)!;
      expect(shown.status).toBe(stored.status);
      expect(shown.finding, stage).toBe(NEUTRAL_FRICTION);
    }
    // The withheld wording is still recognised as historical, and counted.
    expect(p.report.journey).toEqual({ total: 10, fallbacks: 3, historicalWithheld: 3 });
  });

  it('B1: a different authentic PHONE/FRICTION sentence that contradicts the evidence is not published', () => {
    const { p } = publish(L, (s) => {
      s.journeyStages.find((j) => j.stage === 'PHONE')!.finding =
        'Observed on the public site: mobile visitors cannot tap to call. How much phone demand this creates, and whether calls go unanswered, requires call records — not assessed here.';
    });
    expect(phone(p).finding).toBe(NEUTRAL_FRICTION);
    expect(L.evidence.some((e) => e.evidenceType === 'CLICK_TO_CALL' && /links are present/.test(e.fact))).toBe(true);
  });

  it('B2: an altered value inside an authentic frame is not published', () => {
    const { p } = publish(L, (s) => {
      s.journeyStages.find((j) => j.stage === 'PHONE')!.finding =
        'Observed on the public site: no phone number and no menu page was found. How much phone demand this creates, and whether calls go unanswered, requires call records — not assessed here.';
    });
    expect(phone(p).finding).toBe(NEUTRAL_FRICTION);
  });

  it('B3: PHONE wording stored under the MENU stage is not published', () => {
    const { p } = publish(L, (s) => {
      const m = s.journeyStages.find((j) => j.stage === 'MENU')!;
      m.status = 'RISK';
      m.finding = L.journeyStages.find((j) => j.stage === 'PHONE')!.finding;
    });
    expect(p.journey.find((j) => j.stage === 'MENU')!.finding).toBe(NEUTRAL_RISK);
  });

  it('B4: FRICTION wording stored under a HEALTHY status is not published', () => {
    const { p } = publish(L, (s) => {
      const ph = s.journeyStages.find((j) => j.stage === 'PHONE')!;
      ph.status = 'HEALTHY';
      ph.manualValidationRequired = !ph.manualValidationRequired;
    });
    expect(phone(p).finding).toBe('No friction was observed at this stage; see the evidence in the appendix.');
  });

  it('B5: "no phone number was detected" under an edited RISK status is not published while a phone number is in the evidence', () => {
    const { p } = publish(L, (s) => {
      const ph = s.journeyStages.find((j) => j.stage === 'PHONE')!;
      ph.status = 'RISK';
      ph.finding = 'No phone number was detected on the analyzed pages — phone-intent customers have no visible path to call.';
    });
    expect(phone(p).finding).toBe(NEUTRAL_RISK);
    // The stored status is shown as stored (statuses are never rewritten).
    expect(phone(p).status).toBe('RISK');
  });

  it('B6: an authentic finding sentence with a changed count ("7 linked destinations failed", 1 recorded) is not published', () => {
    const broken = L.evidence.filter((e) => e.evidenceType === 'BROKEN_LINK');
    expect(broken).toHaveLength(1);
    const { s, p } = publish(L, (x) =>
      x.opportunities.push({
        ...x.opportunities[0], category: 'BROKEN CUSTOMER PATHWAY', title: 'A linked customer pathway is failing',
        problem: '7 linked destination(s) failed when tested. Customers who click these links reach a dead end at the exact moment they are trying to spend money or get information.',
        businessImpact: 'x', evidenceIds: [broken[0].id], manualValidationRequired: true,
      } as Opp),
    );
    const o = p.opportunities[s.opportunities.length - 1];
    expect(o.problem).toBe(NEUTRAL_PROBLEM);
    expect(o.title).toBe(neutralFindingTitle('BROKEN CUSTOMER PATHWAY'));
    expect(JSON.stringify(p.opportunities)).not.toContain('7 linked destination');
  });

  it('B7: another category\'s authentic title is not published', () => {
    const broken = L.evidence.find((e) => e.evidenceType === 'BROKEN_LINK')!;
    const { s, p } = publish(L, (x) =>
      x.opportunities.push({ ...x.opportunities[0], category: CTA, title: 'A linked customer pathway is failing', problem: 'x', businessImpact: 'x', evidenceIds: [broken.id], manualValidationRequired: true } as Opp),
    );
    expect(p.opportunities[s.opportunities.length - 1].title).toBe(neutralFindingTitle(CTA));
  });

  it('score explanations are still derived from the stored statuses and reproduce the stored score', () => {
    const { s, p } = publish(L);
    for (const cat of ['PHONE_RESPONSE_READINESS', 'CUSTOMER_RETENTION']) {
      expect(p.scores.find((x) => x.category === cat)!.explanation).toBe(s.scores.find((x) => x.category === cat)!.explanation);
    }
    expect(p.scores.map((x) => x.score)).toEqual(s.scores.map((x) => x.score));
  });
});

describe('C1: journey wording is regenerated from the audit\'s own evidence; stage evidence ids are not shown', () => {
  it('stages whose stored evidence ids point at an unrelated fact still get the wording the evidence supports, and no surface lists stage evidence', () => {
    const clean = publish(lev);
    const { p } = publish(lev, (s) => {
      for (const j of s.journeyStages) j.evidenceIds = [idOf(lev, 'CTA_SIGNAL')];
    });
    expect(p.journey.map((j) => j.finding)).toEqual(clean.p.journey.map((j) => j.finding));
    const dto = report(lev, p);
    for (const j of [...dto.journeyMap, ...dto.journeyScorecard]) expect(Object.keys(j)).not.toContain('evidenceIds');
  });
});
