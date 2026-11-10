/**
 * ISSUE #84 — A SUPPLIED URL THAT THE PAGE ALSO SHOWS AS A VISIBLE LINK.
 *
 * The audit tests each address once and queued every supplied URL as "not
 * offered to customers". When the operator supplied exactly the URL the page
 * links visibly, that link was never tested as customer-facing: a real 404
 * became "could not be verified", no BROKEN_LINK was recorded, and the ordering
 * channel and journey still told the client the destination was "linked and
 * reachable". The overall score came out 6 points higher than for the same
 * site with the URL not supplied.
 *
 * Rule pinned here: a supplied URL that the collected pages show as a visible
 * link in the SAME category as the field it was typed into (exact address) is
 * tested as customer-facing, and stays marked supplied. If the page links it
 * under a different category, the page's own link is still tested under that
 * category — so a URL typed into the wrong field can neither create a false
 * failure in that field's category nor hide the page link's real outcome. The audit then reports exactly what it reports for the
 * same site without the URL supplied — so any score change comes from correct
 * evidence, not from a scoring rule. Supplied URLs that are not visible links
 * (absent, embed-only, a trailing-slash variant, reached only by redirect) are
 * unchanged.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { extractPage, type PageExtract } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { buildProbeTargets } from '@/lib/audit/probeTargets';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { publishAuditObservations } from '@/lib/reports/observationPublication';
import { buildExecutiveReport, type ExecutiveReportInput } from '@/lib/reports/executive';
import { generateSalesBrief } from '@/lib/reports/sales';
import type { RankedOpportunity } from '@/lib/reports/owner';

const SITE = 'https://harborgrill.example/';
const FILLER = `<footer><p>${'Wood-fired seafood on the harbor since 1987, open daily for lunch and dinner. '.repeat(12)}</p></footer>`;
const ORDER = 'https://harborgrill.example/order-online';
const BOOK = 'https://www.opentable.com/r/harbor-grill';
const MENU = 'https://harborgrill.example/menu';
const page = (body: string, url = SITE) => extractPage(url, url, 200, 'text/html', `<html><body><h1>Harbor Grill</h1>${body}${FILLER}</body></html>`);

type Outcome = Partial<ProbeResult>;
const OK: Outcome = { ok: true, httpStatus: 200, note: 'HTTP 200' };
const E404: Outcome = { ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP' };
const E500: Outcome = { ok: false, httpStatus: 500, note: 'HTTP 500', failureKind: 'HTTP' };
const E405: Outcome = { ok: false, httpStatus: 405, note: 'HTTP 405 Method Not Allowed', failureKind: 'HTTP', methodNotAllowed: true };
const E403: Outcome = { ok: true, httpStatus: 403, note: 'HTTP 403 (access restricted)' };
const TIMEOUT: Outcome = { ok: false, note: 'Request timed out after 8s', failureKind: 'TIMEOUT' };
const DNS: Outcome = { ok: false, note: 'The address could not be resolved (no DNS record answered)', failureKind: 'NETWORK' };
const OFF: Outcome = { ok: true, httpStatus: 200, note: 'HTTP 200', disabledSignal: '"Online ordering is currently unavailable"' };

/** The audit pipeline from probe selection to every report surface, with probe outcomes faked per URL. */
async function audit(pages: PageExtract[], supplied: { ordering?: string; reservation?: string }, outcome: (url: string) => Outcome) {
  const targets = buildProbeTargets({ pages, reservationUrl: supplied.reservation, orderingUrl: supplied.ordering, collectedUrls: new Set(pages.map((p) => p.finalUrl)) });
  const probes: ProbeResult[] = targets.slice(0, 8).map((t) => ({
    url: t.url, category: t.category, exposedInCustomerJourney: t.exposed, suppliedForAudit: t.supplied, ok: true, note: '', ...outcome(t.url),
  } as ProbeResult));
  const evidence = normalizeEvidence({ pages, failures: [], probes })
    .map((e, i) => ({ id: `v${i}`, auditSourceId: 's1', ...e, supportingContext: e.supportingContext ?? null, sourceUrl: e.sourceUrl ?? null }));
  const journey = analyzeJourney(evidence).map((s, i) => ({ id: `j${i}`, ...s }));
  const scores = calculateCategoryScores(journey, evidence);
  const overall = calculateOverallScore(scores);
  const opportunities = detectRevenueLeaks({ evidence, journey });
  const published = publishAuditObservations({
    evidence, journey, opportunities, scores,
    context: { sources: [{ id: 's1', url: SITE, pageTitle: 'Harbor Grill', sourceType: 'HOMEPAGE' }], restaurant: { name: 'Harbor Grill', websiteUrl: SITE }, suppliedUrls: [supplied.ordering, supplied.reservation] },
  } as never);
  const dto = buildExecutiveReport({
    auditId: 'a', restaurantId: 'r', restaurantName: 'Harbor Grill', websiteUrl: SITE, location: null, auditDate: '2026-11-10', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: 'Winnersbookmark', consultantName: 'K', phone: '1', email: null, bookingUrl: null, fallbackText: 'x' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: overall.overallScore, coverageScore: overall.coverageScore, sourcesCollected: pages.length, sourcesFailed: 0,
    evidence: published.evidence.map(({ provenance: _p, auditSourceId: _s, ...e }) => e), opportunities: published.opportunities, journey: published.journey,
    categoryScores: published.scores, storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
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
    topLeaks: [...(published.opportunities as unknown as RankedOpportunity[])].sort((a, b) => b.rescuePriorityScore - a.rescuePriorityScore).slice(0, 3).map((o) => ({ ...o, recommendedSolution: '' })),
    journey: published.journey as never, evidence: published.evidence as never, recommendedTier: 'AI DISCOVERY AUDIT',
  }));
  return { targets, probes, evidence, journey, scores, overall, opportunities, dto, pdf, brief, report: JSON.stringify(dto) };
}

