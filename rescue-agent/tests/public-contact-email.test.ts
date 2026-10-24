import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, isNonContactAddress, absenceClaim } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { classifyDestination } from '@/lib/audit/destination';
import type { EvidenceInput } from '@/types/audit';

/**
 * REGRESSION CASE: Leverock's Great Seafood, acceptance verification.
 *
 * The audit extracted leverocksgreatseafood@gmail.com into `PageExtract.emails`
 * and then printed, in the client-facing report:
 *
 *   "A contact pathway is publicly available by telephone, but no non-phone
 *    contact route (contact page, enquiry form, or published email) was
 *    detected."
 *
 * Nothing consumed `emails`, so the report asserted the absence of a thing the
 * audit was holding. A false negative stated as a finding is worse than a gap:
 * it is the one failure mode the honesty contract exists to prevent, and it is
 * the kind of error the restaurant owner spots first.
 */

const LEVEROCKS_EMAIL = 'leverocksgreatseafood@gmail.com';

function pageOf(body: string, url = 'https://leverocks.com/') {
  return extractPage(url, url, 200, 'text/html', `<html><head><title>Leverock's</title></head><body>${body}</body></html>`);
}

function recordsFor(body: string, failures: { url: string; sourceType: string; status: string; note: string }[] = []) {
  return normalizeEvidence({ pages: [pageOf(body)], failures, probes: [] });
}

const find = (ev: EvidenceInput[], type: string) => ev.find((e) => e.evidenceType === type);
const stageOf = (ev: EvidenceInput[], stage: string) =>
  analyzeJourney(
    ev.map((e, i) => ({
      id: `e${i}`,
      evidenceType: e.evidenceType,
      fact: e.fact,
      confidence: e.confidence,
      supportingContext: e.supportingContext ?? null,
    })),
  ).find((s) => s.stage === stage);

// ── 1. The exact Leverock's address, in a mailto link ──────────────────────

describe("Leverock's published email in a mailto link", () => {
  const SITE = `
    <a href="tel:+17273674588">Call (727) 367-4588</a>
    <footer><a href="mailto:${LEVEROCKS_EMAIL}">Email us</a></footer>
  `;

  it('extracts the address from the href even though no visible text carries it', () => {
    const p = pageOf(SITE);
    expect(p.emails).toContain(LEVEROCKS_EMAIL);
  });

  it('surfaces it as traceable CONTACT_EMAIL evidence citing the address and its page', () => {
    const email = find(recordsFor(SITE), 'CONTACT_EMAIL');
    expect(email?.fact).toContain(LEVEROCKS_EMAIL);
    expect(email?.sourceUrl).toBe('https://leverocks.com/');
    expect(email?.confidence).toBeGreaterThanOrEqual(85);
  });

  it('CONTACT_PATH can no longer claim no published email was detected', () => {
    const contact = find(recordsFor(SITE), 'CONTACT_PATH');
    // The exact false sentence from the shipped report.
    expect(contact?.fact).not.toMatch(/no non-phone contact route/i);
    // The defect shape: any denial whose scope reaches a published email.
    expect(contact?.fact).not.toMatch(/\bno\b[^.]*published email/i);
    expect(contact?.fact).toMatch(/published email address/i);
  });

  it('no evidence item anywhere asserts the absence of an email that was collected', () => {
    const ev = recordsFor(SITE);
    const denials = ev.filter(
      (e) =>
        /no (public )?(contact )?email/i.test(e.fact) &&
        !/collecting visitors|signup|newsletter/i.test(e.fact),
    );
    expect(denials, denials.map((d) => d.fact).join(' | ')).toHaveLength(0);
  });
});

// ── 2. A public email displayed as plain text ──────────────────────────────

