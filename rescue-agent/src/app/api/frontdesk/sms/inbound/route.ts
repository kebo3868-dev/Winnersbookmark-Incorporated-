import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { handleInboundSms } from '@/lib/frontdesk/messaging/inbound';
import { handleMissedCall } from '@/lib/frontdesk/messaging/missedCall';
import { claimInboundEvent } from '@/lib/frontdesk/messaging/store';
import { recordFailure } from '@/lib/frontdesk/notify/store';
import { noteRejection, presentedAnyCredential } from '@/lib/frontdesk/security/rejections';
import { getTenantWebhookSecretHash } from '@/lib/frontdesk/auth/users';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyWebhookForTenant } from '@/lib/frontdesk/notify/webhook';
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
  // FRONT DOOR. A request carrying no signature at all cannot possibly verify,
  // so it is refused before any parsing, any tenant lookup and any write.
  // Previously such a request reached a database read (slug → tenant) and then
  // a database write (a failure row), which made an unauthenticated caller able
  // to drive work in a production database.
  if (!presentedAnyCredential(request.headers, [SIGNATURE_HEADER])) {
    return NextResponse.json({ error: 'INVALID WEBHOOK REQUEST' }, { status: 401 });
  }

  const rawBody = await request.text();

  // The body is PARSED before it is verified, because the signature is checked
  // against the named restaurant's OWN secret and we cannot know which secret
  // to use until we know which restaurant. Parsing is not trusting: nothing is
  // acted on until the signature check below passes. Resolving a slug to look
  // up a secret is a read, and an attacker who names a restaurant still cannot
  // produce a signature for it.
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

  // Verify against this restaurant's secret. A tenant with no secret
  // configured, or a slug that does not exist, both fail closed — and both
  // return the same 401, so the endpoint cannot be used to discover which
  // restaurants are on the platform.
  const verdict = verifyWebhookForTenant({
    secretHash: tenant ? await getTenantWebhookSecretHash(tenant.id) : null,
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    rawBody,
    now: new Date(),
  });

  if (!verdict.ok) {
    // Coalesced. A signature WAS presented and failed, which is worth an
    // operator knowing — but attributed per hour, not per request. The detail
    // deliberately contains nothing the caller supplied: the tenant slug is
    // attacker-chosen, and echoing it into the operator's queue would let an
    // outsider write text onto a restaurant's dashboard.
    await noteRejection({
      tenantId: tenant?.id ?? null,
      category: 'FAILED_WEBHOOK',
      operation: 'sms.inbound',
      reason: verdict.reason,
      detail: `Inbound messaging webhooks are being rejected: ${verdict.reason}`,
      credentialPresented: true,
    });
    return NextResponse.json({ error: 'INVALID WEBHOOK REQUEST' }, { status: 401 });
  }

  if (!tenant) {
    // Unreachable in practice: verification above needs the tenant's own secret
    // hash, and an unknown tenant has none, so `verifyWebhookForTenant` already
    // failed closed. Kept as a belt-and-braces guard, and coalesced like every
    // other rejection so it cannot become a write primitive if that changes.
    await noteRejection({
      tenantId: null,
      category: 'FAILED_WEBHOOK',
      operation: 'sms.inbound',
      reason: 'UNKNOWN_TENANT',
      detail: 'Inbound events are arriving for a restaurant that does not exist',
      credentialPresented: true,
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
