/**
 * Two P2 findings from the Codex review of 2b12c75, both introduced earlier on
 * this branch (bisected: the signup miss in 8172262, the menu credit in
 * 87d494a; main detects/handles both correctly).
 *
 *   1. A "Name, Email, [Sign up]" form was not recognised as email capture,
 *      so the audit said a guest had no public way to opt in.
 *   2. A menu link that returned 404 was credited as answering the menu
 *      question, so the phone finding said the menu "is answerable online"
 *      and cut its own impact and urgency — while the MENU stage reported a
 *      dead end. An untested menu link was credited the same way.
 */
import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';
import { classifyForms, extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import type { EvidenceInput } from '@/types/audit';

const HOME = 'https://probe-grill.test/';
const MENU = 'https://probe-grill.test/menu';
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

// ── 1. Signup forms ────────────────────────────────────────────────────────

describe('1 — a signup form that also asks for a name is email capture', () => {
  const BASE = '<h1>Probe Grill</h1><p>Call (727) 555-0000</p>';

  it.each([
    ['name + email, "Sign up" (codex)', '<form action="/signup"><input name="name" placeholder="Name"/><input type="email" name="email"/><button>Sign up</button></form>'],
    ['first + last name, "Join"', '<form><input name="first_name"/><input name="last_name"/><input type="email" name="email"/><button>Join</button></form>'],
    ['email + mobile, "Subscribe"', '<form><input type="email" name="email"/><input type="tel" name="mobile"/><button>Subscribe</button></form>'],
    ['name + email + birthday, "Join the club"', '<form><input name="fullname" placeholder="Your name"/><input type="email" name="email"/><input type="date" name="birthday"/><button>Join the club</button></form>'],
    ['submit input "Sign Up Now"', '<form><input name="name"/><input type="email" name="email"/><input type="submit" value="Sign Up Now"/></form>'],
    ['"Sign-up" with a consent tick', '<form><input name="name"/><input type="email" name="email"/><input type="checkbox" name="consent"/><button>Sign-up</button></form>'],
  ])('%s', (_label, form) => {
    const p = page(`${BASE}${form}`);
    expect(p.emailCaptureSignal).toBe(true);
    const { ev, leaks } = analyse([p]);
    expect(ev.find((e) => e.evidenceType === 'EMAIL_CAPTURE')?.fact).toMatch(/email capture mechanism/i);
    expect(leaks.find((l) => /no public way to opt into hearing from you/i.test(l.title ?? ''))).toBeUndefined();
  });

  it.each([
    ['a general enquiry form (name, email, message)', '<form action="/contact"><input name="name"/><input type="email" name="email"/><textarea name="message"></textarea><button>Send</button></form>'],
    ['name + email with a "Send" button', '<form action="/forms"><input name="name"/><input type="email" name="email"/><button>Send</button></form>'],
    ['"Sign up" with a message box', '<form><input name="name"/><input type="email" name="email"/><textarea name="comments"></textarea><button>Sign up</button></form>'],
    ['"Join the waitlist" (a purpose, not a list)', '<form action="/waitlist"><input name="name"/><input type="email" name="email"/><button>Join the waitlist</button></form>'],
    ['"Sign up" for a job (a purpose)', '<form><h2>Careers</h2><input name="name"/><input type="email" name="email"/><button>Sign up</button></form>'],
    ['"Sign up" with an unrecognised field', '<form><input name="name"/><input type="email" name="email"/><input name="company"/><button>Sign up</button></form>'],
    ['"Sign up" on a non-submit button', '<form><input name="name"/><input type="email" name="email"/><button type="button">Sign up</button></form>'],
    ['"Sign up" text that is not the submit label', '<form><p>Sign up below</p><input name="name"/><input type="email" name="email"/><button>Send</button></form>'],
  ])('is NOT capture: %s', (_label, form) => {
    expect(page(`${BASE}${form}`).emailCaptureSignal).toBe(false);
  });

  it('the approved contact-form classifications are unchanged', () => {
    const $ = cheerio.load(
      '<html><body>' +
        '<form action="/contact"><input name="name"/><input type="email" name="email"/><textarea name="message"></textarea><button>Send</button></form>' +
        '<form action="/gift-card-request"><input name="name"/><input type="email" name="email"/><textarea name="message"></textarea><button>Send</button></form>' +
        '<form action="/forms"><input name="name"/><input type="email" name="email"/><textarea name="message"></textarea><button>Send</button></form>' +
        '<form action="/signup"><input name="name"/><input type="email" name="email"/><button>Sign up</button></form>' +
        '</body></html>',
    );
    // The signup box has no message field, so it is not a form a customer
    // writes to the restaurant through, and it gets no contact purpose.
    expect(classifyForms($).forms.map((f) => f.purpose)).toEqual(['GENERAL_CONTACT', 'PURPOSE_SPECIFIC', 'UNVERIFIED_PURPOSE']);
  });
});

// ── 2. Menu destinations ───────────────────────────────────────────────────

describe('2 — the menu counts as answered only when it is known to work', () => {
  // Hours, address and telephone are published; FAQ and click-to-call
  // aside, the menu link decides whether every core question is answered.
  const BODY = '<h1>Probe Grill</h1><a href="tel:+17275550000">Call (727) 555-0000</a><a href="/menu">Menu</a><p>Hours: Mon-Sun 11am-10pm</p><p>123 Gulf Blvd, Treasure Island, FL 33706</p>';
  const probe = (over: Partial<ProbeResult>): ProbeResult => ({ url: MENU, category: 'menu', ok: true, httpStatus: 200, note: 'HTTP 200', ...over });
  const phoneFinding = (pages: ReturnType<typeof page>[], probes: ProbeResult[] = []) => {
    const r = analyse(pages, probes);
    return { ...r, phone: r.leaks.find((l) => /PHONE-DEPENDENT/.test(l.category))! };
  };

  it.each([
    ['HTTP 404 (codex)', probe({ ok: false, httpStatus: 404, note: 'HTTP 404' })],
    ['HTTP 500', probe({ ok: false, httpStatus: 500, note: 'HTTP 500' })],
    ['a placeholder page', probe({ placeholderSignal: 'menu coming soon: "Menu coming soon"' })],
  ])('broken — %s: not credited, named as failed, no impact reduction', (_label, p) => {
    const { phone, journey } = phoneFinding([page(BODY)], [p]);
    expect(phone.problem).not.toMatch(/publish[^.]*the menu/i);
    expect(phone.problem).toMatch(/menu link failed when tested or leads to a page with no menu yet/i);
    expect(phone.title).toBe('Common visit questions are not answered on the website');
    expect(phone.impactScore).toBe(65);
    expect(phone.urgencyScore).toBe(55);
    // Consistent with the MENU stage of the same audit.
    expect(['RISK', 'FRICTION']).toContain(journey.find((s) => s.stage === 'MENU')?.status);
  });

  it('working — HTTP 200: credited, impact and urgency reduced', () => {
    const { phone } = phoneFinding([page(BODY)], [probe({})]);
    expect(phone.problem).toMatch(/does publish opening hours, the menu, the address and how to get in touch/i);
    expect(phone.problem).toMatch(/answerable online without calling/i);
    expect(phone.impactScore).toBe(40);
    expect(phone.urgencyScore).toBe(30);
  });

  it.each([
    ['never tested', [] as ProbeResult[]],
    ['refused the audit\'s GET (HTTP 405)', [probe({ ok: false, httpStatus: 405, note: 'HTTP 405' })]],
    ['timed out (cannot be called broken)', [probe({ ok: false, httpStatus: undefined, failureKind: 'TIMEOUT', note: 'timed out' } as Partial<ProbeResult>)]],
  ])('unknown — %s: not presented as verified, and not presented as a failure', (_label, probes) => {
    const { phone, ev } = phoneFinding([page(BODY)], probes);
    expect(phone.problem).not.toMatch(/publish[^.]*the menu/i);
    expect(phone.problem).toMatch(/whether it opens a working menu was not verified/i);
    expect(phone.problem).not.toMatch(/menu link failed/i);
    // Not verified, so no reduction; not a known gap, so no "not answered" title.
    expect(phone.impactScore).toBe(65);
    expect(phone.urgencyScore).toBe(55);
    expect(phone.title).toBe('Phone demand is unmeasured, and the website cannot show whether it is avoidable');
    expect(phone.businessImpact).toMatch(/not fully verified/i);
    expect(ev.some((e) => /responded successfully|fetched successfully/i.test(e.fact))).toBe(false);
  });

  it('a menu page the audit fetched as a source counts as tested', () => {
    // The orchestrator never probes a link to a page it already collected.
    const menuPage = page('<h1>Menu</h1><p>Grouper sandwich $18</p>', MENU);
    const { phone, ev } = phoneFinding([page(BODY), menuPage]);
    expect(ev.find((e) => /fetched successfully during this audit/i.test(e.fact))?.sourceUrl).toBe(MENU);
    expect(phone.problem).toMatch(/does publish opening hours, the menu/i);
    expect(phone.impactScore).toBe(40);
  });

  it('a fetched menu page that is a placeholder counts as failed, like a probed one', () => {
    const menuPage = page('<h1>Menu</h1><p>Our new menu is coming soon!</p>', MENU);
    const { phone, journey, ev } = phoneFinding([page(BODY), menuPage]);
    expect(ev.find((e) => /has no menu published on it yet \(fetched during this audit/i.test(e.fact))).toBeDefined();
    expect(phone.problem).toMatch(/menu link failed when tested or leads to a page with no menu yet/i);
    expect(journey.find((s) => s.stage === 'MENU')?.status).toBe('FRICTION');
  });

  it('a page fetched at a different URL does not verify the menu link', () => {
    const other = page('<h1>About</h1>', 'https://probe-grill.test/about');
    const { phone } = phoneFinding([page(BODY), other]);
    expect(phone.problem).toMatch(/was not verified/i);
  });
});
