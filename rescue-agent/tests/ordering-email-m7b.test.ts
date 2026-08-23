import { describe, expect, it } from 'vitest';
import { detectOrderingOperator, routeOrdering } from '@/lib/frontdesk/ordering/routing';
import { isPlausibleEmail, maskEmail } from '@/lib/frontdesk/email/provider';
import { MockEmailProvider } from '@/lib/frontdesk/email/mock';
import { renderStaffAlert } from '@/lib/frontdesk/email/render';
import type { Pathway } from '@/lib/frontdesk/config/schema';

/**
 * MILESTONE 7b — provider-aware ordering, and email as a second channel.
 *
 * Neither feature transacts with a vendor, which is why M7b needs no partner
 * agreement: ordering hands over a link, email goes to staff. The rules under
 * test are the ones that keep both honest.
 *
 *   Ordering: never construct a destination the restaurant did not configure.
 *   Email:    ACCEPTED is not DELIVERED, and no secret reaches a body.
 */

const pathway = (overrides: Partial<Pathway> = {}): Pathway =>
  ({ enabled: true, ...overrides }) as Pathway;

describe('ordering routing names a vendor without inventing a destination', () => {
  it('names a recognised operator from the CONFIGURED host', () => {
    const route = routeOrdering(pathway({ url: 'https://www.toasttab.com/leverocks' }), 'takeout');
    expect(route?.operator).toBe('Toast');
    expect(route?.text).toMatch(/through Toast/);
    expect(route?.url).toBe('https://www.toasttab.com/leverocks');
  });

  it('falls back to the plain configured URL for an unrecognised host', () => {
    const route = routeOrdering(pathway({ url: 'https://orders.leverocks.example/' }), 'takeout');
    expect(route?.operator).toBeNull();
    expect(route?.text).not.toMatch(/through/);
    expect(route?.text).toContain('https://orders.leverocks.example/');
  });

  it('never returns a URL the restaurant did not configure', () => {
    // The whole safety property. Whatever wording is produced, the destination
    // is always the configured one — no slug-guessing, no vendor templates.
    for (const url of [
      'https://www.toasttab.com/leverocks',
      'https://www.chownow.com/order/1234',
      'https://orders.leverocks.example/',
    ]) {
      expect(routeOrdering(pathway({ url }), 'takeout')?.url).toBe(url);
    }
  });

  it('does not name a vendor the URL contradicts', () => {
    // A config claiming provider "toast" while pointing elsewhere must not
    // produce Toast wording. Detection reads the host, not the claim.
    const route = routeOrdering(pathway({ url: 'https://example.com/order', provider: 'toast' }), 'takeout');
    expect(route?.operator).toBeNull();
    expect(route?.text).not.toMatch(/Toast/);
  });

  it("prefers the restaurant's own note over any inferred wording", () => {
    const route = routeOrdering(
      pathway({ url: 'https://www.toasttab.com/leverocks', note: 'Order pickup on our app only.' }),
      'takeout',
    );
    expect(route?.text).toBe('Order pickup on our app only.');
  });

  it('returns null when the pathway is disabled or empty, so the caller defers', () => {
    // Preserves the honest deferral: "I don't want to give you the wrong
    // information" rather than improvising a pathway.
    expect(routeOrdering(pathway({ enabled: false, url: 'https://x.example/' }), 'takeout')).toBeNull();
    expect(routeOrdering(pathway({}), 'takeout')).toBeNull();
  });

  it('distinguishes delivery wording from pickup wording', () => {
    expect(routeOrdering(pathway({ url: 'https://x.example/' }), 'delivery')?.text).toMatch(/order delivery/i);
    expect(routeOrdering(pathway({ url: 'https://x.example/' }), 'takeout')?.text).toMatch(/order for pickup/i);
  });

  it('offers a phone pathway when that is all that is configured', () => {
    const route = routeOrdering(pathway({ phone: '+17275551234' }), 'takeout');
    expect(route?.text).toMatch(/calling us at \+17275551234/);
    expect(route?.url).toBeNull();
  });

  it('ignores a malformed configured URL rather than throwing', () => {
    expect(detectOrderingOperator('not a url')).toBeNull();
  });
});

