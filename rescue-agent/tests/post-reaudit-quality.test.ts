/**
 * POST-RE-AUDIT QUALITY REPAIR — regression tests for the four presentation
 * defects found after the Leverock's production re-audit (score 84).
 *
 *   P1  The sales email quoted a VERIFIED phone number as something the audit
 *       "could not confirm", because the evidence hook was simply the first
 *       evidence record attached to the finding.
 *   P2  Phone-only ordering asserted "Order-intent customers who will not call
 *       are lost" — an unmeasured loss stated as fact.
 *   P2  The client report booked a 20-minute review; the sales brief asked for
 *       15 minutes and timed its agenda to 15.
 *   P3  The sales brief printed raw status codes (MANUAL_VALIDATION_REQUIRED).
 *
 * None of these touches scoring: the same evidence must still score 84.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { rankOpportunities } from '@/lib/scoring/priority';
import { generateOwnerReport, type RankedOpportunity } from '@/lib/reports/owner';
import { generateSalesBrief, type SalesBriefContent } from '@/lib/reports/sales';
import { buildExecutiveReport, type ExecutiveReportInput } from '@/lib/reports/executive';
import { COMPANY } from '@/lib/config';
import type { EvidenceRecordLike } from '@/types/audit';

const SITE = 'https://leverocks.example/';

/** The Leverock's homepage as the audit sees it: phone with tap-to-call, phone-only "Order". */
const LEVEROCKS_HTML =
  '<html><head><title>Leverock\'s Great Seafood | St. Petersburg, FL</title>' +
  '<meta name="description" content="Since 1948, Leverock\'s has been providing quality, value and service.">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
  '<h1>Leverock\'s</h1><p>Call <a href="tel:+17273674588">(727) 367-4588</a></p>' +
  '<p>Hours: Mon–Sun 11:30 AM – 9:00 PM</p><p>840 Pasadena Avenue South, St. Petersburg, FL 33707</p>' +
  '<a href="/st-petersburg-leverock-s-great-seafood-food-menu">Menu</a>' +
  '<a href="/-party?source=pop_up&amp;spot_id=78550&amp;destination=private_parties">Book your party</a>' +
  '<a href="tel:+17273674588">Order</a>' +
  '<div data-ordering-url="https://tmt.spotapps.co/ordering-menu/?spot_id="></div>' +
  '<p>Email us: <a href="mailto:leverocksgreatseafood@gmail.com">leverocksgreatseafood@gmail.com</a></p>' +
  '<form><h3>Join our email list</h3><input type="email" name="email"><button>Sign up</button></form>' +
  '<a href="/gift-cards">Gift Cards</a></body></html>';

function pipeline(html = LEVEROCKS_HTML) {
  const evidence: EvidenceRecordLike[] = normalizeEvidence({
    pages: [extractPage(SITE, SITE, 200, 'text/html', html)],
    failures: [],
    probes: [],
  }).map((e, i) => ({ id: `q${i}`, evidenceType: e.evidenceType, fact: e.fact, supportingContext: e.supportingContext ?? null, confidence: e.confidence }));
  const journey = analyzeJourney(evidence);
  const leaks = rankOpportunities(detectRevenueLeaks({ evidence, journey }));
  const categories = calculateCategoryScores(journey, evidence);
  const overall = calculateOverallScore(categories);
  const owner = generateOwnerReport({
    restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: null, auditStatus: 'COMPLETED', demoMode: false,
    overallScore: overall.overallScore, coverageScore: overall.coverageScore, scoreExplanation: 'x', categories, journey, topLeaks: leaks, evidence,
  });
  const sales = generateSalesBrief({
    restaurantName: "Leverock's Great Seafood", overallScore: overall.overallScore, coverageScore: overall.coverageScore,
    topLeaks: leaks, journey, evidence, recommendedTier: owner.recommendation.tier,
  });
  return { evidence, journey, leaks, categories, overall, owner, sales };
}

const salesText = (s: SalesBriefContent) => Object.values(s).flat().filter((v) => typeof v === 'string').join('\n');

// ── P1: SALES EVIDENCE ACCURACY ─────────────────────────────────────────────

