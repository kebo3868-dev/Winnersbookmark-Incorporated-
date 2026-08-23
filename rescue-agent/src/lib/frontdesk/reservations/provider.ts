/**
 * RESERVATION PROVIDER ABSTRACTION (§XXIII, §V)
 *
 * The front desk must not know which booking vendor a deployment uses.
 * Everything above this interface — the engine, the lead lifecycle, the failure
 * queue — works against `ReservationProvider`, so adding Resy after OpenTable
 * is a new adapter rather than a rewrite. Same shape as `SmsProvider`, for the
 * same reason.
 *
 * Nothing here reaches the network. The only implementation shipped today is a
 * mock, so the entire booking pipeline is testable end to end without a partner
 * agreement, an account, or the risk of creating a real reservation in
 * somebody's dining room.
 *
 * ── THE RULE THIS INTERFACE EXISTS TO ENFORCE ────────────────────────────────
 *
 * A reservation is CONFIRMED only when a vendor returns a confirmation
 * reference. Everything else is REQUESTED.
 *
 * That is §V, and it is the same failure the Rescue Agent spent a whole cycle
 * removing: an HTTP 200 was read as "the booking works", a vendor script was
 * read as "ordering exists". Here the equivalent mistake would be treating
 * "the API call did not throw" as "the customer has a table". The types below
 * make that mistake hard to write: there is no success shape without a
 * `confirmationReference`.
 */

/** What the customer asked for. Collected by the engine; §V says nothing more. */
export interface ReservationRequest {
  /** Correlates vendor logs with our booking-attempt record. */
  reference: string;
  /**
   * Stable per-attempt key. Booking is at-least-once: a worker that dies after
   * the vendor accepted a booking but before the outcome was recorded will
   * retry. Passing this key lets the vendor recognise the repeat and not seat
   * the party twice.
   *
   * Unlike a duplicate SMS, a duplicate booking consumes a real table and is
   * visible to the restaurant. Adapters MUST forward this to whatever the
   * vendor calls its idempotency header, and MUST NOT silently drop it.
   */
  idempotencyKey: string;
  customerName: string;
  phone: string;
  email?: string;
  partySize: number;
  /** ISO 8601, with offset. Never a bare local time — see M5 on silent UTC. */
  requestedAt: string;
  notes?: string;
}

/**
 * A slot the vendor said was available, in the response to THIS request.
 *
 * Deliberately not cacheable across turns: availability decays in seconds, and
 * quoting a slot the vendor returned two minutes ago is how a customer is told
 * a table exists that has since gone. `quotedAt` exists so a consumer can
 * refuse to act on a stale quote rather than trusting one.
 */
export interface AvailabilitySlot {
  /** Vendor's opaque handle for this slot, passed back when booking. */
  slotId: string;
  /** ISO 8601 with offset. */
  startsAt: string;
  partySize: number;
  /** When the vendor returned this. */
  quotedAt: string;
}

export type AvailabilityResult =
  | { status: 'AVAILABLE'; slots: AvailabilitySlot[] }
  /** The vendor answered and offered nothing. A real answer, not a failure. */
  | { status: 'NONE_AVAILABLE' }
  /**
   * The vendor could not be asked. NOT the same as "no availability" — the
   * engine must not tell a customer the restaurant is full because an API
   * timed out.
   */
  | { status: 'UNAVAILABLE'; errorCode?: string; errorMessage?: string; retryable: boolean };

/**
 * Result of asking a vendor to book.
 *
 * CONFIRMED carries a `confirmationReference` because that reference IS the
 * confirmation. There is no CONFIRMED-without-reference variant, so a caller
 * cannot construct a confirmed booking it has no evidence for.
 *
 * ACCEPTED_PENDING covers vendors that queue a request for restaurant approval:
 * the vendor took it, nobody has a table yet. It maps to REQUESTED, never
 * BOOKED — conflating the two is exactly how "responded when tested" became
 * "reservations work".
 */
export type BookingResult =
  | { status: 'CONFIRMED'; confirmationReference: string; bookedAt: string; providerName: string }
  | { status: 'ACCEPTED_PENDING'; providerReference?: string; providerName: string }
  | {
      status: 'FAILED';
      errorCode?: string;
      errorMessage?: string;
      /**
       * Whether trying again could plausibly succeed. Getting this wrong in the
       * retryable direction risks a second attempt at a booking that may
       * already exist — which is why adapters must classify a timeout as
       * retryable ONLY when the idempotency key protects the repeat.
       */
      retryable: boolean;
    };

export interface ReservationProvider {
  readonly name: string;
  /** True for mocks. Surfaced in the UI so a simulated booking is never mistaken for a real one. */
  readonly simulated: boolean;
  checkAvailability(request: ReservationRequest): Promise<AvailabilityResult>;
  book(request: ReservationRequest, slotId?: string): Promise<BookingResult>;
}

/**
 * A quote older than this must be re-checked before booking against it.
 *
 * Short on purpose. The cost of re-querying is one API call; the cost of
 * booking against a stale quote is a customer told they have a table they do
 * not have.
 */
export const AVAILABILITY_QUOTE_TTL_MS = 120_000;

/** Whether a slot quote is still fresh enough to book against. */
export function isQuoteFresh(slot: AvailabilitySlot, now: Date = new Date()): boolean {
  const quotedAt = Date.parse(slot.quotedAt);
  if (Number.isNaN(quotedAt)) return false;
  const age = now.getTime() - quotedAt;
  // A quote timestamped in the future is not fresh, it is wrong.
  return age >= 0 && age <= AVAILABILITY_QUOTE_TTL_MS;
}

/**
 * The lead status a booking outcome justifies.
 *
 * The single place the REQUESTED/CONFIRMED rule is decided, so it cannot drift
 * between call sites. Only CONFIRMED — which by construction carries a vendor
 * reference — produces BOOKED.
 */
export function leadStatusForBooking(result: BookingResult): 'BOOKED' | 'NEW' {
  return result.status === 'CONFIRMED' ? 'BOOKED' : 'NEW';
}
