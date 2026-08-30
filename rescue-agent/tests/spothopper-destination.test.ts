import { describe, expect, it } from 'vitest';
import { extractPage, detectWidgetVendor } from '@/lib/web/collector';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';

/**
 * REGRESSION CASE: SpotHopper detected, destination unresolved.
 *
 * The audit correctly detected the SpotHopper widget but still reported
 *
 *   "third-party SpotHopper widget detected, but destination could not be
 *    resolved"
 *
 * for both reservation and ordering. Detection was never the problem. The
 * destination is stated in the served HTML — SpotHopper names
 * `/order-online/<slug>` and `/reservations/<slug>` in the widget's own
 * configuration — but extraction only read anchors, iframes, data-* attributes
 * and onclick handlers. Script bodies were stripped unread, and asset URLs were
 * reduced to bare hostnames, discarding the very path that names the pathway.
 *
 * The fix reads those destinations. What it must NOT do is treat the vendor's
 * presence as proof of a pathway, so the tests below pin both directions: the
 * destination is resolved when the HTML states it, and UNKNOWN survives intact
 * when it does not.
 */

const page = (html: string, url = 'https://leverocks.example/') =>
  extractPage(url, url, 200, 'text/html', html);

describe('SpotHopper destination resolution', () => {
  it('resolves a reservation destination declared in widget configuration', () => {
    const p = page(`
      <script src="https://www.spothopperapp.com/widget.js"></script>
      <script>
        window.SH_CONFIG = {
          reservationUrl: "https://www.spothopperapp.com/reservations/leverocks-seafood",
          spotId: 78550
        };
      </script>
      <div id="sh-reservation-widget"></div>
    `);

    const reservation = p.categorizedLinks.reservation ?? [];
    expect(reservation.length).toBeGreaterThan(0);
    expect(reservation[0].href).toContain('/reservations/leverocks-seafood');
    // Sourced from an embed, not an anchor — the report says so explicitly.
    expect(reservation[0].source).toBe('embed');
  });

  it('resolves an ordering destination declared in widget configuration', () => {
    const p = page(`
      <script src="https://www.spothopperapp.com/widget.js"></script>
      <script>
        var shOrdering = { orderUrl: 'https://www.spothopperapp.com/order-online/leverocks-seafood' };
      </script>
    `);

    const ordering = p.categorizedLinks.ordering ?? [];
    expect(ordering.length).toBeGreaterThan(0);
    expect(ordering[0].href).toContain('/order-online/leverocks-seafood');
    expect(ordering[0].source).toBe('embed');
  });

  it('resolves a destination embedded as JSON, where slashes arrive escaped', () => {
    // How a config blob actually ships. Before unescaping, `https:\/\/…`
    // matched no URL pattern at all and the destination was invisible.
    const p = page(`
      <script src="https://www.spothopperapp.com/widget.js"></script>
      <script type="application/json" id="sh-config">
        {"spotId":78550,"orderUrl":"https:\\/\\/www.spothopperapp.com\\/order-online\\/leverocks-seafood"}
      </script>
    `);
    const ordering = p.categorizedLinks.ordering ?? [];
    expect(ordering.length).toBeGreaterThan(0);
    expect(ordering[0].href).toContain('/order-online/leverocks-seafood');
  });

  it('resolves a protocol-relative destination', () => {
    const p = page(`
      <script src="https://www.spothopperapp.com/widget.js"></script>
      <script>
        var cfg = { reservationUrl: "//www.spothopperapp.com/reservations/leverocks-seafood" };
      </script>
    `);
    const reservation = p.categorizedLinks.reservation ?? [];
    expect(reservation.length).toBeGreaterThan(0);
    expect(reservation[0].href).toContain('/reservations/leverocks-seafood');
  });

  it('reports a resolved pathway as publicly reachable rather than unresolvable', () => {
    const p = page(`
      <script src="https://www.spothopperapp.com/widget.js"></script>
      <script>
        window.SH_CONFIG = { orderUrl: "https://www.spothopperapp.com/order-online/leverocks-seafood" };
      </script>
    `);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    const ordering = evidence.find((e) => e.evidenceType === 'ORDERING_PATH');

    expect(ordering?.fact).toMatch(/publicly reachable/i);
    // The whole point of the fix: this phrasing must be gone.
    expect(ordering?.fact).not.toMatch(/could not be resolved/i);
    expect(ordering?.sourceUrl).toContain('/order-online/leverocks-seafood');
  });

  describe('vendor presence is never proof of a pathway', () => {
    it('keeps UNKNOWN when only SpotHopper assets are present and no destination is stated', () => {
      const p = page(`
        <script src="https://www.spothopperapp.com/widget.js"></script>
        <link rel="stylesheet" href="https://www.spothopperapp.com/widget.css" />
        <img src="https://www.spothopperapp.com/logo.png" />
      `);

      // Detection still works — that is a technical fact, and it is preserved.
      expect(detectWidgetVendor(p.assetHosts, 'ordering')).toBe('SpotHopper');
      // But no pathway is manufactured from a bundle, a stylesheet or a logo.
      expect(p.categorizedLinks.ordering ?? []).toHaveLength(0);
      expect(p.categorizedLinks.reservation ?? []).toHaveLength(0);

      const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
      const ordering = evidence.find((e) => e.evidenceType === 'ORDERING_PATH');
      expect(ordering?.fact).toMatch(/No public online ordering pathway could be resolved/i);
      expect(ordering?.fact).toMatch(/SpotHopper widget was detected/i);
      expect(ordering?.supportingContext).toMatch(/not evidence that a working pathway exists/i);
    });

    it('makes no reservation or ordering claim when the destination cannot be verified', () => {
      const p = page(`
        <script src="https://www.spothopperapp.com/widget.js"></script>
        <footer><a href="https://www.spothopperapp.com/">Powered by SpotHopper</a></footer>
      `);
      const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });

      for (const type of ['RESERVATION_PATH', 'ORDERING_PATH'] as const) {
        const item = evidence.find((e) => e.evidenceType === type);
        expect(item?.fact).not.toMatch(/publicly reachable|publicly linked/i);
        // Confidence stays low precisely because nothing was verified.
        expect(item?.confidence ?? 100).toBeLessThanOrEqual(65);
      }
    });

    it('does not resolve a pathway from an unrelated third-party URL in an inline script', () => {
      // An analytics beacon whose query string mentions "order" is not an
      // ordering pathway. Host restriction is what stops this being claimed.
      const p = page(`
        <script>
          fetch("https://analytics.example.net/collect?event=order_complete&reserve=1");
        </script>
      `);
      expect(p.categorizedLinks.ordering ?? []).toHaveLength(0);
      expect(p.categorizedLinks.reservation ?? []).toHaveLength(0);
    });

    it('does not resolve a pathway from a JavaScript comment', () => {
      // The URL pattern matches a bare `//`, which also begins a JS comment.
      // The host guard is what makes that harmless.
      const p = page(`
        <script>
          // order-online rewrite pending
        </script>
      `);
      expect(p.categorizedLinks.ordering ?? []).toHaveLength(0);
    });

    it('does not treat a vendor bundle URL as a destination even on a vendor host', () => {
      const p = page(`
        <script src="https://www.spothopperapp.com/assets/order-online.js"></script>
      `);
      // The path says "order-online" but it is a .js bundle — an asset, not a
      // place a customer can be sent.
      expect(p.categorizedLinks.ordering ?? []).toHaveLength(0);
    });
  });
});