type Run = Awaited<ReturnType<typeof audit>>;
/** Everything a reader or the score sees, minus record ids. */
const visible = (r: Run) => ({
  evidence: r.evidence.map((e) => [e.evidenceType, e.confidence, e.sourceUrl, e.fact, e.supportingContext]),
  journey: r.journey.map((s) => [s.stage, s.status, s.confidence, s.finding]),
  scores: r.scores,
  overall: r.overall,
  findings: r.dto.findings.map((f) => [f.title, f.classification]),
});
const broken = (r: Run) => r.evidence.filter((e) => e.evidenceType === 'BROKEN_LINK');
const stage = (r: Run, s: string) => r.journey.find((x) => x.stage === s)!;
const LINKED_AND_REACHABLE = /linked and reachable/i;

describe('#84 reproduction: supplied URL = visible ordering link, HTTP 404', () => {
  const pages = [page(`<a href="${ORDER}">Order Online</a>`)];

  it('is tested once, as customer-facing, and stays marked supplied', () => {
    const targets = buildProbeTargets({ pages, orderingUrl: ORDER, collectedUrls: new Set() });
    expect(targets.map((t) => [t.url, t.category, t.exposed, t.supplied])).toEqual([[ORDER, 'ordering', true, true]]);
  });

  it('records the BROKEN_LINK, confirms the channel broken, and puts the journey at RISK', async () => {
    const r = await audit(pages, { ordering: ORDER }, () => E404);
    expect(broken(r).map((e) => e.fact)).toEqual(['The linked ordering destination failed when tested (HTTP 404).']);
    expect(r.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.fact).toMatch(/ONLINE_ORDERING_BROKEN_CONFIRMED/);
    expect(stage(r, 'ORDERING').status).toBe('RISK');
  });

  it('is identical to the same site with the URL not supplied — evidence, journey, scores and findings', async () => {
    const supplied = await audit(pages, { ordering: ORDER }, () => E404);
    const control = await audit(pages, {}, () => E404);
    expect(visible(supplied)).toEqual(visible(control));
    expect(supplied.overall.overallScore).toBe(control.overall.overallScore);
  });

  it('no report surface says the failed destination is "linked and reachable"', async () => {
    const r = await audit(pages, { ordering: ORDER }, () => E404);
    expect(r.report).not.toMatch(LINKED_AND_REACHABLE);
    expect(r.pdf).not.toMatch(LINKED_AND_REACHABLE);
    expect(r.brief).not.toMatch(LINKED_AND_REACHABLE);
  });

  it('the failure reaches the Executive Report, PDF and Sales Brief exactly as it does without the URL supplied', async () => {
    const supplied = await audit(pages, { ordering: ORDER }, () => E404);
    const control = await audit(pages, {}, () => E404);
    const FAILING = /failed when tested \(HTTP 404\)|transaction link on the website is failing/i;
    expect(FAILING.test(supplied.report)).toBe(FAILING.test(control.report));
    expect(FAILING.test(supplied.pdf)).toBe(FAILING.test(control.pdf));
    expect(FAILING.test(supplied.brief)).toBe(FAILING.test(control.brief));
    expect(FAILING.test(supplied.report)).toBe(true);
  });

  it('provenance is kept on the probe: supplied and customer-facing', async () => {
    const r = await audit(pages, { ordering: ORDER }, () => E404);
    expect(r.probes.map((p) => [p.url, p.suppliedForAudit, p.exposedInCustomerJourney])).toEqual([[ORDER, true, true]]);
  });
});

