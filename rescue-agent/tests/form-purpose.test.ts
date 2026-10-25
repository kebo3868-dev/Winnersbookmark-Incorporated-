/**
 * THE THREE-CLASS FORM MODEL.
 *
 * A form a customer can write into is GENERAL_CONTACT, PURPOSE_SPECIFIC or
 * UNVERIFIED_PURPOSE, decided from the PRESENCE of evidence in the form itself
 * — never from how a sentence is punctuated.
 *
 * Nine review rounds on PR #62 each found a sentence that punctuation rules
 * misread ("Contact us about gift cards, and we will get back to you" read as
 * a list of topics). These tests pin the replacement:
 *
 *   · general wording and no named purpose        → GENERAL_CONTACT
 *   · one named purpose and no general wording    → PURPOSE_SPECIFIC
 *   · both, several purposes, neither, or no
 *     usable submit control                       → UNVERIFIED_PURPOSE
 *
 * and the claims the evidence layer may make from each.
 */
import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';
import { classifyForms, extractPage } from '@/lib/web/collector';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { buildExecutiveReport, type ExecutiveReportInput } from '@/lib/reports/executive';
import type { EvidenceInput } from '@/types/audit';

const classify = (html: string) => classifyForms(cheerio.load(`<html><body>${html}</body></html>`));
/** One label per message-bearing form: GENERAL_CONTACT, PURPOSE_SPECIFIC:<topic> or UNVERIFIED:<reason>. */
const purposeOf = (html: string) =>
  classify(html)
    .forms.map((f) =>
      f.purpose === 'PURPOSE_SPECIFIC' ? `PURPOSE_SPECIFIC:${f.topics[0]}` : f.purpose === 'UNVERIFIED_PURPOSE' ? `UNVERIFIED:${f.reason}` : f.purpose,
    )
    .join(',');

const URL = 'https://example-grill.test/';
const pageOf = (body: string) =>
  extractPage(URL, URL, 200, 'text/html', `<html><head><title>Example Grill</title></head><body>${body}</body></html>`);
const recordsFor = (body: string) => normalizeEvidence({ pages: [pageOf(body)], failures: [], probes: [] });
const find = (ev: EvidenceInput[], type: string) => ev.find((e) => e.evidenceType === type);

const FIELDS = '<input type="text" name="name"/><input type="email" name="email"/><textarea name="message"></textarea>';
const form = (attrs: string, inner: string, submit = '<button type="submit">Send</button>') =>
  `<form ${attrs}>${inner}${FIELDS}${submit}</form>`;

// ── 1. "Contact us about gift cards, and we will get back to you." ─────────

describe('1 — the sentence that ended the punctuation model', () => {
  const SENTENCE = 'Contact us about gift cards, and we will get back to you.';

  it.each([
    ['on a gift-card form', form('action="/gift-card-request" aria-label="Gift card request"', `<h2>${SENTENCE}</h2>`)],
    ['on a /contact form', form('action="/contact"', `<h2>${SENTENCE}</h2>`)],
    ['on a form that says nothing else', form('action="/forms"', `<h2>${SENTENCE}</h2>`)],
    ['as an instruction paragraph', form('action="/forms"', `<p>${SENTENCE}</p>`)],
    ['as the aria-label', form(`action="/forms" aria-label="${SENTENCE}"`, '')],
  ])('%s → unverified, conflicting evidence', (_label, html) => {
    expect(purposeOf(html)).toBe('UNVERIFIED:CONFLICTING_EVIDENCE');
  });

  it('is neither published as a general route nor as gift-card-only, nor denied', () => {
    const records = recordsFor(form('action="/gift-card-request" aria-label="Gift card request"', `<h2>${SENTENCE}</h2>`));
    expect(find(records, 'CONTACT_FORM')).toBeUndefined();
    expect(find(records, 'SINGLE_PURPOSE_FORM')).toBeUndefined();
    expect(find(records, 'FORM_PURPOSE_UNVERIFIED')?.supportingContext).toMatch(/invites contact and names a specific purpose \(gift cards\)/i);
    expect(find(records, 'CONTACT_PATH')?.fact).not.toMatch(/^No public contact pathway/i);
  });
});

// ── 2. A gift-card-only form with a message box ────────────────────────────

