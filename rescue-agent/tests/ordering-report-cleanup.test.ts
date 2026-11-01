/**
 * ORDERING FINDING — ONE CONCISE CARD, CLIENT LANGUAGE, HONEST ABOUT WHO TESTED WHAT.
 *
 * The Leverock's report detects that the "Order" button under "ORDER ONLINE"
 * is a tel: link. That detection is right and stays exactly as it is. What
 * the client read around it was not:
 *
 *   - the card stated the observation four times (problem, two "What we know"
 *     lines and the evidence layers), with "VERIFIED IN THE PAGE MARKUP / NOT
 *     YET TESTED / NOT MEASURED" printed both as the layers and inside the
 *     problem, and a "Potential commercial effect" that repeated "not
 *     measured" a third time;
 *   - "No one tapped the button on a phone during this audit" read as if no
 *     tap test existed, when a manual Android test was documented separately;
 *   - "The ordering destination could not be verified when tested (HTTP 404)"
 *     sat under "What we know" for an incomplete SpotHopper address that no
 *     button points to, and read like a broken ordering page;
 *   - the operator page printed PHONE_ORDERING_ONLY [ONLINE_LABEL_OPENS_PHONE]
 *     as the fact itself;
 *   - the PDF hyphenated web addresses ("…/order-" / "ing-menu/").
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import zlib from 'node:zlib';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { parseOrderingChannelFact } from '@/lib/audit/orderingChannel';
import { orderButtonFindingCopy, readUnlinkedOrderingAddress } from '@/lib/audit/orderButtonFinding';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { rankOpportunities } from '@/lib/scoring/priority';
import { generateOwnerReport } from '@/lib/reports/owner';
import { generateSalesBrief } from '@/lib/reports/sales';
import { buildExecutiveReport, evidenceDiagnosticCodes, presentEvidenceText, type ExecutiveReportInput } from '@/lib/reports/executive';
import { evidenceBasisFor, evidenceBasisRows } from '@/lib/audit/evidenceBasis';
import { isAddressWord, MAX_ADDRESS_LINE, pdfHyphenation, wrapAddressesDeep, wrapLongAddresses } from '@/lib/pdf/hyphenation';
import { COMPANY } from '@/lib/config';

const SITE = 'https://leverocks.example/';
const CATEGORY = 'ORDER BUTTON LABEL MISMATCH';
const MARKUP = 'https://tmt.spotapps.co/ordering-menu/?spot_id=';
const MENU = `${SITE}st-petersburg-leverock-s-great-seafood-food-menu`;
const OBSERVATION =
  'The "Order" button in the section labelled "ORDER ONLINE" places a telephone call instead of opening an online ordering page or checkout.';
const FILLER = `<footer><p>${'Fresh Gulf seafood since 1948, served on Pasadena Avenue. '.repeat(12)}</p></footer>`;
const page = (markupUrl: string | null) =>
  '<html><head><title>Leverock\'s Great Seafood | St. Petersburg, FL</title>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
  '<h1>Leverock\'s</h1><p>Call <a href="tel:+17273674588">(727) 367-4588</a></p>' +
  '<p>Hours: Mon–Sun 11:30 AM – 9:00 PM</p><p>840 Pasadena Avenue South, St. Petersburg, FL 33707</p>' +
  '<a href="/st-petersburg-leverock-s-great-seafood-food-menu">Menu</a>' +
  '<section class="order"><h2>ORDER ONLINE</h2><a class="btn" href="tel:+17273674588">Order</a></section>' +
  (markupUrl ? `<div data-ordering-url="${markupUrl}"></div>` : '') +
  '<p>Email us: <a href="mailto:leverocksgreatseafood@gmail.com">leverocksgreatseafood@gmail.com</a></p>' +
  `<a href="/gift-cards">Gift Cards</a>${FILLER}</body></html>`;

/** What Leverock's actually returns: the menu loads, the unlinked SpotHopper address is a 404. */
const menuOk: ProbeResult = { url: MENU, category: 'menu', ok: true, httpStatus: 200, note: 'HTTP 200', exposedInCustomerJourney: true };
const markup404: ProbeResult = {
  url: MARKUP, category: 'ordering', ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP', exposedInCustomerJourney: false,
};

