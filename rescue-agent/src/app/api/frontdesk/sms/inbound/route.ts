import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { handleInboundSms } from '@/lib/frontdesk/messaging/inbound';
import { handleMissedCall } from '@/lib/frontdesk/messaging/missedCall';
import { claimInboundEvent } from '@/lib/frontdesk/messaging/store';
import { recordFailure } from '@/lib/frontdesk/notify/store';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyWebhook } from '@/lib/frontdesk/notify/webhook';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * Inbound messaging webhook: customer SMS and missed-call events.
 *
 * Authenticated by HMAC over the raw body with a recent-timestamp requirement,
 * exactly like the delivery-status webhook, and exempt from the app-wide Basic
 * Auth for the same reason — it fails closed without a valid signature.
 *
 * DUPLICATE PROTECTION. Providers redeliver aggressively. Without the event
 * claim below, one inbound "STOP" could be acknowledged three times, and one
 * missed call could fire three recovery texts at a customer. The claim is a
 * unique-constrained insert, so concurrent redeliveries race and exactly one
 * proceeds.
 */

const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('SMS_INBOUND'),
    provider: z.string().min(1).max(40),
    eventId: z.string().min(1).max(200),
    tenantSlug: z.string().min(1).max(100),
    from: z.string().min(3).max(40),
    body: z.string().min(1).max(2000),
  }),
  z.object({
    kind: z.literal('MISSED_CALL'),
    provider: z.string().min(1).max(40),
    eventId: z.string().min(1).max(200),
    tenantSlug: z.string().min(1).max(100),
    from: z.string().min(3).max(40),
    callId: z.string().min(1).max(200),
  }),
]);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const verdict = verifyWebhook({
    secret: process.env.SMS_WEBHOOK_SECRET,
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    rawBody,
    now: new Date(),
  });

  if (!verdict.ok) {
    await recordFailure({
      tenantId: null,
      category: 'FAILED_WEBHOOK',
      operation: 'sms.inbound',
      detail: `Rejected an inbound messaging webhook: ${verdict.reason}`,
      lastError: verdict.reason,
    });
    return NextResponse.json({ error: 'INVALID WEBHOOK REQUEST' }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'INVALID JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json({ error: 'UNRECOGNISED PAYLOAD' }, { status: 400 });
  }
  const event = parsed.data;

  const tenant = await getTenantBySlug(event.tenantSlug);
  if (!tenant) {
    // 200 rather than 404: the provider cannot fix an unknown tenant by
    // retrying, and a retry storm helps nobody. Filed for an operator instead.
    await recordFailure({
      tenantId: null,
      category: 'FAILED_WEBHOOK',
      operation: 'sms.inbound',
      detail: `Inbound event for unknown restaurant "${event.tenantSlug}"`,
      lastError: 'UNKNOWN_TENANT',
    });
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'UNKNOWN_TENANT' });
  }

  if (tenant.status === 'SUSPENDED') {
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'TENANT_SUSPENDED' });
  }

  // Claim before doing any work. A redelivery is acknowledged, not reprocessed.
  const fresh = await claimInboundEvent(event.provider, event.eventId, event.kind, tenant.id, prisma);
  if (!fresh) {
    return NextResponse.json({ acknowledged: true, handled: false, reason: 'DUPLICATE_EVENT' });
  }

  try {
    if (event.kind === 'SMS_INBOUND') {
      const result = await handleInboundSms(tenant, { fromNumber: event.from, body: event.body }, prisma);
      return NextResponse.json({ acknowledged: true, ...result });
    }

    const result = await handleMissedCall(
      tenant,
      { fromNumber: event.from, callId: event.callId },
      prisma,
    );
    return NextResponse.json({ acknowledged: true, ...result });
  } catch (error) {
    console.error('[frontdesk] inbound event processing failed', { kind: event.kind, error });
    await recordFailure({
      tenantId: tenant.id,
      category: 'FAILED_WEBHOOK',
      operation: `sms.inbound.${event.kind.toLowerCase()}`,
      detail: 'Inbound event was accepted but could not be processed',
      referenceId: event.eventId,
      lastError: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
    });
    // 500 so the provider retries: the event is claimed, but a retry with the
    // same id is deduplicated, so the retry is harmless and the failure is
    // already visible to an operator.
    return NextResponse.json({ error: 'COULD NOT PROCESS EVENT' }, { status: 500 });
  }
}
