/**
 * CLAIM ACCURACY — the conclusions must not outrun the evidence.
 *
 * Every test here pins a REASONING rule, not a phrase. Each one names the
 * conclusion the audit used to draw and the observation that did not support
 * it, so a future edit that restores the conclusion fails here with the reason
 * attached rather than with "snapshot changed".
 *
 * The six defects:
 *   1. A missing FAQ page became "questions go unanswered" and "the phone
 *      carries avoidable demand", on a site publishing hours, address and menu.
 *   2. Score bands and the executive summary asserted measured revenue leakage.
 *   3. Nine detected CTAs became proven visual competition and lost conversions.
 *   4. A tel: ordering CTA became "telephone only" — an exclusivity claim.
 *   5. A gift-card order form became a general enquiry route.
 *   6. Absent public signup widgets became a confirmed weak follow-up system.
 */
import { describe, expect, it } from 'vitest';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { analyzeJourney } from '@/lib/audit/journey';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { extractPage, classifyForms, categorizeLink } from '@/lib/web/collector';
import { scoreBand } from '@/lib/scoring/rescueScore';
import { stateForOpportunity, STATE_LABEL } from '@/lib/audit/evidenceState';
import * as cheerio from 'cheerio';
import type { EvidenceInput, EvidenceRecordLike } from '@/types/audit';

let idCounter = 0;
const ev = (evidenceType: string, fact: string, confidence = 80): EvidenceRecordLike => ({
  id: `ca_${idCounter++}`,
  evidenceType,
  fact,
  supportingContext: null,
  confidence,
});

const leaksFor = (evidence: EvidenceRecordLike[]) =>
  detectRevenueLeaks({ evidence, journey: analyzeJourney(evidence) });

const pageOf = (body: string, url = 'https://example-grill.test/') =>
  extractPage(url, url, 200, 'text/html', `<html><head><title>Example Grill</title></head><body>${body}</body></html>`);
const recordsFor = (body: string, url?: string) =>
  normalizeEvidence({ pages: [pageOf(body, url)], failures: [], probes: [] });
const find = (ev2: EvidenceInput[], type: string) => ev2.find((e) => e.evidenceType === type);

// ── DEFECT 1: a missing FAQ page is not an unanswered question ─────────────
//
// "No dedicated FAQ detected" establishes that no FAQ page was found. It does
// not establish that visitors cannot get answers, and it says nothing at all
// about call volume. The site in this fixture answers hours, address, menu and
// contact — the questions people actually ring to ask.

const ANSWERS_EVERYTHING = [
  ev('PHONE_VISIBILITY', 'A phone number is publicly displayed ((555) 111-2222).'),
  ev('CLICK_TO_CALL', 'No click-to-call (tel:) links detected; mobile visitors must dial manually.'),
  ev('FAQ_SIGNAL', 'No public FAQ pathway was detected on the analyzed website pages.', 70),
  ev('HOURS_VISIBILITY', 'Business hours are published on the website.'),
  ev('ADDRESS_VISIBILITY', 'A street address is published on the website.'),
  ev('MENU_ACCESS', 'A menu pathway is publicly linked (2 link(s) found).'),
  ev('CONTACT_PATH', 'A contact pathway is publicly available by telephone and a published email address.'),
];

