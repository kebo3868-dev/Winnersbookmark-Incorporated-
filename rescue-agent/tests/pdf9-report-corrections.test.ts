/**
 * PDF #9 corrections (PR #77): Decision box, page-10 diagnosis, the 30-day
 * plan, the clickable telephone link and appendix pagination.
 *
 * The Leverock's pipeline below is the same fixture as
 * telephone-link-wording.test.ts: an "Order" button under "ORDER ONLINE" whose
 * href is a tel: link, run through the real collector, journey, leak, scoring
 * and report code.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { ORDER_BUTTON_CATEGORY } from '@/lib/audit/orderButtonFinding';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { rankOpportunities } from '@/lib/scoring/priority';
import { generateOwnerReport } from '@/lib/reports/owner';
import { generateSalesBrief } from '@/lib/reports/sales';
import { buildExecutiveReport, telHref, type ExecutiveReportInput } from '@/lib/reports/executive';
import { chunk, planPhaseStaysWhole } from '@/lib/pdf/ExecutivePdf';
import { COMPANY } from '@/lib/config';

const SITE = 'https://leverocks.example/';
const MARKUP = 'https://tmt.spotapps.co/ordering-menu/?spot_id=';
/** Any wording that says or implies a call was placed, offered or dialled. */
const FILLER = `<footer><p>${'Fresh Gulf seafood since 1948, served on Pasadena Avenue. '.repeat(12)}</p></footer>`;
const page = (section: string) =>
  '<html><head><title>Leverock\'s Great Seafood | St. Petersburg, FL</title>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
  '<h1>Leverock\'s</h1><p>Call <a href="tel:+17273674588">(727) 367-4588</a></p>' +
  '<p>Hours: Mon–Sun 11:30 AM – 9:00 PM</p><p>840 Pasadena Avenue South, St. Petersburg, FL 33707</p>' +
  `<a href="/st-petersburg-leverock-s-great-seafood-food-menu">Menu</a>${section}` +
  `<div data-ordering-url="${MARKUP}"></div>` +
  `<a href="/gift-cards">Gift Cards</a>${FILLER}</body></html>`;
