import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { classifyDestination, isMethodSemanticsRefusal, mayClaimVerifiedBroken } from '@/lib/audit/destination';

/**
 * CRITICAL 1 — RESERVATION FALSE-POSITIVE PROTECTION
 *
 * The production defect: a site embedded a publicly reachable SpotHopper
 * reservation widget. The widget's configuration also named a SpotHopper API
 * endpoint, which the GET-only prober tested. The endpoint accepts POST, so it
 * answered HTTP 405 Method Not Allowed — and the audit reported the reservation
 * pathway as a verified dead end on a site whose booking widget worked.
 *
 * 405 is the server saying "this address exists, and not for that verb". It is
 * evidence about the audit's request, not about the customer's journey.
 */

const page = (html: string, url = 'https://leverocks.example/') => extractPage(url, url, 200, 'text/html', html);

const records = (html: string, probes: ProbeResult[]) =>
  normalizeEvidence({ pages: [page(html)], failures: [], probes }).map((e, i) => ({
    id: `e${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    confidence: e.confidence,
    supportingContext: e.supportingContext ?? null,
  }));

const reservationStage = (html: string, probes: ProbeResult[]) =>
  analyzeJourney(records(html, probes)).find((s) => s.stage === 'RESERVATION');

const WIDGET_SITE = `
  <a href="https://www.spothopperapp.com/reservations/leverocks-seafood">Book a Table</a>
  <script src="https://www.spothopperapp.com/widget.js"></script>
`;

describe('destination classification', () => {
  it('separates customer pages from API endpoints', () => {
    expect(classifyDestination('https://www.spothopperapp.com/reservations/leverocks').kind).toBe('CUSTOMER_FACING');
    expect(classifyDestination('https://www.spothopperapp.com/api/v2/reservations').kind).toBe('API_ENDPOINT');
    expect(classifyDestination('https://api.spothopperapp.com/reservations').kind).toBe('API_ENDPOINT');
    expect(classifyDestination('https://leverocks.com/wp-json/booking').kind).toBe('API_ENDPOINT');
    expect(classifyDestination('https://leverocks.com/graphql').kind).toBe('API_ENDPOINT');
    expect(classifyDestination('https://leverocks.com/reservations.json').kind).toBe('API_ENDPOINT');
    expect(classifyDestination('https://leverocks.com/widget.js').kind).toBe('STATIC_ASSET');
  });

  it('does NOT treat an ordinary booking path as an API just because it is versioned-looking', () => {
    // `/reservations`, `/book`, `/order-online` are the customer pages the audit
    // must keep testing. Over-classifying them would silence real findings.
    for (const url of [
      'https://leverocks.com/reservations',
      'https://leverocks.com/book-a-table',
      'https://www.opentable.com/r/leverocks',
      'https://www.spothopperapp.com/order-online/leverocks',
    ]) {
      expect(classifyDestination(url).kind, url).toBe('CUSTOMER_FACING');
    }
  });

  it('recognises method-semantics statuses', () => {
    expect(isMethodSemanticsRefusal(405)).toBe(true);
    expect(isMethodSemanticsRefusal(501)).toBe(true);
    expect(isMethodSemanticsRefusal(404)).toBe(false);
    expect(isMethodSemanticsRefusal(500)).toBe(false);
    expect(isMethodSemanticsRefusal(undefined)).toBe(false);
  });
});

describe('mayClaimVerifiedBroken — the single gate on a broken-pathway claim', () => {
  it('refuses an API endpoint whatever it returns', () => {
    for (const status of [404, 405, 500, 503]) {
      const verdict = mayClaimVerifiedBroken({
        url: 'https://www.spothopperapp.com/api/v2/reservations',
        ok: false,
        httpStatus: status,
        failureKind: 'HTTP',
      });
      expect(verdict.allowed, `status ${status}`).toBe(false);
      expect(verdict.reason).toMatch(/not customer-facing|method is not allowed/i);
    }
  });

  it('refuses a 405 even on a customer-facing URL', () => {
    const verdict = mayClaimVerifiedBroken({
      url: 'https://leverocks.com/reservations',
      ok: false,
      httpStatus: 405,
      failureKind: 'HTTP',
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/method is not allowed/i);
  });

  it('refuses a timeout — that is the audit\'s limit, not the restaurant\'s failure', () => {
    const verdict = mayClaimVerifiedBroken({ url: 'https://leverocks.com/reservations', ok: false, failureKind: 'TIMEOUT' });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/time budget|rate limiting/i);
  });

  it('refuses a destination the safety policy declined to follow', () => {
    const verdict = mayClaimVerifiedBroken({ url: 'https://leverocks.com/reservations', ok: false, failureKind: 'BLOCKED' });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/safety policy/i);
  });

  it('ALLOWS a genuine customer-facing failure — the guard must not silence real findings', () => {
    const verdict = mayClaimVerifiedBroken({
      url: 'https://leverocks.com/reservations',
      ok: false,
      httpStatus: 404,
      failureKind: 'HTTP',
    });
    expect(verdict.allowed).toBe(true);
  });

  it('allows a network-level dead end on a customer page', () => {
    const verdict = mayClaimVerifiedBroken({ url: 'https://leverocks.com/reservations', ok: false, failureKind: 'NETWORK' });
    expect(verdict.allowed).toBe(true);
  });
});

describe('the SpotHopper 405 case, end to end', () => {
  const API_405: ProbeResult = {
    url: 'https://www.spothopperapp.com/api/v2/reservations',
    category: 'reservation',
    ok: false,
    httpStatus: 405,
    note: 'HTTP 405',
    failureKind: 'HTTP',
  };

  it('produces no BROKEN_LINK evidence', () => {
    const evidence = normalizeEvidence({ pages: [page(WIDGET_SITE)], failures: [], probes: [API_405] });
    expect(evidence.filter((e) => e.evidenceType === 'BROKEN_LINK')).toHaveLength(0);
  });

  it('never marks the reservation stage as a dead end', () => {
    const stage = reservationStage(WIDGET_SITE, [API_405]);
    expect(stage?.status).not.toBe('RISK');
    expect(stage?.finding).not.toMatch(/dead end|failed when tested/i);
  });

  it('classifies it as requiring manual validation instead', () => {
    const stage = reservationStage(WIDGET_SITE, [API_405]);
    expect(stage?.manualValidationRequired).toBe(true);
    expect(stage?.finding).toMatch(/manual validation required/i);
  });

  it('PRESERVES the raw result for debugging rather than discarding it', () => {
    const evidence = normalizeEvidence({ pages: [page(WIDGET_SITE)], failures: [], probes: [API_405] });
    const diagnostic = evidence.find((e) => e.supportingContext?.includes('/api/v2/reservations'));
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.fact).toMatch(/405|not a customer-facing destination/i);
    expect(diagnostic?.supportingContext).toMatch(/API_ENDPOINT/);
    expect(diagnostic?.supportingContext).toMatch(/retained for debugging/i);
  });

  it('still reports a genuinely broken customer-facing booking page as RISK', () => {
    // The guard must not have blunted the real finding.
    const stage = reservationStage(WIDGET_SITE, [
      {
        url: 'https://www.spothopperapp.com/reservations/leverocks-seafood',
        category: 'reservation',
        ok: false,
        httpStatus: 404,
        note: 'HTTP 404',
        failureKind: 'HTTP',
      },
    ]);
    expect(stage?.status).toBe('RISK');
    expect(stage?.finding).toMatch(/dead end/i);
  });
});

describe('a 405 on the customer-facing booking page itself', () => {
  it('is unverified, not broken', () => {
    const stage = reservationStage(WIDGET_SITE, [
      {
        url: 'https://www.spothopperapp.com/reservations/leverocks-seafood',
        category: 'reservation',
        ok: true,
        httpStatus: 405,
        note: 'HTTP 405 — the destination exists and does not accept GET requests',
        methodNotAllowed: true,
      },
    ]);
    expect(stage?.status).not.toBe('RISK');
    expect(stage?.manualValidationRequired).toBe(true);
  });
});
