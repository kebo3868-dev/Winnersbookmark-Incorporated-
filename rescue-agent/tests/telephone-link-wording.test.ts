/**
 * A tel: LINK IS NOT A PLACED CALL.
 *
 * The audit reads the Leverock's "Order" button under "ORDER ONLINE" and finds
 * a tel: link. That is all it establishes. The report said the button "places
 * a telephone call", the title said it "opens a phone call", and the sales
 * brief asked about a button that "places a phone call". A tel: link can open
 * the phone's calling function; whether a call is placed depends on what the
 * visitor does next, which the audit never sees — it reads the link and never
 * taps it.
 *
 * These tests fail if any generated report text, or any stored audit shown
 * today, claims a call was placed solely because a tel: link was detected.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import zlib from 'node:zlib';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { presentOrderingText, resolveOrderingChannel } from '@/lib/audit/orderingChannel';
import { evidenceBasisFor, evidenceBasisRows } from '@/lib/audit/evidenceBasis';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { rankOpportunities } from '@/lib/scoring/priority';
import { generateOwnerReport } from '@/lib/reports/owner';
import { generateSalesBrief } from '@/lib/reports/sales';
import { buildExecutiveReport, presentEvidenceText, type ExecutiveReportInput } from '@/lib/reports/executive';
import { COMPANY } from '@/lib/config';

const SITE = 'https://leverocks.example/';
const MARKUP = 'https://tmt.spotapps.co/ordering-menu/?spot_id=';
const CATEGORY = 'ORDER BUTTON LABEL MISMATCH';
const REQUIRED =
  'The "Order" button under "ORDER ONLINE" uses a telephone link that can open the phone\'s calling function rather ' +
  'than directing customers to an online checkout.';
/** Any wording that says or implies a call was placed, offered or dialled. */
const CALL_CLAIM =
  /\b(places?|placed|placing|makes?|made|starts?|started|opens?|opened) an? (tele)?phone call\b|\boffered a phone call\b|\bhanded a phone call\b|\bcalls? (is|was|were) placed\b|\bdials?\b|\bdialled\b/i;
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

/** Every string a client reads in the web report and PDF. */
function clientText(dto: ReturnType<typeof buildExecutiveReport>): string {
  return [
    dto.executiveSummary,
    ...dto.snapshot.priorities.flatMap((p) => [p.title, p.summary, p.validationRequired]),
    ...dto.findings.flatMap((f) => [
      f.title, f.problem, f.whyItMatters, f.commercialEffect, ...f.whatWeKnow, f.whatWeDoNotKnow, f.recommendedAction,
      ...(f.evidenceBasis ? evidenceBasisRows(f.evidenceBasis).flat() : []),
    ]),
    ...dto.journeyMap.flatMap((s) => [s.note, s.limitation ?? '']),
    ...dto.thirtyDayPlan.flatMap((p) => p.actions),
    ...dto.appendix.flatMap((e) => [e.fact, e.supportingContext ?? '']),
  ].join('\n');
}

const salesText = (sales: ReturnType<typeof generateSalesBrief>) =>
  Object.values(sales).flatMap((v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])).join('\n');

