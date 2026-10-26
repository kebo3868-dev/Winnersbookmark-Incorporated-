/**
 * ORDERING REPORT REPAIR — a button presented as online ordering that places a
 * phone call.
 *
 * Confirmed by hand on Leverock's live site (Android, October 26, 2026): the
 * "ORDER" button in the "ORDER ONLINE" section opened the phone-app chooser,
 * not a checkout. The audit already classified ordering as FRICTION and scored
 * it correctly, but it read only the button's own text ("Order"), so it never
 * saw the "Order Online" label. The report then called the button "a
 * legitimate ordering pathway" and raised no finding about the mismatch.
 *
 * What these tests pin:
 *   - the mismatch is detected from the button's section, with guards against
 *     reading a label that is not the button's;
 *   - it is reported as an OBSERVED website-experience issue, from automated
 *     evidence, with no lost orders, conversion rate or revenue claimed;
 *   - status, category scores and the Rescue Score do not move;
 *   - facts stored before this repair read exactly as they did;
 *   - the executive report, the PDF and the sales brief say the same thing.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import zlib from 'node:zlib';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import {
  formatOrderingChannelFact,
  ORDERING_CHANNEL_HEAD,
  parseOrderingChannelFact,
  resolveOrderingChannel,
  type OrderingChannelInput,
} from '@/lib/audit/orderingChannel';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { rankOpportunities } from '@/lib/scoring/priority';
import { generateOwnerReport } from '@/lib/reports/owner';
import { generateSalesBrief, type SalesBriefContent } from '@/lib/reports/sales';
import { buildExecutiveReport, presentEvidenceText } from '@/lib/reports/executive';
import { STATE_PLAIN, stateForOpportunity } from '@/lib/audit/evidenceState';
import { COMPANY } from '@/lib/config';
import type { EvidenceRecordLike } from '@/types/audit';

const SITE = 'https://leverocks.example/';
const CATEGORY = 'ORDER BUTTON LABEL MISMATCH';

/** Claims this finding may never make: the audit sees no orders, calls or revenue. */
const LOSS_CLAIM =
  /\blost\b|\blose\b|\blosing\b|\bloss(es)?\b|conversion rate|\brevenue (impact|leak)|missed orders|dead end|\bbroken\b|\bfailing\b|\bfailure\b/i;

/** Long enough that <body> is never mistaken for the button's section. */
const FILLER = `<footer><p>${'Fresh Gulf seafood since 1948, served on Pasadena Avenue. '.repeat(12)}</p></footer>`;

/** The Leverock's homepage as the audit sees it, with the order button in its "ORDER ONLINE" section. */
const leverocks = (orderSection: string) =>
  '<html><head><title>Leverock\'s Great Seafood | St. Petersburg, FL</title>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
  '<h1>Leverock\'s</h1><p>Call <a href="tel:+17273674588">(727) 367-4588</a></p>' +
  '<p>Hours: Mon–Sun 11:30 AM – 9:00 PM</p><p>840 Pasadena Avenue South, St. Petersburg, FL 33707</p>' +
  '<a href="/st-petersburg-leverock-s-great-seafood-food-menu">Menu</a>' +
  '<a href="/-party?source=pop_up&amp;spot_id=78550&amp;destination=private_parties">Book your party</a>' +
  orderSection +
  '<div data-ordering-url="https://tmt.spotapps.co/ordering-menu/?spot_id="></div>' +
  '<p>Email us: <a href="mailto:leverocksgreatseafood@gmail.com">leverocksgreatseafood@gmail.com</a></p>' +
  '<form><h3>Join our email list</h3><input type="email" name="email"><button>Sign up</button></form>' +
  `<a href="/gift-cards">Gift Cards</a>${FILLER}</body></html>`;

const LABELLED = leverocks(
  '<section class="order"><div class="inner"><h2>ORDER ONLINE</h2><p>Fresh seafood to go.</p>' +
    '<a class="btn" href="tel:+17273674588">ORDER</a></div></section>',
);
/** The same button with nothing presenting it as online ordering. */
const UNLABELLED = leverocks('<section class="order"><a class="btn" href="tel:+17273674588">ORDER</a></section>');

const page = (html: string) => extractPage(SITE, SITE, 200, 'text/html', html);