describe('a public email displayed as plain text', () => {
  const SITE = `
    <a href="tel:+17273674588">Call us</a>
    <p>Questions? Write to ${LEVEROCKS_EMAIL} any time.</p>
  `;

  it('is detected and reported even with no mailto link present', () => {
    expect(pageOf(SITE).emails).toContain(LEVEROCKS_EMAIL);
    expect(find(recordsFor(SITE), 'CONTACT_EMAIL')?.fact).toContain(LEVEROCKS_EMAIL);
  });

  it('is reflected in CONTACT_PATH as a real non-phone route', () => {
    expect(find(recordsFor(SITE), 'CONTACT_PATH')?.fact).toMatch(/telephone and a published email address/i);
  });
});

// ── 3. Telephone-only contact ─────────────────────────────────────────────

describe('telephone-only contact', () => {
  const SITE = `
    <a href="tel:+17273674588">Call (727) 367-4588</a>
    <p>Call us on (727) 367-4588.</p>
  `;

  it('still reports the genuine absence of a written route', () => {
    const ev = recordsFor(SITE);
    expect(find(ev, 'CONTACT_EMAIL')?.fact).toMatch(/No public contact email address was detected/i);
    expect(find(ev, 'CONTACT_PATH')?.fact).toMatch(/no non-phone contact route/i);
  });

  it('keeps the CONTACT journey stage at FRICTION, not absence and not RISK', () => {
    // journey.ts keys this branch off the literal "no non-phone contact route".
    const stage = stageOf(recordsFor(SITE), 'CONTACT');
    expect(stage?.status).toBe('FRICTION');
    expect(stage?.finding).toMatch(/only route in/i);
  });

  it('never claims the restaurant cannot be contacted at all', () => {
    expect(find(recordsFor(SITE), 'CONTACT_PATH')?.fact).not.toMatch(/no public contact pathway/i);
  });
});

// ── 4. Newsletter signup, no public contact address ───────────────────────