describe('2 — a gift-card form with a message box is purpose-specific', () => {
  it.each([
    ['named by its action', form('action="/gift-card-request"', '')],
    ['named by its heading', form('action="/forms"', '<h2>Gift card request</h2>')],
    ['named by its legend', form('action="/forms"', '<legend>Order an e-gift card</legend>')],
    ['named by its submit button', form('action="/forms"', '', '<button>Send gift card request</button>')],
    ['named by its class', form('class="giftcard-form"', '')],
    ['named by an instruction paragraph', form('action="/forms"', '<p>Gift certificates are posted within 3 days.</p>')],
  ])('%s', (_label, html) => {
    expect(purposeOf(html)).toBe('PURPOSE_SPECIFIC:gift card');
  });

  it('the message box does not make it a contact route', () => {
    const r = classify(form('action="/gift-card-request"', '<textarea name="gift_message" placeholder="Ask us anything"></textarea>'));
    expect(r.contactFormSignal).toBe(false);
    expect(r.formScopes).toEqual(['gift card']);
  });

  it('is reported with its scope and without claiming it works', () => {
    const scoped = find(recordsFor(form('action="/gift-card-request"', '')), 'SINGLE_PURPOSE_FORM');
    expect(scoped?.fact).toMatch(/gift card form is published/i);
    expect(scoped?.fact).toMatch(/not general enquiries/i);
    expect(scoped?.supportingContext).toMatch(/was not submitted during this audit/i);
  });
});

// ── 3. A genuine general enquiry form ──────────────────────────────────────

describe('3 — a genuine general enquiry form is general contact', () => {
  it.each([
    ['action="/contact"', form('action="/contact"', '')],
    ['id="contact-form"', form('id="contact-form"', '')],
    ['class="contact_us"', form('class="contact_us"', '')],
    ['heading "Get in touch"', form('action="/forms"', '<h2>Get in touch</h2>')],
    ['heading "How can we help?"', form('action="/forms"', '<h2>How can we help?</h2>')],
    ['legend "General enquiries"', form('action="/forms"', '<legend>General enquiries</legend>')],
    ['submit "Send us a message"', form('action="/forms"', '', '<button>Send us a message</button>')],
    ['instruction "Questions or comments? Drop us a line."', form('action="/forms"', '<p>Questions or comments? Drop us a line.</p>')],
    [
      'a topic menu offering "General question"',
      form('action="/forms"', '<select name="topic"><option>General question</option><option>Feedback</option></select>'),
    ],
  ])('%s', (_label, html) => {
    expect(purposeOf(html)).toBe('GENERAL_CONTACT');
  });

  it('is reported as a route, bounded: not submitted, reply not observed', () => {
    const records = recordsFor(form('action="/contact"', '<h2>Get in touch</h2>'));
    expect(find(records, 'CONTACT_FORM')?.fact).toMatch(/customer enquiry form is published/i);
    expect(find(records, 'CONTACT_FORM')?.supportingContext).toMatch(/was not submitted during this audit/i);
    expect(find(records, 'CONTACT_PATH')?.fact).toMatch(/an enquiry form/i);
    expect(find(records, 'FORM_PURPOSE_UNVERIFIED')).toBeUndefined();
  });
});

// ── 4. Several legitimate purposes ─────────────────────────────────────────

describe('4 — a form serving several purposes is never narrowed to one', () => {
  it.each([
    ['catering and private events, nothing general', 'UNVERIFIED:SEVERAL_PURPOSES', form('action="/catering-request"', '<h2>Private event request</h2>')],
    ['gift cards and jobs, nothing general', 'UNVERIFIED:SEVERAL_PURPOSES', form('action="/forms"', '<h2>Gift cards</h2><p>Also hiring: apply now.</p>')],
    ['several purposes plus "Contact us"', 'UNVERIFIED:CONFLICTING_EVIDENCE', form('action="/contact"', '<h2>Catering requests and gift cards</h2>')],
    [
      'a topic menu offering several purposes and "Other"',
      'GENERAL_CONTACT',
      form('action="/forms"', '<select name="enquiry_type"><option>Reservations</option><option>Gift cards</option><option>Other</option></select>'),
    ],
    [
      'a topic menu offering only specific purposes',
      'UNVERIFIED:NO_PURPOSE_EVIDENCE',
      form('action="/forms"', '<select name="subject"><option>Gift cards</option><option>Catering</option></select>'),
    ],
  ])('%s → %s', (_label, expected, html) => {
    expect(purposeOf(html)).toBe(expected);
  });

  it('names every purpose in the report', () => {
    const records = recordsFor(form('action="/catering-request"', '<h2>Private event request</h2>'));
    expect(find(records, 'SINGLE_PURPOSE_FORM')).toBeUndefined();
    expect(find(records, 'FORM_PURPOSE_UNVERIFIED')?.supportingContext).toMatch(/catering requests and private event requests/i);
  });

  it('an "Other amount" menu on a gift-card form is not a general invitation', () => {
    expect(
      purposeOf(form('action="/gift-card-request"', '<select name="amount"><option>$25</option><option>Other amount</option></select>')),
    ).toBe('PURPOSE_SPECIFIC:gift card');
  });
});

