/**
 * SUPPLIED-URL PROVENANCE — ISSUE #67, ITEMS 2 AND 3.
 *
 * An ordering or reservation URL typed into the audit form is probed alongside
 * the destinations the website offers. When such a URL responded, the evidence
 * read "The linked ordering destination is reachable…" — a statement that the
 * restaurant's website links to it, made about a URL the website never
 * mentions. That fact reaches the evidence appendix of the client report.
 *
 * Item 3: "provided for this audit" was inferred from probe order and from
 * what is absent from the page. The orchestrator now marks a supplied URL
 * explicitly (`suppliedForAudit`), and that marker travels through ProbeResult
 * and OrderingDestination.
 *
 * The rule pinned here: a destination is called "linked" only when the
 * collected pages show it as a visible link. Only wording changes — evidence
 * types, confidence, journey stages and every score stay exactly as they were.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { resolveOrderingChannel, type OrderingDestination } from '@/lib/audit/orderingChannel';
import { buildProbeTargets } from '@/lib/audit/probeTargets';
import { analyzeJourney } from '@/lib/audit/journey';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { buildExecutiveReport, presentEvidenceText, type ExecutiveReportInput } from '@/lib/reports/executive';
import React from 'react';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { publishAuditObservations, publishEvidenceText } from '@/lib/reports/observationPublication';
import { generateSalesBrief } from '@/lib/reports/sales';
import type { RankedOpportunity } from '@/lib/reports/owner';

const SITE = 'https://harborgrill.example/';
const FILLER = `<footer><p>${'Wood-fired seafood on the harbor since 1987, open daily for lunch and dinner. '.repeat(12)}</p></footer>`;
const SUPPLIED_ORDER = 'https://order.supplied-by-operator.example/harbor-grill';
const SUPPLIED_BOOKING = 'https://book.supplied-by-operator.example/harbor-grill';
const PAGE_ORDER = 'https://harborgrill.example/order-online';

/** Any wording that tells a reader the website itself links to the URL. */
const LINKED_CLAIM = /\blinked\b|publicly linked|links to/i;

const reachable = (url: string, category: ProbeResult['category'], extra: Partial<ProbeResult> = {}): ProbeResult => ({
  url, category, ok: true, httpStatus: 200, note: 'HTTP 200', ...extra,
});

function run(body: string, probes: ProbeResult[]) {
  const evidence = normalizeEvidence({
    pages: [extractPage(SITE, SITE, 200, 'text/html', `<html><body>${body}${FILLER}</body></html>`)],
    failures: [],
    probes,
  });
  const records = evidence.map((e, i) => ({
    id: `v${i}`, evidenceType: e.evidenceType, fact: e.fact, supportingContext: e.supportingContext ?? null, confidence: e.confidence,
  }));
  const journey = analyzeJourney(records);
  const categories = calculateCategoryScores(journey, records);
  return { evidence, records, journey, categories, overall: calculateOverallScore(categories) };
}

const probeRecord = (evidence: ReturnType<typeof run>['evidence'], url: string) =>
  evidence.find((e) => e.sourceUrl === url && /destination|URL provided/.test(e.fact) && e.evidenceType !== 'ORDERING_CHANNEL');

/** A page with no ordering or reservation links at all. */
const BARE_PAGE = '<h1>Harbor Grill</h1><p>Visit us on the waterfront.</p>';

