import { describe, expect, it } from 'vitest';
import { extractPage, formatPhoneNumber, normalizePhonesInText } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { safeDisplayName, resolveRestaurantName } from '@/lib/audit/restaurantName';
import { parseOrderingChannelFact, resolveOrderingChannel, type OrderingChannelInput } from '@/lib/audit/orderingChannel';
import { buildExecutiveReport } from '@/lib/reports/executive';
import { generateOwnerReport } from '@/lib/reports/owner';
import { getContact } from '@/lib/config';

/**
 * DEFECTS FOUND IN A LIVE LEVEROCK'S AUDIT
 *
 * Seven faults observed on a real run of the preview, each pinned here so the
 * report cannot regress into them.
 */

const page = (html: string, url = 'https://leverocks.example/') => extractPage(url, url, 200, 'text/html', html);

const records = (html: string, probes: ProbeResult[] = []) =>
  normalizeEvidence({ pages: [page(html)], failures: [], probes }).map((e, i) => ({
    id: `e${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    supportingContext: e.supportingContext ?? null,
    confidence: e.confidence,
    sourceUrl: e.sourceUrl,
  }));

const stageIn = (html: string, name: string, probes: ProbeResult[] = []) =>
  analyzeJourney(records(html, probes)).find((s) => s.stage === name);

// ── 1. Restaurant identity binding ─────────────────────────────────────────

describe('a null business name can never reach a client report', () => {
  it('rejects the literal string "null" from site metadata', () => {
    // The live cause: a CMS emitted <meta property="og:site_name" content="null">.
    // A four-letter STRING passed every guard written for an absent value.
    const resolved = resolveRestaurantName({
      ogSiteName: 'null',
      pageTitle: "Leverock's Great Seafood | Waterfront Dining",
      hostname: 'leverocks.com',
    });
    expect(resolved.name).toBe("Leverock's Great Seafood");
    expect(resolved.source).toBe('PAGE_TITLE');
  });

  it('safeDisplayName falls back to the domain for every junk value', () => {
    for (const junk of [null, undefined, '', '   ', 'null', 'undefined', 'NaN', 'N/A', 'none', '0', '-']) {
      expect(safeDisplayName(junk as string | null, 'https://leverocks.com'), String(junk)).toBe('leverocks.com');
    }
  });

  it('keeps a real name untouched, apostrophe and all', () => {
    expect(safeDisplayName("Leverock's Great Seafood", 'https://leverocks.com')).toBe("Leverock's Great Seafood");
  });

  it('never renders empty even with no URL to fall back on', () => {
    expect(safeDisplayName(null, null)).toBe('Restaurant');
  });

  it('guards the executive report cover and the owner report header', () => {
    const base = {
      restaurantName: 'null',
      websiteUrl: 'https://leverocks.com',
      location: null,
      auditStatus: 'COMPLETED',
      demoMode: false,
      overallScore: 74,
      coverageScore: 90,
    };
    const owner = generateOwnerReport({
      ...base,
      scoreExplanation: 'x',
      categories: [],
      journey: [],
      topLeaks: [],
      evidence: [],
      aiNarrative: null,
    });
    expect(owner.header.restaurantName).toBe('leverocks.com');

    const exec = buildExecutiveReport({
      ...base,
      auditId: 'clxnullnamecheck',
      auditDate: '2026-08-29',
      contact: getContact({}),
      bookingQrDataUrl: null,
      avgTicket: null,
      sourcesCollected: 1,
      sourcesFailed: 0,
      evidence: [],
      opportunities: [],
      journey: [],
      categoryScores: [],
      storedSummary: null,
      storedSummaryWasAiEnhanced: false,
      storedRecommendation: null,
    });
    expect(exec.cover.restaurantName).toBe('leverocks.com');
    expect(exec.cover.restaurantName).not.toMatch(/null|undefined/i);
  });
});

// ── 2. Contact classification ──────────────────────────────────────────────

describe('a phone number is a contact pathway', () => {
  const PHONE_SITE = `
    <h1>Leverock&rsquo;s</h1>
    <a href="tel:+17273674588">Call (727) 367-4588</a>
    <p>Call us on (727) 367-4588.</p>
  `;

  it('never says no contact pathway exists when a phone is published', () => {
    const contact = records(PHONE_SITE).find((e) => e.evidenceType === 'CONTACT_PATH');
    expect(contact?.fact).not.toMatch(/no public contact pathway was detected/i);
    expect(contact?.fact).toMatch(/available by telephone/i);
  });

  it('names the real gap: no non-phone route in', () => {
    const contact = records(PHONE_SITE).find((e) => e.evidenceType === 'CONTACT_PATH');
    expect(contact?.fact).toMatch(/no non-phone contact route/i);
    expect(contact?.supportingContext).toMatch(/click-to-call|Phone number published/i);
  });

  it('reports the CONTACT stage as phone dependency, not absence', () => {
    const stage = stageIn(PHONE_SITE, 'CONTACT');
    expect(stage?.status).toBe('FRICTION');
    expect(stage?.finding).toMatch(/can reach the restaurant by phone/i);
    expect(stage?.finding).toMatch(/only route in/i);
  });

  it('still reports a genuine absence when there is no phone at all', () => {
    const contact = records('<h1>Leverock&rsquo;s</h1>').find((e) => e.evidenceType === 'CONTACT_PATH');
    expect(contact?.fact).toMatch(/no public contact pathway was detected/i);
  });
});

// ── 3. Ordering exposure ───────────────────────────────────────────────────

describe('a markup-only URL is not a customer-facing failed transaction link', () => {
  const MARKUP_ONLY = `
    <a href="tel:+17273674588">ORDER</a>
    <script>window.SH = { orderUrl: "https://www.spothopperapp.com/order-online/leverocks" };</script>
  `;
  const failing: ProbeResult = {
    url: 'https://www.spothopperapp.com/order-online/leverocks',
    category: 'ordering',
    ok: false,
    httpStatus: 404,
    note: 'HTTP 404',
    failureKind: 'HTTP',
  };

  it('does not produce a broken-ordering finding from a config URL that 404s', () => {
    const stage = stageIn(MARKUP_ONLY, 'ORDERING', [failing]);
    expect(stage?.status).not.toBe('RISK');
    expect(records(MARKUP_ONLY, [failing]).filter((e) => e.evidenceType === 'BROKEN_LINK')).toHaveLength(0);
  });

  it('classifies ordering as phone-based when the visible CTA is tel:', () => {
    const stage = stageIn(MARKUP_ONLY, 'ORDERING', [failing]);
    expect(stage?.finding).toMatch(/telephone only/i);
  });

  it('labels a markup URL with no tel: CTA as unverified exposure', () => {
    const html = '<script>window.SH = { orderUrl: "https://www.spothopperapp.com/order-online/leverocks" };</script>';
    const stage = stageIn(html, 'ORDERING');
    expect(stage?.manualValidationRequired).toBe(true);
    expect(stage?.finding).toMatch(/no visible link or button/i);
    expect(stage?.finding).not.toMatch(/could not be resolved/i);
  });

  it('a VISIBLE link that 404s is still a confirmed failure', () => {
    // The rule must not have blunted the real finding.
    const html = '<a href="https://www.spothopperapp.com/order-online/leverocks">Order Online</a>';
    const stage = stageIn(html, 'ORDERING', [failing]);
    expect(stage?.status).toBe('RISK');
  });
});

// ── 4. Provenance ──────────────────────────────────────────────────────────

describe('a high-severity transaction finding carries its full chain', () => {
  it('records visible CTA → URL → HTTP test → outcome', () => {
    const input: OrderingChannelInput = {
      phoneOrderCtas: [],
      destinations: [
        {
          url: 'https://leverocks.example/order-online',
          exposedInCustomerJourney: true,
          platform: null,
          host: 'leverocks.example',
          ctaText: 'Order Online',
          discoveredVia: 'VISIBLE_LINK',
        },
      ],
      probes: [
        {
          url: 'https://leverocks.example/order-online',
          ok: false,
          httpStatus: 404,
          failureKind: 'HTTP',
          exposedInCustomerJourney: true,
        },
      ],
      widgetVendor: null,
    };
    const result = resolveOrderingChannel(input);
    expect(result.state).toBe('ONLINE_ORDERING_BROKEN_CONFIRMED');
    expect(result.detail).toMatch(/visible link "Order Online"/);
    expect(result.detail).toContain('https://leverocks.example/order-online');
    expect(result.detail).toMatch(/HTTP GET returned 404/);
    expect(result.detail).toMatch(/returned HTTP 404/);
  });
});

// ── 5. Duplicated copy ─────────────────────────────────────────────────────

describe('the ordering card does not say the same thing twice', () => {
  it('states the dead-end consequence exactly once', () => {
    const html = '<a href="https://leverocks.example/order-online">Order Online</a>';
    const stage = stageIn(html, 'ORDERING', [
      { url: 'https://leverocks.example/order-online', category: 'ordering', ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP' },
    ]);
    const deadEnds = (stage?.finding.match(/dead end/gi) ?? []).length;
    expect(deadEnds).toBe(1);
  });
});

// ── 6. Phone formatting ────────────────────────────────────────────────────

describe('phone numbers render in one shape', () => {
  it('normalizes every punctuation style the web produces', () => {
    for (const raw of ['(727)-367-4588', '727-367-4588', '727.367.4588', '727 367 4588']) {
      expect(formatPhoneNumber(raw), raw).toBe('(727) 367-4588');
    }
    expect(formatPhoneNumber('+1 727 367 4588')).toBe('+1 (727) 367-4588');
    expect(formatPhoneNumber('1-727-367-4588')).toBe('+1 (727) 367-4588');
  });

  it('leaves an unparseable number alone rather than dropping it', () => {
    expect(formatPhoneNumber('call 555 HELP')).toBe('call 555 HELP');
  });

  it('never produces the doubled brackets seen in the live report', () => {
    // My first fix corrected the number's own punctuation and left the sentence
    // wrapping it in a second pair of brackets — and this test asserted that
    // doubled form, so it passed while the reported defect was still on screen.
    // The number's area code already supplies brackets; the sentence uses a colon.
    const fact = records('<p>Call (727)-367-4588 today.</p>').find((e) => e.evidenceType === 'PHONE_VISIBILITY');
    expect(fact?.fact).toBe('A phone number is publicly displayed: (727) 367-4588.');
    expect(fact?.fact).not.toContain('((');
  });

  it('normalizes phone numbers inside QUOTED page text, not just extracted ones', () => {
    // The extraction path was already correct. These three quote the page
    // verbatim, which is how the raw form kept reaching the report.
    const ev = records(`
      <p>Mon - Sun 11:30 AM - 10:00 PM. 4801 37th Street South, St. Petersburg, FL. Call (727)-367-4588 today.</p>
      <a href="tel:+17273674588">Call (727)-367-4588</a>
      <a href="/menu">Menu</a>
    `);
    for (const type of ['ADDRESS_VISIBILITY', 'HOURS_VISIBILITY', 'CTA_SIGNAL']) {
      const entry = ev.find((e) => e.evidenceType === type);
      const blob = `${entry?.fact ?? ''} ${entry?.supportingContext ?? ''}`;
      expect(blob, type).not.toContain('(727)-367-4588');
    }
    const address = ev.find((e) => e.evidenceType === 'ADDRESS_VISIBILITY');
    expect(address?.supportingContext).toContain('(727) 367-4588');
  });

  it('does not start an address snippet mid-timestamp', () => {
    // "Mon - Sun 11:30 AM - 10:00 PM. 4801 37th Street South" made the house
    // number "00", so the quoted snippet opened with "00 PM.".
    const ev = records('<p>Mon - Sun 11:30 AM - 10:00 PM. 4801 37th Street South, St. Petersburg, FL.</p>');
    const address = ev.find((e) => e.evidenceType === 'ADDRESS_VISIBILITY');
    expect(address?.supportingContext).toContain('4801 37th Street South');
    expect(address?.supportingContext).not.toMatch(/"\s*\d{2} (AM|PM)/i);
  });
});

// ── 6b. Boundary defects found in review of the phone/address fix ──────────

/**
 * Two P1 review findings against the Check D fix. Both are boundary bugs in the
 * extraction patterns, and both are one-directional: each guard has to keep
 * doing its original job while no longer catching a legitimate case.
 */
describe('a postal code is not part of the phone number beside it', () => {
  it('leaves a ZIP intact when a phone number follows it immediately', () => {
    // PHONE_REGEX's optional `1` country-code prefix would start on the last
    // digit of the ZIP, matching "1 (727)-367-4588" — eleven digits, read as
    // +1 — so the rewrite replaced the ZIP's final digit too and the report
    // printed "FL 3370+1 (727) 367-4588".
    expect(normalizePhonesInText('FL 33701 (727)-367-4588')).toBe('FL 33701 (727) 367-4588');
    expect(normalizePhonesInText('St. Petersburg, FL 33707 (727)-367-4588')).toBe(
      'St. Petersburg, FL 33707 (727) 367-4588',
    );
  });

  it('keeps the ZIP whole through the real pipeline, not just the helper', () => {
    const ev = records('<p>4801 37th Street South, St. Petersburg, FL 33701 (727)-367-4588</p>');
    const address = ev.find((e) => e.evidenceType === 'ADDRESS_VISIBILITY');
    expect(address?.supportingContext).toContain('33701');
    expect(address?.supportingContext).not.toMatch(/3370\+1/);
    const phone = ev.find((e) => e.evidenceType === 'PHONE_VISIBILITY');
    expect(phone?.fact).toBe('A phone number is publicly displayed: (727) 367-4588.');
  });

  it('still reads a genuine leading country code', () => {
    // The guard must not disarm the prefix it constrains — only stop it
    // beginning mid-number.
    expect(normalizePhonesInText('Call 1-727-367-4588')).toBe('Call +1 (727) 367-4588');
    expect(normalizePhonesInText('Call +1 727 367 4588')).toBe('Call +1 (727) 367-4588');
  });
});

describe('a labelled address is still an address', () => {
  it('matches a house number written straight after a label colon', () => {
    // The timestamp guard rejected EVERY colon, which also discarded
    // "Address:4801 37th Street South" — a legitimate, common markup shape.
    const ev = records('<p>Address:4801 37th Street South, St. Petersburg, FL</p>');
    const address = ev.find((e) => e.evidenceType === 'ADDRESS_VISIBILITY');
    expect(address?.supportingContext).toContain('4801 37th Street South');
  });

  it('still refuses to start an address inside a clock time', () => {
    // The original defect this guard exists for. A colon that follows a DIGIT
    // is a time; a colon that follows a letter is a label.
    const ev = records('<p>Mon - Sun 11:30 AM - 10:00 PM. 4801 37th Street South, St. Petersburg, FL</p>');
    const address = ev.find((e) => e.evidenceType === 'ADDRESS_VISIBILITY');
    expect(address?.supportingContext).toContain('4801 37th Street South');
    expect(address?.supportingContext).not.toMatch(/"\s*00 PM/i);
  });
});

describe('the Check D fixes that passed live still hold', () => {
  it('renders PHONE_VISIBILITY and CTA_SIGNAL in the shape the live audit showed', () => {
    const ev = records(`
      <p>Mon - Sun 11:30 AM - 10:00 PM. 4801 37th Street South, St. Petersburg, FL 33701. Call (727)-367-4588 today.</p>
      <a href="tel:+17273674588">Call us at (727)-367-4588</a>
      <a href="/menu">Menu</a>
    `);
    const phone = ev.find((e) => e.evidenceType === 'PHONE_VISIBILITY');
    expect(phone?.fact).toBe('A phone number is publicly displayed: (727) 367-4588.');
    expect(phone?.fact).not.toContain('((');

    const cta = ev.find((e) => e.evidenceType === 'CTA_SIGNAL');
    expect(cta?.supportingContext).toContain('Call us at (727) 367-4588');
    expect(cta?.supportingContext).not.toContain('(727)-367-4588');
  });
});

// ── 7. Channel marker still round-trips after the copy changes ─────────────

describe('the ordering marker survives the copy edits', () => {
  it('parses back out of the reworded summary', () => {
    const html = '<a href="tel:+17273674588">Order Now</a>';
    const record = records(html).find((e) => e.evidenceType === 'ORDERING_CHANNEL');
    expect(parseOrderingChannelFact(record!.fact)?.state).toBe('PHONE_ORDERING_ONLY');
  });
});
