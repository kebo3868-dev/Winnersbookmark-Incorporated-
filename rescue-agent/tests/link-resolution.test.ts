import { describe, expect, it } from 'vitest';
import { extractPage, detectWidgetVendor, declaredDestination, categorizeLink } from '@/lib/web/collector';
import { discoverRelevantPages } from '@/lib/web/discovery';
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
    // Was HEALTHY. Changed deliberately: no probe runs in this fixture, so the
    // old status came with the finding "publicly linked and responded when
    // tested" — a claim about a test that never happened. A resolved link with
    // no verification is RESOLVED_UNVERIFIED. The assertion this test exists
    // for, that ORDERING is not HEALTHY, is unchanged above.
    expect(journey.find((s) => s.stage === 'RESERVATION')?.status).toBe('RESOLVED_UNVERIFIED');
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
    // Wording changed with the ordering-functionality fix: a 200 no longer
    // reads as "responded successfully". The point of this test — that the
    // evidence names the resolved destination and its operator — is unchanged.
    const resolved = ordering.find((e) => /is reachable/.test(e.fact));
    expect(resolved?.fact).toMatch(/operated by Toast/);
    expect(resolved?.supportingContext).toMatch(/resolves to https:\/\/www\.toasttab\.com\/leverocks/);
  });
});

/**
 * REGRESSION CASE: Leverock's, second audit.
 *
 * The pop-up CTA
 *   /-party?source=pop_up&spot_id=78550&destination=private_parties&promo
 * was reported as a reservation pathway while the same report said no private
 * dining pathway was found. Two separate faults: the anchor text ("Book Now")
 * was allowed to classify a link whose URL states a different destination, and
 * `private[- ]?part` could never match `private_parties` because `_` is neither
 * a hyphen nor a space.
 *
 * It is a private-party enquiry pathway, not a table-booking pathway. Both can
 * exist on one site, and reporting the one as the other hides a real gap.
 */
describe('a declared destination outranks generic link text', () => {
  const partyUrl = 'https://leverocks.example/-party?source=pop_up&spot_id=78550&destination=private_parties&promo';

  it('reads the destination out of the query string, underscores and all', () => {
    expect(declaredDestination(new URL(partyUrl))).toBe('private_dining');
    // The historic failure: the pattern never saw through the underscore.
    expect(declaredDestination(new URL('https://x.example/a?destination=private_parties'))).toBe('private_dining');
    expect(declaredDestination(new URL('https://x.example/a?destination=online_ordering'))).toBe('ordering');
    expect(declaredDestination(new URL('https://x.example/a?destination=make_a_reservation'))).toBe('reservation');
  });

  it('files the private-party pop-up as private dining and NOT as a reservation', () => {
    const p = page(`<html><body><a href="${partyUrl}">Book Now</a></body></html>`);
    expect(p.categorizedLinks.private_dining ?? []).toHaveLength(1);
    expect(p.categorizedLinks.reservation ?? []).toHaveLength(0);
  });

  it('reports private dining as present and reservation as undetected', () => {
    const p = page(`<html><body><a href="${partyUrl}">Book Now</a></body></html>`);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    expect(evidence.find((e) => e.evidenceType === 'PRIVATE_DINING_PATH')?.fact).toMatch(/private dining pathway is publicly linked/i);
    expect(evidence.find((e) => e.evidenceType === 'RESERVATION_PATH')?.fact).toMatch(/No public reservation pathway was detected/i);

    const journey = analyzeJourney(
      evidence.map((e, i) => ({ id: `e${i}`, evidenceType: e.evidenceType, fact: e.fact, confidence: e.confidence, supportingContext: e.supportingContext ?? null })),
    );
    // The decisive assertion: a private-party link must not make RESERVATION look answered.
    expect(journey.find((s) => s.stage === 'RESERVATION')?.status).toBe('UNKNOWN');
  });

  it('lets the URL keep its own structural category alongside the declared one', () => {
    // A booking page that also opens private-party enquiries is genuinely both.
    expect(categorizeLink(new URL('https://x.example/reservations?destination=private_parties'), 'Book')).toEqual(
      expect.arrayContaining(['reservation', 'private_dining']),
    );
  });

  it('still classifies from anchor text when the URL declares no destination', () => {
    const p = page('<html><body><a href="https://leverocks.example/x?spot_id=1">Book Now</a></body></html>');
    expect(p.categorizedLinks.reservation ?? []).toHaveLength(1);
  });

  it('does not treat ordinary query parameters as destinations', () => {
    // `page`/`view`/`type` carry pagination and display values, not destinations,
    // so they must never suppress what the anchor text says.
    expect(declaredDestination(new URL('https://x.example/menu?page=2&view=calendar&type=grid'))).toBeNull();
    const p = page('<html><body><a href="https://leverocks.example/m?page=2">Menu</a></body></html>');
    expect(p.categorizedLinks.menu ?? []).toHaveLength(1);
  });
});

/**
 * REGRESSION CASE: Leverock's, second audit.
 *
 * The SpotHopper ordering widget was correctly detected, but the report still
 * said the ordering destination could not be resolved. The collector read
 * destinations from <a href> only — an iframe src or a data-* URL, both served
 * in the public HTML, was thrown away after its hostname was noted. Where a
 * widget states its destination statically, it is now resolved and probed like
 * any other pathway; where it genuinely only exists after JavaScript runs, the
 * honest "could not be resolved" answer is unchanged.
 */
