import type {
  AvailabilityResult,
  BookingResult,
  ReservationProvider,
  ReservationRequest,
} from './provider';

/**
 * Mock reservation provider.
 *
 * Deterministic and offline. It exists so the whole booking pipeline —
 * availability, idempotency, lifecycle, failure queue, dashboard — is testable
 * before any partner agreement exists, and so no test can create a real
 * reservation in a real restaurant.
 *
 * REFUSED IN PRODUCTION, same as the SMS mock. A deployment that silently fell
 * back to this would report confirmed bookings for tables nobody holds, which
 * is the most damaging version of the false-claim failure this codebase keeps
 * being bitten by.
 */
export class MockReservationProvider implements ReservationProvider {
  readonly name = 'mock';
  readonly simulated = true;

  /** Idempotency key -> the result already returned for it. */
  private readonly seen = new Map<string, BookingResult>();
  private readonly behaviour: MockBehaviour;

  constructor(behaviour: MockBehaviour = {}) {
    if (process.env.NODE_ENV === 'production' && !behaviour.allowInProduction) {
      throw new Error(
        'MockReservationProvider refused in production: it would report confirmed bookings that do not exist. ' +
          'Configure a real reservation provider.',
      );
    }
    this.behaviour = behaviour;
  }

  async checkAvailability(request: ReservationRequest): Promise<AvailabilityResult> {
    if (this.behaviour.availability) return this.behaviour.availability;
    if (request.partySize > (this.behaviour.maxPartySize ?? 8)) return { status: 'NONE_AVAILABLE' };
    return {
      status: 'AVAILABLE',
      slots: [
        {
          slotId: `mock-slot-${request.requestedAt}`,
          startsAt: request.requestedAt,
          partySize: request.partySize,
          quotedAt: new Date().toISOString(),
        },
      ],
    };
  }

  async book(request: ReservationRequest): Promise<BookingResult> {
    // Idempotency, modelled rather than assumed. A real vendor returns the
    // original booking for a repeated key; if the mock invented a second
    // confirmation the duplicate-booking test would pass against behaviour no
    // vendor exhibits, and the protection would be fictional.
    const previous = this.seen.get(request.idempotencyKey);
    if (previous) return previous;

    const result: BookingResult = this.behaviour.booking ?? {
      status: 'CONFIRMED',
      confirmationReference: `MOCK-${request.idempotencyKey.slice(0, 12).toUpperCase()}`,
      bookedAt: new Date().toISOString(),
      providerName: this.name,
    };

    this.seen.set(request.idempotencyKey, result);
    return result;
  }
}

export interface MockBehaviour {
  availability?: AvailabilityResult;
  booking?: BookingResult;
  maxPartySize?: number;
  /** Test-only escape hatch. Never set outside a test that asserts the refusal. */
  allowInProduction?: boolean;
}