describe('#84 reservation: supplied URL = visible booking link', () => {
  const pages = [page(`<a href="${BOOK}">Book a Table</a>`)];

  it('HTTP 404: BROKEN_LINK and RISK, identical to the unsupplied site', async () => {
    const supplied = await audit(pages, { reservation: BOOK }, () => E404);
    const control = await audit(pages, {}, () => E404);
    expect(broken(supplied).map((e) => e.fact)).toEqual(['The linked reservation destination failed when tested (HTTP 404).']);
    expect(stage(supplied, 'RESERVATION').status).toBe('RISK');
    expect(visible(supplied)).toEqual(visible(control));
  });
});

describe('#84 status-code and outcome variations: supplied-and-visible matches the unsupplied site', () => {
  const cases: [string, Outcome][] = [
    ['HTTP 200', OK], ['HTTP 404', E404], ['HTTP 500', E500], ['HTTP 405 method not allowed', E405],
    ['HTTP 403 access restricted', E403], ['timeout', TIMEOUT], ['DNS failure', DNS], ['service unavailable', OFF],
  ];
  for (const [label, outcome] of cases) {
    it(`ordering, ${label}`, async () => {
      const pages = [page(`<a href="${ORDER}">Order Online</a>`)];
      expect(visible(await audit(pages, { ordering: ORDER }, () => outcome))).toEqual(visible(await audit(pages, {}, () => outcome)));
    });
    it(`reservation, ${label}`, async () => {
      const pages = [page(`<a href="${BOOK}">Book a Table</a>`)];
      expect(visible(await audit(pages, { reservation: BOOK }, () => outcome))).toEqual(visible(await audit(pages, {}, () => outcome)));
    });
  }

  it('both pathways supplied and visibly linked, both 404', async () => {
    const pages = [page(`<a href="${BOOK}">Book a Table</a><a href="${ORDER}">Order Online</a>`)];
    const supplied = await audit(pages, { ordering: ORDER, reservation: BOOK }, () => E404);
    expect(broken(supplied).length).toBe(2);
    expect(visible(supplied)).toEqual(visible(await audit(pages, {}, () => E404)));
  });

  it('the visible link is on a second collected page', async () => {
    const pages = [page('<p>Welcome.</p>'), page(`<a href="${ORDER}">Order Online</a>`, 'https://harborgrill.example/about')];
    const r = await audit(pages, { ordering: ORDER }, () => E404);
    expect(r.targets[0]).toMatchObject({ url: ORDER, exposed: true, supplied: true });
    expect(broken(r).length).toBe(1);
  });
});