// ── 5. Brackets and parentheticals ─────────────────────────────────────────

describe('5 — bracketed notes change nothing', () => {
  it.each([
    ['general wording with a note', 'GENERAL_CONTACT', '<h2>Contact us (we reply within a day)</h2>'],
    ['general wording with a bracketed note', 'GENERAL_CONTACT', '<h2>Get in touch [Mon–Fri]</h2>'],
    ['a purpose with a note', 'PURPOSE_SPECIFIC:gift card', '<h2>Gift card request (allow 3 days)</h2>'],
    ['a purpose inside the note of general wording', 'UNVERIFIED:CONFLICTING_EVIDENCE', '<h2>Contact us (gift cards only)</h2>'],
    ['general wording inside the note of a purpose', 'UNVERIFIED:CONFLICTING_EVIDENCE', '<h2>Gift card request (questions? contact us)</h2>'],
    ['an unclosed bracket', 'UNVERIFIED:CONFLICTING_EVIDENCE', '<h2>Contact us about gift cards (include your order number</h2>'],
    ['nested brackets', 'UNVERIFIED:CONFLICTING_EVIDENCE', '<h2>Contact us (about gift cards (balances))</h2>'],
  ])('%s → %s', (_label, expected, heading) => {
    expect(purposeOf(form('action="/forms"', heading))).toBe(expected);
  });
});

// ── 6. Semicolons, commas, ampersands and pipes ────────────────────────────

describe('6 — punctuation in a continuing sentence changes nothing', () => {
  it.each([
    ['semicolon', 'GENERAL_CONTACT', 'Get in touch; we reply within a day'],
    ['comma and "and"', 'GENERAL_CONTACT', 'Contact us, and we will get back to you'],
    ['ampersand', 'GENERAL_CONTACT', 'Questions &amp; comments? Contact us'],
    ['pipe', 'GENERAL_CONTACT', 'Contact | Example Grill'],
    ['all four', 'GENERAL_CONTACT', 'Get in touch; questions, comments &amp; ideas | we reply fast'],
    ['purpose with semicolon', 'PURPOSE_SPECIFIC:gift card', 'Gift card request; allow 3 days'],
    ['purpose with comma, "&" and pipe', 'PURPOSE_SPECIFIC:gift card', 'Gift cards, e-gift &amp; certificates | allow 3 days'],
    ['mixed with semicolon', 'UNVERIFIED:CONFLICTING_EVIDENCE', 'Contact us about gift cards; include your order number'],
    ['mixed with comma', 'UNVERIFIED:CONFLICTING_EVIDENCE', 'Contact us about gift cards, and we will get back to you'],
    ['mixed with ampersand', 'UNVERIFIED:CONFLICTING_EVIDENCE', 'Contact us about gift cards &amp; allergens'],
    ['mixed with pipe', 'UNVERIFIED:CONFLICTING_EVIDENCE', 'Gift cards | contact us'],
  ])('%s → %s', (_label, expected, heading) => {
    expect(purposeOf(form('action="/forms"', `<h2>${heading}</h2>`))).toBe(expected);
  });

  it('the same words decide the same way whatever the separator', () => {
    const verdicts = [', ', '; ', ' & ', ' | ', ' — ', ' and ', ' (', ': '].map((sep) =>
      purposeOf(form('action="/forms"', `<h2>Contact us about gift cards${sep}we reply fast</h2>`)),
    );
    expect(new Set(verdicts)).toEqual(new Set(['UNVERIFIED:CONFLICTING_EVIDENCE']));
  });
});

// ── 7. Headings elsewhere on the page ──────────────────────────────────────

