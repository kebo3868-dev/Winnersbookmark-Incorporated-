import { describe, expect, it } from 'vitest';
import { classifyLinkRole, contributesToCustomerPathway } from '@/lib/web/linkTaxonomy';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';

/**
 * HIGH 5 — CONTACT LINK CLASSIFICATION
 *
 * A footer carried `Website design` → spothopperapp.com. That is the builder's
 * marketing page: it answers no customer's question, takes no booking, and
 * reaches nobody at the restaurant — and it was raising the restaurant's
 * Contact-path health, which raised its Rescue Score.
 *
 * The previous guard needed the anchor text to contain "by" ("powered by",
 * "website by"), so `Website design` and `Marketing` walked straight through.
 */

const page = (html: string, url = 'https://leverocks.example/') => extractPage(url, url, 200, 'text/html', html);

const role = (href: string, text: string, siteHost = 'leverocks.example', selfCategories: string[] = []) =>
  classifyLinkRole({ href, text, siteHost, selfCategories }).role;

describe('the taxonomy', () => {
  it('classifies vendor credits, however they are worded', () => {
    for (const text of [
      'Powered by SpotHopper',
      'Website design by SpotHopper',
      'Website design',
      'Restaurant marketing by SpotHopper',
      'Marketing by SpotHopper',
      'Built by Acme',
      'Developed by Acme',
      'Digital marketing',
    ]) {
      expect(role('https://www.spothopperapp.com/restaurant-website-design', text), text).toBe('VENDOR_CREDIT');
    }
  });

  it('classifies a platform property with no credit wording as DEVELOPER_PLATFORM', () => {
    expect(role('https://www.spothopperapp.com/pricing', 'SpotHopper')).toBe('DEVELOPER_PLATFORM');
    expect(role('https://www.spothopperapp.com/', 'SpotHopper')).toBe('DEVELOPER_PLATFORM');
    expect(role('https://www.bentobox.com/features', 'BentoBox')).toBe('DEVELOPER_PLATFORM');
  });

  it('classifies the OTHER roles', () => {
    expect(role('https://www.instagram.com/leverocks', 'Instagram')).toBe('SOCIAL');
    expect(role('https://leverocks.example/privacy-policy', 'Privacy Policy')).toBe('LEGAL');
    expect(role('https://leverocks.example/contact', 'Contact Us')).toBe('CUSTOMER_CONTACT');
    expect(role('https://leverocks.example/hours', 'Hours')).toBe('CUSTOMER_CONTACT');
    expect(role('https://leverocks.example/about', 'About')).toBe('NAVIGATION');
    expect(role('https://leverocks.example/order', 'Order', 'leverocks.example', ['ordering'])).toBe('TRANSACTIONAL');
    expect(role('https://unknown-third-party.example/x', 'Something')).toBe('UNKNOWN');
  });

  it('non-customer roles never contribute to a pathway', () => {
    for (const r of ['VENDOR_CREDIT', 'DEVELOPER_PLATFORM', 'LEGAL'] as const) {
      expect(contributesToCustomerPathway(r), r).toBe(false);
    }
    for (const r of ['CUSTOMER_CONTACT', 'SOCIAL', 'NAVIGATION', 'TRANSACTIONAL', 'UNKNOWN'] as const) {
      expect(contributesToCustomerPathway(r), r).toBe(true);
    }
  });
});

