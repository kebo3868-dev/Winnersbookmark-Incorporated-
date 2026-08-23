import { describe, expect, it, vi } from 'vitest';
import {
  AVAILABILITY_QUOTE_TTL_MS,
  isQuoteFresh,
  leadStatusForBooking,
  type BookingResult,
  type ReservationRequest,
} from '@/lib/frontdesk/reservations/provider';
import { MockReservationProvider } from '@/lib/frontdesk/reservations/mock';
import { attemptBooking, bookingReplyFor } from '@/lib/frontdesk/reservations/store';

/**
 * MILESTONE 7a — reservation provider architecture.
 *
 * The rule under test is §V: a reservation is CONFIRMED only when a vendor
 * returns a confirmation reference. Everything else is REQUESTED.
 *
 * This is the same failure mode the Rescue Agent spent a cycle removing, moved
 * to a place where it costs more. There, an HTTP 200 was read as "booking
 * works". Here the equivalent slip would be reading "the API call did not
 * throw" as "the customer has a table" — and unlike a wrong audit line, that
 * one ends with a family standing in a lobby.
 *
 * No test touches the network. Every booking below is a mock.
 */

const request = (overrides: Partial<ReservationRequest> = {}): ReservationRequest => ({
  reference: 'ref-1',
  idempotencyKey: 'idem-key-0001',
  customerName: 'Keith Warren',
  phone: '+17275551234',
  partySize: 4,
  requestedAt: '2026-09-01T19:00:00-04:00',
  ...overrides,
});

/** Minimal in-memory stand-in for the Prisma delegate this module uses. */
function fakePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const byKey = () => Array.from(rows.values());
  return {
    rows,
    client: {
      fdBookingAttempt: {
        findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
          byKey().find((r) => r.idempotencyKey === where.idempotencyKey) ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const id = `attempt-${++seq}`;
          const row = { id, updatedAt: new Date(), ...data };
          rows.set(id, row);
          return row;
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = rows.get(where.id) as Record<string, unknown>;
          for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === 'object' && 'increment' in (v as object)) {
              row[k] = ((row[k] as number) ?? 0) + ((v as { increment: number }).increment ?? 0);
            } else {
              row[k] = v;
            }
          }
          row.updatedAt = new Date();
          return row;
        },
      },
    },
  };
}

describe('CONFIRMED requires a vendor confirmation reference', () => {
  it('maps a confirmed booking to BOOKED', () => {
    const result: BookingResult = {
      status: 'CONFIRMED',
      confirmationReference: 'OT-12345',
      bookedAt: new Date().toISOString(),
      providerName: 'mock',
    };
    expect(leadStatusForBooking(result)).toBe('BOOKED');
  });

  it('maps an accepted-but-pending booking to REQUESTED, not BOOKED', () => {
    // The vendor took the request. Nobody has a table. This is the exact
    // conflation §V exists to prevent.
    expect(leadStatusForBooking({ status: 'ACCEPTED_PENDING', providerName: 'mock' })).toBe('NEW');
  });

  it('maps a failed booking to REQUESTED', () => {
    expect(leadStatusForBooking({ status: 'FAILED', retryable: true, providerName: 'mock' } as BookingResult)).toBe('NEW');
  });

  it('never tells a customer a table is held without a confirmation', () => {
    expect(bookingReplyFor({ status: 'ACCEPTED_PENDING', providerName: 'mock' })).toMatch(/requested rather than confirmed/i);
    expect(bookingReplyFor({ status: 'FAILED', retryable: false } as BookingResult)).toMatch(/requested rather than confirmed/i);
    expect(
      bookingReplyFor({ status: 'CONFIRMED', confirmationReference: 'OT-9', bookedAt: new Date().toISOString(), providerName: 'mock' }),
    ).toMatch(/confirmed/i);
  });
});