describe('7 — headings outside the form are not its evidence', () => {
  it.each([
    ['a gift-card banner above a contact form', 'GENERAL_CONTACT', `<h1>Gift cards</h1><p>Buy a gift card today!</p>${form('action="/contact"', '')}`],
    ['a "Contact us" banner above a gift-card form', 'PURPOSE_SPECIFIC:gift card', `<h1>Contact us</h1>${form('action="/gift-card-request"', '')}`],
    ['a page heading above an unlabelled form', 'UNVERIFIED:NO_PURPOSE_EVIDENCE', `<h1>Contact us</h1>${form('action="/forms"', '')}`],
    ['a heading part-way down the form', 'GENERAL_CONTACT', `<form action="/contact"><input type="email" name="e"/><h3>Gift card details (optional)</h3><textarea name="message"></textarea><button>Send</button></form>`],
    ['a note after the fields', 'PURPOSE_SPECIFIC:gift card', `<form action="/gift-card-request"><input type="email" name="e"/><textarea name="message"></textarea><p>Any questions? Contact us.</p><button>Send</button></form>`],
    ['a field label naming a topic', 'GENERAL_CONTACT', `<form action="/contact"><label>Gift card number <input name="gc"/></label><textarea name="message"></textarea><button>Send</button></form>`],
  ])('%s → %s', (_label, expected, html) => {
    expect(purposeOf(html)).toBe(expected);
  });

  it('two forms on a page are judged separately', () => {
    expect(purposeOf(`${form('action="/contact"', '')}${form('action="/gift-card-request"', '')}${form('action="/forms"', '')}`)).toBe(
      'GENERAL_CONTACT,PURPOSE_SPECIFIC:gift card,UNVERIFIED:NO_PURPOSE_EVIDENCE',
    );
  });
});

// ── 8. A published email alongside a purpose-specific form ─────────────────

describe('8 — a published email is never denied because the only form is scoped', () => {
  const PAGE = `<a href="mailto:hello@example-grill.test">Email us</a>${form('action="/gift-card-request"', '')}`;

  it('the email is the contact route; the form is reported with its scope', () => {
    const records = recordsFor(PAGE);
    expect(find(records, 'CONTACT_EMAIL')?.fact).toMatch(/hello@example-grill\.test/);
    expect(find(records, 'CONTACT_PATH')?.fact).toMatch(/publicly available by a published email address/i);
    expect(find(records, 'CONTACT_PATH')?.fact).not.toMatch(/^No /);
    expect(find(records, 'SINGLE_PURPOSE_FORM')?.fact).toMatch(/gift card form/i);
    expect(find(records, 'CONTACT_FORM')).toBeUndefined();
  });

  it('the same holds with a form of unverified purpose', () => {
    const records = recordsFor(`<a href="mailto:hello@example-grill.test">Email us</a>${form('action="/forms"', '')}`);
    expect(find(records, 'CONTACT_PATH')?.fact).toMatch(/publicly available by a published email address/i);
    expect(find(records, 'CONTACT_PATH')?.fact).toMatch(/verified enquiry form/i);
    expect(find(records, 'FORM_PURPOSE_UNVERIFIED')).toBeDefined();
  });

  it('with only the scoped form, the absence is stated as GENERAL, and the form is named', () => {
    const contact = find(recordsFor(form('action="/gift-card-request"', '')), 'CONTACT_PATH');
    expect(contact?.fact).toMatch(/^No general public contact pathway was detected; the only form found is scoped to gift card requests\./);
  });
});

// ── 9. Unclear purpose ─────────────────────────────────────────────────────