describe('the taxonomy does not eat real pathways', () => {
  it('a genuine ordering destination on a platform host stays transactional', () => {
    expect(role('https://www.toasttab.com/leverocks/v3', 'Order Online', 'leverocks.example', ['ordering'])).toBe('TRANSACTIONAL');
    expect(role('https://www.spothopperapp.com/order-online/leverocks', 'Order', 'leverocks.example', ['ordering'])).toBe('TRANSACTIONAL');
    expect(role('https://www.opentable.com/r/leverocks', 'Reserve', 'leverocks.example', ['reservation'])).toBe('TRANSACTIONAL');
  });

  it('a restaurant-specific vendor URL with no recognised action is NOT demoted', () => {
    // Demoting an unrecognised restaurant-specific URL would throw away real
    // destinations to catch footer credits — the wrong trade in the wrong
    // direction.
    expect(role('https://www.spothopperapp.com/spots/78550-leverocks', 'Menu')).not.toBe('DEVELOPER_PLATFORM');
  });

  it('first-party prose that happens to say "made by" is not a credit', () => {
    expect(role('https://leverocks.example/menu', 'Chowder made by hand')).toBe('NAVIGATION');
  });

  it('does not mistake a Nevada location page for a legal notice', () => {
    // `ada\b` bounded on one side also matches the tail of "Nevada".
    expect(role('https://leverocks.example/locations/nevada', 'Nevada')).toBe('CUSTOMER_CONTACT');
  });

  it('leaves an off-site contact page on an unrecognised domain alone', () => {
    // A restaurant group routinely puts its contact page on a sister domain.
    expect(role('https://leverocksgroup.example/contact', 'Contact Us')).toBe('CUSTOMER_CONTACT');
  });

  it('but a contact page on a PLATFORM host reaches the platform, not the restaurant', () => {
    expect(role('https://www.spothopperapp.com/contact', 'Contact')).toBe('DEVELOPER_PLATFORM');
  });

  it('a vendor MARKETING page named after a capability is not that capability', () => {
    // `/restaurant-online-ordering/` declares "ordering" perfectly well — it is
    // a sales page about ordering, aimed at the owner. Letting the declared
    // action win is exactly how a footer credit became a restaurant's ordering
    // pathway and its reservation pathway at the same time.
    expect(role('https://www.spothopperapp.com/restaurant-online-ordering/?utm=x', 'Marketing', 'harbour.example', ['ordering']))
      .toBe('DEVELOPER_PLATFORM');
    expect(
      role('https://www.spothopperapp.com/restaurant-reservations-software/', 'Website design', 'harbour.example', ['reservation']),
    ).toBe('VENDOR_CREDIT');
    expect(role('https://www.toasttab.com/pricing', 'Toast', 'harbour.example', [])).toBe('DEVELOPER_PLATFORM');
  });

  it('matches the vendor-property rule on the FIRST segment only', () => {
    // Whole-path matching would demote a real ordering page for a restaurant
    // called Design Bar.
    expect(role('https://www.spothopperapp.com/order-online/design-bar', 'Order', 'harbour.example', ['ordering']))
      .toBe('TRANSACTIONAL');
    expect(role('https://www.spothopperapp.com/reservations/marketing-street-grill', 'Book', 'harbour.example', ['reservation']))
      .toBe('TRANSACTIONAL');
  });
});

describe('end to end: a SpotHopper footer credit does not raise contact health', () => {
  const SITE_WITH_CREDIT = `
    <h1>Leverock&rsquo;s Great Seafood</h1>
    <footer>
      <a href="https://www.spothopperapp.com/restaurant-website-design/?utm_source=leverocks">Website design</a>
    </footer>
  `;

  it('keeps the credit out of every categorized pathway', () => {
    const extracted = page(SITE_WITH_CREDIT);
    for (const links of Object.values(extracted.categorizedLinks)) {
      for (const link of links ?? []) {
        expect(link.href).not.toMatch(/spothopperapp/);
      }
    }
  });

  it('records it as a vendor credit instead', () => {
    expect(page(SITE_WITH_CREDIT).vendorCredits.map((c) => c.text)).toContain('Website design');
  });

  it('reports the contact path as not detected, not as present', () => {
    const evidence = normalizeEvidence({ pages: [page(SITE_WITH_CREDIT)], failures: [], probes: [] });
    const contact = evidence.find((e) => e.evidenceType === 'CONTACT_PATH');
    expect(contact?.fact).toMatch(/no public contact pathway was detected/i);
  });

  it('does not let the credit make the CONTACT journey stage healthier', () => {
    const records = normalizeEvidence({ pages: [page(SITE_WITH_CREDIT)], failures: [], probes: [] }).map((e, i) => ({
      id: `e${i}`,
      evidenceType: e.evidenceType,
      fact: e.fact,
      confidence: e.confidence,
      supportingContext: e.supportingContext ?? null,
    }));
    const stage = analyzeJourney(records).find((s) => s.stage === 'CONTACT');
    expect(stage?.status).not.toBe('HEALTHY');
  });

  it('a real contact link on the same page IS counted', () => {
    // The guard must discriminate, not simply suppress.
    const extracted = page(`${SITE_WITH_CREDIT}<a href="/contact">Contact Us</a>`);
    expect((extracted.categorizedLinks.contact ?? []).map((l) => l.href)).toContain('https://leverocks.example/contact');
  });
});
