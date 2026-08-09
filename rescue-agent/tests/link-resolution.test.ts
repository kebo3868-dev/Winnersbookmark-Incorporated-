import { describe, expect, it } from 'vitest';
import { extractPage, detectWidgetVendor } from '@/lib/web/collector';
import { normalizeEvidence, detectPlatform } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';

/**
 * REGRESSION CASE: Leverock's Seafood.
 *
 * The audit collected 22 evidence items across 7 pages with zero failures, yet
 * Reservation and Ordering were UNKNOWN. The classifier was correct; link
 * extraction produced no reservation/ordering links to classify. Each test
 * below pins one of the four confirmed defects.
 */

const page = (html: string, url = 'https://leverocks.example/') =>
  extractPage(url, url, 200, 'text/html', html);

describe('defect 1 — JS-rendered widgets leave no anchor', () => {
  it('records third-party asset hosts before scripts are stripped', () => {
    const p = page(`<html><head>
      <script src="https://www.spothopperapp.com/widget.js"></script>
    </head><body><h1>Leverocks</h1></body></html>`);
    expect(p.assetHosts).toContain('www.spothopperapp.com');
    // SpotHopper provides both capabilities, so it resolves for either.
    expect(detectWidgetVendor(p.assetHosts, 'reservation')).toBe('SpotHopper');
    expect(detectWidgetVendor(p.assetHosts, 'ordering')).toBe('SpotHopper');
  });

  it('reports a detected widget as UNKNOWN with a reason — never as a working pathway', () => {
    const p = page(`<html><head>
      <script src="https://www.spothopperapp.com/widget.js"></script>
    </head><body><button>Book Now</button><button>Order Online</button></body></html>`);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });

    const reservation = evidence.find((e) => e.evidenceType === 'RESERVATION_PATH');
    expect(reservation?.fact).toMatch(/SpotHopper widget was detected/i);
    expect(reservation?.supportingContext).toMatch(/not evidence that a working pathway exists/i);

    const journey = analyzeJourney(
      evidence.map((e, i) => ({ id: `e${i}`, evidenceType: e.evidenceType, fact: e.fact, confidence: e.confidence, supportingContext: e.supportingContext ?? null })),
    );
    const stage = journey.find((s) => s.stage === 'RESERVATION');
    expect(stage?.status).toBe('UNKNOWN'); // must NOT be HEALTHY
    expect(stage?.finding).toMatch(/could not be verified/i);
    expect(stage?.manualValidationRequired).toBe(true);
  });
});