describe('9 — a form that does not say what it is for is unverified', () => {
  it.each([
    ['generic action, "Send" button', form('action="/forms"', '')],
    ['no attributes at all', form('', '')],
    ['a "How can we help?" PLACEHOLDER only — a field label, not the form', `<form action="/forms"><textarea name="message" placeholder="How can we help?"></textarea><button>Send</button></form>`],
    ['"Submit" button', form('action="/wp-admin/admin-ajax.php"', '', '<input type="submit" value="Submit">')],
    ['a feedback box', form('action="/forms"', '<h2>Feedback</h2>')],
    ['bare "Enquiry"', form('action="/forms"', '<h2>Enquiry form</h2>')],
  ])('%s', (_label, html) => {
    expect(purposeOf(html)).toBe('UNVERIFIED:NO_PURPOSE_EVIDENCE');
  });

  it('is reported as unverified, with an uncertainty label, and never as absence', () => {
    const records = recordsFor(form('action="/forms"', ''));
    const unverified = find(records, 'FORM_PURPOSE_UNVERIFIED');
    expect(unverified?.fact).toMatch(/could not be established from the form itself/i);
    expect(unverified?.supportingContext).toMatch(/message box alone does not show/i);
    expect(unverified?.supportingContext).toMatch(/not evidence that no route exists/i);
    expect(unverified?.confidence).toBeLessThan(60);
    expect(find(records, 'CONTACT_FORM')).toBeUndefined();
    expect(find(records, 'CONTACT_PATH')?.fact).toBe(
      'No verified public contact pathway was detected; a form was found whose purpose could not be established.',
    );
  });

  it('phone plus an unverified form is not reported as phone-only', () => {
    const records = recordsFor(`<a href="tel:+15551112222">Call</a>${form('action="/forms"', '')}`);
    const contact = find(records, 'CONTACT_PATH');
    expect(contact?.fact).not.toMatch(/no non-phone contact route/i);
    expect(contact?.fact).toMatch(/no verified non-phone contact route/i);
    const stage = analyzeJourney(
      records.map((e, i) => ({ id: `f${i}`, evidenceType: e.evidenceType, fact: e.fact, supportingContext: e.supportingContext ?? null, confidence: e.confidence })),
    ).find((s) => s.stage === 'CONTACT');
    expect(stage?.finding).not.toMatch(/the phone is the only route in/i);
  });
});

// ── 10. Missing, hidden or non-functional submit controls ──────────────────

describe('10 — a general form nobody can send is not counted as a route', () => {
  it.each([
    ['no submit control', '<form action="/contact" id="c1">', ''],
    ['only a type="button" control', '<form action="/contact" id="c2">', '<button type="button">Send</button>'],
    ['only a reset control', '<form action="/contact" id="c3">', '<input type="reset" value="Clear">'],
    ['a disabled submit', '<form action="/contact" id="c4">', '<button type="submit" disabled>Send</button>'],
    ['a submit hidden by style', '<form action="/contact" id="c5">', '<button style="display: none">Send</button>'],
    ['a submit with the hidden attribute', '<form action="/contact" id="c6">', '<button hidden>Send</button>'],
    ['a submit inside a hidden wrapper', '<form action="/contact" id="c7">', '<div style="visibility:hidden"><button>Send</button></div>'],
    ['an aria-hidden submit', '<form action="/contact" id="c8">', '<input type="submit" value="Send" aria-hidden="true">'],
    ['a hidden form', '<form action="/contact" id="c9" style="display:none">', '<button>Send</button>'],
    ['a submit that belongs to another form', '<form action="/contact" id="c10">', '<button form="newsletter">Send</button>'],
  ])('%s → unverified', (_label, open, submit) => {
    expect(purposeOf(`${open}${FIELDS}${submit}</form>`)).toBe('UNVERIFIED:NO_USABLE_SUBMIT_CONTROL');
  });

  it.each([
    ['a <button> with no type (submits by default)', '<button>Send</button>'],
    ['an image input', '<input type="image" src="send.png" alt="Send">'],
    ['an enabled submit beside a disabled one', '<button disabled>Wait</button><button>Send</button>'],
  ])('control: %s is usable', (_label, submit) => {
    expect(purposeOf(`<form action="/contact">${FIELDS}${submit}</form>`)).toBe('GENERAL_CONTACT');
  });

  it('control: a submit outside the form that names it with form="id" is usable', () => {
    expect(purposeOf(`<form action="/contact" id="cf">${FIELDS}</form><button form="cf">Send</button>`)).toBe('GENERAL_CONTACT');
  });

  it('a purpose-specific form without a submit control keeps its scope — that verdict never claims it works', () => {
    expect(purposeOf(`<form action="/gift-card-request">${FIELDS}</form>`)).toBe('PURPOSE_SPECIFIC:gift card');
  });

  it('the report says why', () => {
    const unverified = find(recordsFor(`<form action="/contact">${FIELDS}</form>`), 'FORM_PURPOSE_UNVERIFIED');
    expect(unverified?.supportingContext).toMatch(/no visible, enabled submit button/i);
  });
});

// ── Adversarial ────────────────────────────────────────────────────────────