describe('#84 does not widen exposure: supplied URLs that are not visible links are unchanged', () => {
  it('absent from the page, HTTP 404: not exposed, no BROKEN_LINK', async () => {
    const r = await audit([page('<p>Visit us.</p>')], { ordering: ORDER }, () => E404);
    expect(r.targets.map((t) => [t.url, t.exposed, t.supplied])).toEqual([[ORDER, false, true]]);
    expect(broken(r)).toEqual([]);
  });

  it('only in an iframe (embed), HTTP 404: not exposed, no BROKEN_LINK', async () => {
    const IFRAME = 'https://order.toasttab.com/online/harbor-grill';
    const r = await audit([page(`<iframe src="${IFRAME}" title="Order online"></iframe>`)], { ordering: IFRAME }, () => E404);
    expect(r.targets.map((t) => [t.url, t.exposed, t.supplied])).toEqual([[IFRAME, false, true]]);
    expect(broken(r)).toEqual([]);
  });

  for (const [label, linked, typed] of [
    ['page links slash, operator typed none', `${ORDER}/`, ORDER],
    ['page links none, operator typed slash', ORDER, `${ORDER}/`],
  ] as const) {
    it(`trailing-slash variant (${label}): two addresses, each with its own exposure and outcome`, async () => {
      const r = await audit([page(`<a href="${linked}">Order Online</a>`)], { ordering: typed }, (u) => (u === linked ? E404 : OK));
      expect(r.targets.map((t) => [t.url, t.exposed, t.supplied])).toEqual([[typed, false, true], [linked, true, false]]);
      expect(broken(r).map((e) => e.sourceUrl)).toEqual([linked]);
    });
  }

  it('a supplied URL that only redirects to the visible link stays unexposed; the visible link is still tested on its own', async () => {
    const TYPED = 'https://harborgrill.example/order';
    const r = await audit([page(`<a href="${ORDER}">Order Online</a>`)], { ordering: TYPED }, (u) => (u === TYPED ? { ...E404, finalUrl: ORDER } : E404));
    expect(r.targets.map((t) => [t.url, t.exposed, t.supplied])).toEqual([[TYPED, false, true], [ORDER, true, false]]);
    expect(broken(r).map((e) => e.sourceUrl)).toEqual([ORDER]);
  });
});

