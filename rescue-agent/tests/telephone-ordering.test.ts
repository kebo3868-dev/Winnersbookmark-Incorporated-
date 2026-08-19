import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';

/**
 * FALSE POSITIVE 1: a phone action reported as functional online ordering.
 *
 * Confirmed manually against Leverock's live site: the button labelled "ORDER"
 * under the "ORDER ONLINE" heading opens the phone dialler. It does not open an
 * ordering page. The audit nonetheless reported
 *
 *   ORDERING → HEALTHY: "An online ordering pathway is publicly linked and
 *                        responded when tested."
 *
 * because a `/order-online/<slug>` URL sat in the SpotHopper widget config and
 * nothing recorded that the visible call-to-action was a telephone link. The
 * audit told an owner they had online ordering their customers cannot reach.
 *
 * The rule these tests pin: WHAT A CUSTOMER IS ACTUALLY OFFERED OUTRANKS WHAT A
 * WIDGET'S CONFIGURATION DECLARES.
 */

const page = (html: string, url = 'https://leverocks.example/') =>
  extractPage(url, url, 200, 'text/html', html);

const journeyFor = (html: string) => {
  const evidence = normalizeEvidence({ pages: [page(html)], failures: [], probes: [] });
  const records = evidence.map((e, i) => ({
    id: `e${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    confidence: e.confidence,
    supportingContext: e.supportingContext ?? null,
  }));
  return { evidence, journey: analyzeJourney(records) };
};

const orderingStage = (html: string) => journeyFor(html).journey.find((s) => s.stage === 'ORDERING');

describe('telephone precedence — the Leverock\'s case', () => {
  const LEVEROCKS_SHAPE = `
    <h2>ORDER ONLINE</h2>
    <a href="tel:+17275551234">ORDER</a>
    <script src="https://www.spothopperapp.com/widget.js"></script>
    <script>
      window.SH_CONFIG = { orderUrl: "https://www.spothopperapp.com/order-online/leverocks-seafood" };
    </script>
  `;

  it('never reports a phone action as functional online ordering', () => {
    const stage = orderingStage(LEVEROCKS_SHAPE);
    expect(stage?.status).not.toBe('HEALTHY');
    expect(stage?.status).toBe('FRICTION');
    expect(stage?.finding).toMatch(/telephone only/i);
  });

  it('records the config destination as context, never as the pathway', () => {
    const { evidence } = journeyFor(LEVEROCKS_SHAPE);
    const ordering = evidence.find((e) => e.evidenceType === 'ORDERING_PATH');

    expect(ordering?.fact).toMatch(/offered by telephone/i);
    // The claim that caused the false positive must be gone.
    expect(ordering?.fact).not.toMatch(/publicly reachable|publicly linked/i);
    // The resolved URL is still disclosed — as context, explicitly not a pathway.
    expect(ordering?.supportingContext).toContain('/order-online/leverocks-seafood');
    expect(ordering?.supportingContext).toMatch(/context rather than as a working online ordering pathway/i);
  });

  it('captures the ordering call-to-action text from the tel: link', () => {
    expect(page(LEVEROCKS_SHAPE).phoneOrderCtas).toContain('ORDER');
  });
});

describe('telephone precedence does not suppress genuine online ordering', () => {
  it('still reports a real browser ordering destination as healthy', () => {
    const stage = orderingStage(`
      <a href="https://www.spothopperapp.com/order-online/leverocks-seafood">Order Online</a>
    `);
    expect(stage?.status).toBe('HEALTHY');
  });

  it('ignores a tel: link whose wording is not about ordering', () => {
    // "Call Us" in a footer must not demote a working ordering pathway.
    const stage = orderingStage(`
      <a href="https://www.spothopperapp.com/order-online/leverocks-seafood">Order Online</a>
      <footer><a href="tel:+17275551234">Call Us</a></footer>
    `);
    expect(stage?.status).toBe('HEALTHY');
    expect(page(`<footer><a href="tel:+17275551234">Call Us</a></footer>`).phoneOrderCtas).toHaveLength(0);
  });

  it('treats a bare phone number link as contact, not ordering intent', () => {
    expect(page(`<a href="tel:+17275551234">(727) 555-1234</a>`).phoneOrderCtas).toHaveLength(0);
  });

  it('recognises takeout and pickup wording as phone ordering', () => {
    for (const label of ['Call to Order', 'Takeout', 'Order Now', 'Pick Up']) {
      expect(page(`<a href="tel:+17275551234">${label}</a>`).phoneOrderCtas, label).toHaveLength(1);
    }
  });
});

describe('a broken ordering link still outranks the phone', () => {
  it('reports RISK rather than telephone friction when a link failed', () => {
    const evidence = normalizeEvidence({
      pages: [page(`<a href="tel:+17275551234">ORDER</a>`)],
      failures: [],
      probes: [
        { url: 'https://www.spothopperapp.com/order-online/x', category: 'ordering', ok: false, note: 'HTTP 500' },
      ],
    });
    const records = evidence.map((e, i) => ({
      id: `e${i}`,
      evidenceType: e.evidenceType,
      fact: e.fact,
      confidence: e.confidence,
      supportingContext: e.supportingContext ?? null,
    }));
    const stage = analyzeJourney(records).find((s) => s.stage === 'ORDERING');
    // A dead end is a worse finding than a working phone, so it takes priority.
    expect(stage?.status).toBe('RISK');
  });
});