describe('a reachable URL supplied on the audit form and absent from the website', () => {
  for (const [label, url, category] of [
    ['ordering', SUPPLIED_ORDER, 'ordering'],
    ['reservation', SUPPLIED_BOOKING, 'reservation'],
  ] as const) {
    it(`${label}: is never described as linked`, () => {
      const { evidence } = run(BARE_PAGE, [reachable(url, category, { exposedInCustomerJourney: false, suppliedForAudit: true })]);
      const record = probeRecord(evidence, url)!;
      expect(record).toBeDefined();
      expect(record.fact).not.toMatch(LINKED_CLAIM);
      expect(record.fact).toMatch(/provided for this audit/);
      expect(record.supportingContext).toMatch(/not found on the analyzed pages/);
    });

    it(`${label}: the client report appendix does not say the website links to it`, () => {
      const { evidence } = run(BARE_PAGE, [reachable(url, category, { exposedInCustomerJourney: false, suppliedForAudit: true })]);
      const record = probeRecord(evidence, url)!;
      const shown = presentEvidenceText(record.fact);
      expect(shown).not.toMatch(LINKED_CLAIM);
    });
  }

  it('operated-by wording is kept: the vendor is named, provenance is not misstated', () => {
    const url = 'https://www.opentable.com/r/harbor-grill-supplied';
    const { evidence } = run(BARE_PAGE, [reachable(url, 'reservation', { exposedInCustomerJourney: false, suppliedForAudit: true })]);
    const record = probeRecord(evidence, url)!;
    expect(record.fact).not.toMatch(LINKED_CLAIM);
    expect(record.fact).toMatch(/operated by OpenTable/i);
  });

  it('a "service unavailable" signal is still detected by the journey, without calling the URL linked', () => {
    const disabled = reachable(SUPPLIED_BOOKING, 'reservation', {
      exposedInCustomerJourney: false, suppliedForAudit: true, disabledSignal: '"Online reservations are currently closed"',
    });
    const { evidence } = run(BARE_PAGE, [disabled]);
    const record = probeRecord(evidence, SUPPLIED_BOOKING)!;
    expect(record.fact).not.toMatch(LINKED_CLAIM);
    // The journey matches on this clause; the wording repair must keep it.
    expect(record.fact).toMatch(/states the service is unavailable/i);
  });

  it('stored or direct-call probes without the marker are still recognised as supplied by the existing inference', () => {
    const { evidence } = run(BARE_PAGE, [reachable(SUPPLIED_ORDER, 'ordering', { exposedInCustomerJourney: false })]);
    const record = probeRecord(evidence, SUPPLIED_ORDER)!;
    expect(record.fact).not.toMatch(LINKED_CLAIM);
    expect(record.fact).toMatch(/provided for this audit/);
  });
});

describe('"linked" is kept wherever the collected pages support it', () => {
  it('a destination offered as a visible link on the page is still described as linked', () => {
    const page = `${BARE_PAGE}<a href="${PAGE_ORDER}">Order Online</a>`;
    const { evidence } = run(page, [reachable(PAGE_ORDER, 'ordering', { exposedInCustomerJourney: true })]);
    expect(probeRecord(evidence, PAGE_ORDER)!.fact).toMatch(/^The linked ordering destination is reachable/);
  });

  it('a supplied URL that is ALSO a visible link on the page is still described as linked', () => {
    const page = `${BARE_PAGE}<a href="${SUPPLIED_ORDER}">Order Online</a>`;
    const { evidence } = run(page, [reachable(SUPPLIED_ORDER, 'ordering', { exposedInCustomerJourney: false, suppliedForAudit: true })]);
    expect(probeRecord(evidence, SUPPLIED_ORDER)!.fact).toMatch(/^The linked ordering destination is reachable/);
  });
});

describe('scores, stages and evidence states are untouched by the wording repair', () => {
  const cases: [string, string, ProbeResult[]][] = [
    ['supplied ordering only', BARE_PAGE, [reachable(SUPPLIED_ORDER, 'ordering', { exposedInCustomerJourney: false, suppliedForAudit: true })]],
    ['supplied reservation only', BARE_PAGE, [reachable(SUPPLIED_BOOKING, 'reservation', { exposedInCustomerJourney: false, suppliedForAudit: true })]],
    [
      'supplied ordering beside a page ordering link',
      `${BARE_PAGE}<a href="${PAGE_ORDER}">Order Online</a>`,
      [
        reachable(SUPPLIED_ORDER, 'ordering', { exposedInCustomerJourney: false, suppliedForAudit: true }),
        reachable(PAGE_ORDER, 'ordering', { exposedInCustomerJourney: true }),
      ],
    ],
  ];

  for (const [label, body, probes] of cases) {
    it(`${label}: the marker changes no stage, evidence type, confidence or score`, () => {
      const marked = run(body, probes);
      // The same audit as an older engine stored it: no explicit marker.
      const unmarked = run(body, probes.map(({ suppliedForAudit: _s, ...p }) => p));
      expect(marked.evidence.map((e) => [e.evidenceType, e.confidence, e.sourceUrl])).toEqual(
        unmarked.evidence.map((e) => [e.evidenceType, e.confidence, e.sourceUrl]),
      );
      expect(marked.journey.map((s) => [s.stage, s.status, s.confidence])).toEqual(unmarked.journey.map((s) => [s.stage, s.status, s.confidence]));
      expect(marked.categories).toEqual(unmarked.categories);
      expect(marked.overall).toEqual(unmarked.overall);
    });
  }

  it('the journey does not describe a supplied-only pathway as publicly linked', () => {
    for (const [, body, probes] of cases.slice(0, 2)) {
      const { journey } = run(body, probes);
      for (const s of journey.filter((x) => x.stage === 'ORDERING' || x.stage === 'RESERVATION')) {
        expect(s.finding, `${s.stage}: ${s.finding}`).not.toMatch(/publicly linked/i);
      }
    }
  });
});

