import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * DELIVERY-STATUS WEBHOOK VERIFICATION
 *
 * This endpoint is the one place a provider reaches into the system from
 * outside, so it is treated as hostile input:
 *
 *   - The body is authenticated with an HMAC over the RAW bytes. Verifying a
 *     re-serialised object would let an attacker alter the payload in ways
 *     that survive a round-trip through JSON.
 *   - A timestamp is required and must be recent, so a captured callback
 *     cannot be replayed days later to mark a failed alert as delivered.
 *   - Comparison is constant-time.
 *   - Absent a configured secret, verification FAILS. It must never be
 *     possible to make the endpoint trust everything by unsetting a variable.
 */

export const SIGNATURE_HEADER = 'x-wbi-signature';
export const TIMESTAMP_HEADER = 'x-wbi-timestamp';

/** How far out of date a callback may be. Providers retry for minutes, not days. */
export const MAX_SKEW_SECONDS = 300;

export type WebhookVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'NO_SECRET_CONFIGURED'
        | 'MISSING_SIGNATURE'
        | 'MISSING_TIMESTAMP'
        | 'MALFORMED_TIMESTAMP'
        | 'STALE_TIMESTAMP'
        | 'BAD_SIGNATURE';
    };

/** The value signed is `timestamp.rawBody`, binding the two together. */
export function signPayload(secret: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyWebhook(options: {
  secret: string | undefined;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  now: Date;
}): WebhookVerdict {
  const { secret, signature, timestamp, rawBody, now } = options;

  // Fail closed: no secret means no trust, never "trust everything".
  if (!secret) return { ok: false, reason: 'NO_SECRET_CONFIGURED' };
  if (!signature) return { ok: false, reason: 'MISSING_SIGNATURE' };
  if (!timestamp) return { ok: false, reason: 'MISSING_TIMESTAMP' };

  const sentAtSeconds = Number(timestamp);
  if (!Number.isFinite(sentAtSeconds) || !/^\d{9,11}$/.test(timestamp)) {
    return { ok: false, reason: 'MALFORMED_TIMESTAMP' };
  }

  const skewSeconds = Math.abs(now.getTime() / 1000 - sentAtSeconds);
  if (skewSeconds > MAX_SKEW_SECONDS) return { ok: false, reason: 'STALE_TIMESTAMP' };

  const expected = signPayload(secret, timestamp, rawBody);
  if (!safeEqual(expected, signature)) return { ok: false, reason: 'BAD_SIGNATURE' };

  return { ok: true };
}

/**
 * Provider-neutral shape of a delivery callback. A real vendor adapter maps
 * its own payload onto this, so the route never learns vendor vocabulary.
 */
export interface DeliveryCallback {
  providerMessageId: string;
  status: 'DELIVERED' | 'UNDELIVERED';
  errorCode: string | null;
  errorMessage: string | null;
}

export function parseDeliveryCallback(value: unknown): DeliveryCallback | null {
  if (typeof value !== 'object' || value === null) return null;
  const body = value as Record<string, unknown>;

  const providerMessageId = body.providerMessageId;
  const status = body.status;
  if (typeof providerMessageId !== 'string' || providerMessageId.length === 0 || providerMessageId.length > 200) {
    return null;
  }
  if (status !== 'DELIVERED' && status !== 'UNDELIVERED') return null;

  const asString = (raw: unknown): string | null =>
    typeof raw === 'string' && raw.length > 0 ? raw.slice(0, 200) : null;

  return {
    providerMessageId,
    status,
    errorCode: asString(body.errorCode),
    errorMessage: asString(body.errorMessage),
  };
}