async function pdfText(dto: ReturnType<typeof buildExecutiveReport>): Promise<string> {
  const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
  const { renderToBuffer } = await import('@react-pdf/renderer');
  type PdfElement = Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(React.createElement(ExecutivePdf, { dto }) as unknown as PdfElement);
  const latin = pdf.toString('latin1');
  const runs: string[] = [];
  for (const match of latin.matchAll(/stream\r?\n/g)) {
    const start = match.index! + match[0].length;
    let data = pdf.subarray(start, latin.indexOf('endstream', start));
    try {
      data = zlib.inflateSync(data);
    } catch {
      continue;
    }
    for (const run of data.toString('latin1').matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const hex = [...run[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => h[1]).join('');
      const step = hex.length > 0 && /^(00[0-9a-fA-F]{2})+$/.test(hex) ? 4 : 2;
      let text = '';
      for (let i = 0; i < hex.length; i += step) text += String.fromCharCode(parseInt(hex.slice(i, i + step), 16));
      runs.push(text);
    }
  }
  return runs.join(' ').replace(/\s+/g, ' ');
}

// ── NEW AUDITS ───────────────────────────────────────────────────────────────

describe('a new audit never claims a call was placed because a tel: link was found', () => {
  for (const [name, section] of [['labelled "ORDER ONLINE"', LABELLED], ['unlabelled', UNLABELLED]] as const) {
    it(`${name}: evidence, journey, findings, report and sales brief`, () => {
      const { evidence, journey, leaks, dto, sales } = pipeline(section);
      for (const e of evidence) expect(`${e.fact} ${e.supportingContext ?? ''}`, e.evidenceType).not.toMatch(CALL_CLAIM);
      for (const s of journey) expect(s.finding, s.stage).not.toMatch(CALL_CLAIM);
      for (const l of leaks) expect([l.title, l.problem, l.businessImpact, l.recommendedSolution].join(' '), l.category).not.toMatch(CALL_CLAIM);
      expect(clientText(dto)).not.toMatch(CALL_CLAIM);
      expect(salesText(sales)).not.toMatch(CALL_CLAIM);
    });
  }

  it('the labelled button is described in exactly the required words, everywhere it is stated', () => {
    const { dto, evidence } = pipeline();
    const card = dto.findings.find((f) => f.category === CATEGORY)!;
    expect(card.title).toBe('The online ordering button uses a telephone link instead of an online checkout');
    expect(card.problem).toBe(REQUIRED);
    expect(dto.snapshot.priorities[0].summary).toBe(REQUIRED);
    expect(dto.journeyMap.find((s) => s.stage === 'ORDERING')!.note).toBe(REQUIRED);
    expect(evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.fact).toContain(REQUIRED);
    expect(dto.executiveSummary).toMatch(/the online ordering button uses a telephone link instead of an online checkout/);
  });

  it('the PDF says the same, and nothing about a placed call', async () => {
    const { dto } = pipeline();
    const text = await pdfText(dto);
    const squash = (s: string) => s.replace(/\s+/g, '');
    // Quotes and the apostrophe are matched loosely: the extractor decodes them byte-wise.
    expect(squash(text)).toMatch(/usesatelephonelinkthatcanopenthephone.scallingfunctionratherthandirectingcustomerstoanonlinecheckout\./);
    expect(text).toContain('The online ordering button uses a telephone link');
    expect(text).not.toMatch(CALL_CLAIM);
  }, 30000);
});

// ── NOT BROKEN: THE MISMATCH IS THE ISSUE ───────────────────────────────────

describe('the button is not called broken; the label/destination mismatch is the issue', () => {
  const { dto, evidence } = pipeline();
  const card = dto.findings.find((f) => f.category === CATEGORY)!;

  it('phone ordering is allowed to be intentional, and the mismatch is named', () => {
    expect(card.whyItMatters).toMatch(/Ordering by phone may be intentional; the mismatch between the label and the destination is what needs a decision\./);
    const channel = evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;
    expect(channel.fact).toContain('ordering by phone may be intentional, so the mismatch is what needs checking.');
  });

  it('no ordering text calls the button broken or failing', () => {
    const ordering = [card.title, card.problem, card.whyItMatters, card.recommendedAction, ...card.whatWeKnow].join(' ');
    expect(ordering).not.toMatch(/\bbroken\b|\bfail(s|ed|ing|ure)?\b|\bdead end\b/i);
    expect(evidence.filter((e) => e.evidenceType === 'BROKEN_LINK')).toEqual([]);
  });
});

// ── AUTOMATED VS MANUAL ─────────────────────────────────────────────────────

describe('automated evidence and manual validation stay separate', () => {
  it('the automated layer reads the link; tapping it is a separate manual check', () => {
    const rows = evidenceBasisRows(evidenceBasisFor(CATEGORY)!);
    expect(rows.map(([label]) => label)).toEqual(['Automated finding', 'Manual check', 'Not measured']);
    expect(rows[0][1]).toMatch(/telephone \(tel:\) link\. The automated audit reads links; it does not tap buttons\./);
    expect(rows[1][1]).toMatch(/^Tapping the button on a phone is a manual check, separate from this automated audit\./);
  });

  it('the channel record says what the automated check did', () => {
    const result = resolveOrderingChannel({
      phoneOrderCtas: ['Order'], onlineLabelledPhoneCtas: [{ text: 'Order', label: 'ORDER ONLINE' }], destinations: [], probes: [], widgetVendor: null,
    });
    expect(result.summary.startsWith(REQUIRED)).toBe(true);
    expect(result.detail).toMatch(/The automated audit reads links and does not tap buttons/);
    expect(`${result.summary} ${result.detail}`).not.toMatch(CALL_CLAIM);
  });
});

// ── STORED AUDITS ───────────────────────────────────────────────────────────

describe('an audit stored with the old wording is shown without the claim, and its records are not rewritten', () => {
  const OLD_FACT =
    'ORDERING CHANNEL: PHONE_ORDERING_ONLY [ONLINE_LABEL_OPENS_PHONE] — The "Order" button in the section labelled ' +
    '"ORDER ONLINE" places a telephone call instead of opening an online ordering page or checkout. A visitor who chose ' +
    'to order online is offered a phone call instead. Whether online ordering exists somewhere this audit did not reach ' +
    'is not established either way.';

  it('rewrites each stored sentence in presentation only', () => {
    expect(presentOrderingText(OLD_FACT)).toContain(REQUIRED);
    expect(presentOrderingText(OLD_FACT)).not.toMatch(CALL_CLAIM);
    expect(presentOrderingText('The ordering button labelled "Order Online" places a telephone call instead of opening an online ordering page or checkout.'))
      .toBe('The ordering button labelled "Order Online" uses a telephone link that can open the phone\'s calling function rather than directing customers to an online checkout.');
    expect(presentOrderingText('Ordering is offered by telephone: the ordering call-to-action on the website places a phone call rather than opening an online ordering page.'))
      .not.toMatch(CALL_CLAIM);
    expect(presentOrderingText('The online ordering button opens a phone call instead of an online checkout'))
      .toBe('The online ordering button uses a telephone link instead of an online checkout');
    expect(presentOrderingText("Your website's online ordering button places a phone call — is online ordering meant to be offered, or is ordering by phone the plan?"))
      .toBe("Your website's online ordering button uses a phone link — is online ordering meant to be offered, or is ordering by phone the plan?");
    // Unrelated text is left alone.
    expect(presentOrderingText('Call us at (727) 367-4588 to book a table.')).toBe('Call us at (727) 367-4588 to book a table.');
  });

  it('a whole stored report renders without the claim, from unmodified stored records', () => {
    const { input } = pipeline();
    const old: ExecutiveReportInput = {
      ...input,
      evidence: input.evidence.map((e) => (e.evidenceType === 'ORDERING_CHANNEL' ? { ...e, fact: OLD_FACT } : e)),
      opportunities: input.opportunities.map((o) =>
        o.category === CATEGORY
          ? { ...o, title: 'The online ordering button opens a phone call instead of an online checkout', problem: `VERIFIED IN THE PAGE MARKUP: ${OLD_FACT}` }
          : o,
      ),
      journey: input.journey.map((s) =>
        s.stage === 'ORDERING' ? { ...s, finding: 'The "Order" button in the section labelled "ORDER ONLINE" places a telephone call instead of opening an online ordering page or checkout.' } : s,
      ),
    };
    const snapshot = JSON.stringify(old);
    const dto = buildExecutiveReport(old);
    expect(clientText(dto)).not.toMatch(CALL_CLAIM);
    expect(dto.findings.find((f) => f.category === CATEGORY)!.problem).toBe(REQUIRED);
    expect(JSON.stringify(old)).toBe(snapshot); // the stored records are not mutated
    expect(presentEvidenceText(OLD_FACT).startsWith(REQUIRED)).toBe(true);
  });
});

// ── NOTHING THAT SCORES OR RANKS MOVES ──────────────────────────────────────

describe('scoring, confidence and priority are unchanged', () => {
  it('the finding keeps its scores and the audit keeps the values pinned from main', () => {
    const { leaks, overall, evidence } = pipeline();
    expect(leaks.find((l) => l.category === CATEGORY)).toMatchObject({
      impactScore: 60, urgencyScore: 55, confidenceScore: 78, aiFitScore: 15, manualValidationRequired: false,
    });
    expect([overall.overallScore, overall.coverageScore]).toEqual([80, 80]);
    expect(evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.confidence).toBe(90);
  });
});