describe('defect 2 — vendor credits must never count as customer pathways', () => {
  it('excludes a "Powered by SpotHopper" footer credit from reservation/ordering links', () => {
    const p = page(`<html><body>
      <footer><a href="https://www.spothopperapp.com/">Powered by SpotHopper</a></footer>
    </body></html>`);
    expect(p.categorizedLinks.reservation ?? []).toHaveLength(0);
    expect(p.categorizedLinks.ordering ?? []).toHaveLength(0);
    expect(p.vendorCredits.map((v) => v.text)).toContain('Powered by SpotHopper');
  });

  it('records the credit as a technical signal, not a booking path', () => {
    const p = page(`<html><body>
      <footer><a href="https://www.spothopperapp.com/">Powered by SpotHopper</a></footer>
    </body></html>`);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    const tech = evidence.find((e) => e.evidenceType === 'TECHNICAL_SIGNAL' && /vendor credit/i.test(e.fact));
    expect(tech?.fact).toMatch(/SpotHopper/);
    expect(tech?.supportingContext).toMatch(/not a customer-facing booking or ordering pathway/i);

    // The decisive assertion: the credit alone must not make RESERVATION healthy.
    const journey = analyzeJourney(
      evidence.map((e, i) => ({ id: `e${i}`, evidenceType: e.evidenceType, fact: e.fact, confidence: e.confidence, supportingContext: e.supportingContext ?? null })),
    );
    expect(journey.find((s) => s.stage === 'RESERVATION')?.status).toBe('UNKNOWN');
  });

  it('still classifies a real SpotHopper booking link when it is a genuine CTA', () => {
    const p = page(`<html><body>
      <a href="https://www.spothopperapp.com/reservations/leverocks">Reserve a Table</a>
    </body></html>`);
    expect(p.categorizedLinks.reservation?.[0].href).toContain('spothopperapp.com');
    expect(detectPlatform(['https://www.spothopperapp.com/reservations/leverocks'])).toBe('SpotHopper');
    // The assertion this test was missing: a RESERVATION link must not also be
    // filed as ORDERING just because the vendor happens to offer both.
    expect(p.categorizedLinks.ordering ?? []).toHaveLength(0);
  });

  it('files a SpotHopper ordering link as ordering only', () => {
    const p = page(`<html><body>
      <a href="https://www.spothopperapp.com/order-online/leverocks">Order Online</a>
    </body></html>`);
    expect(p.categorizedLinks.ordering ?? []).toHaveLength(1);
    expect(p.categorizedLinks.reservation ?? []).toHaveLength(0);
  });

  it('does not report an ordering pathway for a reservations-only SpotHopper site', () => {
    const p = page(`<html><body>
      <a href="https://www.spothopperapp.com/reservations/leverocks">Reserve a Table</a>
    </body></html>`);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    const ordering = evidence.find((e) => e.evidenceType === 'ORDERING_PATH');
    expect(ordering?.fact).toMatch(/No public online ordering pathway was detected/i);

    const journey = analyzeJourney(
      evidence.map((e, i) => ({ id: `e${i}`, evidenceType: e.evidenceType, fact: e.fact, confidence: e.confidence, supportingContext: e.supportingContext ?? null })),
    );
    expect(journey.find((s) => s.stage === 'ORDERING')?.status).toBe('UNKNOWN'); // must NOT be HEALTHY
    expect(journey.find((s) => s.stage === 'RESERVATION')?.status).toBe('HEALTHY');
  });
});

describe('widget vendors are matched to the capability they actually provide', () => {
  it('an OpenTable script does not imply an ordering widget', () => {
    const p = page(`<html><head>
      <script src="https://www.opentable.com/widget.js"></script>
    </head><body><h1>Leverocks</h1></body></html>`);
    expect(detectWidgetVendor(p.assetHosts, 'reservation')).toBe('OpenTable');
    expect(detectWidgetVendor(p.assetHosts, 'ordering')).toBeNull();

    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    expect(evidence.find((e) => e.evidenceType === 'RESERVATION_PATH')?.fact).toMatch(/OpenTable widget was detected/i);
    // Ordering keeps the ordinary no-path wording, not a widget claim.
    const ordering = evidence.find((e) => e.evidenceType === 'ORDERING_PATH');
    expect(ordering?.fact).toMatch(/No public online ordering pathway was detected/i);
    expect(ordering?.fact).not.toMatch(/widget/i);
  });

  it('a Toast script does not imply a reservation widget', () => {
    const p = page(`<html><head>
      <script src="https://www.toasttab.com/widget.js"></script>
    </head><body><h1>Leverocks</h1></body></html>`);
    expect(detectWidgetVendor(p.assetHosts, 'ordering')).toBe('Toast');
    expect(detectWidgetVendor(p.assetHosts, 'reservation')).toBeNull();

    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    const reservation = evidence.find((e) => e.evidenceType === 'RESERVATION_PATH');
    expect(reservation?.fact).toMatch(/No public reservation pathway was detected/i);
    expect(reservation?.fact).not.toMatch(/widget/i);
  });

  it('resolves each category to its own vendor when two widgets are present', () => {
    const p = page(`<html><head>
      <script src="https://www.opentable.com/w.js"></script>
      <script src="https://www.toasttab.com/w.js"></script>
    </head><body><h1>Leverocks</h1></body></html>`);
    expect(detectWidgetVendor(p.assetHosts, 'reservation')).toBe('OpenTable');
    expect(detectWidgetVendor(p.assetHosts, 'ordering')).toBe('Toast');
  });
});

