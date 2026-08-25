import type { NextRequest } from 'next/server';
import { normaliseNumber } from './provider';
import { TWILIO_SIGNATURE_HEADER, verifyTwilioSignature } from './twilio';
import type { TenantRecord } from '../store';

/**
 * SHARED GUARD FOR TWILIO-SHAPED INBOUND WEBHOOKS
 *
 * The SMS route and the voice-status route differ only in what they parse. The
 * things that decide whether a request may be acted on at all are identical,
 * and identical is the point — a security check that is written twice is a
 * security check that will eventually be written two ways.
 *
 * ── WHY THE TENANT COMES FROM THE URL ────────────────────────────────────────
 *
 * The platform's own webhook scheme carries `tenantSlug` inside the signed
 * body. Twilio's does not: its payload names the destination by phone number,
 * and there is no index from number to restaurant — a tenant's sending number
 * lives inside its config JSON.
 *
 * Twilio configures the inbound webhook PER PHONE NUMBER, so the URL can name
 * the restaurant instead. That is why these routes live under
 * `/api/frontdesk/[tenantSlug]/…` rather than at a single shared path.
 *
 * ── WHY THE `To` CHECK IS NOT OPTIONAL ───────────────────────────────────────
 *
 * Twilio signs with the ACCOUNT auth token, which is shared by every number on
 * the account. So a signature proves "this came from our Twilio account" — it
 * does NOT prove which restaurant it was for, and the slug in the URL is
 * attacker-shaped. Without binding the payload's `To` to the tenant's own
 * configured sending number, a validly signed message for restaurant A could
 * be replayed at restaurant B's URL and be delivered into B's conversations.
 *
 * That is the whole reason this file exists rather than a signature check
 * inline in each route.
 */

export type TwilioGuardResult =
  | { ok: true; params: URLSearchParams }
  | { ok: false; status: number; reason: string; credentialPresented: boolean };

export function twilioCredentialPresented(request: NextRequest): boolean {
  const value = request.headers.get(TWILIO_SIGNATURE_HEADER);
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Verify a Twilio webhook and bind it to one restaurant.
 *
 * `rawBody` is the exact bytes received. Twilio signs the URL plus the sorted
 * parameters, so the parameters must be reconstructed from the same bytes that
 * arrived — re-serialising a parsed object would sign a different string.
 */
export function verifyTwilioWebhook(options: {
  request: NextRequest;
  rawBody: string;
  tenant: TenantRecord | null;
  /** The public URL Twilio signed. Must match the configured webhook exactly. */
  url: string;
  env?: Record<string, string | undefined>;
}): TwilioGuardResult {
  const { request, rawBody, tenant, url } = options;
  const env = options.env ?? process.env;
  const presented = twilioCredentialPresented(request);

  // Nothing presented cannot possibly verify. Refused before any parsing, any
  // tenant read and any write — the no-credential/no-database-work rule the
  // rest of the webhook surface already follows.
  if (!presented) {
    return { ok: false, status: 401, reason: 'NO_SIGNATURE', credentialPresented: false };
  }

  const params = new URLSearchParams(rawBody);

  const verified = verifyTwilioSignature({
    authToken: env.TWILIO_AUTH_TOKEN?.trim(),
    signature: request.headers.get(TWILIO_SIGNATURE_HEADER),
    url,
    params,
  });
  if (!verified) {
    return { ok: false, status: 401, reason: 'BAD_SIGNATURE', credentialPresented: true };
  }

  // Uniform with the platform webhook: an unknown restaurant and a bad
  // signature are indistinguishable to the caller, so the endpoint cannot be
  // used to discover which restaurants are on the platform.
  if (!tenant) {
    return { ok: false, status: 401, reason: 'UNKNOWN_TENANT', credentialPresented: true };
  }

  // The binding. A signature is account-wide; this is what makes the slug in
  // the URL trustworthy.
  const configured = tenant.config.messaging.fromNumber
    ? normaliseNumber(tenant.config.messaging.fromNumber)
    : null;
  const destination = normaliseNumber(params.get('To') ?? '');
  if (!configured || !destination || configured !== destination) {
    return { ok: false, status: 401, reason: 'DESTINATION_MISMATCH', credentialPresented: true };
  }

  return { ok: true, params };
}

/**
 * The URL Twilio signed.
 *
 * Twilio signs the address it was configured with. Behind a proxy, `request.url`
 * can carry the internal host, so the forwarded headers are preferred when
 * present — a mismatch here fails every signature and is maddening to diagnose.
 */
export function signedRequestUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (proto && host) {
    const url = new URL(request.url);
    return `${proto}://${host}${url.pathname}${url.search}`;
  }
  return request.url;
}
