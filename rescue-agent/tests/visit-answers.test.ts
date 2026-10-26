/**
 * Email capture and menu availability: what the evidence may claim.
 *
 * Round 11 (Codex on 2b12c75, both bisected to earlier commits on this branch):
 *   · a "Name, Email, [Sign up]" form was reported as "no mechanism for
 *     collecting visitors' email addresses" (since 8172262);
 *   · a menu link returning 404 was credited as answering the menu question
 *     and cut the phone finding's impact and urgency (since 87d494a).
 *
 * Round 12 (Codex on 8104d70, against the round-11 repair):
 *   · a working /menu beside a broken /old-menu was told "the menu cannot be
 *     read online" — any failure cancelled the answer;
 *   · a wine-tasting registration form counted as mailing-list capture —
 *     a "Register" button was treated as evidence of a list.
 *
 * The rules pinned here: each menu destination is judged on its own, and a
 * signup counts as email capture only when the form's own wording names an
 * ongoing list. Anything the evidence cannot settle stays unverified — never
 * promoted to verified, never turned into an absence.
 */
import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';
import { classifyForms, classifySignupForm, extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import type { EvidenceInput } from '@/types/audit';

const HOME = 'https://probe-grill.test/';
const page = (body: string, url = HOME) =>
  extractPage(url, url, 200, 'text/html', `<html><head><title>Probe Grill</title></head><body>${body}</body></html>`);
const records = (ev: EvidenceInput[]) =>
  ev.map((e, i) => ({
    id: `v${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    supportingContext: e.supportingContext ?? null,
    confidence: e.confidence,
    sourceUrl: e.sourceUrl,
  }));
const analyse = (pages: ReturnType<typeof page>[], probes: ProbeResult[] = []) => {
  const ev = records(normalizeEvidence({ pages, failures: [], probes }));
  const journey = analyzeJourney(ev);
  return { ev, journey, leaks: detectRevenueLeaks({ evidence: ev, journey }) };
};
const signupKind = (form: string) => {
  const $ = cheerio.load(`<html><body>${form}</body></html>`);
  return classifySignupForm($, $('form').first());
};

// ── 1. Email capture ───────────────────────────────────────────────────────

describe('1 — a signup counts as email capture only when the form names a list', () => {
  const BASE = '<h1>Probe Grill</h1><p>Call (727) 555-0000</p>';
  const optInFinding = (leaks: ReturnType<typeof analyse>['leaks']) =>
    leaks.find((l) => /no public way to opt into hearing from you/i.test(l.title ?? ''));

  it.each([
    ['newsletter, name + email', '<form action="/signup"><h3>Join our newsletter</h3><input name="name"/><input type="email" name="email"/><button>Sign up</button></form>'],
    ['"Get email updates", first + last name', '<form><p>Get email updates</p><input name="first_name"/><input name="last_name"/><input type="email" name="email"/><button>Join</button></form>'],
    ['"news & offers" consent label, mobile', '<form><input type="email" name="email"/><input type="tel" name="mobile"/><label><input type="checkbox" name="optin"/> Send me news &amp; offers</label><button>Sign up</button></form>'],
    ['"VIP club", birthday', '<form><h3>Join our VIP club</h3><input name="fullname" placeholder="Your name"/><input type="email" name="email"/><input type="date" name="birthday"/><button>Join</button></form>'],
    ['a clearly identified newsletter with NO consent tick', '<form class="newsletter-signup"><input name="name"/><input type="email" name="email"/><input type="submit" value="Sign Up"/></form>'],
    ['the approved email-only box (shape)', '<form><input type="email" name="email" placeholder="Your email"/><button>Join</button></form>'],
  ])('capture: %s', (_label, form) => {
    expect(signupKind(form)).toBe('MAILING_LIST');
    const p = page(`${BASE}${form}`);
    expect(p.emailCaptureSignal).toBe(true);
    const { ev, leaks } = analyse([p]);
    expect(ev.find((e) => e.evidenceType === 'EMAIL_CAPTURE')?.fact).toMatch(/email capture mechanism/i);
    expect(optInFinding(leaks)).toBeUndefined();
  });

  it.each([
    ['event registration, name + email, "Register" (codex)', '<form action="/event-registration"><h2>Register for our wine tasting</h2><input name="name"/><input type="email" name="email"/><input type="submit" value="Register"/></form>'],
    ['RSVP for an event', '<form><h3>RSVP</h3><input name="name"/><input type="email" name="email"/><button>Join</button></form>'],
    ['tickets', '<form><h3>Tickets for New Year’s Eve</h3><input name="name"/><input type="email" name="email"/><button>Register</button></form>'],
    ['account creation (no password field)', '<form><h3>Create an account</h3><input name="name"/><input type="email" name="email"/><button>Sign up</button></form>'],
    ['a waitlist', '<form action="/waitlist"><input name="name"/><input type="email" name="email"/><button>Join the waitlist</button></form>'],
    ['a job form', '<form><h2>Careers</h2><input name="name"/><input type="email" name="email"/><button>Sign up</button></form>'],
    ['"Join our team"', '<form><h3>Join our team</h3><input name="name"/><input type="email" name="email"/><button>Join</button></form>'],
    ['an email-only box for an event', '<form><p>Register for the cooking class</p><input type="email" name="email"/><button>Register</button></form>'],
  ])('another purpose, not capture: %s', (_label, form) => {
    expect(signupKind(form)).toBe('OTHER_PURPOSE');
    const p = page(`${BASE}${form}`);
    expect(p.emailCaptureSignal).toBe(false);
    expect(p.unverifiedSignupSignal).toBe(false);
    // Its email is collected for something else, so the absence of a list
    // signup is a fact the audit may state — and the opt-in finding returns.
    const { ev, leaks } = analyse([p]);
    expect(ev.find((e) => e.evidenceType === 'EMAIL_CAPTURE')?.fact).toMatch(/^No mechanism for collecting visitors' email addresses/);
    expect(optInFinding(leaks)).toBeDefined();
  });

  it.each([
    ['name + email, "Sign up" (round-11 codex case)', '<form action="/signup"><input name="name" placeholder="Name"/><input type="email" name="email"/><button>Sign up</button></form>'],
    ['first + last name, "Join"', '<form><input name="first_name"/><input name="last_name"/><input type="email" name="email"/><button>Join</button></form>'],
    ['name + email + birthday, "Join the club"', '<form><input name="fullname" placeholder="Your name"/><input type="email" name="email"/><input type="date" name="birthday"/><button>Join the club</button></form>'],
    ['submit input "Sign Up Now"', '<form><input name="name"/><input type="email" name="email"/><input type="submit" value="Sign Up Now"/></form>'],
    ['"Sign-up" with a bare consent tick', '<form><input name="name"/><input type="email" name="email"/><input type="checkbox" name="consent"/><button>Sign-up</button></form>'],
    ['generic "Register"', '<form><input name="name"/><input type="email" name="email"/><button>Register</button></form>'],
  ])('ambiguous — neither capture nor absence: %s', (_label, form) => {
    expect(signupKind(form)).toBe('AMBIGUOUS');
    const p = page(`${BASE}${form}`);
    expect(p.emailCaptureSignal).toBe(false);
    expect(p.unverifiedSignupSignal).toBe(true);
    const { ev, journey, leaks } = analyse([p]);
    const capture = ev.find((e) => e.evidenceType === 'EMAIL_CAPTURE');
    expect(capture?.fact).toMatch(/could not be established/i);
    expect(capture?.fact).not.toMatch(/^No mechanism/i);
    expect(capture?.supportingContext).toMatch(/not evidence that none exists/i);
    expect(capture?.confidence).toBeLessThan(60);
    // No surface turns the uncertainty into an absence…
    expect(optInFinding(leaks)).toBeUndefined();
    const followUp = journey.find((s) => s.stage === 'FOLLOW_UP')!;
    expect(followUp.finding).not.toMatch(/no public way to opt into hearing from you/i);
    expect(followUp.status).toBe('UNKNOWN');
    expect(journey.find((s) => s.stage === 'RETURN')!.finding).not.toMatch(/nothing on the site invites a guest back/i);
    // …or into a confirmed route.
    expect(followUp.finding).not.toMatch(/one public retention signal was detected/i);
  });

  it.each([
    ['a general enquiry form (name, email, message)', '<form action="/contact"><input name="name"/><input type="email" name="email"/><textarea name="message"></textarea><button>Send</button></form>'],
    ['name + email with a "Send" button', '<form action="/forms"><input name="name"/><input type="email" name="email"/><button>Send</button></form>'],
    ['"Sign up" with a message box', '<form><input name="name"/><input type="email" name="email"/><textarea name="comments"></textarea><button>Sign up</button></form>'],
    ['"Sign up" with an unrecognised field', '<form><input name="name"/><input type="email" name="email"/><input name="company"/><button>Sign up</button></form>'],
    ['"Sign up" on a non-submit button', '<form><input name="name"/><input type="email" name="email"/><button type="button">Sign up</button></form>'],
    ['"Sign up" text that is not the submit label', '<form><p>Sign up below</p><input name="name"/><input type="email" name="email"/><button>Send</button></form>'],
    ['account registration with a password', '<form><input name="name"/><input type="email" name="email"/><input type="password" name="password"/><button>Sign up</button></form>'],
  ])('not a signup at all: %s', (_label, form) => {
    expect(signupKind(form)).toBeNull();
    const p = page(`${BASE}${form}`);
    expect(p.emailCaptureSignal).toBe(false);
    expect(p.unverifiedSignupSignal).toBe(false);
  });

  it('a form naming a list AND another purpose is ambiguous on its own — but newsletter wording on the page still counts', () => {
    const form = '<form><h3>Register for our wine tasting and join our newsletter</h3><input name="name"/><input type="email" name="email"/><button>Register</button></form>';
    expect(signupKind(form)).toBe('AMBIGUOUS');
    // The approved page-wording rule ("newsletter" anywhere on the page) is
    // unchanged, and here it is the form's own words: capture.
    expect(page(`${BASE}${form}`).emailCaptureSignal).toBe(true);
  });

  it('a list-identified form beside an ambiguous one is capture', () => {
    const p = page(
      `${BASE}<form><input name="name"/><input type="email" name="email"/><button>Sign up</button></form>` +
        '<form><h3>Join our newsletter</h3><input type="email" name="email2"/><button>Subscribe</button></form>',
    );
    expect(p.emailCaptureSignal).toBe(true);
    expect(p.unverifiedSignupSignal).toBe(false);
  });

  it('the approved contact-form classifications are unchanged', () => {
    const $ = cheerio.load(
      '<html><body>' +
        '<form action="/contact"><input name="name"/><input type="email" name="email"/><textarea name="message"></textarea><button>Send</button></form>' +
        '<form action="/gift-card-request"><input name="name"/><input type="email" name="email"/><textarea name="message"></textarea><button>Send</button></form>' +
        '<form action="/forms"><input name="name"/><input type="email" name="email"/><textarea name="message"></textarea><button>Send</button></form>' +
        '<form action="/signup"><h3>Join our newsletter</h3><input name="name"/><input type="email" name="email"/><button>Sign up</button></form>' +
        '<form action="/event-registration"><h2>Register for our wine tasting</h2><input name="name"/><input type="email" name="email"/><button>Register</button></form>' +
        '</body></html>',
    );
    // Signup and registration boxes have no message field, so they are not
    // forms a customer writes to the restaurant through: no contact purpose.
    expect(classifyForms($).forms.map((f) => f.purpose)).toEqual(['GENERAL_CONTACT', 'PURPOSE_SPECIFIC', 'UNVERIFIED_PURPOSE']);
  });
});

// ── 2. Menu destinations ───────────────────────────────────────────────────

const BODY_LINKS = (links: string[]) =>
  '<h1>Probe Grill</h1><a href="tel:+17275550000">Call (727) 555-0000</a>' +
  links.map((l) => `<a href="${l}">Menu</a>`).join('') +
  '<p>Hours: Mon-Sun 11am-10pm</p><p>123 Gulf Blvd, Treasure Island, FL 33706</p>';
const BODY = BODY_LINKS(['/menu']);
const MENU = 'https://probe-grill.test/menu';
const OLD = 'https://probe-grill.test/old-menu';
const probe = (url: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ url, category: 'menu', ok: true, httpStatus: 200, note: 'HTTP 200', ...over });
const WORKING = (url: string) => probe(url);
const BROKEN = (url: string) => probe(url, { ok: false, httpStatus: 404, note: 'HTTP 404' });
const PLACEHOLDER = (url: string) => probe(url, { placeholderSignal: 'menu coming soon: "Menu coming soon"' });
const REFUSED = (url: string) => probe(url, { ok: false, httpStatus: 405, note: 'HTTP 405' });
const phoneFinding = (pages: ReturnType<typeof page>[], probes: ProbeResult[] = []) => {
  const r = analyse(pages, probes);
  return { ...r, phone: r.leaks.find((l) => /PHONE-DEPENDENT/.test(l.category))!, availability: r.ev.find((e) => e.evidenceType === 'MENU_AVAILABILITY') };
};

describe('2 — the menu counts as answered only when a destination is known to work', () => {
  it.each([
    ['HTTP 404 (round-11 codex)', BROKEN(MENU)],
    ['HTTP 500', probe(MENU, { ok: false, httpStatus: 500, note: 'HTTP 500' })],
    ['a placeholder page', PLACEHOLDER(MENU)],
  ])('broken — %s: not credited, named as failed, no impact reduction', (_label, p) => {
    const { phone, journey, availability } = phoneFinding([page(BODY)], [p]);
    expect(availability?.fact).toMatch(/^No readable menu was found/);
    expect(phone.problem).not.toMatch(/publish[^.]*the menu/i);
    expect(phone.problem).toMatch(/every linked menu destination failed when tested or leads to a page with no menu yet/i);
    expect(phone.title).toBe('Common visit questions are not answered on the website');
    expect(phone.impactScore).toBe(65);
    expect(phone.urgencyScore).toBe(55);
    expect(['RISK', 'FRICTION']).toContain(journey.find((s) => s.stage === 'MENU')?.status);
  });

  it('working — HTTP 200: credited, impact and urgency reduced', () => {
    const { phone, availability } = phoneFinding([page(BODY)], [WORKING(MENU)]);
    expect(availability?.fact).toBe(`A working menu was verified at ${MENU}.`);
    expect(phone.problem).toMatch(/does publish opening hours, the menu, the address and how to get in touch/i);
    expect(phone.problem).toMatch(/answerable online without calling/i);
    expect(phone.impactScore).toBe(40);
    expect(phone.urgencyScore).toBe(30);
  });

  it.each([
    ['never tested', [] as ProbeResult[]],
    ["refused the audit's GET (HTTP 405)", [REFUSED(MENU)]],
    ['timed out (cannot be called broken)', [probe(MENU, { ok: false, httpStatus: undefined, failureKind: 'TIMEOUT', note: 'timed out' } as Partial<ProbeResult>)]],
  ])('unknown — %s: not presented as verified, and not presented as a failure', (_label, probes) => {
    const { phone, ev, availability } = phoneFinding([page(BODY)], probes);
    expect(availability?.fact).toMatch(/^Menu availability was not verified/);
    expect(phone.problem).not.toMatch(/publish[^.]*the menu/i);
    expect(phone.problem).toMatch(/whether it opens a working menu was not verified/i);
    expect(phone.problem).not.toMatch(/failed when tested|cannot be read online/i);
    expect(phone.impactScore).toBe(65);
    expect(phone.urgencyScore).toBe(55);
    expect(phone.title).toBe('Phone demand is unmeasured, and the website cannot show whether it is avoidable');
    expect(phone.businessImpact).toMatch(/not fully verified/i);
    expect(ev.some((e) => /responded successfully|fetched successfully/i.test(e.fact))).toBe(false);
  });

  it('a menu page the audit fetched as a source counts as tested', () => {
    const { phone, ev, availability } = phoneFinding([page(BODY), page('<h1>Menu</h1><p>Grouper sandwich $18</p>', MENU)]);
    expect(ev.find((e) => /fetched successfully during this audit/i.test(e.fact))?.sourceUrl).toBe(MENU);
    expect(availability?.supportingContext).toContain(`${MENU} — works (fetched during this audit, HTTP 200)`);
    expect(phone.problem).toMatch(/does publish opening hours, the menu/i);
    expect(phone.impactScore).toBe(40);
  });

  it('a fetched menu page that is a placeholder counts as failed, like a probed one', () => {
    const { phone, journey, availability } = phoneFinding([page(BODY), page('<h1>Menu</h1><p>Our new menu is coming soon!</p>', MENU)]);
    expect(availability?.fact).toMatch(/^No readable menu was found/);
    expect(phone.problem).toMatch(/every linked menu destination failed when tested or leads to a page with no menu yet/i);
    expect(journey.find((s) => s.stage === 'MENU')?.status).toBe('FRICTION');
  });

  it('a page fetched at a different URL does not verify the menu link', () => {
    const { phone } = phoneFinding([page(BODY), page('<h1>About</h1>', 'https://probe-grill.test/about')]);
    expect(phone.problem).toMatch(/was not verified/i);
  });
});

// ── 3. Several menu destinations, each judged on its own ───────────────────

describe('3 — several menu links: each destination is judged on its own, in any order', () => {
  type Status = 'working' | 'broken' | 'placeholder' | 'untested' | 'refused';
  const make: Record<Status, ((url: string) => ProbeResult) | null> = {
    working: WORKING,
    broken: BROKEN,
    placeholder: PLACEHOLDER,
    untested: null,
    refused: REFUSED,
  };
  const run = (a: Status, b: Status, order: 'menu-first' | 'old-first') => {
    const links = order === 'menu-first' ? ['/menu', '/old-menu'] : ['/old-menu', '/menu'];
    const probes = ([[MENU, a], [OLD, b]] as const).flatMap(([url, s]) => (make[s] ? [make[s]!(url)] : []));
    return phoneFinding([page(BODY_LINKS(links))], order === 'menu-first' ? probes : [...probes].reverse());
  };

  it.each([
    // [first, second, expected conclusion, credited?, spare-failure note?]
    ['working', 'broken', 'VERIFIED', true, 'separately'],
    ['working', 'placeholder', 'VERIFIED', true, 'separately'],
    ['working', 'untested', 'VERIFIED', true, null],
    ['working', 'working', 'VERIFIED', true, null],
    ['broken', 'untested', 'UNVERIFIED', false, 'unverified'],
    ['placeholder', 'refused', 'UNVERIFIED', false, 'unverified'],
    ['untested', 'untested', 'UNVERIFIED', false, null],
    ['broken', 'placeholder', 'FAILED', false, null],
    ['broken', 'broken', 'FAILED', false, null],
  ] as const)('%s + %s → %s', (a, b, expected, credited, spare) => {
    for (const order of ['menu-first', 'old-first'] as const) {
      for (const [x, y] of [[a, b], [b, a]] as const) {
        const { phone, availability } = run(x, y, order);
        const label = `${x}@/menu + ${y}@/old-menu, ${order}`;
        const conclusion = /^A working menu was verified/.test(availability!.fact)
          ? 'VERIFIED'
          : /^No readable menu was found/.test(availability!.fact)
            ? 'FAILED'
            : 'UNVERIFIED';
        expect(conclusion, label).toBe(expected);
        expect(/does publish[^.]*the menu/i.test(phone.problem), label).toBe(credited);
        expect(phone.impactScore, label).toBe(credited ? 40 : 65);
        if (expected !== 'FAILED') expect(phone.problem, label).not.toMatch(/cannot be read online/i);
        if (expected === 'FAILED') expect(phone.problem, label).toMatch(/cannot be read online/i);
        if (spare === 'separately') expect(phone.problem, label).toMatch(/reported separately and does not affect the working menu/i);
        if (spare === 'unverified') expect(phone.problem, label).toMatch(/does not show that no readable menu exists/i);
        if (spare === null) expect(phone.problem, label).not.toMatch(/Another menu link failed/i);
      }
    }
  });

  it('the codex case: verified /menu with a broken /old-menu keeps the credit and cites the working destination', () => {
    const { phone, availability, ev } = run('working', 'broken', 'old-first');
    expect(availability?.fact).toBe(`A working menu was verified at ${MENU}; 1 other menu link(s) failed when tested or have no menu yet.`);
    expect(availability?.sourceUrl).toBe(MENU);
    expect(availability?.supportingContext).toContain(`${OLD} — failed when tested (HTTP 404)`);
    expect(availability?.supportingContext).toContain(`${MENU} — works (HTTP 200)`);
    // The broken spare is still reported on its own record.
    expect(ev.find((e) => e.evidenceType === 'BROKEN_LINK')?.sourceUrl).toBe(OLD);
    expect(phone.problem).toMatch(/does publish opening hours, the menu/i);
    expect(phone.impactScore).toBe(40);
    expect(phone.urgencyScore).toBe(30);
  });

  it('identical inputs in either link order produce identical menu evidence', () => {
    const a = run('working', 'broken', 'menu-first').availability!;
    const b = run('working', 'broken', 'old-first').availability!;
    expect(b.fact).toBe(a.fact);
    expect(b.supportingContext).toBe(a.supportingContext);
    expect(b.sourceUrl).toBe(a.sourceUrl);
  });
});
