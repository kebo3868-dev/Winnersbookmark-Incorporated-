/**
 * PROBE PROVENANCE — where a tested URL came from, stated accurately.
 *
 * A reservation or ordering URL typed into the audit form is probed alongside
 * the destinations the website offers. When such a URL could not be reached,
 * the evidence said it was not reported as a failure because "the destination
 * appears only in the page markup" — a statement about the restaurant's
 * website, made about a URL the website never mentions. It reached the client
 * report's evidence appendix.
 *
 * The rule pinned here: a URL is described as being in the page markup, or as
 * a link on the page, only when the collected pages show it there. Being probed
 * establishes nothing about where a URL came from.
 *
 * Only the explanation changes. The fact a stage is classified from, and the
 * decision not to report a failure, stay exactly as they were.
 */
import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { presentEvidenceText } from '@/lib/reports/executive';

const SITE = 'https://leverocks.example/';
const FILLER = `<footer><p>${'Fresh Gulf seafood since 1948, served on Pasadena Avenue. '.repeat(12)}</p></footer>`;
const SUPPLIED_ORDER = 'https://order.supplied-by-operator.example/leverocks';
const SUPPLIED_BOOKING = 'https://book.supplied-by-operator.example/leverocks';
const MARKUP_ORDER = 'https://tmt.spotapps.co/ordering-menu/?spot_id=';
const LINKED_BOOKING = 'https://www.opentable.com/r/leverocks-st-petersburg';

const MARKUP_PROVENANCE = /appears only in the page markup/;
const SUPPLIED_PROVENANCE = /provided for this audit/;