const LABELLED = '<section class="order"><h2>ORDER ONLINE</h2><a class="btn" href="tel:+17273674588">Order</a></section>';
const UNLABELLED = '<section class="order"><a class="btn" href="tel:+17273674588">Order</a></section>';
const probes: ProbeResult[] = [
  { url: `${SITE}st-petersburg-leverock-s-great-seafood-food-menu`, category: 'menu', ok: true, httpStatus: 200, note: 'HTTP 200', exposedInCustomerJourney: true },
  { url: MARKUP, category: 'ordering', ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP', exposedInCustomerJourney: false },
];

function pipeline(section = LABELLED) {
  const evidence = normalizeEvidence({ pages: [extractPage(SITE, SITE, 200, 'text/html', page(section))], failures: [], probes }).map(
    (e, i) => ({ id: `t${i}`, evidenceType: e.evidenceType, fact: e.fact, supportingContext: e.supportingContext ?? null, confidence: e.confidence, sourceUrl: e.sourceUrl ?? null }),
  );
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
  const input: ExecutiveReportInput = {
    auditId: 'ctel000001', restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: 'St. Petersburg, FL',
    auditDate: '2026-11-01', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: COMPANY.name, consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: overall.overallScore, coverageScore: overall.coverageScore,
    sourcesCollected: 1, sourcesFailed: 0, evidence, opportunities: leaks, journey, categoryScores: categories,
    storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
  };
  return { evidence, journey, leaks, categories, overall, sales, input, dto: buildExecutiveReport(input) };
}


const source = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
/** Claims a public audit cannot make: measured missed calls, lost revenue, conversion failures. */
const INVENTED_OUTCOME =
  /\b(\d+ missed calls|missed calls (were|are) (found|measured|detected)|lost (revenue|orders|sales)|losing (revenue|orders)|revenue (loss|leak)|conversion (failure|failed)|customers (are|were) (lost|abandoning))\b/i;

describe('Decision box: a pilot is conditional on demand AND readiness', () => {
  const { dto } = pipeline();
  const implement = dto.decisionBox.implement;

  it('no unconditional deploy instruction remains', () => {
    expect(implement.heading).toBe('PILOT IF READY');
    expect(`${implement.heading} ${implement.detail} ${implement.benefit}`).not.toMatch(/\bdeploy/i);
  });

  it('names every condition — demand, readiness and safety, owner approval — joined by AND, and the no-change outcome', () => {
    expect(implement.detail).toMatch(/only if validation confirms the demand AND it passes its own independent readiness and safety tests AND you approve it\./);
    expect(implement.detail).toMatch(/Otherwise, make no automation change\.$/);
    expect(implement.benefit).toMatch(/^If piloted: a limited, monitored workflow/);
  });

  it('the 30-day plan and the prescription say the same thing', () => {
    const plan = dto.thirtyDayPlan.find((p) => p.phase === 'DAYS 15–21')!;
    expect(plan.heading).toBe('DECIDE & PILOT IF READY');
    expect(plan.actions.join(' ')).toMatch(/passes its own readiness and safety checks/);
    expect(plan.actions.join(' ')).toMatch(/make no automation change/);
    // Anywhere an automation is mentioned in the client report, no deploy instruction.
    const text = JSON.stringify({ plan: dto.thirtyDayPlan, decision: dto.decisionBox, prescription: dto.prescription });
    expect(text).not.toMatch(/\bdeploy/i);
  });

  it('with no automation candidate the plan still requires readiness and offers no change', () => {
    const { input } = pipeline();
    const none = buildExecutiveReport({ ...input, opportunities: input.opportunities.map((o) => ({ ...o, aiFitScore: 10 })) });
    const plan = none.thirtyDayPlan.find((p) => p.phase === 'DAYS 15–21')!;
    expect(plan.actions.join(' ')).toMatch(/readiness and safety checks/);
    expect(plan.actions.join(' ')).toMatch(/make no automation change/);
  });
});

describe('page-10 diagnosis: observed link (Strong) versus unverified outcome', () => {
  const { dto } = pipeline();
  const primary = dto.findings[0];

  it('the order-button finding is the top finding in this fixture, with Strong observed evidence', () => {
    expect(primary.category).toBe(ORDER_BUTTON_CATEGORY);
    expect(primary.labels.observedEvidence).toBe('Strong');
  });

  it('states what was directly observed, at its evidence strength', () => {
    const [observed] = dto.prescription.diagnosisBasis;
    expect(observed.label).toBe('Directly observed in the page markup (Strong evidence)');
    expect(observed.text).toMatch(/is a telephone \(tel:\) link, not a link to an online checkout/);
  });

  it('states separately what is not verified and needs the owner', () => {
    const [, unverified] = dto.prescription.diagnosisBasis;
    expect(unverified.label).toBe('Not verified — requires owner confirmation');
    expect(unverified.text).toMatch(/whether ordering by phone is the intended method/i);
    expect(unverified.text).toMatch(/what customers do after selecting the button/);
    expect(unverified.text).toMatch(/any effect on orders or revenue/);
  });

  it('does not call the observed link an open question, and invents no outcome', () => {
    const all = [dto.prescription.diagnosis, ...dto.prescription.diagnosisBasis.flatMap((r) => [r.label, r.text])].join(' ');
    expect(dto.prescription.diagnosis).toMatch(/Highest-priority finding: The online ordering button uses a telephone link/);
    expect(dto.prescription.diagnosis).not.toMatch(/open question|verified finding/i);
    expect(all).not.toMatch(INVENTED_OUTCOME);
  });

  it('the finding\'s classification is unchanged — still manual validation, not verified', () => {
    expect(primary.classification).not.toBe('VERIFIED FINDING');
  });

  it('the web report prints the same labelled lines', () => {
    expect(source('src/app/audits/[auditId]/report/page.tsx')).toMatch(/dto\.prescription\.diagnosisBasis\.map/);
  });
});

describe('the contact telephone number is a working tel: link', () => {
  it('normalises displayed numbers to an E.164 tel: URI', () => {
    expect(telHref('727-291-5965')).toBe('tel:+17272915965');
    expect(telHref('(727) 291-5965')).toBe('tel:+17272915965');
    expect(telHref('1-727-291-5965')).toBe('tel:+17272915965');
    expect(telHref('+44 20 7946 0958')).toBe('tel:+442079460958');
    expect(telHref('Call us')).toBeNull();
    expect(telHref('12')).toBeNull();
  });

  it('the DTO carries the link for the configured phone', () => {
    expect(pipeline().dto.cta.phoneHref).toBe('tel:+17272915965');
  });

  it('the rendered PDF has a link annotation targeting it', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const { renderToBuffer } = await import('@react-pdf/renderer');
    type PdfElement = Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(React.createElement(ExecutivePdf, { dto: pipeline().dto }) as unknown as PdfElement);
    const raw = buffer.toString('latin1');
    expect(raw).toMatch(/\/Subtype \/Link/);
    expect(raw).toContain('/URI (tel:+17272915965)');
  }, 60_000);

  it('the web report links the same number', () => {
    expect(source('src/app/audits/[auditId]/report/page.tsx')).toMatch(/href=\{dto\.cta\.phoneHref\}/);
  });
});

describe('PDF pagination helpers', () => {
  it('appendix groups never end with a short final group', () => {
    for (let n = 1; n <= 30; n++) {
      const groups = chunk(Array.from({ length: n }, (_, i) => i), 2);
      expect(groups.flat()).toEqual(Array.from({ length: n }, (_, i) => i));
      if (groups.length > 1) expect(groups[groups.length - 1].length, `n=${n}`).toBeGreaterThanOrEqual(2);
      expect(Math.max(...groups.map((g) => g.length)), `n=${n}`).toBeLessThanOrEqual(3);
    }
  });

  it('short plan phases stay whole; long ones may break between bullets', () => {
    expect(planPhaseStaysWhole({ actions: ['Track: Missed calls per week.'] })).toBe(true);
    expect(planPhaseStaysWhole({ actions: Array.from({ length: 4 }, () => 'x'.repeat(250)) })).toBe(false);
  });
});