describe('email provider — accepted is not delivered', () => {
  it('reports ACCEPTED without claiming delivery', async () => {
    const provider = new MockEmailProvider();
    const result = await provider.send({
      to: 'manager@leverocks.example',
      from: 'alerts@winnersbookmark.example',
      subject: 'Escalation',
      text: 'A customer reported an allergy concern.',
      reference: 'ref-1',
      idempotencyKey: 'k-1',
    });
    // The status vocabulary has no DELIVERED. Delivery is confirmed elsewhere,
    // asynchronously — the same distinction the SMS path already enforces.
    expect(result.status).toBe('ACCEPTED');
    expect(Object.keys(result)).not.toContain('delivered');
  });

  it('does not send twice for a repeated idempotency key', async () => {
    const provider = new MockEmailProvider();
    const message = {
      to: 'manager@leverocks.example',
      from: 'alerts@winnersbookmark.example',
      subject: 'Escalation',
      text: 'body',
      reference: 'ref-1',
      idempotencyKey: 'k-same',
    };
    await provider.send(message);
    await provider.send(message);
    expect(provider.sent).toHaveLength(1);
  });

  it('surfaces a permanent failure as non-retryable', async () => {
    const provider = new MockEmailProvider({
      result: { status: 'FAILED', errorCode: 'INVALID_ADDRESS', retryable: false },
    });
    const result = await provider.send({
      to: 'nope',
      from: 'alerts@winnersbookmark.example',
      subject: 's',
      text: 't',
      reference: 'r',
      idempotencyKey: 'k',
    });
    expect(result.status).toBe('FAILED');
    expect(result.retryable).toBe(false);
    expect(provider.sent).toHaveLength(0);
  });

  it('is refused in production', () => {
    const original = process.env.NODE_ENV;
    try {
      // @ts-expect-error deliberate override for the assertion
      process.env.NODE_ENV = 'production';
      expect(() => new MockEmailProvider()).toThrow(/refused in production/i);
    } finally {
      // @ts-expect-error restoring
      process.env.NODE_ENV = original;
    }
  });

  it('validates addresses shallowly and masks them for logs', () => {
    expect(isPlausibleEmail('manager@leverocks.example')).toBe(true);
    expect(isPlausibleEmail('no-at-sign')).toBe(false);
    expect(isPlausibleEmail('two@@at.example')).toBe(false);
    expect(isPlausibleEmail('spaces in@address.example')).toBe(false);
    expect(maskEmail('manager@leverocks.example')).toBe('m******@leverocks.example');
  });
});

describe('staff email bodies never carry secrets', () => {
  const base = {
    restaurantName: "Leverock's",
    subject: 'Escalation: allergy concern',
    summary: 'A customer reported an allergy concern.',
  };

  it('drops detail lines that look like credentials', () => {
    const rendered = renderStaffAlert({
      ...base,
      details: [
        { label: 'Customer', value: 'Jane' },
        { label: 'API key', value: 'sk_live_abcdef123456' },
        { label: 'Authorization', value: 'Bearer abc.def.ghi' },
      ],
    });
    // Dropped entirely, not masked: a masked secret still reveals that one
    // existed and roughly how long it was.
    expect(rendered.text).toContain('Customer: Jane');
    expect(rendered.text).not.toMatch(/sk_live/);
    expect(rendered.text).not.toMatch(/Bearer/);
    expect(rendered.html).not.toMatch(/sk_live/);
  });

  it('always produces plain text alongside HTML', () => {
    const rendered = renderStaffAlert({ ...base, details: [{ label: 'Party size', value: '8' }] });
    expect(rendered.text.length).toBeGreaterThan(0);
    expect(rendered.text).toContain('Party size: 8');
    expect(rendered.html).toContain('Party size: 8');
  });

  it('escapes HTML so a customer name cannot inject markup', () => {
    const rendered = renderStaffAlert({
      ...base,
      details: [{ label: 'Customer', value: '<script>alert(1)</script>' }],
    });
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
  });

  it('marks a simulated alert so it cannot be mistaken for a real one', () => {
    const rendered = renderStaffAlert({ ...base, details: [], simulated: true });
    expect(rendered.subject).toMatch(/^\[SIMULATED\]/);
    expect(rendered.text).toMatch(/simulated provider/i);
  });
});

describe('M7a reservation rules are untouched', () => {
  it('does not import or alter the reservation provider', async () => {
    // M7b must not disturb the accepted M7a contract. Imported here so a
    // change to the confirmation rule fails in this milestone's suite too.
    const { leadStatusForBooking } = await import('@/lib/frontdesk/reservations/provider');
    expect(leadStatusForBooking({ status: 'ACCEPTED_PENDING', providerName: 'mock' })).toBe('NEW');
    expect(
      leadStatusForBooking({
        status: 'CONFIRMED',
        confirmationReference: 'X-1',
        bookedAt: new Date().toISOString(),
        providerName: 'mock',
      }),
    ).toBe('BOOKED');
  });
});
