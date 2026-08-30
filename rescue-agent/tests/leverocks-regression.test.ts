import { describe, expect, it } from 'vitest';
import { sanitizeUrlInput } from '@/lib/validation/urlSanitize';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { rankOpportunities } from '@/lib/scoring/priority';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { generateOwnerReport } from '@/lib/reports/owner';
import { generateSalesBrief } from '@/lib/reports/sales';
import { buildExecutiveReport } from '@/lib/reports/executive';
import { resolveRestaurantName } from '@/lib/audit/restaurantName';
import { parseOrderingChannelFact } from '@/lib/audit/orderingChannel';
import { containsDefinitiveFailureLanguage, stateForOpportunity } from '@/lib/audit/evidenceState';
import { getContact } from '@/lib/config';

/**
 * THE LEVEROCK'S REGRESSION
 *
 * One fixture reproducing every defect this work was commissioned for, driven
 * through the real pipeline modules in the real order:
 *
 *   sanitize → collect → evidence → journey → leaks → score → reports
 *
 * The fixture is the shape of the live site as documented in the existing
 * telephone-precedence and SpotHopper tests: an ORDER button that dials the
 * phone, a SpotHopper reservation widget, a SpotHopper API endpoint that only
 * accepts POST, and a "Website design" vendor credit in the footer.
 *
 * The Rescue Score is NOT asserted against the previous value of 66. The
 * corrected evidence model may legitimately move it; what is asserted is that it
 * is deterministically recomputed from the corrected evidence.
 */

const SITE_URL = 'https://leverocks.example/';

const LEVEROCKS_HTML = `
  <title>Leverock's Great Seafood | Waterfront Dining in St. Pete</title>
  <meta name="description" content="Fresh Gulf seafood on the waterfront since 1948." />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:site_name" content="Leverock's Great Seafood" />
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Restaurant","name":"Leverock's Great Seafood",
     "telephone":"(727) 555-1234","address":"4801 37th Street South, St. Petersburg"}
  </script>
  <h1>Leverock's Great Seafood</h1>

  <nav>
    <a href="/menu">Menu</a>
    <a href="/contact">Contact Us</a>
    <a href="/hours">Hours</a>
  </nav>

  <h2>ORDER ONLINE</h2>
  <a href="tel:+17275551234">ORDER</a>

  <a href="https://www.spothopperapp.com/reservations/leverocks-seafood">Book a Table</a>
  <script src="https://www.spothopperapp.com/widget.js"></script>
  <script>
    window.SH_CONFIG = {
      orderUrl: "https://www.spothopperapp.com/order-online/leverocks-seafood",
      api: "https://www.spothopperapp.com/api/v2/reservations"
    };
  </script>

  <p>Mon - Sun 11:30 AM - 10:00 PM. 4801 37th Street South, St. Petersburg. Call (727) 555-1234.</p>

  <footer>
    <a href="https://www.spothopperapp.com/restaurant-website-design/?utm_source=leverocks">Website design</a>
    <a href="/privacy-policy">Privacy Policy</a>
    <a href="https://www.facebook.com/leverocks">Facebook</a>
  </footer>
`;

/** The SpotHopper reservation API. POST-only, so a GET probe gets 405. */
const RESERVATION_API_PROBE: ProbeResult = {
  url: 'https://www.spothopperapp.com/api/v2/reservations',
  category: 'reservation',
  ok: false,
  httpStatus: 405,
  note: 'HTTP 405',
  failureKind: 'HTTP',
  exposedInCustomerJourney: false,
};

/** The customer-facing booking page, which answers normally. */
const RESERVATION_PAGE_PROBE: ProbeResult = {
  url: 'https://www.spothopperapp.com/reservations/leverocks-seafood',
  category: 'reservation',
  ok: true,
  httpStatus: 200,
  note: 'HTTP 200',
  exposedInCustomerJourney: true,
};