describe('adversarial inputs', () => {
  it.each([
    ['"contactless" is not "contact"', 'PURPOSE_SPECIFIC:gift card', form('class="contactless-gift-card"', '')],
    ['a purpose in the query string of a contact action', 'UNVERIFIED:CONFLICTING_EVIDENCE', form('action="/contact?ref=gift-card"', '')],
    ['case and spacing', 'GENERAL_CONTACT', form('action="/forms"', '<h2>  GET   IN TOUCH  </h2>')],
    ['a 5,000-character heading', 'GENERAL_CONTACT', form('action="/forms"', `<h2>Contact us ${'x'.repeat(5000)}</h2>`)],
    ['a purpose word 250 characters into a heading still counts', 'UNVERIFIED:CONFLICTING_EVIDENCE', form('action="/forms"', `<h2>Contact us ${'x '.repeat(120)}gift cards</h2>`)],
    ['markup injected into an attribute', 'UNVERIFIED:NO_PURPOSE_EVIDENCE', form('action="/forms" data-x="&lt;h2&gt;Contact us&lt;/h2&gt;"', '')],
    ['a hidden text field does not count as the first field', 'PURPOSE_SPECIFIC:gift card', `<form action="/forms"><input type="hidden" name="t"/><h2>Gift card request</h2>${FIELDS}<button>Send</button></form>`],
  ])('%s → %s', (_label, expected, html) => {
    expect(purposeOf(html)).toBe(expected);
  });

  it('a newsletter box mentioning "contact us" is still a newsletter box, not a form of any purpose', () => {
    const r = classify('<form><p>Contact us? Join our mailing list.</p><input type="email" name="email"/><button>Subscribe</button></form>');
    expect(r.forms).toEqual([]);
    expect(r.contactFormSignal).toBe(false);
  });

  it('a reservation form is never given a contact purpose', () => {
    const r = classify(
      '<form action="/contact"><h2>Contact us to book</h2><input type="date" name="date"/><input name="party_size"/><textarea name="notes"></textarea><button>Request</button></form>',
    );
    expect(r.reservationFormSignal).toBe(true);
    expect(r.forms).toEqual([]);
  });
});

// ── Client-facing report and PDF data ──────────────────────────────────────

describe('the uncertainty reaches the client report with its label', () => {
  const reportFor = (body: string) => {
    const evidence = recordsFor(body).map((e, i) => ({
      id: `r${i}`,
      evidenceType: e.evidenceType,
      fact: e.fact,
      supportingContext: e.supportingContext ?? null,
      confidence: e.confidence,
      sourceUrl: e.sourceUrl,
    }));
    const input: ExecutiveReportInput = {
      auditId: 'fp',
      restaurantName: 'Example Grill',
      websiteUrl: URL,
      location: null,
      auditDate: '2026-10-25',
      auditStatus: 'COMPLETED',
      demoMode: false,
      contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
      bookingQrDataUrl: null,
      avgTicket: null,
      overallScore: 60,
      coverageScore: 50,
      sourcesCollected: 1,
      sourcesFailed: 0,
      evidence,
      opportunities: [],
      journey: analyzeJourney(evidence),
      categoryScores: [],
      storedSummary: null,
      storedSummaryWasAiEnhanced: false,
      storedRecommendation: null,
    };
    return buildExecutiveReport(input);
  };

  it('the appendix — which the web report and the PDF both print — carries the record and a Preliminary label', () => {
    const row = reportFor(form('action="/forms"', '')).appendix.find((e) => e.evidenceType === 'FORM_PURPOSE_UNVERIFIED');
    expect(row?.fact).toMatch(/could not be established/i);
    expect(row?.confidenceLabel).toBe('Preliminary');
  });

  it('no client-facing form record claims a submission works', () => {
    const appendix = reportFor(
      `${form('action="/contact"', '')}${form('action="/gift-card-request"', '')}${form('action="/forms"', '')}`,
    ).appendix.filter((e) => /FORM/.test(e.evidenceType));
    expect(appendix.map((e) => e.evidenceType).sort()).toEqual(['CONTACT_FORM', 'FORM_PURPOSE_UNVERIFIED', 'SINGLE_PURPOSE_FORM']);
    for (const e of appendix) {
      expect(`${e.fact} ${e.supportingContext}`, e.evidenceType).not.toMatch(/\b(works|working|functional|successfully|delivered|tested and)\b/i);
      expect(e.supportingContext, e.evidenceType).toMatch(/not submitted during this audit/i);
    }
  });
});