describe('explicit supplied provenance through the ordering channel', () => {
  const tel = { phoneOrderCtas: ['Call to Order'], onlineLabelledPhoneCtas: [], probes: [], widgetVendor: null };
  const dest = (extra: Partial<OrderingDestination>): OrderingDestination => ({
    url: SUPPLIED_ORDER, exposedInCustomerJourney: false, platform: null, host: 'order.supplied-by-operator.example', ...extra,
  });

  it('a destination marked supplied is described as provided for this audit', () => {
    const channel = resolveOrderingChannel({ ...tel, destinations: [dest({ suppliedForAudit: true })] });
    expect(channel.detail).toMatch(/provided for this audit \(https:\/\/order\.supplied-by-operator\.example/);
  });

  it('a destination explicitly marked NOT supplied is never described as provided for this audit', () => {
    const channel = resolveOrderingChannel({ ...tel, destinations: [dest({ suppliedForAudit: false })] });
    expect(channel.detail).not.toMatch(/provided for this audit/);
  });

  it('without the marker, the existing inference still applies (stored audits)', () => {
    const channel = resolveOrderingChannel({ ...tel, destinations: [dest({})] });
    expect(channel.detail).toMatch(/provided for this audit/);
  });

  it('the evidence layer carries the probe marker onto the ordering destination', () => {
    // A supplied URL the page offers nowhere, with a phone CTA on the page:
    // the channel names the supplied URL from the explicit marker.
    const page = `${BARE_PAGE}<a href="tel:+17275550100">Call to Order</a>`;
    const { evidence } = run(page, [reachable(SUPPLIED_ORDER, 'ordering', { exposedInCustomerJourney: false, suppliedForAudit: true })]);
    const channel = evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;
    expect(channel.supportingContext).toMatch(/An ordering URL provided for this audit \(https:\/\/order\.supplied-by-operator\.example\/harbor-grill\)/);
  });
});

describe('the orchestrator sets the marker where the supplied URL enters the pipeline', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../src/lib/audit/orchestrator.ts'), 'utf8');

  it('owner-supplied probe targets are marked supplied; page-found targets are not', () => {
    // Behavioural since the selection moved into buildProbeTargets (#86, L3).
    const pages = [extractPage(SITE, SITE, 200, 'text/html', `<html><body>${BARE_PAGE}<a href="${PAGE_ORDER}">Order Online</a>${FILLER}</body></html>`)];
    const targets = buildProbeTargets({ pages, reservationUrl: SUPPLIED_BOOKING, orderingUrl: SUPPLIED_ORDER, collectedUrls: new Set() });
    expect(targets.map((t) => [t.url, t.supplied])).toEqual([[SUPPLIED_BOOKING, true], [SUPPLIED_ORDER, true], [PAGE_ORDER, false]]);
    expect(src).toMatch(/buildProbeTargets\(\{/);
  });

  it('the marker is forwarded onto the ProbeResult', () => {
    expect(src).toMatch(/suppliedForAudit: target\.supplied/);
  });
});

/**
 * FOLLOW-UP: A SUPPLIED URL THE PAGE CARRIES IN ITS MARKUP.
 *
 * Validation of da2d62c found the added sentence "This URL was provided for
 * this audit and was not found on the analyzed pages." printed for a supplied
 * URL that IS on the page — as an iframe src, or as the address a redirect
 * lands on. The explicit supplied marker short-circuited the markup check.
 * The sentence is now chosen from what the collected pages show; the fact,
 * evidence type, confidence and every score are unchanged.
 *
 * Trailing slashes are not normalised: ".../harbor-grill" and
 * ".../harbor-grill/" are different addresses with their own HTTP outcomes
 * unless a redirect observed during the audit joins them.
 */
describe('a supplied URL the analyzed pages carry only in their markup', () => {
  const IFRAME_ORDER = 'https://order.toasttab.com/online/harbor-grill';
  const NOT_FOUND = /was not found on the analyzed pages/;
  const IN_MARKUP =
    'This URL was provided for this audit; the analyzed pages carry it only in the page markup, not as a visible link.';
  const iframe = (src: string) => `${BARE_PAGE}<iframe src="${src}" title="Order online"></iframe>`;
  const supplied = (url: string, extra: Partial<ProbeResult> = {}) =>
    reachable(url, 'ordering', { exposedInCustomerJourney: false, suppliedForAudit: true, ...extra });
  const failed: Partial<ProbeResult> = { ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP' };

  it('the iframe is collected as a markup-only ordering destination (precondition)', () => {
    const { evidence } = run(iframe(IFRAME_ORDER), []);
    expect(evidence.some((e) => e.evidenceType === 'ORDERING_PATH' && /embedded widget/.test(e.fact))).toBe(true);
  });

  it('reachable, same address as the iframe: says it is in the page markup, never "not found"', () => {
    const { evidence } = run(iframe(IFRAME_ORDER), [supplied(IFRAME_ORDER)]);
    const record = probeRecord(evidence, IFRAME_ORDER)!;
    expect(record.evidenceType).toBe('ORDERING_PATH');
    expect(record.fact).toMatch(/^The ordering URL provided for this audit is reachable/);
    expect(record.supportingContext).not.toMatch(NOT_FOUND);
    expect(record.supportingContext).toContain(IN_MARKUP);
  });

  it('service unavailable, same address as the iframe: same correction, journey clause kept', () => {
    const { evidence } = run(iframe(IFRAME_ORDER), [supplied(IFRAME_ORDER, { disabledSignal: '"Online ordering is closed"' })]);
    const record = probeRecord(evidence, IFRAME_ORDER)!;
    expect(record.fact).toMatch(/states the service is unavailable/);
    expect(record.supportingContext).not.toMatch(NOT_FOUND);
    expect(record.supportingContext).toContain(IN_MARKUP);
  });

  it('failed, same address as the iframe: not a BROKEN_LINK, and the reason names the page markup (unchanged)', () => {
    const { evidence } = run(iframe(IFRAME_ORDER), [supplied(IFRAME_ORDER, failed)]);
    expect(evidence.filter((e) => e.evidenceType === 'BROKEN_LINK')).toEqual([]);
    const record = probeRecord(evidence, IFRAME_ORDER)!;
    expect(record.fact).toMatch(/could not be verified when tested \(HTTP 404\)/);
    expect(record.supportingContext).toMatch(/appears only in the page markup/);
    expect(record.supportingContext).not.toMatch(NOT_FOUND);
  });

  for (const [label, from, to] of [
    ['no slash → slash', IFRAME_ORDER, `${IFRAME_ORDER}/`],
    ['slash → no slash', `${IFRAME_ORDER}/`, IFRAME_ORDER],
  ] as const) {
    it(`redirect to the iframe address (${label}): says it is in the page markup, never "not found"`, () => {
      const { evidence } = run(iframe(to), [supplied(from, { finalUrl: to })]);
      const record = probeRecord(evidence, from)!;
      expect(record.fact).not.toMatch(LINKED_CLAIM);
      expect(record.supportingContext).not.toMatch(NOT_FOUND);
      expect(record.supportingContext).toContain(IN_MARKUP);
    });

    it(`no redirect (${label}): different addresses keep their own outcomes and wording`, () => {
      const outcome = (url: string) => (url === from ? failed : {});
      const probes = [
        supplied(from, outcome(from)),
        reachable(to, 'ordering', { exposedInCustomerJourney: false, suppliedForAudit: false, ...outcome(to) }),
      ];
      const { evidence } = run(iframe(to), probes);
      expect(evidence.filter((e) => e.evidenceType === 'BROKEN_LINK')).toEqual([]);
      const fromRecord = probeRecord(evidence, from)!;
      expect(fromRecord.fact).toMatch(/could not be verified when tested \(HTTP 404\)/);
      // Not on the page as typed: "not found" is accurate for this exact address.
      expect(fromRecord.supportingContext).toMatch(/provided for this audit and was not found on the analyzed pages/);
      expect(probeRecord(evidence, to)!.fact).toMatch(/is reachable/);
    });

    it(`no redirect, reachable (${label}): the supplied address keeps the "not found" sentence`, () => {
      const { evidence } = run(iframe(to), [supplied(from)]);
      const record = probeRecord(evidence, from)!;
      expect(record.supportingContext).toMatch(NOT_FOUND);
      expect(record.supportingContext).not.toContain(IN_MARKUP);
    });
  }

  it('absent from the analyzed pages: keeps "not found on the analyzed pages"', () => {
    for (const extra of [{}, { disabledSignal: '"Ordering is closed"' }]) {
      const { evidence } = run(BARE_PAGE, [supplied(SUPPLIED_ORDER, extra)]);
      const record = probeRecord(evidence, SUPPLIED_ORDER)!;
      expect(record.supportingContext).toContain('This URL was provided for this audit and was not found on the analyzed pages.');
      expect(record.supportingContext).not.toContain(IN_MARKUP);
    }
  });

  it('the correction changes no evidence type, confidence, stage or score', () => {
    for (const probes of [[supplied(IFRAME_ORDER)], [supplied(IFRAME_ORDER, failed)], [supplied(IFRAME_ORDER, { disabledSignal: '"closed"' })]]) {
      const marked = run(iframe(IFRAME_ORDER), probes);
      const unmarked = run(iframe(IFRAME_ORDER), probes.map(({ suppliedForAudit: _s, ...p }) => p));
      expect(marked.evidence.map((e) => [e.evidenceType, e.confidence, e.sourceUrl])).toEqual(
        unmarked.evidence.map((e) => [e.evidenceType, e.confidence, e.sourceUrl]),
      );
      expect(marked.journey.map((s) => [s.stage, s.status, s.confidence])).toEqual(unmarked.journey.map((s) => [s.stage, s.status, s.confidence]));
      expect(marked.categories).toEqual(unmarked.categories);
      expect(marked.overall).toEqual(unmarked.overall);
    }
  });
});

/**
 * BLOCKER 2: A SUPPLIED URL WITH NO EXPOSURE FLAG.
 *
 * The orchestrator always sets exposedInCustomerJourney (false for a supplied
 * URL). A direct normalizeEvidence caller that marks a URL supplied but omits
 * the flag fell through to the "assume exposed" default, and a supplied-only
 * 404 became "A transaction link on the website is failing", classified
 * VERIFIED FINDING, in the Executive Report, the PDF and the Sales Brief.
 *
 * Rule pinned here: suppliedForAudit === true with no exposure flag behaves
 * exactly like the orchestrator's explicit false. Explicit true and false win;
 * unmarked probes keep main's default.
 */
describe('a supplied URL whose exposure flag is omitted (direct normalizeEvidence callers)', () => {
  const ORDER = 'https://order.toasttab.com/online/harbor-grill';
  const failed: Partial<ProbeResult> = { ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP' };
  const probe = (extra: Partial<ProbeResult>): ProbeResult => ({ url: ORDER, category: 'ordering', ok: true, httpStatus: 200, note: 'HTTP 200', ...failed, ...extra } as ProbeResult);
  const ABSENT = BARE_PAGE;
  const LINKED = `${BARE_PAGE}<a href="${ORDER}">Order Online</a>`;
  const broken = (r: ReturnType<typeof run>) => r.evidence.filter((e) => e.evidenceType === 'BROKEN_LINK');
  const channel = (r: ReturnType<typeof run>) => r.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.fact;
  const comparable = (r: ReturnType<typeof run>) => ({
    evidence: r.evidence.map((e) => [e.evidenceType, e.confidence, e.sourceUrl, e.fact, e.supportingContext]),
    journey: r.journey.map((s) => [s.stage, s.status, s.confidence, s.finding]),
    categories: r.categories,
    overall: r.overall,
  });

  for (const [label, page] of [['absent from the page', ABSENT], ['also a visible link on the page', LINKED]] as const) {
    it(`supplied, flag omitted, HTTP 404, ${label}: no BROKEN_LINK`, () => {
      expect(broken(run(page, [probe({ suppliedForAudit: true })]))).toEqual([]);
    });

    it(`supplied, flag omitted, ${label}: identical to the orchestrator's explicit false`, () => {
      for (const outcome of [failed, { ok: true, httpStatus: 200, note: 'HTTP 200', failureKind: undefined }]) {
        const omitted = run(page, [probe({ suppliedForAudit: true, ...outcome })]);
        const explicit = run(page, [probe({ suppliedForAudit: true, exposedInCustomerJourney: false, ...outcome })]);
        expect(comparable(omitted)).toEqual(comparable(explicit));
      }
    });
  }

  it('ordering channel: a supplied URL that is also a visible link is not "confirmed broken" when the flag is omitted', () => {
    const omitted = run(LINKED, [probe({ suppliedForAudit: true })]);
    expect(channel(omitted)).not.toMatch(/ONLINE_ORDERING_BROKEN_CONFIRMED/);
    expect(channel(omitted)).toBe(channel(run(LINKED, [probe({ suppliedForAudit: true, exposedInCustomerJourney: false })])));
  });

  it('explicit true still wins: a supplied URL marked exposed and failing is a BROKEN_LINK', () => {
    expect(broken(run(LINKED, [probe({ suppliedForAudit: true, exposedInCustomerJourney: true })])).length).toBe(1);
  });

  it('explicit false still wins: no BROKEN_LINK', () => {
    expect(broken(run(LINKED, [probe({ suppliedForAudit: false, exposedInCustomerJourney: false })]))).toEqual([]);
  });

  it('unmarked probes keep main\'s default: flag omitted, not markup-only, HTTP 404 → BROKEN_LINK', () => {
    expect(broken(run(ABSENT, [probe({})])).length).toBe(1);
    expect(broken(run(LINKED, [probe({})])).length).toBe(1);
  });

  it('a page-found URL (suppliedForAudit false) with the flag omitted keeps main\'s default', () => {
    expect(broken(run(LINKED, [probe({ suppliedForAudit: false })])).length).toBe(1);
  });

  it('end to end: a supplied-only failed URL never becomes a VERIFIED broken-link finding in the report, PDF or sales brief', async () => {
    const pages = [extractPage(SITE, SITE, 200, 'text/html', `<html><body>${ABSENT}${FILLER}</body></html>`)];
    const ev = normalizeEvidence({ pages, failures: [], probes: [probe({ suppliedForAudit: true })] })
      .map((e, i) => ({ id: `v${i}`, auditSourceId: 's1', ...e, supportingContext: e.supportingContext ?? null, sourceUrl: e.sourceUrl ?? null }));
    const journey = analyzeJourney(ev).map((s, i) => ({ id: `j${i}`, ...s }));
    const scores = calculateCategoryScores(journey, ev);
    const overall = calculateOverallScore(scores);
    const opportunities = detectRevenueLeaks({ evidence: ev, journey });
    const p = publishAuditObservations({
      evidence: ev, journey, opportunities, scores,
      context: { sources: [{ id: 's1', url: SITE, pageTitle: 'Harbor Grill', sourceType: 'HOMEPAGE' }], restaurant: { name: 'Harbor Grill', websiteUrl: SITE }, suppliedUrls: [ORDER] },
    } as never);
    const dto = buildExecutiveReport({
      auditId: 'a', restaurantId: 'r', restaurantName: 'Harbor Grill', websiteUrl: SITE, location: null, auditDate: '2026-11-09', auditStatus: 'COMPLETED', demoMode: false,
      contact: { company: 'Winnersbookmark', consultantName: 'K', phone: '1', email: null, bookingUrl: null, fallbackText: 'x' },
      bookingQrDataUrl: null, avgTicket: null, overallScore: overall.overallScore, coverageScore: overall.coverageScore, sourcesCollected: 1, sourcesFailed: 0,
      evidence: p.evidence.map(({ provenance: _p, auditSourceId: _s, ...e }) => e), opportunities: p.opportunities, journey: p.journey,
      categoryScores: p.scores, storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
    } as unknown as ExecutiveReportInput);
    const strings = (node: unknown, out: string[] = []): string[] => {
      if (node === null || node === undefined || node === false) return out;
      if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out; }
      if (Array.isArray(node)) { for (const c of node) strings(c, out); return out; }
      const el = node as { type?: unknown; props?: { children?: unknown } };
      if (typeof el.type === 'function') return strings((el.type as (q: unknown) => unknown)(el.props ?? {}), out);
      if (el.props && 'children' in el.props) strings(el.props.children, out);
      return out;
    };
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const pdf = strings(React.createElement(ExecutivePdf, { dto })).join('\n');
    const brief = JSON.stringify(generateSalesBrief({
      restaurantName: 'Harbor Grill', overallScore: overall.overallScore, coverageScore: overall.coverageScore,
      topLeaks: [...(p.opportunities as unknown as RankedOpportunity[])].sort((a, b) => b.rescuePriorityScore - a.rescuePriorityScore).slice(0, 3).map((o) => ({ ...o, recommendedSolution: '' })),
      journey: p.journey as never, evidence: p.evidence as never, recommendedTier: 'AI DISCOVERY AUDIT',
    }));
    const FAILURE = /transaction link on the website is failing|linked ordering destination failed/i;
    expect(ev.filter((e) => e.evidenceType === 'BROKEN_LINK')).toEqual([]);
    expect(opportunities.map((o) => o.category)).not.toContain('ONLINE ORDERING FAILURE RISK');
    expect(dto.findings.filter((f) => f.classification === 'VERIFIED FINDING' && FAILURE.test(f.title))).toEqual([]);
    expect(JSON.stringify(dto)).not.toMatch(FAILURE);
    expect(pdf).not.toMatch(FAILURE);
    expect(brief).not.toMatch(FAILURE);
  });
});

/**
 * L1: THE ORDERING-CHANNEL NOTE AND THE PROBE RECORD MUST AGREE.
 *
 * For a supplied URL that redirected, when tested, to an address the page
 * carries, the probe record (9e9cde1) said "the analyzed pages carry it only
 * in the page markup" while the ordering-channel note on the same report said
 * the supplied URL "was not found on the analyzed pages, so it says nothing
 * about what the website offers customers". The channel never received the
 * recorded redirect target, so it could not tell.
 *
 * Only a redirect recorded during the audit joins two addresses: a trailing-
 * slash variant with no recorded redirect is a different address, and keeps
 * the "not found" wording and its own outcome.
 */
describe('the ordering-channel note agrees with the probe record about a supplied URL', () => {
  const S = 'https://order.toasttab.com/online/harbor-grill';
  const TEL = '<a href="tel:+17275550100">Call to Order</a>';
  const NOT_FOUND_S = (url: string) => new RegExp(`provided for this audit \\(${url.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\) was not found on the analyzed pages`);
  const supplied = (url: string, extra: Partial<ProbeResult> = {}) =>
    reachable(url, 'ordering', { exposedInCustomerJourney: false, suppliedForAudit: true, ...extra });
  const channelContext = (r: ReturnType<typeof run>) => r.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.supportingContext!;

  for (const [label, from, to] of [['no slash → slash', S, `${S}/`], ['slash → no slash', `${S}/`, S]] as const) {
    it(`redirect to a markup-only address (${label}): the channel names the redirect and the markup, never "not found"`, () => {
      const r = run(`${BARE_PAGE}${TEL}<iframe src="${to}" title="Order online"></iframe>`, [supplied(from, { finalUrl: to })]);
      const ctx = channelContext(r);
      expect(ctx).not.toMatch(NOT_FOUND_S(from));
      expect(ctx).toContain(
        `An ordering URL provided for this audit (${from}) redirected, when tested, to an address the page carries only in its markup (${to}); it is not a visible link customers are offered.`,
      );
      // And the probe record says the same thing in its own words.
      expect(probeRecord(r.evidence, from)!.supportingContext).toContain('the analyzed pages carry it only in the page markup, not as a visible link');
    });

    it(`redirect to a visible link (${label}): the channel says the page offers it as a visible link, never "not found"`, () => {
      const r = run(`${BARE_PAGE}${TEL}<a href="${to}">Order Online</a>`, [supplied(from, { finalUrl: to })]);
      const ctx = channelContext(r);
      expect(ctx).not.toMatch(NOT_FOUND_S(from));
      expect(ctx).toContain(
        `An ordering URL provided for this audit (${from}) redirected, when tested, to an address the page offers as a visible link (${to}).`,
      );
      expect(probeRecord(r.evidence, from)!.supportingContext ?? '').not.toMatch(/was not found on the analyzed pages/);
    });

    it(`no recorded redirect (${label}): a trailing-slash variant is a different address — "not found" is kept, outcomes stay separate`, () => {
      const r = run(`${BARE_PAGE}${TEL}<iframe src="${to}" title="Order online"></iframe>`, [
        supplied(from, { ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP' }),
        reachable(to, 'ordering', { exposedInCustomerJourney: false, suppliedForAudit: false }),
      ]);
      expect(channelContext(r)).toMatch(NOT_FOUND_S(from));
      expect(probeRecord(r.evidence, from)!.fact).toMatch(/could not be verified when tested \(HTTP 404\)/);
      expect(probeRecord(r.evidence, to)!.fact).toMatch(/is reachable/);
    });
  }

  it('redirect to an address that is not on the page: the historical "not found" sentence is kept verbatim', () => {
    const r = run(`${BARE_PAGE}${TEL}`, [supplied(S, { finalUrl: 'https://order.toasttab.com/online/elsewhere' })]);
    expect(channelContext(r)).toContain(
      `An ordering URL provided for this audit (${S}) was not found on the analyzed pages, so it says nothing about what the website offers customers.`,
    );
  });

  it('absent from the page, no redirect: the historical "not found" sentence is kept verbatim', () => {
    const r = run(`${BARE_PAGE}${TEL}`, [supplied(S)]);
    expect(channelContext(r)).toContain(
      `An ordering URL provided for this audit (${S}) was not found on the analyzed pages, so it says nothing about what the website offers customers.`,
    );
  });

  it('resolveOrderingChannel reads the recorded redirect target directly', () => {
    const base = { phoneOrderCtas: ['Call to Order'], onlineLabelledPhoneCtas: [], probes: [], widgetVendor: null };
    const markup: OrderingDestination = { url: `${S}/`, exposedInCustomerJourney: false, platform: 'Toast', host: 'order.toasttab.com', discoveredVia: 'PAGE_MARKUP', ctaText: null };
    const sup: OrderingDestination = { url: S, finalUrl: `${S}/`, exposedInCustomerJourney: false, platform: 'Toast', host: 'order.toasttab.com', suppliedForAudit: true };
    const withRedirect = resolveOrderingChannel({ ...base, destinations: [markup, sup] });
    expect(withRedirect.detail).toContain(`redirected, when tested, to an address the page carries only in its markup (${S}/)`);
    const { finalUrl: _f, ...noRedirect } = sup;
    expect(resolveOrderingChannel({ ...base, destinations: [markup, noRedirect] }).detail).toMatch(NOT_FOUND_S(S));
  });

  it('every corrected channel note publishes as approved wording in the report (never withheld)', () => {
    const ctx = { sources: [{ id: 's1', url: SITE, pageTitle: 'Harbor Grill', sourceType: 'HOMEPAGE' }], restaurant: { name: 'Harbor Grill', websiteUrl: SITE }, suppliedUrls: [S] };
    for (const [body, finalUrl] of [
      [`${BARE_PAGE}${TEL}<iframe src="${S}/" title="Order online"></iframe>`, `${S}/`],
      [`${BARE_PAGE}${TEL}<a href="${S}/">Order Online</a>`, `${S}/`],
      [`${BARE_PAGE}${TEL}`, undefined],
    ] as const) {
      const text = channelContext(run(body, [supplied(S, finalUrl ? { finalUrl } : {})]));
      const published = publishEvidenceText('ORDERING_CHANNEL', 'supportingContext', text, ctx as never);
      expect(published.provenance, text).toBe('TEMPLATE');
      expect(published.text).toBe(text);
    }
  });

  it('the correction changes no state, evidence type, confidence, stage or score', () => {
    const page = `${BARE_PAGE}${TEL}<iframe src="${S}/" title="Order online"></iframe>`;
    const redirected = run(page, [supplied(S, { finalUrl: `${S}/` })]);
    const notRedirected = run(page, [supplied(S)]);
    expect(redirected.evidence.map((e) => [e.evidenceType, e.confidence, e.sourceUrl])).toEqual(notRedirected.evidence.map((e) => [e.evidenceType, e.confidence, e.sourceUrl]));
    expect(redirected.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.fact).toBe(notRedirected.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.fact);
    expect(redirected.journey.map((s) => [s.stage, s.status, s.confidence, s.finding])).toEqual(notRedirected.journey.map((s) => [s.stage, s.status, s.confidence, s.finding]));
    expect(redirected.categories).toEqual(notRedirected.categories);
    expect(redirected.overall).toEqual(notRedirected.overall);
  });
});