function pipeline({ markupUrl = MARKUP as string | null, probes = [menuOk, markup404] as ProbeResult[] } = {}) {
  const evidence = normalizeEvidence({ pages: [extractPage(SITE, SITE, 200, 'text/html', page(markupUrl))], failures: [], probes }).map(
    (e, i) => ({ id: `o${i}`, evidenceType: e.evidenceType, fact: e.fact, supportingContext: e.supportingContext ?? null, confidence: e.confidence, sourceUrl: e.sourceUrl ?? null }),
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
    auditId: 'cordering0001', restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: 'St. Petersburg, FL',
    auditDate: '2026-11-01', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: COMPANY.name, consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: overall.overallScore, coverageScore: overall.coverageScore,
    sourcesCollected: 1, sourcesFailed: 0, evidence, opportunities: leaks, journey, categoryScores: categories,
    storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
  };
  const executive = buildExecutiveReport(input);
  return { evidence, journey, leaks, categories, overall, sales, input, executive, card: executive.findings.find((f) => f.category === CATEGORY)! };
}

/** Every string a client reads on the finding card, in card order. */
function cardText(card: ReturnType<typeof pipeline>['card']): string[] {
  return [
    ...(card.evidenceBasis ? evidenceBasisRows(card.evidenceBasis).flat() : []),
    card.title,
    card.problem,
    card.whyItMatters,
    card.commercialEffect,
    ...card.whatWeKnow,
    card.whatWeDoNotKnow,
    card.recommendedAction,
  ].filter(Boolean);
}

/** Every string the client report renders (web and PDF read the same DTO). */
function clientText(executive: ReturnType<typeof pipeline>['executive']): string {
  return [
    ...executive.findings.flatMap(cardText),
    ...executive.snapshot.priorities.flatMap((p) => [p.title, p.summary, p.validationRequired]),
    ...executive.appendix.flatMap((e) => [e.evidenceLabel, e.fact, e.supportingContext ?? '']),
    // `stage` is the internal key; the page renders the label, status, note and limitation.
    ...executive.journeyMap.flatMap((s) => [s.label, s.status, s.note, s.limitation ?? '']),
  ].join('\n');
}

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/** All text runs of a rendered PDF, in content-stream order. */
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

// ── 1. DETECTION AND SCORING ARE PRESERVED ──────────────────────────────────

describe('the ordering friction finding and its detection are unchanged', () => {
  const { evidence, leaks, journey, overall, categories } = pipeline();
  const channel = evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;
  const finding = leaks.find((l) => l.category === CATEGORY)!;

  it('still detects the online-labelled phone button from the page markup', () => {
    expect(parseOrderingChannelFact(channel.fact)).toEqual({ state: 'PHONE_ORDERING_ONLY', destinationResolved: false, onlineLabelOpensPhone: true });
    expect(channel.fact).toContain(OBSERVATION);
  });

  it('raises the same finding with the same scores, title and evidence', () => {
    expect(finding.title).toBe('The online ordering button opens a phone call instead of an online checkout');
    expect([finding.impactScore, finding.urgencyScore, finding.confidenceScore, finding.aiFitScore, finding.manualValidationRequired]).toEqual([60, 55, 78, 15, false]);
    expect(finding.evidenceIds).toContain(channel.id);
    expect(journey.find((s) => s.stage === 'ORDERING')!.status).toBe('FRICTION');
  });

  it('scores exactly as before this change (values pinned from main)', () => {
    expect([overall.overallScore, overall.coverageScore]).toEqual([82, 80]);
    expect(categories.map((c) => [c.category, c.score])).toEqual([
      ['DIGITAL_CUSTOMER_JOURNEY', 83], ['WEBSITE_CONVERSION', 90], ['PHONE_RESPONSE_READINESS', 90],
      ['RESERVATION_EXPERIENCE', null], ['ONLINE_ORDERING_EXPERIENCE', 60], ['CUSTOMER_RETENTION', 65],
      ['REVIEW_REPUTATION_SYSTEM', null], ['LOCAL_DIGITAL_PRESENCE', 100], ['AI_AUTOMATION_READINESS', 71],
    ]);
  });

  it('the unlinked 404 lowers no score: every category is at least what a page without the address scores', () => {
    const absent = pipeline({ markupUrl: null, probes: [menuOk] });
    expect(overall.overallScore).toBe(absent.overall.overallScore);
    for (const c of categories) {
      const other = absent.categories.find((a) => a.category === c.category)!;
      if (c.score !== null && other.score !== null) expect(c.score, c.category).toBeGreaterThanOrEqual(other.score);
    }
  });
});

