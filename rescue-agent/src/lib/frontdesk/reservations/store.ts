import type { PrismaClient } from '@prisma/client';
import type { BookingResult, ReservationProvider, ReservationRequest } from './provider';
import { leadStatusForBooking } from './provider';

/**
 * BOOKING LIFECYCLE (§V)
 *
 * The single path from "a customer asked for a table" to "the restaurant holds
 * one", and the single place the REQUESTED/CONFIRMED rule is applied to
 * durable state.
 *
 * The ordering below is the whole point, and it is deliberately the opposite of
 * the convenient one:
 *
 *   1. Record the attempt (with its idempotency key) BEFORE calling the vendor.
 *   2. Call the vendor.
 *   3. Record the outcome.
 *
 * Writing the record first means a crash at step 2 leaves evidence that a call
 * may have happened. Calling first would leave a booking nobody knows about,
 * and the retry would seat the party twice. A duplicate SMS is noise; a
 * duplicate reservation consumes a real table and embarrasses the restaurant in
 * front of the customer.
 */

export interface BookingOutcome {
  attemptId: string;
  result: BookingResult;
  /** Status the lead is entitled to. BOOKED only from a vendor confirmation. */
  leadStatus: 'BOOKED' | 'NEW';
  /** True when the same idempotency key had already been attempted. */
  deduplicated: boolean;
}

/**
 * Attempt a booking exactly once per idempotency key.
 *
 * Re-entrant by construction: a repeat call with the same key returns the
 * recorded outcome and does not contact the vendor again. That check is a
 * database read on a UNIQUE column, not an in-memory guard, because the process
 * that made the first attempt may no longer exist.
 */
export async function attemptBooking(
  prisma: PrismaClient,
  provider: ReservationProvider,
  tenantId: string,
  request: ReservationRequest,
  options: { leadId?: string; slotId?: string } = {},
): Promise<BookingOutcome> {
  const existing = await prisma.fdBookingAttempt.findUnique({
    where: { idempotencyKey: request.idempotencyKey },
  });

  // A terminal prior outcome is returned as-is. Re-running a CONFIRMED booking
  // would ask the vendor for a second table.
  if (existing && (existing.status === 'CONFIRMED' || existing.status === 'ACCEPTED_PENDING')) {
    const result: BookingResult =
      existing.status === 'CONFIRMED'
        ? {
            status: 'CONFIRMED',
            confirmationReference: existing.confirmationReference as string,
            bookedAt: (existing.confirmedAt ?? existing.updatedAt).toISOString(),
            providerName: existing.providerName,
          }
        : { status: 'ACCEPTED_PENDING', providerReference: existing.providerReference ?? undefined, providerName: existing.providerName };
    return { attemptId: existing.id, result, leadStatus: leadStatusForBooking(result), deduplicated: true };
  }

  const attempt =
    existing ??
    (await prisma.fdBookingAttempt.create({
      data: {
        tenantId,
        leadId: options.leadId ?? null,
        idempotencyKey: request.idempotencyKey,
        status: 'SENDING',
        providerName: provider.name,
        simulated: provider.simulated,
        customerName: request.customerName,
        phone: request.phone,
        email: request.email ?? null,
        partySize: request.partySize,
        requestedAt: new Date(request.requestedAt),
        notes: request.notes ?? null,
        slotId: options.slotId ?? null,
        lockedAt: new Date(),
        attempts: 1,
      },
    }));

  if (existing) {
    await prisma.fdBookingAttempt.update({
      where: { id: attempt.id },
      data: { status: 'SENDING', lockedAt: new Date(), attempts: { increment: 1 } },
    });
  }

  let result: BookingResult;
  try {
    result = await provider.book(request, options.slotId);
  } catch (error) {
    // A thrown adapter is a failed attempt, never a silent one. Treated as
    // non-retryable here: we cannot tell whether the vendor created a booking
    // before throwing, and guessing "retryable" risks a duplicate.
    result = {
      status: 'FAILED',
      errorCode: 'ADAPTER_THREW',
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Unknown adapter error',
      retryable: false,
    };
  }

  await prisma.fdBookingAttempt.update({
    where: { id: attempt.id },
    data: recordFor(result),
  });

  return { attemptId: attempt.id, result, leadStatus: leadStatusForBooking(result), deduplicated: false };
}

/** Durable fields for an outcome. CONFIRMED cannot be written without a reference. */
function recordFor(result: BookingResult) {
  const now = new Date();
  if (result.status === 'CONFIRMED') {
    return {
      status: 'CONFIRMED' as const,
      confirmationReference: result.confirmationReference,
      confirmedAt: new Date(result.bookedAt),
      lockedAt: null,
      lastAttemptAt: now,
      errorCode: null,
      errorMessage: null,
    };
  }
  if (result.status === 'ACCEPTED_PENDING') {
    return {
      status: 'ACCEPTED_PENDING' as const,
      providerReference: result.providerReference ?? null,
      lockedAt: null,
      lastAttemptAt: now,
    };
  }
  return {
    status: 'FAILED' as const,
    errorCode: result.errorCode ?? null,
    errorMessage: result.errorMessage ?? null,
    lockedAt: null,
    lastAttemptAt: now,
  };
}

/**
 * Customer-facing wording for an outcome.
 *
 * Kept here so the REQUESTED/CONFIRMED language cannot drift from the state
 * that justifies it. Only a CONFIRMED result is allowed to say the table is
 * held; everything else says requested, explicitly.
 */
export function bookingReplyFor(result: BookingResult): string {
  if (result.status === 'CONFIRMED') {
    return `Your table is confirmed. Your confirmation reference is ${result.confirmationReference}.`;
  }
  if (result.status === 'ACCEPTED_PENDING') {
    return 'Your reservation request has been sent to the restaurant. Please treat it as requested rather than confirmed until they come back to you.';
  }
  return 'I could not complete the booking automatically, so I have passed your request to the restaurant. Please treat it as requested rather than confirmed until someone confirms it with you.';
}
