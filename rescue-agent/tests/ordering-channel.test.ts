import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import {
  formatOrderingChannelFact,
  isMarketplacePlatform,
  parseOrderingChannelFact,
  resolveOrderingChannel,
  type OrderingChannelInput,
} from '@/lib/audit/orderingChannel';

/**
 * CRITICAL 2 — ORDERING CHANNEL CLASSIFICATION
 *
 * Phone ordering is a legitimate ordering pathway. It is not online ordering,
 * and the audit must be able to say both things at once.
 *
 * A discovered vendor URL returning 404 is not an ordering failure. A VERIFIED
 * failure needs all four of: customer-facing destination, actually exposed in
 * the customer journey, intended for ordering, and demonstrably failing.
 */

const page = (html: string, url = 'https://leverocks.example/') => extractPage(url, url, 200, 'text/html', html);

const channelFor = (html: string, probes: ProbeResult[] = []) => {
  const evidence = normalizeEvidence({ pages: [page(html)], failures: [], probes });
  const record = evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL');
  expect(record, 'an ORDERING_CHANNEL record is always emitted').toBeDefined();
  return { record: record!, marker: parseOrderingChannelFact(record!.fact)! };
};

const orderingStage = (html: string, probes: ProbeResult[] = []) => {
  const records = normalizeEvidence({ pages: [page(html)], failures: [], probes }).map((e, i) => ({
    id: `e${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    confidence: e.confidence,
    supportingContext: e.supportingContext ?? null,
  }));
  return analyzeJourney(records).find((s) => s.stage === 'ORDERING');
};

const base: OrderingChannelInput = { phoneOrderCtas: [], destinations: [], probes: [], widgetVendor: null };

describe('the five states', () => {
  it('PHONE_ORDERING_ONLY — a tel: ordering CTA is a pathway, and is not online ordering', () => {
    const { marker, record } = channelFor('<a href="tel:+17275551234">Order Now</a>');
    expect(marker.state).toBe('PHONE_ORDERING_ONLY');
    expect(record.fact).toMatch(/telephone only/i);
    expect(record.fact).toMatch(/legitimate ordering pathway/i);
    expect(record.fact).toMatch(/not online ordering/i);
  });

  it('THIRD_PARTY_ORDERING — marketplaces that sit between the restaurant and its customer', () => {
    const { marker } = channelFor(`
      <a href="https://www.doordash.com/store/leverocks">Order on DoorDash</a>
      <a href="https://www.ubereats.com/store/leverocks">Uber Eats</a>
    `);
    expect(marker.state).toBe('THIRD_PARTY_ORDERING');
  });

  it('ONLINE_ORDERING_BROKEN_CONFIRMED — a link a customer is offered that fails', () => {
    const { marker } = channelFor('<a href="https://leverocks.example/order-online">Order Online</a>', [
      { url: 'https://leverocks.example/order-online', category: 'ordering', ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP' },
    ]);
    expect(marker.state).toBe('ONLINE_ORDERING_BROKEN_CONFIRMED');
  });

  it('ORDERING_PATH_UNCLEAR — a reachable destination whose order flow was not completed', () => {
    const { marker } = channelFor('<a href="https://www.spothopperapp.com/order-online/leverocks">Order Online</a>');
    expect(marker.state).toBe('ORDERING_PATH_UNCLEAR');
    expect(marker.destinationResolved).toBe(true);
  });

  it('ORDERING_PATH_UNCLEAR — nothing found at all is an absence, not a defect', () => {
    const { marker, record } = channelFor('<h1>Leverock&rsquo;s</h1>');
    expect(marker.state).toBe('ORDERING_PATH_UNCLEAR');
    expect(marker.destinationResolved).toBe(false);
    expect(record.supportingContext).toMatch(/INSUFFICIENT_DATA/);
  });

  it('ONLINE_ORDERING_WORKING is unreachable without positive verification', () => {
    // The audit cannot place a test order, so it must never claim ordering
    // works. The state exists for a future verification step and nothing in the
    // current collector can reach it.
    const reachable = resolveOrderingChannel({
      ...base,
      destinations: [{ url: 'https://leverocks.example/order', exposedInCustomerJourney: true, platform: null, host: 'leverocks.example' }],
      probes: [{ url: 'https://leverocks.example/order', ok: true, httpStatus: 200, exposedInCustomerJourney: true }],
    });
    expect(reachable.state).not.toBe('ONLINE_ORDERING_WORKING');

    const verified = resolveOrderingChannel({ ...base, orderPlacementVerified: true });
    expect(verified.state).toBe('ONLINE_ORDERING_WORKING');
  });
});

describe('the four conditions for a VERIFIED ordering failure', () => {
  const failingProbe = {
    url: 'https://www.spothopperapp.com/order-online/x',
    ok: false,
    httpStatus: 404,
    failureKind: 'HTTP' as const,
  };

  it('1 — refuses when the destination is not customer-facing', () => {
    const result = resolveOrderingChannel({
      ...base,
      probes: [{ ...failingProbe, url: 'https://www.spothopperapp.com/api/v1/orders', exposedInCustomerJourney: true }],
    });
    expect(result.state).not.toBe('ONLINE_ORDERING_BROKEN_CONFIRMED');
  });

  it('2 — refuses when the destination is not exposed in the customer journey', () => {
    const result = resolveOrderingChannel({ ...base, probes: [{ ...failingProbe, exposedInCustomerJourney: false }] });
    expect(result.state).not.toBe('ONLINE_ORDERING_BROKEN_CONFIRMED');
  });

  it('3 — only ordering-category probes reach this decision at all', () => {
    // A failing RESERVATION probe must not become an ordering finding. The
    // evidence layer routes by category, so nothing non-ordering is passed in.
    const stage = orderingStage('<a href="https://leverocks.example/reservations">Book</a>', [
      { url: 'https://leverocks.example/reservations', category: 'reservation', ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP' },
    ]);
    expect(stage?.status).not.toBe('RISK');
  });

  it('4 — refuses when nothing actually failed', () => {
    const result = resolveOrderingChannel({
      ...base,
      probes: [{ url: failingProbe.url, ok: true, httpStatus: 200, exposedInCustomerJourney: true }],
    });
    expect(result.state).not.toBe('ONLINE_ORDERING_BROKEN_CONFIRMED');
  });

  it('accepts only when ALL FOUR hold', () => {
    const result = resolveOrderingChannel({ ...base, probes: [{ ...failingProbe, exposedInCustomerJourney: true }] });
    expect(result.state).toBe('ONLINE_ORDERING_BROKEN_CONFIRMED');
    expect(result.evidenceState).toBe('VERIFIED');
    expect(result.detail).toMatch(/all four conditions/i);
  });
});

describe('a discovered vendor 404 does not make ordering broken', () => {
  it('leaves the channel unchanged when the URL is nowhere in the markup', () => {
    const stage = orderingStage('<a href="tel:+17275551234">Order</a>', [
      { url: 'https://www.spothopperapp.com/order-online/stale-slug', category: 'ordering', ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP' },
    ]);
    expect(stage?.status).toBe('FRICTION');
    expect(stage?.finding).toMatch(/telephone only/i);
  });
});

describe('white-label vendors are not marketplaces', () => {
  it('does not call a restaurant\'s own ordering page third-party ordering', () => {
    // Calling SpotHopper/Toast "third-party ordering" would start a commission
    // conversation with a restaurant that pays no commission.
    for (const platform of ['SpotHopper', 'Toast', 'Olo', 'Square', 'Clover', 'Menufy', 'ChowNow']) {
      expect(isMarketplacePlatform(platform), platform).toBe(false);
    }
    for (const platform of ['DoorDash', 'Uber Eats', 'Grubhub', 'Postmates', 'Slice']) {
      expect(isMarketplacePlatform(platform), platform).toBe(true);
    }
    expect(isMarketplacePlatform(null)).toBe(false);
  });

  it('a single SpotHopper ordering link is unclear, not third-party', () => {
    const { marker } = channelFor('<a href="https://www.spothopperapp.com/order-online/leverocks">Order Online</a>');
    expect(marker.state).toBe('ORDERING_PATH_UNCLEAR');
  });
});

describe('the marker round-trips', () => {
  it('formats and parses without prose matching', () => {
    const result = resolveOrderingChannel({ ...base, phoneOrderCtas: ['Order Now'] });
    const fact = formatOrderingChannelFact(result);
    expect(parseOrderingChannelFact(fact)).toEqual({ state: 'PHONE_ORDERING_ONLY', destinationResolved: false });
  });

  it('returns null for a fact that carries no marker', () => {
    expect(parseOrderingChannelFact('Ordering is offered by telephone.')).toBeNull();
    expect(parseOrderingChannelFact('ORDERING CHANNEL: NOT_A_REAL_STATE — x')).toBeNull();
  });
});

describe('journey mapping keeps the distinction visible', () => {
  it('phone ordering is FRICTION, never HEALTHY and never RISK', () => {
    const stage = orderingStage('<a href="tel:+17275551234">Order Now</a>');
    expect(stage?.status).toBe('FRICTION');
    expect(stage?.finding).toMatch(/telephone only/i);
  });

  it('a resolved-but-unverified destination keeps RESOLVED_UNVERIFIED, not UNKNOWN', () => {
    // UNKNOWN would drop the ordering category out of the Rescue Score entirely
    // for a restaurant that demonstrably has an ordering page.
    const stage = orderingStage('<a href="https://www.spothopperapp.com/order-online/leverocks">Order Online</a>');
    expect(stage?.status).toBe('RESOLVED_UNVERIFIED');
  });

  it('no ordering pathway at all stays UNKNOWN', () => {
    const stage = orderingStage('<h1>Leverock&rsquo;s Great Seafood</h1>');
    expect(stage?.status).toBe('UNKNOWN');
    expect(stage?.manualValidationRequired).toBe(true);
  });
});