// ── 2. ONE CONCISE FINDING ──────────────────────────────────────────────────

describe('the client card states the finding once', () => {
  const { card } = pipeline();
  const all = cardText(card).join('\n');

  it('the business problem is the observation, in plain words, with no layer prefixes', () => {
    expect(card.problem).toBe(OBSERVATION);
    expect(card.problem).not.toMatch(/VERIFIED IN|NOT YET TESTED|NOT MEASURED|OBSERVED/);
  });

  it('the observation and the measurement caveat each appear exactly once on the card', () => {
    expect(count(all, 'places a telephone call')).toBe(1);
    expect(all.match(/not measured/gi) ?? []).toHaveLength(1);
    expect(all).not.toMatch(/Ordering is offered by telephone/);
  });

  it('has no separate "potential commercial effect" repeating the measurement caveat', () => {
    expect(card.commercialEffect).toBe('');
  });

  it('carries evidence, business implication, uncertainty and a next action', () => {
    const rows = evidenceBasisRows(card.evidenceBasis!);
    expect(rows[0][1]).toMatch(/telephone \(tel:\) link/); // evidence
    expect(card.whyItMatters).toBe('A visitor who chooses to order online is offered a phone call instead of the online checkout the label promises.');
    expect(rows[2][1]).toMatch(/orders or revenue/); // uncertainty
    expect(card.whatWeDoNotKnow).toMatch(/order and call records/);
    expect(card.recommendedAction).toMatch(/^Decide which experience is intended\./);
    expect(card.recommendedAction).toMatch(/relabel the section — for example "Order by Phone"/);
  });

  it('the snapshot summarises it with the same plain observation', () => {
    const { executive } = pipeline();
    expect(executive.snapshot.priorities[0].summary).toBe(OBSERVATION);
  });
});

describe('an audit stored before this change renders the same concise card', () => {
  it('rebuilds the copy from the stored evidence instead of the stored long problem text', () => {
    const { input, card } = pipeline();
    const stored = input.opportunities.map((o) =>
      o.category === CATEGORY
        ? {
            ...o,
            problem: `VERIFIED IN THE PAGE MARKUP: ${OBSERVATION} The button is a tel: link. NOT YET TESTED: no one tapped the button on a phone during this audit. NOT MEASURED: any effect.`,
            businessImpact: 'A visitor who chooses to order online is handed a phone call instead of the checkout the label promises. Whether that changes how many orders the restaurant receives is not measured by this audit.',
            recommendedSolution: 'Decide which experience is intended. (the markup already declares one, which needs checking)',
          }
        : o,
    );
    const old = buildExecutiveReport({ ...input, opportunities: stored }).findings.find((f) => f.category === CATEGORY)!;
    expect([old.problem, old.whyItMatters, old.whatWeKnow, old.recommendedAction, old.commercialEffect]).toEqual([
      card.problem, card.whyItMatters, card.whatWeKnow, card.recommendedAction, card.commercialEffect,
    ]);
  });
});

// ── 3. INTERNAL CODES STAY IN TECHNICAL DIAGNOSTICS ─────────────────────────

describe('internal codes', () => {
  const { executive, evidence } = pipeline();
  const channel = evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;

  it('never reach the client report', () => {
    const text = clientText(executive);
    expect(text).not.toMatch(/PHONE_ORDERING_ONLY|ONLINE_LABEL_OPENS_PHONE|DESTINATION_RESOLVED|LABEL MISMATCH/);
    expect(text).not.toMatch(/\b[A-Z]{2,}(?:_[A-Z]{2,})+\b/);
  });

  it('remain in the stored evidence, where the engine reads them', () => {
    expect(channel.fact).toMatch(/^ORDERING CHANNEL: PHONE_ORDERING_ONLY \[ONLINE_LABEL_OPENS_PHONE\] — /);
  });

  it('are offered to the operator page as a separate diagnostics line, not as the fact', () => {
    expect(evidenceDiagnosticCodes(channel.fact)).toBe('PHONE_ORDERING_ONLY · ONLINE_LABEL_OPENS_PHONE');
    expect(presentEvidenceText(channel.fact).startsWith(OBSERVATION)).toBe(true);
    expect(evidenceDiagnosticCodes('A menu pathway is publicly linked.')).toBeNull();
  });
});

