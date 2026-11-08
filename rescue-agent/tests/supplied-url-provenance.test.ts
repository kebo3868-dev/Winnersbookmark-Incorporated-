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
import { analyzeJourney } from '@/lib/audit/journey';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { presentEvidenceText } from '@/lib/reports/executive';

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
    expect(src).toMatch(/probeTargets\.push\(\{ url, category, exposed: false, supplied: true \}\)/);
    expect(src).toMatch(/probeTargets\.push\(\{ url: link\.href, category, exposed: link\.source === 'anchor', supplied: false \}\)/);
  });

  it('the marker is forwarded onto the ProbeResult', () => {
    expect(src).toMatch(/suppliedForAudit: target\.supplied/);
  });
});
