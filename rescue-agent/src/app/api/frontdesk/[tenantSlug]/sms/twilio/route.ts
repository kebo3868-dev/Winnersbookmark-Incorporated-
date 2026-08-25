import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { handleInboundSms } from '@/lib/frontdesk/messaging/inbound';
import { claimInboundEvent } from '@/lib/frontdesk/messaging/store';
import { parseTwilioInboundSms } from '@/lib/frontdesk/notify/twilio';
import { signedRequestUrl, twilioCredentialPresented, verifyTwilioWebhook } from '@/lib/frontdesk/notify/twilioWebhook';
import { recordFailure } from '@/lib/frontdesk/notify/store';
import { noteRejection } from '@/lib/frontdesk/security/rejections';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * INBOUND CUSTOMER SMS FROM TWILIO
 *
 * The bridge between Twilio's webhook and the front desk. Twilio posts
 * form-encoded with `X-Twilio-Signature`; the platform's own inbound route
 * speaks JSON with `x-wbi-signature`. Nothing translated between them, which
 * meant that with Twilio configured there was no inbound path at all — no
 * conversations, no consent, and no way to honour STOP.
 *
 * ── THIS ROUTE HANDLES MESSAGES. ONLY MESSAGES. ──────────────────────────────
 *
 * A missed call is a different event with a different consequence: it sends an
 * unprompted recovery text to someone who never wrote to us. It has its own
 * route and its own parser, and `parseTwilioInboundSms` returns null for
 * anything carrying `CallStatus` or `CallSid`, so a voice payload delivered
 * here is refused rather than recorded as a customer message.
 *
 * Everything after verification is the existing pipeline: `handleInboundSms`
 * applies consent, opt-out keywords and the follow-up cap exactly as it does
 * for any other provider.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  // Refused before any parsing, tenant read or write.
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
    // Coalesced per hour. A rejected request must never be a write primitive.
    // The detail carries nothing the caller supplied — the slug is
    // attacker-chosen and must not be echoed onto a restaurant's dashboard.
    await noteRejection({
      tenantId: tenant?.id ?? null,
      category: 'FAILED_WEBHOOK',
      operation: 'sms.inbound.twilio',
      reason: verdict.reason,
      detail: `Inbound Twilio messages are being rejected: ${verdict.reason}`,
      credentialPresented: verdict.credentialPresented,
    });
    return NextResponse.json({ error: 'INVALID WEBHOOK REQUEST' }, { status: 401 });
  }

  // Verified above, so a tenant exists.
  const restaurant = tenant as NonNullable<typeof tenant>;
  if (restaurant.status === 'SUSPENDED') {
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'TENANT_SUSPENDED' });
  }

  const message = parseTwilioInboundSms(verdict.params);
  if (!message) {
    // A shape this route does not handle — a call event, or a message with no
    // body. Acknowledged so Twilio stops retrying, and explicitly not handled.
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'NOT_AN_INBOUND_MESSAGE' });
  }

  // Claim before any work. Twilio redelivers aggressively, and without this one
  // customer text could be answered three times.
  const fresh = await claimInboundEvent('twilio', message.eventId, 'SMS_INBOUND', restaurant.id, prisma);
  if (!fresh) {
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'DUPLICATE_EVENT' });
  }

  try {
    const result = await handleInboundSms(restaurant, { fromNumber: message.from, body: message.body }, prisma);
    return NextResponse.json({ acknowledged: true, handled: true, result: result.handled });
  } catch (error) {
    // Answered 200 deliberately: a 500 makes Twilio retry a message the claim
    // above has already consumed, so the retry would be dropped as a duplicate
    // and the failure would be invisible. Filed instead.
    await recordFailure(
      {
        tenantId: restaurant.id,
        category: 'FAILED_WEBHOOK',
        operation: 'sms.inbound.twilio',
        detail: 'An inbound customer message could not be processed',
        referenceId: message.eventId,
        lastError: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
      },
      prisma,
    );
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'PROCESSING_FAILED' });
  }
}