function runPipeline() {
  // A — clean URL accepted. B — the invisible-character variant sanitizes to it.
  const clean = sanitizeUrlInput('https://leverocks.example/');
  const dirty = sanitizeUrlInput('https://leverocks.example/%E2%81%A0');
  if (!clean.ok || !dirty.ok) throw new Error('sanitization failed');

  // C — homepage collection.
  const home = extractPage(SITE_URL, SITE_URL, 200, 'text/html', LEVEROCKS_HTML);

  // E — name resolution from the site's own metadata.
  const name = resolveRestaurantName({
    structuredNames: home.structuredNames,
    ogSiteName: home.ogSiteName,
    ogTitle: home.ogTitle,
    pageTitle: home.title,
    h1: home.h1,
    userProvided: 'Leverocks Great Seafood',
    hostname: 'leverocks.example',
  });

  // D — evidence chain.
  const evidenceInputs = normalizeEvidence({
    pages: [home],
    failures: [],
    probes: [RESERVATION_API_PROBE, RESERVATION_PAGE_PROBE],
  });
  const evidence = evidenceInputs.map((e, i) => ({
    id: `e${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    supportingContext: e.supportingContext ?? null,
    confidence: e.confidence,
    sourceUrl: e.sourceUrl,
  }));

  const journey = analyzeJourney(evidence);
  const ranked = rankOpportunities(detectRevenueLeaks({ evidence, journey }));
  const categories = calculateCategoryScores(journey, evidence);
  const overall = calculateOverallScore(categories);
  const topLeaks = ranked.slice(0, 3);

  const ownerReport = generateOwnerReport({
    restaurantName: name.name,
    websiteUrl: clean.normalized,
    location: 'St. Petersburg, FL',
    auditStatus: 'COMPLETED',
    demoMode: false,
    overallScore: overall.overallScore,
    coverageScore: overall.coverageScore,
    scoreExplanation: overall.explanation,
    categories,
    journey,
    topLeaks,
    evidence,
    aiNarrative: null,
  });

  const brief = generateSalesBrief({
    restaurantName: name.name,
    overallScore: overall.overallScore,
    coverageScore: overall.coverageScore,
    topLeaks,
    journey,
    evidence,
    recommendedTier: ownerReport.recommendation.tier,
  });

  const executive = buildExecutiveReport({
    auditId: 'clxleverocksregression',
    restaurantName: name.name,
    websiteUrl: clean.normalized,
    location: 'St. Petersburg, FL',
    auditDate: '2026-08-29',
    auditStatus: 'COMPLETED',
    demoMode: false,
    contact: getContact({}),
    bookingQrDataUrl: null,
    avgTicket: null,
    overallScore: overall.overallScore,
    coverageScore: overall.coverageScore,
    sourcesCollected: 1,
    sourcesFailed: 0,
    evidence,
    opportunities: ranked,
    journey,
    categoryScores: categories,
    storedSummary: ownerReport.executiveSummary,
    storedSummaryWasAiEnhanced: false,
    storedRecommendation: ownerReport.recommendation,
  });

  return { clean, dirty, home, name, evidence, journey, ranked, categories, overall, ownerReport, brief, executive };
}

const run = runPipeline();

describe('A / B — URL intake', () => {
  it('A: accepts the clean URL unchanged', () => {
    expect(run.clean.normalized).toBe('https://leverocks.example');
    // The only change is dropping the bare trailing slash on a root URL, which
    // is what keeps `.com` and `.com/` one audit rather than two.
    expect(run.clean.removals).toHaveLength(0);
  });

  it('B: sanitizes the invisible-character variant to exactly the same URL', () => {
    expect(run.dirty.normalized).toBe(run.clean.normalized);
    expect(run.dirty.removals.map((r) => r.codePoint)).toContain('U+2060');
  });
});

describe('C / D — collection and evidence', () => {
  it('C: homepage collection returns normally', () => {
    expect(run.home.title).toContain("Leverock's Great Seafood");
    expect(run.home.phones.length).toBeGreaterThan(0);
    expect(run.home.hoursText).toBeTruthy();
    expect(run.home.addressText).toBeTruthy();
  });

  it('D: an evidence chain is generated', () => {
    expect(run.evidence.length).toBeGreaterThan(10);
    expect(new Set(run.evidence.map((e) => e.evidenceType)).size).toBeGreaterThan(6);
  });
});

describe('E — restaurant name', () => {
  it('becomes "Leverock\'s Great Seafood", apostrophe intact', () => {
    expect(run.name.name).toBe("Leverock's Great Seafood");
    expect(run.name.source).toBe('STRUCTURED_DATA');
  });

  it('carries that spelling into every report surface', () => {
    expect(run.ownerReport.header.restaurantName).toBe("Leverock's Great Seafood");
    expect(run.executive.cover.restaurantName).toBe("Leverock's Great Seafood");
    expect(run.brief.emailOpener).toContain("Leverock's Great Seafood");
  });
});

describe('F — phone ordering is distinguished from online ordering', () => {
  const channel = () => {
    const record = run.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;
    return { record, marker: parseOrderingChannelFact(record.fact)! };
  };

  it('classifies the channel as PHONE_ORDERING_ONLY', () => {
    expect(channel().marker.state).toBe('PHONE_ORDERING_ONLY');
  });

  it('says it is a legitimate pathway AND not online ordering', () => {
    expect(channel().record.fact).toMatch(/legitimate ordering pathway/i);
    expect(channel().record.fact).toMatch(/not online ordering/i);
  });

  it('never reports the widget-config order URL as working online ordering', () => {
    const stage = run.journey.find((s) => s.stage === 'ORDERING');
    expect(stage?.status).toBe('FRICTION');
    expect(stage?.status).not.toBe('HEALTHY');
  });
});

describe('G — the HTTP 405 false positive is gone', () => {
  it('no BROKEN_LINK evidence is produced from the reservation API', () => {
    expect(run.evidence.filter((e) => e.evidenceType === 'BROKEN_LINK')).toHaveLength(0);
  });

  it('the reservation stage is not a dead end', () => {
    const stage = run.journey.find((s) => s.stage === 'RESERVATION');
    expect(stage?.status).not.toBe('RISK');
    expect(stage?.finding).not.toMatch(/dead end/i);
  });

  it('the raw 405 is preserved for debugging', () => {
    const diagnostic = run.evidence.find((e) => e.supportingContext?.includes('/api/v2/reservations'));
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.supportingContext).toMatch(/API_ENDPOINT/);
  });
});

describe('H — the vendor credit is not contact evidence', () => {
  it('keeps the SpotHopper credit out of every categorized pathway', () => {
    for (const links of Object.values(run.home.categorizedLinks)) {
      for (const link of links ?? []) {
        expect(link.href, link.text).not.toMatch(/restaurant-website-design/);
      }
    }
  });

  it('records it as a vendor credit instead', () => {
    expect(run.home.vendorCredits.map((c) => c.text)).toContain('Website design');
  });

  it('the real /contact link is still counted', () => {
    expect((run.home.categorizedLinks.contact ?? []).map((l) => l.href)).toContain('https://leverocks.example/contact');
  });

  it('the privacy policy is not counted as a contact pathway either', () => {
    for (const link of run.home.categorizedLinks.contact ?? []) {
      expect(link.href).not.toMatch(/privacy/);
    }
  });
});

describe('I / J — scores are recomputed from the corrected evidence', () => {
  it('I: the Rescue Score is a deterministic number derived from the categories', () => {
    // Deliberately NOT asserted against the previous value of 66 — the corrected
    // evidence model may legitimately move it. What must hold is that it is
    // recomputed, in range, and reproducible.
    expect(run.overall.overallScore).not.toBeNull();
    expect(run.overall.overallScore!).toBeGreaterThanOrEqual(0);
    expect(run.overall.overallScore!).toBeLessThanOrEqual(100);
    expect(runPipeline().overall.overallScore).toBe(run.overall.overallScore);
  });

  it('J: coverage is recomputed from the categories that had evidence', () => {
    expect(run.overall.coverageScore).toBeGreaterThan(0);
    expect(run.overall.coverageScore).toBeLessThanOrEqual(100);
    const scored = run.categories.filter((c) => !c.insufficientData);
    const usedWeight = scored.reduce((s, c) => s + c.weight, 0);
    expect(run.overall.coverageScore).toBe(Math.round((usedWeight / 100) * 100));
  });

  it('the ordering category is scored rather than dropped', () => {
    // A restaurant that demonstrably takes orders by phone has an ordering
    // finding; dropping the category would silently reweight the whole score.
    const ordering = run.categories.find((c) => c.category === 'ONLINE_ORDERING_EXPERIENCE');
    expect(ordering?.insufficientData).toBe(false);
  });
});

describe('N / O / Q — the report surfaces render', () => {
  it('N: the executive report renders with findings and a journey map', () => {
    expect(run.executive.cover.restaurantName).toBeTruthy();
    expect(run.executive.journeyMap.length).toBeGreaterThan(5);
    expect(run.executive.methodologyAndLimitations.length).toBeGreaterThan(0);
  });

  it('O/P: the PDF DTO carries every section the document prints', () => {
    // The PDF renders from this DTO; a missing section is what produces a
    // clipped or blank page.
    expect(run.executive.snapshot).toBeTruthy();
    expect(run.executive.prescription).toBeTruthy();
    expect(run.executive.decisionBox).toBeTruthy();
    expect(run.executive.cta).toBeTruthy();
    expect(run.executive.valueSignals).toBeTruthy();
  });

  it('Q: the internal sales brief renders', () => {
    expect(run.brief.bestSalesAngle).toBeTruthy();
    expect(run.brief.discoveryQuestions.length).toBeGreaterThan(0);
    expect(run.brief.talkTrack).toBeTruthy();
  });
});

describe('R — the sales brief uses only evidence-safe claims', () => {
  it('makes no definitive failure claim about anything unverified', () => {
    const unverifiedLeads = run.ranked.filter((l) => stateForOpportunity(l) !== 'VERIFIED');
    if (unverifiedLeads.length === run.ranked.length) {
      for (const [field, text] of Object.entries(run.brief)) {
        if (typeof text !== 'string') continue;
        expect(containsDefinitiveFailureLanguage(text), `${field}: ${text}`).toBe(false);
      }
    }
  });

  it('never claims the reservation or ordering pathway is broken', () => {
    const all = Object.values(run.brief).filter((v): v is string => typeof v === 'string').join(' ');
    expect(all).not.toMatch(/reservations? (is|are) broken|ordering is broken|booking is broken/i);
  });
});

describe('S / T — methodology intact, nothing fabricated', () => {
  it('S: methodology and limitations survive', () => {
    expect(run.executive.methodologyAndLimitations.length).toBeGreaterThan(0);
    expect(run.executive.methodologyAndLimitations.join(' ')).toMatch(/public|not analyzed|could not/i);
    expect(run.ownerReport.assumptionsAndLimitations.length).toBeGreaterThan(0);
  });

  it('T: every finding is backed by at least one real evidence record', () => {
    const evidenceIds = new Set(run.evidence.map((e) => e.id));
    for (const leak of run.ranked) {
      expect(leak.evidenceIds.length, leak.title).toBeGreaterThan(0);
      for (const id of leak.evidenceIds) expect(evidenceIds.has(id), `${leak.title} cites ${id}`).toBe(true);
    }
  });

  it('T: every executive finding carries an explicit evidence classification', () => {
    for (const finding of run.executive.findings) {
      expect(
        ['VERIFIED FINDING', 'STRONG EVIDENCE', 'INFERRED OPPORTUNITY', 'MANUAL VALIDATION REQUIRED', 'INSUFFICIENT DATA'],
      ).toContain(finding.classification);
    }
  });

  it('T: the finding counters still add up to the findings printed', () => {
    const { verifiedCount, inferredCount, manualValidationCount, findingsCount } = run.executive.score;
    expect(verifiedCount + inferredCount + manualValidationCount).toBe(findingsCount);
    expect(findingsCount).toBe(run.executive.findings.length);
  });
});