describe('idempotency — a retry must never seat the party twice', () => {
  it('does not call the vendor again for a key that already confirmed', async () => {
    const { client } = fakePrisma();
    const provider = new MockReservationProvider();
    const spy = vi.spyOn(provider, 'book');

    const first = await attemptBooking(client as never, provider, 'tenant-1', request());
    expect(first.result.status).toBe('CONFIRMED');
    expect(first.deduplicated).toBe(false);

    const second = await attemptBooking(client as never, provider, 'tenant-1', request());
    expect(second.deduplicated).toBe(true);
    expect(second.result.status).toBe('CONFIRMED');
    // The decisive assertion: one vendor call, two attempts.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('returns the original confirmation reference on the repeat', async () => {
    const { client } = fakePrisma();
    const provider = new MockReservationProvider();
    const first = await attemptBooking(client as never, provider, 'tenant-1', request());
    const second = await attemptBooking(client as never, provider, 'tenant-1', request());
    const ref = (r: typeof first.result) => (r.status === 'CONFIRMED' ? r.confirmationReference : null);
    expect(ref(second.result)).toBe(ref(first.result));
  });

  it('records the attempt BEFORE calling the vendor', async () => {
    // A crash during the vendor call must leave evidence the call may have
    // happened. If the row were written afterwards, the retry would book again.
    const { client, rows } = fakePrisma();
    const provider = new MockReservationProvider();
    vi.spyOn(provider, 'book').mockImplementation(async () => {
      expect(rows.size).toBe(1);
      const row = Array.from(rows.values())[0];
      expect(row.status).toBe('SENDING');
      expect(row.idempotencyKey).toBe('idem-key-0001');
      return { status: 'CONFIRMED', confirmationReference: 'X-1', bookedAt: new Date().toISOString(), providerName: 'mock' };
    });
    await attemptBooking(client as never, provider, 'tenant-1', request());
  });

  it('forwards the idempotency key to the provider', async () => {
    const { client } = fakePrisma();
    const provider = new MockReservationProvider();
    const spy = vi.spyOn(provider, 'book');
    await attemptBooking(client as never, provider, 'tenant-1', request({ idempotencyKey: 'k-abc' }));
    expect(spy.mock.calls[0][0].idempotencyKey).toBe('k-abc');
  });
});

describe('failures are recorded, never silent', () => {
  it('records a vendor refusal as FAILED and leaves the lead as REQUESTED', async () => {
    const { client, rows } = fakePrisma();
    const provider = new MockReservationProvider({
      booking: { status: 'FAILED', errorCode: 'NO_TABLES', errorMessage: 'Fully booked', retryable: false },
    });
    const outcome = await attemptBooking(client as never, provider, 'tenant-1', request());
    expect(outcome.result.status).toBe('FAILED');
    expect(outcome.leadStatus).toBe('NEW');
    expect(Array.from(rows.values())[0].status).toBe('FAILED');
  });

  it('treats a thrown adapter as a non-retryable failure', async () => {
    // We cannot tell whether the vendor created a booking before throwing.
    // Guessing "retryable" risks a duplicate, so the safe classification wins.
    const { client } = fakePrisma();
    const provider = new MockReservationProvider();
    vi.spyOn(provider, 'book').mockRejectedValue(new Error('socket hang up'));
    const outcome = await attemptBooking(client as never, provider, 'tenant-1', request());
    expect(outcome.result.status).toBe('FAILED');
    if (outcome.result.status === 'FAILED') {
      expect(outcome.result.retryable).toBe(false);
      expect(outcome.result.errorCode).toBe('ADAPTER_THREW');
    }
  });
});

describe('availability is never invented', () => {
  it('distinguishes "no tables" from "could not ask"', async () => {
    const noTables = new MockReservationProvider({ availability: { status: 'NONE_AVAILABLE' } });
    const cannotAsk = new MockReservationProvider({
      availability: { status: 'UNAVAILABLE', errorCode: 'TIMEOUT', retryable: true },
    });
    expect((await noTables.checkAvailability(request())).status).toBe('NONE_AVAILABLE');
    // A timeout must never be reported to a customer as "we are full".
    expect((await cannotAsk.checkAvailability(request())).status).toBe('UNAVAILABLE');
  });

  it('rejects a stale quote', () => {
    const stale = {
      slotId: 's1',
      startsAt: '2026-09-01T19:00:00-04:00',
      partySize: 4,
      quotedAt: new Date(Date.now() - AVAILABILITY_QUOTE_TTL_MS - 1000).toISOString(),
    };
    expect(isQuoteFresh(stale)).toBe(false);
  });

  it('accepts a fresh quote and rejects a future-dated one', () => {
    const fresh = { slotId: 's1', startsAt: 'x', partySize: 2, quotedAt: new Date().toISOString() };
    expect(isQuoteFresh(fresh)).toBe(true);
    // A quote from the future is not fresh, it is wrong.
    const future = { ...fresh, quotedAt: new Date(Date.now() + 60_000).toISOString() };
    expect(isQuoteFresh(future)).toBe(false);
    expect(isQuoteFresh({ ...fresh, quotedAt: 'not-a-date' })).toBe(false);
  });
});

describe('the mock is refused in production', () => {
  it('throws rather than silently simulating bookings', () => {
    const original = process.env.NODE_ENV;
    try {
      // @ts-expect-error deliberately overriding for the assertion
      process.env.NODE_ENV = 'production';
      expect(() => new MockReservationProvider()).toThrow(/refused in production/i);
    } finally {
      // @ts-expect-error restoring
      process.env.NODE_ENV = original;
    }
  });

  it('marks simulated bookings so they cannot be mistaken for real ones', async () => {
    const { client, rows } = fakePrisma();
    await attemptBooking(client as never, new MockReservationProvider(), 'tenant-1', request());
    expect(Array.from(rows.values())[0].simulated).toBe(true);
  });
});