// ── 4. AUTOMATED FINDING VS SEPARATE MANUAL QA ──────────────────────────────

describe('the automated finding is kept apart from manual QA', () => {
  const { executive, evidence, sales } = pipeline();
  const basis = evidenceBasisFor(CATEGORY)!;

  it('labels the layers as automated finding, manual check and not measured', () => {
    expect(evidenceBasisRows(basis).map(([label]) => label)).toEqual(['Automated finding', 'Manual check', 'Not measured']);
    expect(basis.verified).toMatch(/reads links; it does not tap buttons/);
    expect(basis.manualCheck).toMatch(/separate from this automated audit/);
    expect(basis.manualCheck).toMatch(/documented separately/);
  });

  it('nothing says the audit tapped the button, or that no one ever did', () => {
    const everything = [
      clientText(executive),
      ...evidence.map((e) => `${e.fact} ${e.supportingContext ?? ''}`),
      ...Object.values(sales).filter((v): v is string => typeof v === 'string'),
    ].join('\n');
    expect(everything).not.toMatch(/\b(the audit|this audit|the agent|we)\s+(tapped|clicked|pressed)\b/i);
    expect(everything).not.toMatch(/tap test (was|has been) (done|performed|completed)/i);
    expect(everything).not.toMatch(/no one tapped/i);
  });

  it('the stored channel evidence says what the automated check did', () => {
    const channel = evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;
    expect(channel.supportingContext).toMatch(/^Verified in the page markup: /);
    expect(channel.supportingContext).toMatch(/The automated audit reads links and does not tap buttons; a tap test on a phone is a separate manual check/);
  });

  it('the sales brief describes a read, not a tap, and does not deny a separate test', () => {
    expect(sales.emailOpener).toContain(basis.ownerObservation);
    expect(sales.emailOpener).toMatch(/rather than tapping it/);
    expect(sales.emailOpener).not.toMatch(/have not tested it on a phone/);
    expect(sales.bestSalesAngle).toContain(`Status: ${basis.summary}`);
  });
});

// ── 5. THE UNLINKED 404 ADDRESS ─────────────────────────────────────────────

describe('the incomplete SpotHopper address that no button points to', () => {
  const { evidence, leaks, card } = pipeline();

  it('is never a broken link, a failure finding or a confirmed ordering failure', () => {
    expect(evidence.filter((e) => e.evidenceType === 'BROKEN_LINK')).toEqual([]);
    expect(leaks.map((l) => l.category)).not.toContain('ONLINE ORDERING FAILURE RISK');
    const channel = evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;
    expect(parseOrderingChannelFact(channel.fact)!.state).not.toBe('ONLINE_ORDERING_BROKEN_CONFIRMED');
  });

  it('is described once, as not customer-facing, incomplete and HTTP 404 — never as a failed button or a loss', () => {
    expect(card.whatWeKnow).toEqual([
      `The page code also contains an online ordering address that no button or link on the page points to: ${MARKUP}. ` +
        'It appears incomplete: "spot_id" has no value. When the audit requested it, it did not load (HTTP 404). ' +
        'Customers are not offered this address, so it is not treated as an ordering button they use, and no effect on ' +
        'orders or revenue is claimed from it.',
    ]);
    // Not even negated: no failure or loss vocabulary is attached to the address.
    expect(card.whatWeKnow[0]).not.toMatch(/\bbroken\b|\blost\b|\bloss\b|\bfail(ed|ing|ure)?\b|dead end/i);
    expect(cardText(card).join(' ')).not.toMatch(/could not be verified when tested/);
  });

  it('the next action is to complete or remove it, not to "fix a broken link"', () => {
    expect(card.recommendedAction).toContain('complete or remove the unfinished ordering address in the page code');
    expect(card.recommendedAction).not.toMatch(/broken/i);
  });

  it('reports a network failure and a working response as what they were', () => {
    const dns = pipeline({ probes: [menuOk, { ...markup404, httpStatus: undefined, note: 'The address could not be resolved (no DNS record answered)', failureKind: 'NETWORK' }] });
    expect(dns.card.whatWeKnow[0]).toContain('it did not load (The address could not be resolved (no DNS record answered)).');
    const ok = pipeline({ probes: [menuOk, { ...markup404, ok: true, httpStatus: 200, note: 'HTTP 200', failureKind: undefined }] });
    expect(ok.card.whatWeKnow[0]).toContain('When the audit requested it, it responded (HTTP 200).');
    expect(ok.card.whatWeKnow[0]).toContain('Customers are not offered this address');
  });

  it('a complete unlinked address is checked, not called unfinished; no address adds nothing', () => {
    const complete = 'https://tmt.spotapps.co/ordering-menu/?spot_id=78550';
    const filled = pipeline({ markupUrl: complete, probes: [menuOk, { ...markup404, url: complete }] });
    expect(filled.card.whatWeKnow[0]).not.toMatch(/incomplete/);
    expect(filled.card.recommendedAction).toContain('check the unlinked ordering address in the page code');
    const none = pipeline({ markupUrl: null, probes: [menuOk] });
    expect(none.card.whatWeKnow).toEqual([]);
    expect(none.card.recommendedAction).not.toMatch(/page code/);
  });

  it('a destination customers ARE linked to is not treated as the unlinked address', () => {
    const records = [
      {
        evidenceType: 'ORDERING_CHANNEL',
        fact: `ORDERING CHANNEL: PHONE_ORDERING_ONLY [DESTINATION_RESOLVED] [ONLINE_LABEL_OPENS_PHONE] — ${OBSERVATION}`,
        supportingContext: 'Verified in the page markup: x. An ordering destination is also declared in the page markup (https://order.example/), but the action a customer is actually offered is the phone call.',
      },
    ];
    expect(readUnlinkedOrderingAddress(records)).toBeNull();
    expect(orderButtonFindingCopy(records)!.facts).toEqual([]);
  });
});