describe('#84 review fix: a supplied URL is customer-facing only in the category of the field it was typed into', () => {
  const CATERING = 'https://harborgrill.example/catering';
  const channelFact = (r: Run) => r.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.fact;

  it('the page\'s menu link supplied as the ordering URL, 404: no VERIFIED ordering failure; the menu link fails as a menu link, as on the unsupplied site', async () => {
    const pages = [page(`<a href="${MENU}">Menu</a>`)];
    const supplied = await audit(pages, { ordering: MENU }, () => E404);
    const control = await audit(pages, {}, () => E404);
    // The supplied ordering test keeps its provenance and is not customer-facing;
    // the page's own menu link is still tested, as customer-facing, under menu.
    expect(supplied.targets.map((t) => [t.url, t.category, t.exposed, t.supplied])).toEqual([[MENU, 'ordering', false, true], [MENU, 'menu', true, false]]);
    expect(channelFact(supplied)).not.toMatch(/ONLINE_ORDERING_BROKEN_CONFIRMED/);
    expect(stage(supplied, 'ORDERING').status).not.toBe('RISK');
    expect(broken(supplied).map((e) => e.fact)).toEqual(broken(control).map((e) => e.fact));
    expect(broken(supplied).map((e) => e.fact)).toEqual(['The linked menu destination failed when tested (HTTP 404).']);
    expect(stage(supplied, 'MENU').status).toBe(stage(control, 'MENU').status);
    expect(supplied.dto.findings.map((f) => f.title)).not.toContain('A transaction link on the website is failing');
  });

  it('the page\'s catering link supplied as the ordering URL, 404: no BROKEN_LINK and no VERIFIED ordering failure', async () => {
    const supplied = await audit([page(`<a href="${CATERING}">Catering</a>`)], { ordering: CATERING }, () => E404);
    expect(supplied.targets.map((t) => [t.url, t.category, t.exposed, t.supplied])).toEqual([[CATERING, 'ordering', false, true]]);
    expect(broken(supplied)).toEqual([]);
    expect(channelFact(supplied)).not.toMatch(/ONLINE_ORDERING_BROKEN_CONFIRMED/);
    expect(stage(supplied, 'ORDERING').status).not.toBe('RISK');
    expect(supplied.report).not.toMatch(/transaction link on the website is failing/i);
  });

  for (const [label, fields] of [
    ['ordering URL typed into the reservation field', { reservation: ORDER }],
    ['the same URL typed into both fields', { reservation: ORDER, ordering: ORDER }],
  ] as const) {
    it(`${label}, 404: the ordering link still fails as ordering, no false reservation BROKEN_LINK, no "linked and reachable"`, async () => {
      const pages = [page(`<a href="${ORDER}">Order Online</a>`)];
      const supplied = await audit(pages, fields, () => E404);
      const control = await audit(pages, {}, () => E404);
      expect(supplied.targets.map((t) => [t.url, t.category, t.exposed, t.supplied])).toEqual([[ORDER, 'reservation', false, true], [ORDER, 'ordering', true, false]]);
      expect(broken(supplied).map((e) => e.fact)).toEqual(['The linked ordering destination failed when tested (HTTP 404).']);
      expect(channelFact(supplied)).toMatch(/ONLINE_ORDERING_BROKEN_CONFIRMED/);
      expect(stage(supplied, 'ORDERING').status).toBe(stage(control, 'ORDERING').status);
      expect(stage(supplied, 'RESERVATION').status).not.toBe('RISK');
      for (const surface of [supplied.report, supplied.pdf, supplied.brief]) expect(surface).not.toMatch(LINKED_AND_REACHABLE);
    });
  }
});

describe('#84 more in-category outcome variations match the unsupplied site', () => {
  const E401: Outcome = { ok: true, httpStatus: 401, note: 'HTTP 401 (access restricted)' };
  const E429: Outcome = { ok: true, httpStatus: 429, note: 'HTTP 429 (access restricted)' };
  const E503: Outcome = { ok: false, httpStatus: 503, note: 'HTTP 503', failureKind: 'HTTP' };
  const BLOCKED: Outcome = { ok: false, note: 'Rejected by safety policy: private address', failureKind: 'BLOCKED' };
  const cases: [string, (u: string) => Outcome][] = [
    ['redirect, then 404', () => ({ ...E404, finalUrl: 'https://harborgrill.example/order-moved' })],
    ['redirect, then 200', () => ({ ...OK, finalUrl: 'https://harborgrill.example/order-moved' })],
    ['HTTP 401', () => E401], ['HTTP 429', () => E429], ['HTTP 503', () => E503], ['blocked by safety policy', () => BLOCKED],
  ];
  for (const [label, outcome] of cases) {
    it(`ordering, ${label}`, async () => {
      const pages = [page(`<a href="${ORDER}">Order Online</a>`)];
      expect(visible(await audit(pages, { ordering: ORDER }, outcome))).toEqual(visible(await audit(pages, {}, outcome)));
    });
    it(`reservation, ${label}`, async () => {
      const pages = [page(`<a href="${BOOK}">Book a Table</a>`)];
      expect(visible(await audit(pages, { reservation: BOOK }, outcome))).toEqual(visible(await audit(pages, {}, outcome)));
    });
  }
});