describe('defect 1 — a missing FAQ does not prove questions go unanswered', () => {
  const phone = () => leaksFor(ANSWERS_EVERYTHING).find((l) => /PHONE-DEPENDENT/i.test(l.category))!;

  it('credits the answers the site already publishes', () => {
    // The same evidence chain recorded hours, address and menu. A finding that
    // ignored them contradicted its own appendix.
    const problem = phone().problem;
    expect(problem).toMatch(/opening hours/i);
    expect(problem).toMatch(/the address/i);
    expect(problem).toMatch(/the menu/i);
    expect(problem).toMatch(/answerable online without calling/i);
  });

  it('does not claim excessive or missed call demand without call records', () => {
    const problem = phone().problem;
    expect(problem).toMatch(/requires your data/i);
    expect(problem).toMatch(/call records|how many calls arrive/i);
    expect(problem).not.toMatch(/missed-call exposure|excessive (call|phone)|flooded|too many calls/i);
    // "overloaded" is absent from the list above on purpose: the disclaimer
    // below uses the word to deny the claim, so a bare /overloaded/ would
    // match the very sentence that fixes the defect.
    expect(problem).toMatch(/does not claim the phone is overloaded/i);
  });

  it('does not rank an unmeasured question as a high-impact problem', () => {
    // Impact 70 put this alongside a broken ordering link. Nothing was measured.
    const p = phone();
    expect(p.impactScore).toBeLessThan(50);
    expect(p.urgencyScore).toBeLessThan(40);
    expect(p.manualValidationRequired).toBe(true);
  });

  it('still names the gap when the site genuinely answers nothing', () => {
    // The repair must not silence the finding — only bound it. With no hours,
    // address or menu, the unanswered-questions framing is correct.
    const bare = [
      ev('PHONE_VISIBILITY', 'A phone number is publicly displayed ((555) 111-2222).'),
      ev('CLICK_TO_CALL', 'No click-to-call (tel:) links detected; mobile visitors must dial manually.'),
      ev('FAQ_SIGNAL', 'No public FAQ pathway was detected on the analyzed website pages.', 70),
      ev('HOURS_VISIBILITY', 'Business hours were not detected in the text of the analyzed pages.'),
      ev('ADDRESS_VISIBILITY', 'A street address was not detected in the text of the analyzed pages.'),
    ];
    const phoneLeak = leaksFor(bare).find((l) => /PHONE-DEPENDENT/i.test(l.category))!;
    expect(phoneLeak.title).toMatch(/not answered on the website/i);
    expect(phoneLeak.impactScore).toBeGreaterThan(50);
    // Even here, call demand stays unmeasured.
    expect(phoneLeak.problem).toMatch(/requires your data/i);
  });

  it('the PHONE journey stage does not infer missed calls either', () => {
    const stage = analyzeJourney(ANSWERS_EVERYTHING).find((s) => s.stage === 'PHONE');
    expect(stage?.finding).not.toMatch(/missed-call exposure|calls are being missed/i);
    expect(stage?.finding).toMatch(/call records|not assessed/i);
  });
});

// ── DEFECT 2: nothing financial was measured ───────────────────────────────

describe('defect 2 — no surface asserts a measured loss', () => {
  const MONEY = /revenue leakage|measurable revenue|lost revenue|losing \$|costs? you \$|\$\d/i;

  it('no score band names revenue, leakage or a loss', () => {
    for (const score of [100, 95, 85, 75, 65, 59, 20, 0]) {
      expect(scoreBand(score), `band for ${score}`).not.toMatch(/revenue|leakage|loss|cost|\$/i);
    }
  });

  it('no leak finding claims a measured loss', () => {
    const everything = [
      ev('BROKEN_LINK', 'The linked ordering destination failed when tested (HTTP 404).', 95),
      ev('CLICK_TO_CALL', 'No click-to-call (tel:) links detected; mobile visitors must dial manually.'),
      ev('FAQ_SIGNAL', 'No public FAQ pathway was detected on the analyzed website pages.'),
      ev('EMAIL_CAPTURE', 'No public email capture mechanism was detected on the analyzed pages.'),
      ev('LOYALTY_SIGNAL', 'No public loyalty or rewards pathway was detected on the analyzed website pages.'),
      ev('MENU_ACCESS', 'The only detected menu links point to PDF files, which create friction on mobile devices.'),
      ev('HOURS_VISIBILITY', 'Business hours were not detected in the text of the analyzed pages.'),
      ev('ADDRESS_VISIBILITY', 'A street address was not detected in the text of the analyzed pages.'),
    ];
    for (const leak of leaksFor(everything)) {
      expect(leak.problem, leak.category).not.toMatch(MONEY);
      expect(leak.businessImpact, leak.category).not.toMatch(MONEY);
      expect(leak.title, leak.category).not.toMatch(MONEY);
    }
  });

  it('no journey finding claims a measured loss', () => {
    for (const stage of analyzeJourney(ANSWERS_EVERYTHING)) {
      expect(stage.finding, stage.stage).not.toMatch(MONEY);
    }
  });
});

// ── DEFECT 3: a CTA count is not a usability verdict ───────────────────────