function pipeline(html: string) {
  const evidence = normalizeEvidence({ pages: [page(html)], failures: [], probes: [] }).map((e, i) => ({
    id: `o${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    supportingContext: e.supportingContext ?? null,
    confidence: e.confidence,
    sourceUrl: e.sourceUrl ?? null,
  }));
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
  const executive = buildExecutiveReport({
    auditId: 'corderlabel01', restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: 'St. Petersburg, FL',
    auditDate: '2026-10-26', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: COMPANY.name, consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: overall.overallScore, coverageScore: overall.coverageScore,
    sourcesCollected: 1, sourcesFailed: 0, evidence, opportunities: leaks, journey, categoryScores: categories,
    storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
  });
  return { evidence, journey, leaks, categories, overall, sales, executive };
}

const channelOf = (evidence: EvidenceRecordLike[]) => evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;
const salesText = (s: SalesBriefContent) => Object.values(s).flat().filter((v) => typeof v === 'string').join('\n');

// ── DETECTION ───────────────────────────────────────────────────────────────

describe('detecting a phone ordering button presented as online ordering', () => {
  it('reads the "ORDER ONLINE" section label over an "ORDER" button that dials', () => {
    expect(page(LABELLED).onlineLabelledPhoneCtas).toEqual([{ text: 'ORDER', label: 'ORDER ONLINE' }]);
  });

  it('reads online-ordering wording on the button itself, and in its accessible name', () => {
    expect(page(`<a href="tel:+17275551234">Order Online</a>${FILLER}`).onlineLabelledPhoneCtas).toEqual([
      { text: 'Order Online', label: 'Order Online' },
    ]);
    expect(page(`<a href="tel:+17275551234" aria-label="Online ordering">Order</a>${FILLER}`).onlineLabelledPhoneCtas).toEqual([
      { text: 'Order', label: 'Online ordering' },
    ]);
  });

  it('does not flag a phone ordering button that is labelled as phone ordering', () => {
    const html = `<section><h2>Order by Phone</h2><a href="tel:+17275551234">Call to Order</a></section>${FILLER}`;
    expect(page(html).phoneOrderCtas).toEqual(['Call to Order']);
    expect(page(html).onlineLabelledPhoneCtas).toEqual([]);
    expect(page(UNLABELLED).onlineLabelledPhoneCtas).toEqual([]);
  });

  it('does not borrow "Order Online" from a real online ordering link beside the phone button', () => {
    // Two routes, each doing what it says — not a mislabelled button.
    const html =
      '<div><a href="https://order.toasttab.com/leverocks">Order Online</a> <a href="tel:+17275551234">Call to Order</a></div>' +
      FILLER;
    expect(page(html).phoneOrderCtas).toEqual(['Call to Order']);
    expect(page(html).onlineLabelledPhoneCtas).toEqual([]);
  });

  it('does not read a sentence that mentions online ordering as the button\'s label', () => {
    const html = `<div><p>Order online at our website or call us to order.</p><a href="tel:+17275551234">Order</a></div>${FILLER}`;
    expect(page(html).onlineLabelledPhoneCtas).toEqual([]);
  });

  it('does not reach a label in a different part of the page', () => {
    const html =
      `<section><h2>Order Online</h2><p>${'Our full menu is available for pickup every day. '.repeat(10)}</p></section>` +
      `<section><div><p>Questions?</p><a href="tel:+17275551234">Order</a></div></section>${FILLER}`;
    expect(page(html).phoneOrderCtas).toEqual(['Order']);
    expect(page(html).onlineLabelledPhoneCtas).toEqual([]);
  });

  it('ignores a contact link under an "Order Online" label: no ordering wording, no ordering button', () => {
    const html = `<section><h2>Order Online</h2><a href="tel:+17275551234">Call Us</a></section>${FILLER}`;
    expect(page(html).phoneOrderCtas).toEqual([]);
    expect(page(html).onlineLabelledPhoneCtas).toEqual([]);
  });
});

// ── EVIDENCE MARKER AND STORED RECORDS ──────────────────────────────────────

describe('the channel marker', () => {
  const base: OrderingChannelInput = { phoneOrderCtas: ['ORDER'], destinations: [], probes: [], widgetVendor: null };

  it('round-trips the new flag alongside the existing one', () => {
    const result = resolveOrderingChannel({
      ...base,
      onlineLabelledPhoneCtas: [{ text: 'ORDER', label: 'ORDER ONLINE' }],
      destinations: [{ url: 'https://tmt.spotapps.co/ordering-menu/?spot_id=', exposedInCustomerJourney: true, platform: 'SpotHopper', host: 'tmt.spotapps.co' }],
    });
    const fact = formatOrderingChannelFact(result);
    expect(fact.startsWith('ORDERING CHANNEL: PHONE_ORDERING_ONLY [DESTINATION_RESOLVED] [ONLINE_LABEL_OPENS_PHONE] — ')).toBe(true);
    expect(parseOrderingChannelFact(fact)).toEqual({ state: 'PHONE_ORDERING_ONLY', destinationResolved: true, onlineLabelOpensPhone: true });
  });

  it('parses facts stored before the flag existed exactly as before', () => {
    expect(parseOrderingChannelFact('ORDERING CHANNEL: PHONE_ORDERING_ONLY [DESTINATION_RESOLVED] — x')).toEqual({
      state: 'PHONE_ORDERING_ONLY', destinationResolved: true, onlineLabelOpensPhone: false,
    });
    expect(parseOrderingChannelFact('ORDERING CHANNEL: ORDERING_PATH_UNCLEAR — x')).toEqual({
      state: 'ORDERING_PATH_UNCLEAR', destinationResolved: false, onlineLabelOpensPhone: false,
    });
  });

  it('never shows a flag to a reader', () => {
    const fact = 'ORDERING CHANNEL: PHONE_ORDERING_ONLY [DESTINATION_RESOLVED] [ONLINE_LABEL_OPENS_PHONE] — The button places a call.';
    expect(fact.replace(ORDERING_CHANNEL_HEAD, '')).toBe('The button places a call.');
    expect(presentEvidenceText(fact)).toBe('The button places a call.');
    expect(presentEvidenceText('Context [ONLINE_LABEL_OPENS_PHONE] here.')).toBe('Context here.');
  });

  it('describes the mismatch as observed, and separates automated evidence from manual confirmation', () => {
    const result = resolveOrderingChannel({ ...base, onlineLabelledPhoneCtas: [{ text: 'ORDER', label: 'ORDER ONLINE' }] });
    expect(result.state).toBe('PHONE_ORDERING_ONLY');
    expect(result.summary).toMatch(/^The "ORDER" button in the section labelled "ORDER ONLINE" places a telephone call instead of opening an online ordering page or checkout\./);
    expect(result.summary).not.toMatch(/legitimate/i);
    expect(result.summary).not.toMatch(LOSS_CLAIM);
    expect(result.detail).toMatch(/^Observed automatically from the page markup/);
    expect(result.detail).toMatch(/did not tap the button on a device, and no owner confirmation is recorded/);
  });

  it('reports a destination declared in markup but not offered, instead of saying none was found', () => {
    const url = 'https://tmt.spotapps.co/ordering-menu/?spot_id=';
    const result = resolveOrderingChannel({
      ...base,
      onlineLabelledPhoneCtas: [{ text: 'ORDER', label: 'ORDER ONLINE' }],
      destinations: [{ url, exposedInCustomerJourney: false, platform: 'SpotHopper', host: 'tmt.spotapps.co' }],
    });
    expect(result.detail).toContain(`An ordering destination is declared in the page markup (${url}) but is not linked for customers`);
    expect(result.detail).not.toMatch(/No browser-based ordering destination was found/);
    expect(result.destinationResolved).toBe(false);
  });

  it('keeps the plain phone-ordering wording for a button that does not promise online ordering', () => {
    const result = resolveOrderingChannel(base);
    expect(result.onlineLabelOpensPhone).toBe(false);
    expect(result.summary).toMatch(/legitimate ordering pathway, and it is not online ordering/);
  });
});

// ── SCORING UNCHANGED ───────────────────────────────────────────────────────

describe('the repair changes wording and findings, never scoring', () => {
  const labelled = pipeline(LABELLED);
  const unlabelled = pipeline(UNLABELLED);

  it('the ORDERING stage stays FRICTION', () => {
    expect(labelled.journey.find((s) => s.stage === 'ORDERING')?.status).toBe('FRICTION');
  });

  it('every stage status, category score and the overall score match the unlabelled page', () => {
    expect(labelled.journey.map((s) => [s.stage, s.status])).toEqual(unlabelled.journey.map((s) => [s.stage, s.status]));
    expect(labelled.categories.map((c) => [c.category, c.score, c.weight])).toEqual(
      unlabelled.categories.map((c) => [c.category, c.score, c.weight]),
    );
    expect(labelled.overall.overallScore).toBe(unlabelled.overall.overallScore);
    expect(labelled.overall.coverageScore).toBe(unlabelled.overall.coverageScore);
    expect(labelled.categories.find((c) => c.category === 'ONLINE_ORDERING_EXPERIENCE')?.score).toBe(60);
  });

  it('a stored audit\'s ordering record reads exactly as it did before the repair', () => {
    const stored: EvidenceRecordLike[] = [
      {
        id: 's1', evidenceType: 'ORDERING_CHANNEL', confidence: 90,
        fact:
          'ORDERING CHANNEL: PHONE_ORDERING_ONLY [DESTINATION_RESOLVED] — The ordering call-to-action found on the analyzed ' +
          'pages places a telephone call rather than opening an online ordering page. Telephone ordering is a legitimate ' +
          'ordering pathway, and it is not online ordering. Whether online ordering exists somewhere this audit did not ' +
          'reach is not established either way.',
        supportingContext: 'Call-to-action text "Order" resolves to a telephone number (a tel: link), not to a web destination. Evidence confidence: VERIFIED.',
      },
    ];
    const journey = analyzeJourney(stored);
    const ordering = journey.find((s) => s.stage === 'ORDERING')!;
    expect(ordering.status).toBe('FRICTION');
    expect(ordering.finding).toBe(
      'The ordering call-to-action found on the analyzed pages places a telephone call rather than opening an online ' +
        'ordering page. Telephone ordering is a legitimate ordering pathway, and it is not online ordering. Whether online ' +
        'ordering exists somewhere this audit did not reach is not established either way. Not assessed: whether visitors ' +
        'who would rather order online go elsewhere, and how many orders arrive by phone — that requires order and call records.',
    );
    expect(detectRevenueLeaks({ evidence: stored, journey }).some((o) => o.category === CATEGORY)).toBe(false);
  });
});

// ── THE FINDING ─────────────────────────────────────────────────────────────

describe('the finding states the observation and claims nothing more', () => {
  const { leaks, executive, evidence } = pipeline(LABELLED);
  const finding = leaks.find((l) => l.category === CATEGORY)!;

  it('is raised only when the button is presented as online ordering', () => {
    expect(finding).toBeDefined();
    expect(pipeline(UNLABELLED).leaks.some((l) => l.category === CATEGORY)).toBe(false);
  });

  it('is strong evidence, not verified, and not a revenue leak', () => {
    expect(stateForOpportunity(finding)).toBe('STRONG_EVIDENCE');
    expect(finding.manualValidationRequired).toBe(false);
    expect(executive.findings.find((f) => f.category === CATEGORY)?.classification).toBe('STRONG EVIDENCE');
    expect(executive.headlines.findings).toBe('Priority Opportunities to Validate');
    expect(executive.headlines.findings).not.toMatch(/revenue leak/i);
  });

  it('describes the button and labels where the evidence came from', () => {
    expect(finding.title).toBe('The online ordering button opens a phone call instead of an online checkout');
    expect(finding.problem).toMatch(
      /^OBSERVED AUTOMATICALLY \(from the page markup\): The "ORDER" button in the section labelled "ORDER ONLINE" places a telephone call/,
    );
    expect(finding.problem).toMatch(/NOT OBSERVED: whether this affects orders, conversion or revenue/);
    expect(finding.problem).toMatch(/MANUAL CONFIRMATION: not recorded in this audit/);
    expect(finding.problem).toContain('https://tmt.spotapps.co/ordering-menu/?spot_id=');
    expect(finding.evidenceIds).toContain(channelOf(evidence).id);
  });

  it('makes no claim about lost orders, conversion rates or revenue, and no failure claim', () => {
    for (const text of [finding.title, finding.businessImpact, finding.recommendedSolution]) {
      expect(text).not.toMatch(LOSS_CLAIM);
    }
    // The problem names those things only to say they were NOT observed.
    expect(finding.problem.replace(/NOT OBSERVED:[^.]*working\./, '')).not.toMatch(LOSS_CLAIM);
    const card = executive.findings.find((f) => f.category === CATEGORY)!;
    for (const text of [card.commercialEffect, card.whyItMatters, card.potentialEffect, ...card.whatWeKnow]) {
      expect(text).not.toMatch(LOSS_CLAIM);
    }
    expect(card.commercialEffect).toMatch(/^No effect on orders, conversion or revenue is claimed/);
    expect(card.scenarioKind).toBeNull();
    expect(card.whatWeDoNotKnow).toMatch(/order and call records/);
  });

  it('adds a tap test to the plan, not a third-party commission check', () => {
    const plan = executive.thirtyDayPlan.flatMap((p) => p.actions).join('\n');
    expect(plan).toMatch(/Tap the online ordering button on a phone/);
    expect(plan).not.toMatch(/third-party/i);
  });
});

// ── REPORT, PDF AND SALES BRIEF AGREE ───────────────────────────────────────

/** Text runs of each rendered PDF page, in page order (see audit-report-repair.test.ts). */
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
  return runs.join(' ');
}

describe('the executive report, the PDF and the sales brief communicate the same finding', () => {
  const { executive, sales, leaks } = pipeline(LABELLED);
  const card = executive.findings.find((f) => f.category === CATEGORY)!;
  const finding = leaks.find((l) => l.category === CATEGORY)!;

  it('the report card carries the finding title, problem and readable evidence', () => {
    expect(card.title).toBe(finding.title);
    expect(card.problem).toBe(finding.problem);
    expect(card.whatWeKnow[0]).toMatch(/^The "ORDER" button in the section labelled "ORDER ONLINE" places a telephone call/);
    const ordering = executive.journeyMap.find((s) => s.stage === 'ORDERING')!;
    expect(ordering.note).toMatch(/section labelled "ORDER ONLINE" places a telephone call/);
  });

  it('no client-facing text carries a machine flag', () => {
    const client = JSON.stringify({ ...executive, appendix: executive.appendix.map(({ evidenceType: _code, ...rest }) => rest) });
    expect(client).not.toMatch(/ONLINE_LABEL_OPENS_PHONE|DESTINATION_RESOLVED|PHONE_ORDERING_ONLY|ORDERING CHANNEL:/);
    expect(salesText(sales)).not.toMatch(/ONLINE_LABEL_OPENS_PHONE|DESTINATION_RESOLVED|STRONG_EVIDENCE/);
  });

  it('the PDF prints the same title and evidence state', async () => {
    const text = (await pdfText(executive)).replace(/\s+/g, ' ');
    // Long titles wrap across text runs; the opening words are on one run.
    expect(text).toContain('The online ordering button opens a phone call');
    expect(text).toMatch(/STRONG EVIDENCE/);
    expect(text).not.toMatch(/ONLINE_LABEL_OPENS_PHONE|legitimate ordering pathway/);
  }, 30000);

  it('the sales brief leads with the observation as strongly indicated — not as fact, and not as unchecked', () => {
    const lead = finding.title.charAt(0).toLowerCase() + finding.title.slice(1);
    expect(sales.emailOpener).toContain(`one thing the website itself points to: ${lead}`);
    expect(sales.emailOpener).toMatch(/I have not confirmed it end to end and I am not assuming what it costs you/);
    expect(sales.emailOpener).not.toMatch(/could not check from the outside/);
    expect(sales.callOpener).toContain(lead);
    expect(sales.followUpAngle).toContain(finding.title);
    expect(sales.followUpAngle).toContain(STATE_PLAIN.STRONG_EVIDENCE);
    expect(sales.bestSalesAngle).toContain(STATE_PLAIN.STRONG_EVIDENCE);
    expect(sales.discoveryQuestions[0]).toMatch(/online ordering button places a phone call — is online ordering meant to be offered/);
  });

  it('the sales brief makes no loss claim about it', () => {
    for (const field of [sales.emailOpener, sales.callOpener, sales.followUpAngle, sales.bestSalesAngle, sales.outreachAngle]) {
      expect(field).not.toMatch(LOSS_CLAIM);
    }
    expect(sales.discoveryQuestions.join(' ')).not.toMatch(/commission/i);
  });
});