/**
 * The Rescue Score must be a CONSEQUENCE of the evidence, never a number the
 * report carries independently of it. A score that stayed at 75 whether or not
 * the destination resolved would mean the fix above changed the words while the
 * headline figure was decorative.
 *
 * These run the real pipeline end to end — extract → evidence → journey →
 * category scores → overall score — over two sites differing only in whether
 * the widget states its destination.
 */
describe('Rescue Score is derived from the corrected evidence', () => {
  const scoreFor = (html: string) => {
    const p = page(html);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    const records = evidence.map((e, i) => ({
      id: `e${i}`,
      evidenceType: e.evidenceType,
      fact: e.fact,
      confidence: e.confidence,
      supportingContext: e.supportingContext ?? null,
    }));
    const journey = analyzeJourney(records);
    return {
      overall: calculateOverallScore(calculateCategoryScores(journey, records)),
      journey,
    };
  };

  const WIDGET_ONLY = `
    <script src="https://www.spothopperapp.com/widget.js"></script>
  `;
  const WIDGET_WITH_DESTINATIONS = `
    <script src="https://www.spothopperapp.com/widget.js"></script>
    <script>
      window.SH_CONFIG = {
        reservationUrl: "https://www.spothopperapp.com/reservations/leverocks-seafood",
        orderUrl: "https://www.spothopperapp.com/order-online/leverocks-seafood"
      };
    </script>
  `;

  it('scores an unresolved widget lower than a resolved destination', () => {
    const unresolved = scoreFor(WIDGET_ONLY);
    const resolved = scoreFor(WIDGET_WITH_DESTINATIONS);

    // The pipeline must actually reach a score in both cases.
    expect(unresolved.overall.overallScore).not.toBeNull();
    expect(resolved.overall.overallScore).not.toBeNull();

    // The load-bearing assertion: resolving a real pathway moves the number.
    expect(resolved.overall.overallScore).toBeGreaterThan(unresolved.overall.overallScore as number);
  });

  it('turns an UNKNOWN reservation stage into a known one once resolved', () => {
    const unresolvedStages = scoreFor(WIDGET_ONLY).journey;
    const resolvedStages = scoreFor(WIDGET_WITH_DESTINATIONS).journey;

    expect(unresolvedStages.find((s) => s.stage === 'RESERVATION')?.status).toBe('UNKNOWN');
    expect(resolvedStages.find((s) => s.stage === 'RESERVATION')?.status).not.toBe('UNKNOWN');
  });

  it('keeps ORDERING unknown from widget config alone, but says something different about it', () => {
    // ORDERING is deliberately no longer promoted out of UNKNOWN by a URL found
    // only in widget configuration. A config value is not a visible
    // call-to-action, so nothing here shows a customer is offered the
    // destination — and an ordering finding is a transaction claim, which needs
    // proven customer exposure.
    //
    // Resolving the URL still changes the OUTPUT, which is what this test now
    // guards: the finding moves from "no pathway detected" to a specific,
    // actionable "here is the URL, confirm whether anyone is shown it".
    const unresolved = scoreFor(WIDGET_ONLY).journey.find((s) => s.stage === 'ORDERING');
    const resolved = scoreFor(WIDGET_WITH_DESTINATIONS).journey.find((s) => s.stage === 'ORDERING');

    expect(unresolved?.status).toBe('UNKNOWN');
    expect(resolved?.status).toBe('UNKNOWN');
    expect(resolved?.manualValidationRequired).toBe(true);
    expect(resolved?.finding).not.toBe(unresolved?.finding);
    expect(resolved?.finding).toMatch(/markup/i);
  });

  it('is not pinned to any constant — 75 included', () => {
    // Not an assertion about the right answer, only that the number follows the
    // input. Two materially different sites must not produce one fixed figure.
    const a = scoreFor(WIDGET_ONLY).overall.overallScore;
    const b = scoreFor(WIDGET_WITH_DESTINATIONS).overall.overallScore;
    expect(a).not.toBe(b);
    expect([a, b]).not.toEqual([75, 75]);
  });
});