describe('defect 3 — the CTA count is separated from the usability hypothesis', () => {
  const NINE_CTAS = [
    ev('CTA_SIGNAL', 'Homepage presents 9 distinct action-oriented CTAs, more than the 8 this audit treats as a prompt to look at hierarchy.'),
  ];
  const cta = () => leaksFor(NINE_CTAS).find((l) => /CTA/i.test(l.category))!;

  it('states the count as observed and the competition as not observed', () => {
    const problem = cta().problem;
    expect(problem).toMatch(/OBSERVED:/);
    expect(problem).toMatch(/NOT OBSERVED:/);
    expect(problem).toMatch(/reads markup, not layout/i);
  });

  it('does not assert visual competition or lost conversions', () => {
    const c = cta();
    expect(c.problem).not.toMatch(/compete visually for attention|are competing|dilut/i);
    expect(c.problem).not.toMatch(/conversions are lost|losing conversions/i);
    expect(c.problem).toMatch(/requires your data/i);
  });

  it('the evidence badge matches the classification — not STRONG EVIDENCE', () => {
    // The report showed "Strong Evidence" above a finding whose own text said
    // the conclusion was unobservable. The badge is derived from the finding's
    // own state, so the two can no longer disagree.
    const c = cta();
    const state = stateForOpportunity(c);
    expect(state).toBe('MANUAL_VALIDATION_REQUIRED');
    expect(STATE_LABEL[state]).toBe('MANUAL VALIDATION REQUIRED');
    expect(STATE_LABEL[state]).not.toBe('STRONG EVIDENCE');
  });

  it('a homepage with NO CTAs is still a real finding', () => {
    const none = leaksFor([ev('CTA_SIGNAL', 'No clear action-oriented CTAs were detected on the homepage.')]);
    const missing = none.find((l) => /CTA/i.test(l.category))!;
    expect(missing.title).toMatch(/no clear next action/i);
    expect(missing.impactScore).toBeGreaterThan(cta().impactScore);
  });
});

// ── DEFECT 4: a tel: CTA is a destination, not an exclusivity proof ────────

describe('defect 4 — the Order button is described by its destination', () => {
  const PHONE_ORDER = '<h2>ORDER ONLINE</h2><a href="tel:+15551112222">Order Now</a>';
  const stage = () =>
    analyzeJourney(
      recordsFor(PHONE_ORDER).map((e, i) => ({
        id: `o${i}`,
        evidenceType: e.evidenceType,
        fact: e.fact,
        supportingContext: e.supportingContext ?? null,
        confidence: e.confidence,
      })),
    ).find((s) => s.stage === 'ORDERING');

  it('names the telephone destination of the observed button', () => {
    expect(stage()?.finding).toMatch(/places a telephone call/i);
  });

  it('does not claim exclusivity the crawl never established', () => {
    // "Telephone only" asserts that no other ordering route exists anywhere.
    // The collector reads a handful of pages; exclusivity was never in scope.
    const finding = stage()?.finding ?? '';
    expect(finding).not.toMatch(/telephone only|only by (tele)?phone|phone is the only/i);
    expect(finding).toMatch(/not established either way/i);
  });

  it('does not treat the tel: destination as a broken or working journey', () => {
    expect(stage()?.status).toBe('FRICTION');
    expect(stage()?.status).not.toBe('RISK');
    expect(stage()?.status).not.toBe('HEALTHY');
  });
});

// ── DEFECT 5: a gift-card form is not a general enquiry route ──────────────

