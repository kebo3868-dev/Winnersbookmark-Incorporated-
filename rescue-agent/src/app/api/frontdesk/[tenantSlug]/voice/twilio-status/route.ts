import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { handleMissedCall } from '@/lib/frontdesk/messaging/missedCall';
import { claimInboundEvent } from '@/lib/frontdesk/messaging/store';
import { parseTwilioCallStatus } from '@/lib/frontdesk/notify/twilio';
import { signedRequestUrl, twilioCredentialPresented, verifyTwilioWebhook } from '@/lib/frontdesk/notify/twilioWebhook';
import { recordFailure } from '@/lib/frontdesk/notify/store';
import { noteRejection } from '@/lib/frontdesk/security/rejections';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * VOICE CALL STATUS FROM TWILIO — the missed-call trigger
 *
 * A SEPARATE ROUTE FROM INBOUND SMS, ON PURPOSE.
 *
 * The two events look similar in a webhook log and are not similar at all. An
 * inbound message is a customer writing to the restaurant, and the reply is
 * something they asked for. An unanswered call produces an UNPROMPTED text to
 * someone who never wrote to us — a different consent posture, a different
 * failure mode, and a different thing to get wrong.
 *
 * Keeping them on one endpoint would mean one parser deciding which they were,
 * and the day that decision is wrong a customer who texted "table for 4?" gets
 * "Sorry we missed your call". So: two routes, two parsers, and each refuses
 * the other's payload shape outright.
 *
 * ── SCOPE: EVENT RECEIPT, NOT CALL CONTROL ───────────────────────────────────
 *
 * This receives a status callback. It does not answer calls, play audio or
 * bridge anything — there is no TwiML here. A deployment that wants Twilio to
 * place the call needs a `<Dial>` endpoint, which is a separate capability and
 * deliberately not in this change. This route is the minimum that makes the
 * missed-call path real for a number that forwards on no-answer.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  if (!twilioCredentialPresented(request)) {
    return NextResponse.json({ error: 'INVALID WEBHOOK REQUEST' }, { status: 401 });
  }

  const rawBody = await request.text();
  const tenant = await getTenantBySlug(tenantSlug);

  const verdict = verifyTwilioWebhook({
    request,
    rawBody,
    tenant,
    url: signedRequestUrl(request),
  });

  if (!verdict.ok) {
    await noteRejection({
      tenantId: tenant?.id ?? null,
      category: 'FAILED_WEBHOOK',
      operation: 'voice.status.twilio',
      reason: verdict.reason,
      detail: `Twilio call-status callbacks are being rejected: ${verdict.reason}`,
      credentialPresented: verdict.credentialPresented,
    });
    return NextResponse.json({ error: 'INVALID WEBHOOK REQUEST' }, { status: 401 });
  }

  const restaurant = tenant as NonNullable<typeof tenant>;
  if (restaurant.status === 'SUSPENDED') {
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'TENANT_SUSPENDED' });
  }

  const call = parseTwilioCallStatus(verdict.params);
  if (!call) {
    // An answered call, a non-terminal status, or a message payload. All of
    // them are acknowledged and none of them recover anything — texting
    // somebody the restaurant just spoke to is worse than staying quiet.
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'NOT_A_MISSED_CALL' });
  }

  const fresh = await claimInboundEvent('twilio', call.eventId, 'MISSED_CALL', restaurant.id, prisma);
  if (!fresh) {
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'DUPLICATE_EVENT' });
  }

  try {
    const result = await handleMissedCall(restaurant, { fromNumber: call.from, callId: call.eventId }, prisma);
    return NextResponse.json({ acknowledged: true, handled: true, recovered: result.recovered });
  } catch (error) {
    await recordFailure(
      {
        tenantId: restaurant.id,
        category: 'FAILED_WEBHOOK',
        operation: 'voice.status.twilio',
        detail: 'A missed call could not be processed for recovery',
        referenceId: call.eventId,
        lastError: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
      },
      prisma,
    );
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'PROCESSING_FAILED' });
  }
}