describe('newsletter signup without a public contact email', () => {
  const SITE = `
    <a href="tel:+17273674588">Call us</a>
    <form><input type="email" name="subscribe" /><button>Join our mailing list</button></form>
  `;

  it('records list building and the absence of a contact address as separate facts', () => {
    const ev = recordsFor(SITE);
    expect(find(ev, 'EMAIL_CAPTURE')?.fact).toMatch(/collecting visitors'? addresses/i);
    expect(find(ev, 'CONTACT_EMAIL')?.fact).toMatch(/No public contact email address was detected/i);
  });

  it('does not let a signup box pose as a contact route', () => {
    expect(find(recordsFor(SITE), 'CONTACT_PATH')?.fact).toMatch(/no non-phone contact route/i);
  });

  it('and conversely, a published address is not reported as list building', () => {
    const ev = recordsFor(`<a href="mailto:${LEVEROCKS_EMAIL}">Email</a>`);
    expect(find(ev, 'EMAIL_CAPTURE')?.fact).toMatch(/No mechanism for collecting/i);
    expect(find(ev, 'CONTACT_EMAIL')?.fact).toContain(LEVEROCKS_EMAIL);
  });

  it('ignores automated-sender and site-tooling addresses', () => {
    expect(isNonContactAddress('noreply@leverocks.com')).toBe(true);
    expect(isNonContactAddress('no-reply@leverocks.com')).toBe(true);
    expect(isNonContactAddress('abc@sentry.io')).toBe(true);
    expect(isNonContactAddress(LEVEROCKS_EMAIL)).toBe(false);
    const ev = recordsFor(`<p>noreply@leverocks.com</p>`);
    expect(find(ev, 'CONTACT_EMAIL')?.fact).toMatch(/No public contact email address/i);
  });
});

// ── 5. Incomplete collection must not harden into a certainty ─────────────

describe('incomplete collection does not become a definitive absence claim', () => {
  const FAILURES = [{ url: 'https://leverocks.com/contact', sourceType: 'CONTACT', status: 'TIMEOUT', note: 'Timed out' }];

  it('softens the wording when a page could not be read', () => {
    const ev = recordsFor(`<a href="tel:+17273674588">Call</a>`, FAILURES);
    const email = find(ev, 'CONTACT_EMAIL');
    expect(email?.fact).toMatch(/collection was incomplete/i);
    expect(email?.fact).not.toMatch(/was detected on the analyzed website pages\.$/);
    expect(email?.supportingContext).toMatch(/absence is not conclusive/i);
  });

  it('lowers confidence rather than asserting absence at full strength', () => {
    const complete = find(recordsFor(`<a href="tel:+17273674588">Call</a>`), 'CONTACT_EMAIL');
    const partial = find(recordsFor(`<a href="tel:+17273674588">Call</a>`, FAILURES), 'CONTACT_EMAIL');
    expect(partial!.confidence).toBeLessThan(complete!.confidence);
  });

  it('marks the CONTACT_PATH gap as scoped to what could be collected', () => {
    const contact = find(recordsFor(`<a href="tel:+17273674588">Call</a>`, FAILURES), 'CONTACT_PATH');
    expect(contact?.fact).toMatch(/on the pages that could be collected/i);
    expect(contact?.supportingContext).toMatch(/absence is not conclusive/i);
  });

  it('absenceClaim never states a bare certainty on an incomplete collection', () => {
    expect(absenceClaim('No public contact email address', false)).toMatch(/was detected on the analyzed website pages\./);
    expect(absenceClaim('No public contact email address', true)).toMatch(/collection was incomplete/);
  });

  it('a complete collection still states the absence plainly', () => {
    const email = find(recordsFor(`<a href="tel:+17273674588">Call</a>`), 'CONTACT_EMAIL');
    expect(email?.fact).toBe('No public contact email address was detected on the analyzed website pages.');
  });
});

// ── 6. WordPress internal endpoints are not customer ordering pathways ────

describe('WordPress internal endpoints are not customer-facing ordering destinations', () => {
  it('classifies admin-ajax.php and admin-post.php as API endpoints', () => {
    expect(classifyDestination('https://r.example/wp-admin/admin-ajax.php?action=order_status').kind).toBe('API_ENDPOINT');
    expect(classifyDestination('https://r.example/wp-admin/admin-post.php?action=order_submit').kind).toBe('API_ENDPOINT');
    expect(classifyDestination('https://r.example/wp-json/wc/v3/orders').kind).toBe('API_ENDPOINT');
  });

  it('keeps naming the reason, so the call stays auditable', () => {
    expect(classifyDestination('https://r.example/wp-admin/admin-ajax.php?action=order_status').reason)
      .toMatch(/admin-ajax/i);
  });

  it('does not reclassify a genuine customer ordering page', () => {
    expect(classifyDestination('https://order.toasttab.com/online/leverocks').kind).toBe('CUSTOMER_FACING');
    expect(classifyDestination('https://r.example/order-online').kind).toBe('CUSTOMER_FACING');
    expect(classifyDestination('https://r.example/reservations').kind).toBe('CUSTOMER_FACING');
  });

  it('an admin-ajax URL in a data attribute produces no customer ordering claim', () => {
    const ev = normalizeEvidence({
      pages: [pageOf(`<button data-url="/wp-admin/admin-ajax.php?action=order_status">Track</button>`)],
      failures: [],
      probes: [{
        url: 'https://leverocks.com/wp-admin/admin-ajax.php?action=order_status',
        category: 'ordering', ok: true, httpStatus: 200, note: 'HTTP 200',
      }],
    });
    const ordering = ev.filter((e) => e.evidenceType === 'ORDERING_PATH');
    for (const o of ordering) {
      expect(o.fact, o.fact).not.toMatch(/reachable through an embedded widget/i);
      expect(o.fact, o.fact).not.toMatch(/responded successfully/i);
    }
    expect(stageOf(ev, 'ORDERING')?.status).not.toBe('HEALTHY');
  });
});