describe('defect 5 — form scope is preserved in classification and report', () => {
  const GIFT_CARD_FORM = `
    <h1>Gift Cards</h1>
    <form action="/gift-card-request" id="gift-card-form">
      <input name="name" placeholder="Recipient name" />
      <input type="email" name="email" placeholder="Recipient email" />
      <textarea name="message" placeholder="Add a gift message"></textarea>
      <button type="submit">Send gift card</button>
    </form>
  `;

  it('does not classify it as a general contact form', () => {
    const $ = cheerio.load(`<html><body>${GIFT_CARD_FORM}</body></html>`);
    const result = classifyForms($);
    expect(result.contactFormSignal).toBe(false);
    expect(result.formScopes).toContain('gift card');
  });

  it('reports the form AND its scope rather than dropping it', () => {
    const records = recordsFor(GIFT_CARD_FORM, 'https://example-grill.test/gift-cards');
    expect(find(records, 'CONTACT_FORM')).toBeUndefined();
    const scoped = find(records, 'SINGLE_PURPOSE_FORM');
    expect(scoped?.fact).toMatch(/gift card form is published/i);
    expect(scoped?.fact).toMatch(/not general enquiries/i);
  });

  it('CONTACT_PATH names it without counting it as a non-phone route', () => {
    const contact = find(
      recordsFor(`<a href="tel:+15551112222">Call</a>${GIFT_CARD_FORM}`),
      'CONTACT_PATH',
    );
    // The phrase journey.ts keys CONTACT=FRICTION off must survive: there is
    // still no general written route in.
    expect(contact?.fact).toMatch(/no non-phone contact route/i);
    // But the audit must not look as though it missed a form on the page.
    expect(contact?.supportingContext).toMatch(/not counted as general enquiry routes/i);
    expect(contact?.supportingContext).toMatch(/a gift card form/i);
  });

  it('a genuine enquiry form is still a contact route', () => {
    // The scope table must not suppress real contact forms. A page that
    // mentions gift cards in its footer still has a contact form on it.
    const $ = cheerio.load(`<html><body>
      <footer>Gift cards available</footer>
      <form action="/contact" id="contact-form">
        <input name="name" /><input type="email" name="email" />
        <textarea name="message" placeholder="How can we help?"></textarea>
        <button>Send</button>
      </form>
    </body></html>`);
    expect(classifyForms($).contactFormSignal).toBe(true);
  });
});

// ── DEFECT 6: unseen operations are unknown, not weak ──────────────────────

describe('defect 6 — public signup signals do not grade internal follow-up', () => {
  const NO_SIGNALS = [
    ev('EMAIL_CAPTURE', 'No public email capture mechanism was detected on the analyzed pages.'),
    ev('LOYALTY_SIGNAL', 'No public loyalty or rewards pathway was detected on the analyzed website pages.'),
    ev('GIFT_CARD_SIGNAL', 'No public gift card pathway was detected on the analyzed website pages.'),
  ];
  const ONE_SIGNAL = [
    ev('EMAIL_CAPTURE', 'An email capture mechanism (signup form or newsletter invitation) is publicly visible.'),
    ev('LOYALTY_SIGNAL', 'No public loyalty or rewards pathway was detected on the analyzed website pages.'),
  ];
  const TWO_SIGNALS = [
    ev('EMAIL_CAPTURE', 'An email capture mechanism (signup form or newsletter invitation) is publicly visible.'),
    ev('LOYALTY_SIGNAL', 'A loyalty or rewards pathway is publicly linked (1 link(s) found).'),
  ];
  const stageIn = (evidence: EvidenceRecordLike[], name: string) =>
    analyzeJourney(evidence).find((s) => s.stage === name);

  it('absent widgets are friction in the public journey, never a confirmed failure', () => {
    // RISK is the bucket for observed failures. An absent signup box is not an
    // observed failure of follow-up: a POS loyalty programme leaves no trace.
    const followUp = stageIn(NO_SIGNALS, 'FOLLOW_UP');
    expect(followUp?.status).toBe('FRICTION');
    expect(followUp?.status).not.toBe('RISK');
    expect(followUp?.manualValidationRequired).toBe(true);
    expect(followUp?.finding).toMatch(/not assessed/i);
    expect(followUp?.finding).toMatch(/leaves no public trace|invisible to this audit/i);
  });

  it('does not conclude that repeat business depends on memory', () => {
    const ret = stageIn(NO_SIGNALS, 'RETURN');
    expect(ret?.status).toBe('FRICTION');
    expect(ret?.status).not.toBe('RISK');
    expect(ret?.finding).not.toMatch(/depend(s)? entirely on memory/i);
    expect(ret?.finding).toMatch(/require(s)? your own data/i);
  });

  it('one visible signal is not a verdict that follow-up is basic', () => {
    const followUp = stageIn(ONE_SIGNAL, 'FOLLOW_UP');
    expect(followUp?.finding).not.toMatch(/appears basic|system appears/i);
    expect(followUp?.finding).toMatch(/not assessed/i);
  });

  it('visible mechanisms are not a working programme — never HEALTHY', () => {
    const followUp = stageIn(TWO_SIGNALS, 'FOLLOW_UP');
    expect(followUp?.status).toBe('RESOLVED_UNVERIFIED');
    expect(followUp?.status).not.toBe('HEALTHY');
    expect(followUp?.manualValidationRequired).toBe(true);
    expect(followUp?.finding).toMatch(/not a working follow-up programme|whether the resulting list is contacted/i);
  });

  it('the retention finding asks about internal data before recommending a system', () => {
    const leak = leaksFor(NO_SIGNALS).find((l) => /OPT-IN|RETENTION/i.test(l.category))!;
    expect(leak.problem).toMatch(/NOT OBSERVED:/);
    expect(leak.problem).toMatch(/REQUIRES YOUR DATA:/);
    expect(leak.problem).toMatch(/pos loyalty|leaves no public trace/i);
    expect(leak.recommendedSolution).toMatch(/check whether a list already exists/i);
    // Must not rank an unverified operational gap with a confirmed defect.
    expect(leak.impactScore).toBeLessThan(50);
  });
});

