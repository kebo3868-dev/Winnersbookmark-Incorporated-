import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { applyDeliveryStatus, recordFailure } from '@/lib/frontdesk/notify/store';
import {
  TWILIO_SIGNATURE_HEADER,
  parseTwilioDeliveryCallback,
  verifyTwilioSignature,
} from '@/lib/frontdesk/notify/twilio';
import { applyVerificationOutcome } from '@/lib/frontdesk/notify/verification';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  parseDeliveryCallback,
  verifyWebhook,
  type DeliveryCallback,
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
 * TWO SCHEMES, ONE ROUTE. A vendor signs the way the vendor signs; we do not
 * get to choose. Twilio uses HMAC-SHA1 over the URL plus sorted form fields;
 * the platform's own scheme is HMAC-SHA256 over `timestamp.rawBody`. Which one
 * applies is decided by the CONFIGURED PROVIDER, never by which header the
 * caller chose to send — otherwise an attacker could pick whichever scheme
 * they had a secret for.
 *
 * Rejections are recorded to the failure queue: a run of BAD_SIGNATURE entries
 * means either a rotated secret nobody updated, or someone probing the
 * endpoint. Both are things an operator needs to see.
 */
export async function POST(request: NextRequest) {
  // The RAW body is what was signed. Parsing first and re-serialising would
  // verify a different string than the provider signed.
  const rawBody = await request.text();
  const provider = (process.env.SMS_PROVIDER || '').toLowerCase().trim();

  const outcome =
    provider === 'twilio'
      ? verifyTwilioRequest(request, rawBody)
      : verifyPlatformRequest(request, rawBody);

  if (!outcome.ok) {
    await recordFailure({
      tenantId: null,
      category: 'FAILED_WEBHOOK',
      operation: 'notifications.webhook',
      detail: `Rejected a delivery callback: ${outcome.reason}`,
      lastError: outcome.reason,
    });
    // Uniform response: a caller learns only that it was rejected.
    return NextResponse.json({ error: 'INVALID WEBHOOK REQUEST' }, { status: 401 });
  }

  if (!outcome.callback) {
    // Verified, but not a terminal delivery outcome — Twilio posts `queued`,
    // `sending` and `sent` on the way past. Acknowledged so the provider stops
    // retrying, and deliberately not applied: those are progress, not results.
    return NextResponse.json({ acknowledged: true, applied: false, reason: outcome.skipped ?? 'NOT_TERMINAL' });
  }

  const callback = outcome.callback;

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

  // A rota test alert is only proven by a real delivery receipt, which is this
  // one. Scoped by tenant so a receipt can never resolve another restaurant's
  // verification.
  if (result.notificationId && result.tenantId) {
    await applyVerificationOutcome(
      result.notificationId,
      result.tenantId,
      callback.status,
      { at: new Date(), errorMessage: callback.errorMessage },
      prisma,
    );
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

type VerifyOutcome =
  | { ok: true; callback: DeliveryCallback | null; skipped?: string }
  | { ok: false; reason: string };

/** The platform's own scheme: HMAC-SHA256 over `timestamp.rawBody`. */
function verifyPlatformRequest(request: NextRequest, rawBody: string): VerifyOutcome {
  const verdict = verifyWebhook({
    secret: process.env.SMS_WEBHOOK_SECRET,
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    rawBody,
    now: new Date(),
  });
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: 'MALFORMED_JSON' };
  }

  const callback = parseDeliveryCallback(parsed);
  if (!callback) return { ok: false, reason: 'UNRECOGNISED_PAYLOAD' };
  return { ok: true, callback };
}

/**
 * Twilio's scheme. The signed value includes the FULL request URL, which must
 * match what Twilio was configured to call — so `TWILIO_STATUS_CALLBACK_URL`
 * is used as the canonical URL rather than reconstructing it from headers a
 * proxy may have rewritten. A mismatch there fails verification, which is the
 * correct outcome: it means the deployment and the vendor disagree about this
 * endpoint's address.
 */
function verifyTwilioRequest(request: NextRequest, rawBody: string): VerifyOutcome {
  const params = new URLSearchParams(rawBody);
  const canonicalUrl = process.env.TWILIO_STATUS_CALLBACK_URL?.trim();
  if (!canonicalUrl) return { ok: false, reason: 'NO_CALLBACK_URL_CONFIGURED' };

  const verified = verifyTwilioSignature({
    authToken: process.env.TWILIO_AUTH_TOKEN,
    signature: request.headers.get(TWILIO_SIGNATURE_HEADER),
    url: canonicalUrl,
    params,
  });
  if (!verified) return { ok: false, reason: 'BAD_TWILIO_SIGNATURE' };

  const callback = parseTwilioDeliveryCallback(params);
  // Non-terminal status: verified but nothing to apply.
  return { ok: true, callback, skipped: callback ? undefined : 'NON_TERMINAL_STATUS' };
}