describe('embedded widget destinations are resolved from the served HTML', () => {
  it('resolves an iframe-embedded ordering destination', () => {
    const p = page(`<html><body>
      <iframe title="Order Online" src="https://www.spothopperapp.com/order-online/leverocks"></iframe>
    </body></html>`);
    expect(p.categorizedLinks.ordering ?? []).toHaveLength(1);
    expect(p.categorizedLinks.ordering?.[0].source).toBe('embed');
    expect(p.categorizedLinks.reservation ?? []).toHaveLength(0);
  });

  it('resolves a destination held in a data attribute on a scripted button', () => {
    const p = page(`<html><body>
      <button data-order-url="https://order.toasttab.com/online/leverocks">Order Online</button>
    </body></html>`);
    expect(p.categorizedLinks.ordering?.[0].href).toContain('order.toasttab.com');
  });

  it('resolves a destination held in an inline open handler', () => {
    const p = page(`<html><body>
      <div onclick="window.open('https://www.spothopperapp.com/order-online/leverocks')">Order Now</div>
    </body></html>`);
    expect(p.categorizedLinks.ordering?.[0].href).toContain('spothopperapp.com');
  });

  it('names the resolved destination and vendor instead of reporting it unresolvable', () => {
    const p = page(`<html><head>
      <script src="https://www.spothopperapp.com/widget.js"></script>
    </head><body>
      <iframe title="Order Online" src="https://www.spothopperapp.com/order-online/leverocks"></iframe>
      <button>Order Online</button>
    </body></html>`);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    const ordering = evidence.find((e) => e.evidenceType === 'ORDERING_PATH');
    expect(ordering?.fact).toMatch(/An online ordering pathway is publicly reachable through an embedded widget via SpotHopper/i);
    expect(ordering?.fact).not.toMatch(/could not be resolved/i);
    expect(ordering?.supportingContext).toContain('https://www.spothopperapp.com/order-online/leverocks');
    // The claim stays bounded: the destination is public HTML, the on-screen
    // widget still is not.
    expect(ordering?.supportingContext).toMatch(/still needs a human look/i);
    expect(ordering?.confidence).toBeLessThan(90);
  });

  // Renamed: the old title asserted the destination was "working" once it
  // responded, which is the claim the ordering-functionality fix rejects. A 200
  // proves the destination exists, never that an order can be placed.
  it('reports a responding destination as resolved but unverified', () => {
    const p = page(`<html><body>
      <iframe title="Order Online" src="https://www.spothopperapp.com/order-online/leverocks"></iframe>
    </body></html>`);
    const evidence = normalizeEvidence({
      pages: [p],
      failures: [],
      probes: [{ url: 'https://www.spothopperapp.com/order-online/leverocks', category: 'ordering', ok: true, httpStatus: 200, note: 'HTTP 200' }],
    });
    const journey = analyzeJourney(
      evidence.map((e, i) => ({ id: `e${i}`, evidenceType: e.evidenceType, fact: e.fact, confidence: e.confidence, supportingContext: e.supportingContext ?? null })),
    );
    expect(journey.find((s) => s.stage === 'ORDERING')?.status).toBe('RESOLVED_UNVERIFIED');
  });

  it('keeps reporting UNKNOWN when the widget leaves no destination in the HTML', () => {
    const p = page(`<html><head>
      <script src="https://www.spothopperapp.com/widget.js"></script>
    </head><body><button>Order Online</button></body></html>`);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    expect(evidence.find((e) => e.evidenceType === 'ORDERING_PATH')?.fact).toMatch(
      /No public online ordering pathway could be resolved, but a SpotHopper widget was detected/i,
    );
    const journey = analyzeJourney(
      evidence.map((e, i) => ({ id: `e${i}`, evidenceType: e.evidenceType, fact: e.fact, confidence: e.confidence, supportingContext: e.supportingContext ?? null })),
    );
    expect(journey.find((s) => s.stage === 'ORDERING')?.status).toBe('UNKNOWN');
  });

  it('does not crawl embedded destinations as pages of the site', () => {
    const p = page(`<html><body>
      <iframe title="Order Online" src="https://leverocks.example/order-widget"></iframe>
    </body></html>`);
    expect(p.internalLinks).toHaveLength(0);
    // Same-host embeds must not consume a page slot either — they are probed.
    expect(discoverRelevantPages(p)).toHaveLength(0);
  });

  it('ignores a vendor credit that arrives through a data attribute', () => {
    const p = page(`<html><body>
      <span data-href="https://www.spothopperapp.com/">Powered by SpotHopper</span>
    </body></html>`);
    expect(p.categorizedLinks.reservation ?? []).toHaveLength(0);
    expect(p.categorizedLinks.ordering ?? []).toHaveLength(0);
  });

  it('prefers a visible anchor over an embed when the site offers both', () => {
    const p = page(`<html><body>
      <a href="https://www.spothopperapp.com/order-online/leverocks">Order Online</a>
      <iframe title="Order" src="https://order.toasttab.com/online/leverocks"></iframe>
    </body></html>`);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    const ordering = evidence.find((e) => e.evidenceType === 'ORDERING_PATH');
    expect(ordering?.fact).toMatch(/publicly linked/);
    expect(ordering?.fact).not.toMatch(/embedded widget/);
  });
});

describe('client-facing wording', () => {
  it('uses the right indefinite article for every pathway label', () => {
    const p = page(`<html><body>
      <a href="https://leverocks.example/order-online">Order Online</a>
      <a href="https://leverocks.example/faq">FAQ</a>
      <a href="https://leverocks.example/menu">Menu</a>
    </body></html>`);
    const facts = normalizeEvidence({ pages: [p], failures: [], probes: [] }).map((e) => e.fact);
    expect(facts).toContain('An online ordering pathway is publicly linked (1 link(s) found).');
    expect(facts).toContain('An FAQ pathway is publicly linked (1 link(s) found).');
    expect(facts).toContain('A menu pathway is publicly linked (1 link(s) found).');
    expect(facts.some((f) => /^A (online|FAQ)/.test(f))).toBe(false);
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
