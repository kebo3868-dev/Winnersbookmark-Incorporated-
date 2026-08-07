import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { applyDeliveryStatus, recordFailure } from '@/lib/frontdesk/notify/store';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  parseDeliveryCallback,
  verifyWebhook,
} from '@/lib/frontdesk/notify/webhook';

export const dynamic = 'force-dynamic';

/**
 * Provider delivery-status callback.
 *
 * This is the only front desk route designed to be reached by a third party,
 * and it authenticates itself with an HMAC rather than a shared password — so
 * it is exempt from the app-wide Basic Auth in the middleware matcher. That
 * exemption is safe only because every request here is signature-verified and
 * fails closed when no secret is configured.
 *
 * Rejections are recorded to the failure queue: a run of BAD_SIGNATURE entries
 * means either a rotated secret nobody updated, or someone probing the
 * endpoint. Both are things an operator needs to see.
 */
export async function POST(request: NextRequest) {
  // The RAW body is what was signed. Parsing first and re-serialising would
  // verify a different string than the provider signed.
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
      operation: 'notifications.webhook',
      detail: `Rejected a delivery callback: ${verdict.reason}`,
      lastError: verdict.reason,
    });
    // Uniform response: a caller learns only that it was rejected.
    return NextResponse.json({ error: 'INVALID WEBHOOK REQUEST' }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'INVALID JSON' }, { status: 400 });
  }

  const callback = parseDeliveryCallback(parsedBody);
  if (!callback) {
    return NextResponse.json({ error: 'UNRECOGNISED CALLBACK PAYLOAD' }, { status: 400 });
  }

  const result = await applyDeliveryStatus(
    callback.providerMessageId,
    callback.status,
    { errorCode: callback.errorCode, errorMessage: callback.errorMessage, at: new Date() },
    prisma,
  );

  // A callback for an unknown message is acknowledged with 200, not an error:
  // providers retry non-2xx responses, and there is nothing to retry into.
  if (!result.updated) {
    return NextResponse.json({ acknowledged: true, applied: false });
  }

  // An undeliverable escalation alert means a human was never reached, so it
  // goes to the failure queue even though the webhook itself succeeded.
  if (callback.status === 'UNDELIVERED' && result.tenantId) {
    await recordFailure({
      tenantId: result.tenantId,
      category: 'FAILED_SMS',
      operation: 'escalation.deliver',
      detail: `Carrier could not deliver an alert: ${callback.errorCode ?? 'unknown reason'}`,
      referenceId: callback.providerMessageId,
      lastError: callback.errorMessage ?? callback.errorCode ?? null,
    });
  }

  return NextResponse.json({ acknowledged: true, applied: true });
}
