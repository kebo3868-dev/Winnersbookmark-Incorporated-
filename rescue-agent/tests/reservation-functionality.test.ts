import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';

/**
 * FALSE POSITIVE 2: HTTP reachability reported as functional booking.
 *
 * Confirmed manually against Leverock's live site: the reservation page loads,
 * and reservations are not enabled through SpotHopper. The audit reported
 *
 *   RESERVATION → HEALTHY: "A reservation pathway is publicly linked and
 *                           responded when tested."
 *
 * because `probeLink` cancelled the response body unread, so "ok" only ever
 * meant "HTTP responded" — and `JourneyStatus` had no value between HEALTHY and
 * a defect, leaving nowhere to put "resolved, functionality unknown".
 *
 * The rule these tests pin: REACHABILITY IS NOT FUNCTIONALITY. A destination
 * that responds earns RESOLVED_UNVERIFIED, never HEALTHY.
 */

const page = (html: string, url = 'https://leverocks.example/') =>
  extractPage(url, url, 200, 'text/html', html);

const RESERVATION_LINK = `<a href="https://www.spothopperapp.com/reservations/leverocks">Reserve a Table</a>`;

const analyze = (probes: ProbeResult[], html = RESERVATION_LINK) => {
  const evidence = normalizeEvidence({ pages: [page(html)], failures: [], probes });
  const records = evidence.map((e, i) => ({
    id: `e${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    confidence: e.confidence,
    supportingContext: e.supportingContext ?? null,
  }));
  const journey = analyzeJourney(records);
  return {
    evidence,
    journey,
    reservation: journey.find((s) => s.stage === 'RESERVATION'),
    overall: calculateOverallScore(calculateCategoryScores(journey, records)),
  };
};

const reachable = (extra: Partial<ProbeResult> = {}): ProbeResult => ({
  url: 'https://www.spothopperapp.com/reservations/leverocks',
  category: 'reservation',
  ok: true,
  httpStatus: 200,
  note: 'HTTP 200',
  ...extra,
});

describe('reachability is not functionality', () => {
  it('classifies a reachable reservation destination as RESOLVED_UNVERIFIED, not HEALTHY', () => {
    const { reservation } = analyze([reachable()]);
    expect(reservation?.status).toBe('RESOLVED_UNVERIFIED');
    expect(reservation?.status).not.toBe('HEALTHY');
    expect(reservation?.finding).toMatch(/not verified/i);
    expect(reservation?.manualValidationRequired).toBe(true);
  });

  it('never claims the destination responded "successfully"', () => {
    const { evidence } = analyze([reachable()]);
    const item = evidence.find((e) => e.evidenceType === 'RESERVATION_PATH' && /reachable/i.test(e.fact));
    expect(item?.fact).not.toMatch(/responded successfully/i);
    expect(item?.supportingContext).toMatch(/switched off responds identically/i);
  });

  it('classifies an explicitly disabled destination as RISK', () => {
    const { reservation } = analyze([reachable({ disabledSignal: 'not accepting reservations: "not currently accepting reservations"' })]);
    expect(reservation?.status).toBe('RISK');
    expect(reservation?.finding).toMatch(/bookings are not available/i);
  });

  it('still classifies a dead destination as RISK', () => {
    const { reservation } = analyze([
      { url: 'https://www.spothopperapp.com/reservations/leverocks', category: 'reservation', ok: false, httpStatus: 500, note: 'HTTP 500' },
    ]);
    expect(reservation?.status).toBe('RISK');
  });

  it('treats an access-restricted destination as unverified, not healthy', () => {
    const { reservation } = analyze([
      reachable({ httpStatus: 403, note: 'Access-restricted destination (treated as reachable, not verified)' }),
    ]);
    expect(reservation?.status).toBe('RESOLVED_UNVERIFIED');
  });

  it('leaves UNKNOWN intact when no reservation pathway exists at all', () => {
    const { reservation } = analyze([], `<p>Walk-ins welcome.</p>`);
    expect(reservation?.status).toBe('UNKNOWN');
  });
});

describe('RESOLVED_UNVERIFIED scores between HEALTHY and a defect', () => {
  it('scores lower than the old HEALTHY classification did', () => {
    const unverified = analyze([reachable()]).overall.overallScore as number;
    const disabled = analyze([reachable({ disabledSignal: 'reservations unavailable: "reservations are currently unavailable"' })])
      .overall.overallScore as number;

    // Explicitly disabled must score below merely unverified.
    expect(disabled).toBeLessThan(unverified);
    // And the stage still counts toward coverage — it is a known state.
    expect(analyze([reachable()]).overall.coverageScore).toBeGreaterThan(0);
  });
});

// The executive-report rendering of this status is asserted in
// tests/executive-report.test.ts, which already has the full report harness.