/** An unreachable probe — the branch whose explanation was wrong. */
const unreachable = (url: string, category: ProbeResult['category'], exposedInCustomerJourney?: boolean): ProbeResult => ({
  url, category, ok: false, note: 'The address could not be resolved (no DNS record answered)', failureKind: 'NETWORK',
  ...(exposedInCustomerJourney === undefined ? {} : { exposedInCustomerJourney }),
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
  return { evidence, journey, categories, overall: calculateOverallScore(categories) };
}

/** The probe-outcome record for one URL. */
const recordFor = (evidence: ReturnType<typeof run>['evidence'], url: string) =>
  evidence.find((e) => e.sourceUrl === url && /could not be verified when tested/.test(e.fact));

const PAGE = '<h1>Leverock\'s</h1><p>Call <a href="tel:+17273674588">(727) 367-4588</a></p>';

describe('an unreachable URL supplied on the audit form', () => {
  it('ordering: is identified as provided for the audit, never as page markup', () => {
    const { evidence } = run(PAGE, [unreachable(SUPPLIED_ORDER, 'ordering', false)]);
    const record = recordFor(evidence, SUPPLIED_ORDER)!;
    expect(record.supportingContext).not.toMatch(MARKUP_PROVENANCE);
    expect(record.supportingContext).toContain(
      `${SUPPLIED_ORDER}. Not reported as a failure because this URL was provided for this audit and was not found on the analyzed pages`,
    );
  });

  it('reservation: the same correction applies', () => {
    const { evidence } = run(PAGE, [unreachable(SUPPLIED_BOOKING, 'reservation', false)]);
    const record = recordFor(evidence, SUPPLIED_BOOKING)!;
    expect(record.evidenceType).toBe('RESERVATION_PATH');
    expect(record.supportingContext).not.toMatch(MARKUP_PROVENANCE);
    expect(record.supportingContext).toMatch(SUPPLIED_PROVENANCE);
  });

  it('reads accurately in the client report appendix', () => {
    const { evidence } = run(PAGE, [unreachable(SUPPLIED_ORDER, 'ordering', false)]);
    const shown = presentEvidenceText(recordFor(evidence, SUPPLIED_ORDER)!.supportingContext!);
    expect(shown).toMatch(/provided for this audit and was not found on the analyzed pages/);
    expect(shown).not.toMatch(/page markup/);
  });
});

describe('an unreachable URL the website itself declares', () => {
  it('markup only: keeps the page-markup explanation, with no supplied claim', () => {
    const { evidence } = run(`${PAGE}<div data-ordering-url="${MARKUP_ORDER}"></div>`, [unreachable(MARKUP_ORDER, 'ordering', false)]);
    const record = recordFor(evidence, MARKUP_ORDER)!;
    expect(record.supportingContext).toMatch(MARKUP_PROVENANCE);
    expect(record.supportingContext).not.toMatch(SUPPLIED_PROVENANCE);
  });
});

describe('mixed provenance', () => {
  it('a markup URL and a separate supplied URL are each explained by their own source', () => {
    const { evidence } = run(`${PAGE}<div data-ordering-url="${MARKUP_ORDER}"></div>`, [
      unreachable(SUPPLIED_ORDER, 'ordering', false),
      unreachable(MARKUP_ORDER, 'ordering', false),
    ]);
    expect(recordFor(evidence, SUPPLIED_ORDER)!.supportingContext).toMatch(SUPPLIED_PROVENANCE);
    expect(recordFor(evidence, SUPPLIED_ORDER)!.supportingContext).not.toMatch(MARKUP_PROVENANCE);
    expect(recordFor(evidence, MARKUP_ORDER)!.supportingContext).toMatch(MARKUP_PROVENANCE);
    expect(recordFor(evidence, MARKUP_ORDER)!.supportingContext).not.toMatch(SUPPLIED_PROVENANCE);
  });

  it('a supplied URL that is also a visible link says so, rather than "only in the page markup"', () => {
    // The supplied URL is probed first, as an owner hint, so it arrives
    // unexposed even though the page links to it.
    const { evidence } = run(`${PAGE}<a href="${LINKED_BOOKING}">Book a table</a>`, [unreachable(LINKED_BOOKING, 'reservation', false)]);
    const record = recordFor(evidence, LINKED_BOOKING)!;
    expect(record.supportingContext).not.toMatch(MARKUP_PROVENANCE);
    expect(record.supportingContext).toMatch(/provided for this audit and also appears as a visible link on the analyzed pages/);
  });
});

describe('the correction claims no provenance it cannot show, and changes nothing else', () => {
  it('a URL that is not on the page is never described as being on the page', () => {
    const { evidence } = run(PAGE, [unreachable(SUPPLIED_ORDER, 'ordering', false)]);
    expect(recordFor(evidence, SUPPLIED_ORDER)!.supportingContext).not.toMatch(/page markup|visible link on the analyzed pages/);
  });

  it('the fact, confidence and evidence type are unchanged, so no stage reads it differently', () => {
    const { evidence } = run(PAGE, [unreachable(SUPPLIED_ORDER, 'ordering', false), unreachable(SUPPLIED_BOOKING, 'reservation', false)]);
    const order = recordFor(evidence, SUPPLIED_ORDER)!;
    expect(order.fact).toBe(
      'The ordering destination could not be verified when tested (The address could not be resolved (no DNS record answered)) — manual validation required.',
    );
    expect(order.confidence).toBe(55);
    expect(order.evidenceType).toBe('ORDERING_PATH');
    expect(evidence.some((e) => e.evidenceType === 'BROKEN_LINK')).toBe(false);
  });

  it('journey statuses match the same page with nothing supplied, and scores match 67de5d9', () => {
    // An unreachable supplied URL that is not on the page moves no stage. It
    // does add evidence records, which AI readiness counts, so the scores are
    // pinned from 67de5d9 for this exact input: a wording change must move
    // none of them.
    const withSupplied = run(PAGE, [unreachable(SUPPLIED_ORDER, 'ordering', false), unreachable(SUPPLIED_BOOKING, 'reservation', false)]);
    const without = run(PAGE, []);
    expect(withSupplied.journey.map((s) => [s.stage, s.status])).toEqual(without.journey.map((s) => [s.stage, s.status]));
    expect(withSupplied.journey.find((s) => s.stage === 'RESERVATION')?.status).toBe('UNKNOWN');
    expect(withSupplied.journey.find((s) => s.stage === 'ORDERING')?.status).toBe('UNKNOWN');
    expect(withSupplied.categories.map((c) => [c.category, c.score])).toEqual([
      ['DIGITAL_CUSTOMER_JOURNEY', 45],
      ['WEBSITE_CONVERSION', 30],
      ['PHONE_RESPONSE_READINESS', 90],
      ['RESERVATION_EXPERIENCE', null],
      ['ONLINE_ORDERING_EXPERIENCE', null],
      ['CUSTOMER_RETENTION', 60],
      ['REVIEW_REPUTATION_SYSTEM', null],
      ['LOCAL_DIGITAL_PRESENCE', 33],
      ['AI_AUTOMATION_READINESS', 29],
    ]);
    expect([withSupplied.overall.overallScore, withSupplied.overall.coverageScore]).toEqual([51, 70]);
  });

  it('a visible page link that fails is still a customer-facing failure — the verdict is untouched', () => {
    const { evidence } = run(`${PAGE}<a href="${LINKED_BOOKING}">Book a table</a>`, [
      { url: LINKED_BOOKING, category: 'reservation', ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP', exposedInCustomerJourney: true },
    ]);
    const broken = evidence.find((e) => e.evidenceType === 'BROKEN_LINK');
    expect(broken?.fact).toBe('The linked reservation destination failed when tested (HTTP 404).');
    expect(broken?.supportingContext).not.toMatch(SUPPLIED_PROVENANCE);
  });
});