describe('vendor-credit detection must not eat ordinary restaurant copy', () => {
  it('keeps an internal link whose text merely contains "made by"', () => {
    const p = page(`<html><body>
      <a href="https://leverocks.example/menu">Pizza made by hand</a>
    </body></html>`);
    // Credit-like wording pointing at the restaurant's own site is prose, not a credit.
    expect(p.vendorCredits).toHaveLength(0);
    expect(p.categorizedLinks.menu ?? []).toHaveLength(1);
    expect(p.internalLinks.some((l) => l.href.includes('/menu'))).toBe(true);
  });

  it('does not report a missing menu because of that wording', () => {
    const p = page(`<html><body>
      <a href="https://leverocks.example/menu">Pizza made by hand</a>
    </body></html>`);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    const menu = evidence.find((e) => e.evidenceType === 'MENU_ACCESS');
    expect(menu?.fact).not.toMatch(/No public menu/i);
  });

  it('still treats an off-site "Powered by" link as a credit', () => {
    const p = page(`<html><body>
      <a href="https://www.spothopperapp.com/">Powered by SpotHopper</a>
    </body></html>`);
    expect(p.vendorCredits).toHaveLength(1);
  });
});

describe('defect 3 — query strings were excluded from matching', () => {
  it('categorizes a link whose intent lives only in the query string', () => {
    const p = page(`<html><body>
      <a href="https://leverocks.example/widget?action=reservation">Click here</a>
    </body></html>`);
    expect(p.categorizedLinks.reservation ?? []).toHaveLength(1);
  });
});

describe('defect 4 — a bare "Book Now" CTA did not match', () => {
  it('matches "Book Now" as a reservation link', () => {
    const p = page(`<html><body><a href="https://leverocks.example/b">Book Now</a></body></html>`);
    expect(p.categorizedLinks.reservation ?? []).toHaveLength(1);
  });

  it('still matches the previously supported wording', () => {
    for (const text of ['Reservations', 'Booking', 'Book a Table']) {
      const p = page(`<html><body><a href="https://leverocks.example/x">${text}</a></body></html>`);
      expect(p.categorizedLinks.reservation ?? [], text).toHaveLength(1);
    }
  });
});

describe('destination resolution — where the link actually leads', () => {
  it('names the resolved destination and its operator in the evidence', () => {
    const p = page('<html><body><a href="https://leverocks.example/order">Order Online</a></body></html>');
    const evidence = normalizeEvidence({
      pages: [p],
      failures: [],
      probes: [
        {
          url: 'https://leverocks.example/order',
          category: 'ordering',
          ok: true,
          httpStatus: 200,
          note: 'HTTP 200 (redirects to https://www.toasttab.com/leverocks)',
          finalUrl: 'https://www.toasttab.com/leverocks',
        },
      ],
    });
    const ordering = evidence.filter((e) => e.evidenceType === 'ORDERING_PATH');
    const resolved = ordering.find((e) => /responded successfully/.test(e.fact));
    expect(resolved?.fact).toMatch(/operated by Toast/);
    expect(resolved?.supportingContext).toMatch(/resolves to https:\/\/www\.toasttab\.com\/leverocks/);
  });
});

describe('no false positives introduced', () => {
  it('a site with genuinely no booking or ordering still reports none', () => {
    const p = page(`<html><body>
      <a href="https://leverocks.example/about">About Us</a>
      <a href="https://leverocks.example/careers">Careers</a>
    </body></html>`);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    const reservation = evidence.find((e) => e.evidenceType === 'RESERVATION_PATH');
    expect(reservation?.fact).toMatch(/No public reservation pathway was detected/i);
    expect(reservation?.fact).not.toMatch(/widget/i);
  });
});