// ── FOUND BY RUNNING THE REPAIRED PIPELINE ────────────────────────────────
//
// Both of these were produced by a fresh audit of a fixture site, not by
// reading the code. They are the same class of defect as the six above: a
// specific observation promoted into a broader claim.

describe('a generic booking verb does not assert a table reservation', () => {
  it('"Book Catering" is catering, not a reservation pathway', () => {
    // The live run filed this link under BOTH, and RESERVATION_PATH is a
    // transactional claim — it drives the RESERVATION stage and told the owner
    // a public booking pathway existed where the link opens a catering page.
    const categories = categorizeLink(new URL('https://example-grill.test/catering.html'), 'Book Catering');
    expect(categories).toContain('catering');
    expect(categories).not.toContain('reservation');
  });

  it('the same applies to private events, gift cards and careers', () => {
    const cases: [string, string, string][] = [
      ['https://example-grill.test/private-events', 'Book a Private Event', 'private_dining'],
      ['https://example-grill.test/events', 'Book Now', 'events'],
      ['https://example-grill.test/gift-cards', 'Book a Gift Card Experience', 'gift_card'],
    ];
    for (const [href, text, expected] of cases) {
      const categories = categorizeLink(new URL(href), text);
      expect(categories, `${text} → ${expected}`).toContain(expected);
      expect(categories, `${text} must not be a reservation`).not.toContain('reservation');
    }
  });

  it('a real table booking is untouched, however it is labelled', () => {
    // The guard must not suppress reservations. Anything naming a TABLE
    // booking, or a booking platform, still counts.
    const kept: [string, string][] = [
      ['https://example-grill.test/reservations', 'Book Now'],
      ['https://example-grill.test/catering', 'Book a Table'],
      ['https://www.opentable.com/r/example-grill', 'Book'],
      ['https://resy.com/cities/sp/example-grill', 'Reserve'],
    ];
    for (const [href, text] of kept) {
      expect(categorizeLink(new URL(href), text), `${text} ${href}`).toContain('reservation');
    }
  });
});

describe('an email field is not an invitation to join a list', () => {
  const GIFT_CARD_FORM_PAGE = `
    <h1>Gift Cards</h1>
    <form action="/gift-card-request" id="gift-card-request-form">
      <input type="text" name="name" />
      <input type="email" name="email" />
      <textarea name="message" placeholder="Add a gift message"></textarea>
      <button type="submit">Send gift card request</button>
    </form>
  `;

  it('a gift-card request form is not an email capture mechanism', () => {
    // The live run reported "an email capture mechanism for collecting
    // visitors' addresses (signup form or newsletter invitation) is publicly
    // visible" on a site with no signup anywhere — the claim then fed the
    // retention category, reading a gift-card signal as a follow-up system.
    expect(pageOf(GIFT_CARD_FORM_PAGE).emailCaptureSignal).toBe(false);
    expect(find(recordsFor(GIFT_CARD_FORM_PAGE), 'EMAIL_CAPTURE')?.fact).toMatch(/no mechanism for collecting/i);
  });

  it('a newsletter box still is one', () => {
    const page = pageOf(`
      <form><label>Join our mailing list</label><input type="email" name="subscribe" /><button>Subscribe</button></form>
    `);
    expect(page.emailCaptureSignal).toBe(true);
  });

  it('newsletter wording in the page text still counts', () => {
    expect(pageOf('<p>Sign up for our newsletter in restaurant.</p>').emailCaptureSignal).toBe(true);
  });
});