// ── 6. PDF: ADDRESSES ARE NEVER HYPHENATED, AND LONG ONES STAY ON THE PAGE ──

describe('PDF line breaking for addresses', () => {
  const builtin = (w: string) => (w.length > 6 ? [w.slice(0, 4), w.slice(4)] : [w]);

  it('keeps web and email addresses whole and leaves prose to the built-in hyphenation', () => {
    expect(pdfHyphenation(MARKUP, builtin)).toEqual([MARKUP]);
    expect(pdfHyphenation('(https://x.example/a).', builtin)).toEqual(['(https://x.example/a).']);
    expect(pdfHyphenation('leverocksgreatseafood@gmail.com', builtin)).toEqual(['leverocksgreatseafood@gmail.com']);
    expect(pdfHyphenation('restaurant', builtin)).toEqual(['rest', 'aurant']);
    expect(isAddressWord('ordering')).toBe(false);
  });

  it('breaks an address longer than a line only after its own separators, adding no characters', () => {
    const long = 'https://127.0.0.1:3443/ordering-menu/?spot_id=&source=website&campaign=holiday-party-2026&utm_medium=referral&utm_content=very-long-tracking-parameter-value-for-testing-wrap';
    const wrapped = wrapLongAddresses(`See ${long}. Then more.`);
    const lines = wrapped.split('\n');
    expect(lines.length).toBeGreaterThan(2);
    expect(wrapped.replace(/\n/g, '')).toBe(`See ${long}. Then more.`);
    for (const line of lines.slice(0, -1)) expect(line).toMatch(/[/?&=._-]$/);
    for (const line of lines.slice(1, -1)) expect(line.length).toBeLessThanOrEqual(MAX_ADDRESS_LINE);
    expect(wrapLongAddresses(`Short: ${MARKUP}.`)).toBe(`Short: ${MARKUP}.`);
  });

  it('wraps every string in the report data and leaves non-strings alone', () => {
    const long = `https://x.example/${'a/'.repeat(40)}`;
    expect(wrapAddressesDeep({ a: [long], b: 3, c: null })).toEqual({ a: [wrapLongAddresses(long)], b: 3, c: null });
  });

  it('the exported PDF prints the address intact, the card once, and no code', async () => {
    const { executive } = pipeline();
    const text = await pdfText(executive);
    expect(text).toContain(MARKUP);
    expect(text).not.toMatch(/order- ?ing-menu/);
    expect(count(text, OBSERVATION)).toBeGreaterThanOrEqual(1);
    expect(text).toContain('Automated finding');
    expect(text).toContain('Manual check');
    expect(text).not.toMatch(/No effect on orders, conversion or revenue is claimed/);
    expect(text).not.toMatch(/PHONE_ORDERING_ONLY|ONLINE_LABEL_OPENS_PHONE/);
  }, 30000);
});