describe('P1: outreach never presents an observed fact as unconfirmed', () => {
  it('the Leverock\'s email does not quote the verified phone number as something it could not confirm', () => {
    const { sales, evidence } = pipeline();
    expect(evidence.some((e) => /A phone number is publicly displayed/.test(e.fact)), 'fixture has the verified number').toBe(true);
    for (const field of [sales.emailOpener, sales.followUpAngle]) {
      expect(field).not.toMatch(/phone number is publicly displayed/i);
      expect(field).not.toMatch(/suggests a phone number/i);
    }
  });

  it('an unverified lead is raised as its open question, in the email and the follow-up', () => {
    const { sales, leaks } = pipeline();
    const lead = leaks.find((l) => /PHONE-DEPENDENT/.test(l.category))!;
    expect(lead.manualValidationRequired).toBe(true);
    const question = lead.title.charAt(0).toLowerCase() + lead.title.slice(1);
    expect(sales.emailOpener).toContain(`could not check from the outside: ${question}`);
    expect(sales.followUpAngle).toContain(lead.title);
    expect(sales.followUpAngle).toMatch(/question/i);
  });

  it('no outreach field pairs "could not confirm" with an evidence fact', () => {
    const { sales } = pipeline();
    expect(sales.emailOpener).not.toMatch(/public evidence suggests .+ — I could not confirm it/i);
  });

  it('a verified lead quotes an observed gap — never a presence signal — chosen by meaning, not position', () => {
    // Evidence attached presence-first, exactly as the PHONE stage orders it.
    const evidence: EvidenceRecordLike[] = [
      { id: 'a', evidenceType: 'PHONE_VISIBILITY', fact: 'A phone number is publicly displayed: (555) 111-2222.', supportingContext: null, confidence: 95 },
      { id: 'b', evidenceType: 'BROKEN_LINK', fact: 'An online ordering link failed when tested (HTTP 404): https://order.example/x', supportingContext: null, confidence: 95 },
    ];
    const verified: RankedOpportunity = {
      category: 'ONLINE ORDERING FAILURE RISK', title: 'The online ordering link is failing', problem: 'OBSERVED: the ordering link returns 404.',
      businessImpact: 'Order-intent customers hit a dead end.', customerJourneyStage: 'ORDERING', evidenceIds: ['a', 'b'],
      impactScore: 90, urgencyScore: 90, confidenceScore: 95, aiFitScore: 20, rescuePriorityScore: 90,
      recommendedSolution: 'Fix the link.', manualValidationRequired: false,
    };
    const sales = generateSalesBrief({ restaurantName: 'Probe Grill', overallScore: 70, coverageScore: 80, topLeaks: [verified], journey: [], evidence, recommendedTier: 'BASIC OPTIMIZATION' });
    expect(sales.emailOpener).toContain('failed when tested');
    expect(sales.emailOpener).not.toMatch(/phone number is publicly displayed/i);
    expect(sales.followUpAngle).toContain('failed when tested');
  });
});

// ── P2: ORDERING LANGUAGE ───────────────────────────────────────────────────

describe('P2: phone-only ordering states what was observed, not a loss', () => {
  it('the ORDERING stage makes no unsupported loss claim', () => {
    const { journey } = pipeline();
    const ordering = journey.find((s) => s.stage === 'ORDERING')!;
    expect(ordering.finding).toMatch(/places a telephone call/i);
    expect(ordering.finding).not.toMatch(/\bare lost\b|\blose\b|\blosing\b|lost revenue|lost orders/i);
    expect(ordering.finding).toMatch(/Not assessed:/);
    expect(ordering.finding).toMatch(/order and call records/i);
  });

  it('the stored-audit fallback path (no channel record) makes no loss claim either', () => {
    const ordering = analyzeJourney([
      { id: 'o1', evidenceType: 'ORDERING_PATH', fact: 'Ordering is offered by telephone: the ordering call-to-action on the website places a phone call rather than opening an online ordering page.', supportingContext: null, confidence: 85 },
    ]).find((s) => s.stage === 'ORDERING')!;
    expect(ordering.finding).not.toMatch(/\bare lost\b|\blose\b|\blosing\b/i);
    expect(ordering.finding).toMatch(/Not assessed:/);
  });

  it('classification and scoring are unchanged by the wording repair', () => {
    // Pinned from main (1434f94) for this exact evidence. This compact page has
    // fewer structured signals than the full Leverock's site, so AI readiness
    // is 60 here (75 on the full site) and the overall is 83 rather than 84;
    // every journey-derived category matches the production re-audit.
    const { journey, categories, overall } = pipeline();
    expect(journey.find((s) => s.stage === 'ORDERING')!.status).toBe('FRICTION');
    expect(Object.fromEntries(categories.map((c) => [c.category, c.score]))).toEqual({
      DIGITAL_CUSTOMER_JOURNEY: 90,
      WEBSITE_CONVERSION: 90,
      PHONE_RESPONSE_READINESS: 90,
      RESERVATION_EXPERIENCE: null,
      ONLINE_ORDERING_EXPERIENCE: 60,
      CUSTOMER_RETENTION: 70,
      REVIEW_REPUTATION_SYSTEM: null,
      LOCAL_DIGITAL_PRESENCE: 100,
      AI_AUTOMATION_READINESS: 60,
    });
    expect(overall.overallScore).toBe(83);
  });
});

// ── P2: ONE REVIEW DURATION ─────────────────────────────────────────────────

describe('P2: one review duration across every output', () => {
  const minutesIn = (text: string) => [...text.matchAll(/(\d+)[- ]minute/gi)].map((m) => Number(m[1]));

  it('the configured review is 20 minutes', () => {
    expect(COMPANY.reviewMinutes).toBe(20);
    expect(minutesIn(COMPANY.nextStepCta)).toEqual([20]);
    expect(minutesIn(COMPANY.ctaHeadline)).toEqual([20]);
  });

  it('the sales brief, email, objection strategy and owner report ask for the same 20 minutes', () => {
    const { sales, owner } = pipeline();
    const asks = [
      ...minutesIn(sales.outreachAngle),
      ...minutesIn(sales.objectionStrategy),
      ...minutesIn(owner.nextStep.cta),
      ...[...sales.emailOpener.matchAll(/Worth (\d+) minutes/g)].map((m) => Number(m[1])),
    ];
    expect(asks.length).toBeGreaterThanOrEqual(4);
    expect(new Set(asks)).toEqual(new Set([20]));
    expect(salesText(sales)).not.toMatch(/\b15[- ]minute|\b15 minutes/i);
  });

  it('the talk-track agenda is contiguous and totals exactly the review length', () => {
    const { sales } = pipeline();
    const blocks = [...sales.talkTrack.matchAll(/MINUTE (\d+)–(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(blocks.length).toBeGreaterThan(3);
    expect(blocks[0][0]).toBe(0);
    for (let i = 1; i < blocks.length; i++) expect(blocks[i][0], `block ${i} starts where ${i - 1} ends`).toBe(blocks[i - 1][1]);
    expect(blocks[blocks.length - 1][1]).toBe(COMPANY.reviewMinutes);
  });

  it('the executive report and PDF book the same review length', async () => {
    const { leaks, journey, evidence } = pipeline();
    const dto = buildExecutiveReport({
      auditId: 'cq1', restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: null, auditDate: '2026-10-26',
      auditStatus: 'COMPLETED', demoMode: false,
      contact: { company: COMPANY.name, consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
      bookingQrDataUrl: null, avgTicket: null, overallScore: 84, coverageScore: 80, sourcesCollected: 1, sourcesFailed: 0,
      evidence: evidence.map((e) => ({ ...e, sourceUrl: SITE })), opportunities: leaks as ExecutiveReportInput['opportunities'],
      journey, categoryScores: [], storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
    });
    expect(minutesIn(dto.cta.headline)).toEqual([20]);
    expect(minutesIn(dto.snapshot.recommendedNextStep)).toEqual([20]);
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const pdf = treeStrings(React.createElement(ExecutivePdf, { dto })).join(' ');
    expect(new Set(minutesIn(pdf))).toEqual(new Set([20]));
  }, 60_000);
});

// ── P3: READABLE STATUS LANGUAGE ────────────────────────────────────────────

describe('P3: no raw status codes in sales outreach or client-facing material', () => {
  const RAW_CODE = /\b(VERIFIED|STRONG_EVIDENCE|INFERRED|MANUAL_VALIDATION_REQUIRED|INSUFFICIENT_DATA|PHONE_ORDERING_ONLY|ONLINE_ORDERING_[A-Z_]+|THIRD_PARTY_ORDERING|DESTINATION_RESOLVED)\b|\b[A-Z]{3,}_[A-Z_]{3,}\b/;

  it('the sales brief speaks in plain language', () => {
    const { sales } = pipeline();
    for (const [field, value] of Object.entries(sales)) {
      if (field === 'priority' || field === 'painLevel') continue; // machine-readable statuses kept for internal logic
      const text = Array.isArray(value) ? value.join(' ') : String(value);
      expect(text, field).not.toMatch(RAW_CODE);
    }
    expect(sales.talkTrack).toMatch(/not confirmed/i);
  });

  it('the machine-readable statuses are preserved for internal logic', () => {
    const { sales } = pipeline();
    expect(['HOT', 'WARM', 'NURTURE', 'LOW_PRIORITY']).toContain(sales.priority);
  });

  it('the client PDF and report show readable evidence labels, not internal type codes', async () => {
    const { leaks, journey, evidence } = pipeline();
    const dto = buildExecutiveReport({
      auditId: 'cq2', restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: null, auditDate: '2026-10-26',
      auditStatus: 'COMPLETED', demoMode: false,
      contact: { company: COMPANY.name, consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
      bookingQrDataUrl: null, avgTicket: null, overallScore: 84, coverageScore: 80, sourcesCollected: 1, sourcesFailed: 0,
      evidence: evidence.map((e) => ({ ...e, sourceUrl: SITE })), opportunities: leaks as ExecutiveReportInput['opportunities'],
      journey, categoryScores: [], storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
    });
    // The stored evidence keeps its machine codes; only the presentation changes.
    expect(evidence.some((e) => e.evidenceType === 'ORDERING_CHANNEL' && /PHONE_ORDERING_ONLY/.test(e.fact))).toBe(true);
    for (const row of dto.appendix) {
      // The machine code is kept for internal logic; the client reads the label.
      expect(row.evidenceLabel, row.evidenceType).not.toMatch(RAW_CODE);
      expect(row.fact).not.toMatch(RAW_CODE);
      expect(row.supportingContext ?? '').not.toMatch(RAW_CODE);
    }
    expect(dto.appendix.find((r) => r.evidenceType === 'CLICK_TO_CALL')?.evidenceLabel).toBe('Tap to call');
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const pdf = treeStrings(React.createElement(ExecutivePdf, { dto })).join(' ');
    expect(pdf).not.toMatch(RAW_CODE);
  }, 60_000);

  it('ordering-channel evidence reads as words, and the stored text is not altered', async () => {
    const { presentEvidenceText, evidenceTypeLabel } = await import('@/lib/reports/executive');
    const stored = 'ORDERING CHANNEL: PHONE_ORDERING_ONLY [DESTINATION_RESOLVED] — The ordering call-to-action places a telephone call.';
    expect(presentEvidenceText(stored)).toBe('The ordering call-to-action places a telephone call.');
    expect(presentEvidenceText('A tel: link, not a web destination. Evidence confidence: VERIFIED.')).toBe(
      'A tel: link, not a web destination. Evidence: verified from public evidence.',
    );
    expect(evidenceTypeLabel('CLICK_TO_CALL')).toBe('Tap to call');
    expect(evidenceTypeLabel('SOMETHING_NEW')).toBe('Something new');
    expect(stored).toContain('PHONE_ORDERING_ONLY');
  });

  it('the Leverock\'s 30-day plan asserts no leak or loss that was not verified', () => {
    const { leaks, journey, evidence } = pipeline();
    const dto = buildExecutiveReport({
      auditId: 'cq3', restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: null, auditDate: '2026-10-26',
      auditStatus: 'COMPLETED', demoMode: false,
      contact: { company: COMPANY.name, consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
      bookingQrDataUrl: null, avgTicket: null, overallScore: 84, coverageScore: 80, sourcesCollected: 1, sourcesFailed: 0,
      evidence: evidence.map((e) => ({ ...e, sourceUrl: SITE })), opportunities: leaks as ExecutiveReportInput['opportunities'],
      journey, categoryScores: [], storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
    });
    const plan = JSON.stringify(dto.thirtyDayPlan);
    expect(dto.findings.some((f) => f.classification === 'VERIFIED FINDING')).toBe(false);
    expect(plan).not.toMatch(/\bleak/i);
    expect(plan).not.toMatch(/\bare lost\b|\bis lost\b/i);
  });

  it('the only 80% in the outputs is audit coverage, never an AI performance claim', () => {
    const { sales, owner } = pipeline();
    expect(salesText(sales)).not.toMatch(/\d+\s?%/);
    expect(JSON.stringify(owner)).not.toMatch(/handles? the repetitive \d+\s?%|\d+\s?% of (calls|repetitive)/i);
  });
});

/** Every string in the PDF element tree (components rendered, render props skipped). */
function treeStrings(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || node === false) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) treeStrings(child, out);
    return out;
  }
  const element = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof element.type === 'function') return treeStrings((element.type as (p: unknown) => unknown)(element.props ?? {}), out);
  if (element.props && 'children' in element.props) treeStrings(element.props.children, out);
  return out;
}
