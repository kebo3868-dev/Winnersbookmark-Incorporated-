import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SmsMessage, SmsProvider, SmsSendResult } from './provider';

/**
 * TWILIO ADAPTER
 *
 * The first real vendor behind `SmsProvider`. Everything above this file —
 * dispatch, retries, the failure queue, the dashboard — is unchanged by its
 * existence, which is the point of the interface.
 *
 * Written against Twilio's REST API with `fetch` rather than the vendor SDK.
 * The SDK is a large dependency that pulls its own HTTP stack, retry logic and
 * logging into a codebase that already has considered opinions about all three
 * — and its retries would sit *underneath* our bounded-retry policy, silently
 * multiplying attempts we thought we had capped.
 *
 * NOTHING HERE RUNS WITHOUT CREDENTIALS. The adapter refuses to construct
 * without them, so importing this module cannot accidentally start sending.
 */

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

/** Header Twilio signs its status callbacks with. */
export const TWILIO_SIGNATURE_HEADER = 'x-twilio-signature';

/** Abort a hung request rather than holding a worker lease until it expires. */
const REQUEST_TIMEOUT_MS = 10_000;

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  /**
   * Where Twilio posts delivery receipts. Optional: without it, messages still
   * send but never progress past SENT, so the dashboard cannot distinguish
   * "handed to the carrier" from "reached a handset".
   */
  statusCallbackUrl?: string;
}

/**
 * Twilio error codes that no amount of retrying will fix.
 *
 * Curated deliberately rather than treating every 4xx as permanent: 429 is a
 * 4xx and is exactly the case where waiting helps. Codes are Twilio's own
 * numeric ones, documented at twilio.com/docs/api/errors.
 */
const PERMANENT_TWILIO_CODES = new Set([
  '21211', // Invalid 'To' phone number
  '21214', // 'To' phone number cannot be reached
  '21217', // Phone number does not appear to be valid
  '21219', // 'To' number not verified (trial accounts)
  '21408', // Permission to send to this region not enabled
  '21606', // The 'From' number is not a valid, SMS-capable number on this account
  '21610', // Recipient has opted out (STOP)
  '21612', // Cannot route to this number
  '21614', // 'To' number is not a valid mobile number
  '30003', // Unreachable destination handset
  '30004', // Message blocked
  '30005', // Unknown destination handset
  '30006', // Landline or unreachable carrier
  '30007', // Carrier filtered (spam) — retrying re-sends into the same filter
]);

/**
 * Map a Twilio numeric code onto the vendor-neutral codes the retry policy
 * already treats as always-permanent, so `classifyResult` keeps working
 * without learning Twilio's vocabulary.
 */
const CANONICAL_CODES: Record<string, string> = {
  '21211': 'INVALID_NUMBER',
  '21214': 'UNREACHABLE_DESTINATION',
  '21217': 'INVALID_NUMBER',
  '21610': 'RECIPIENT_OPTED_OUT',
  '21612': 'UNREACHABLE_DESTINATION',
  '21614': 'INVALID_NUMBER',
  '30003': 'UNREACHABLE_DESTINATION',
  '30004': 'BLOCKED',
  '30005': 'UNREACHABLE_DESTINATION',
  '30006': 'UNREACHABLE_DESTINATION',
  '30007': 'BLOCKED',
};

export function canonicalTwilioCode(twilioCode: string | null | undefined): string | null {
  if (!twilioCode) return null;
  return CANONICAL_CODES[twilioCode] ?? `TWILIO_${twilioCode}`;
}

export function isPermanentTwilioCode(twilioCode: string | null | undefined): boolean {
  return Boolean(twilioCode && PERMANENT_TWILIO_CODES.has(twilioCode));
}

/**
 * Decide retryability from the HTTP status when there is no usable code.
 *
 * 429 and 5xx are the wait-and-see cases. Everything else in 4xx is a request
 * we built wrong, and rebuilding it identically will fail identically.
 */
export function retryableFromStatus(httpStatus: number): boolean {
  if (httpStatus === 429) return true;
  if (httpStatus >= 500) return true;
  if (httpStatus >= 400) return false;
  return true;
}

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  /** Real messages, real money, real handsets. Never simulated. */
  readonly simulated = false;

  private readonly credentials: TwilioCredentials;
  private readonly fetchImpl: typeof fetch;

  constructor(credentials: TwilioCredentials, fetchImpl: typeof fetch = fetch) {
    if (!credentials.accountSid || !credentials.authToken) {
      throw new Error('TwilioSmsProvider requires accountSid and authToken');
    }
    this.credentials = credentials;
    this.fetchImpl = fetchImpl;
  }

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const body = new URLSearchParams({
      To: message.to,
      From: message.from,
      Body: message.body,
    });

    if (this.credentials.statusCallbackUrl) {
      body.set('StatusCallback', this.credentials.statusCallbackUrl);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await this.fetchImpl(
        `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(this.credentials.accountSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            authorization: basicAuthHeader(this.credentials.accountSid, this.credentials.authToken),
            'content-type': 'application/x-www-form-urlencoded',
            // Twilio has NO idempotency header for the Messages resource, so
            // unlike the mock this cannot be deduplicated vendor-side. The key
            // is sent as a header anyway: Twilio ignores unknown headers, and
            // when it appears in a support trace it is the fastest way to tell
            // a duplicate apart from two genuine alerts. Actual duplicate
            // protection is ours — the FOR UPDATE SKIP LOCKED claim and the
            // attempt counter — see notify/store.ts.
            'x-wbi-idempotency-key': message.idempotencyKey,
          },
          body,
          signal: controller.signal,
        },
      );

      return await this.interpret(response);
    } catch (error) {
      // Network failure, DNS, or our own timeout. None of these tell us whether
      // Twilio received the request, so this is retryable and the duplicate
      // risk is accepted — a possibly-doubled food-safety alert beats a
      // possibly-absent one.
      const aborted = error instanceof Error && error.name === 'AbortError';
      return {
        status: 'FAILED',
        errorCode: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: aborted
          ? `No response from Twilio within ${REQUEST_TIMEOUT_MS}ms`
          : truncate(error instanceof Error ? error.message : 'Unknown network error'),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async interpret(response: Response): Promise<SmsSendResult> {
    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      // A body we cannot parse is not a reason to claim success.
      if (response.ok) {
        return {
          status: 'FAILED',
          errorCode: 'MALFORMED_RESPONSE',
          errorMessage: 'Twilio returned a success status with an unreadable body',
          retryable: true,
        };
      }
    }

    if (response.ok) {
      const sid = typeof payload.sid === 'string' ? payload.sid : null;
      if (!sid) {
        // Without a sid there is no way to match a later delivery receipt, so
        // the send is not usable even though Twilio said 2xx.
        return {
          status: 'FAILED',
          errorCode: 'NO_MESSAGE_SID',
          errorMessage: 'Twilio accepted the message but returned no sid',
          retryable: true,
        };
      }

      // Twilio can return a terminal failure state inside a 2xx response.
      const status = typeof payload.status === 'string' ? payload.status : '';
      if (status === 'failed' || status === 'undelivered') {
        const code = numericCode(payload.error_code);
        return {
          status: 'FAILED',
          providerMessageId: sid,
          errorCode: canonicalTwilioCode(code) ?? 'TWILIO_REJECTED',
          errorMessage: truncate(typeof payload.error_message === 'string' ? payload.error_message : status),
          retryable: !isPermanentTwilioCode(code),
        };
      }

      return { status: 'ACCEPTED', providerMessageId: sid, retryable: false };
    }

    const code = numericCode(payload.code);
    return {
      status: 'FAILED',
      errorCode: canonicalTwilioCode(code) ?? `HTTP_${response.status}`,
      errorMessage: truncate(
        typeof payload.message === 'string' ? payload.message : `Twilio returned HTTP ${response.status}`,
      ),
      retryable: isPermanentTwilioCode(code) ? false : retryableFromStatus(response.status),
    };
  }
}

function numericCode(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return raw;
  return null;
}

function basicAuthHeader(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
}

function truncate(value: string, max = 200): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

// --- Delivery receipts -----------------------------------------------------

/**
 * Twilio's status values, mapped onto ours.
 *
 * `sent` deliberately does NOT map to DELIVERED. Twilio's "sent" means handed
 * to the carrier — the exact conflation this system exists to avoid.
 */
const TERMINAL_STATUS: Record<string, 'DELIVERED' | 'UNDELIVERED'> = {
  delivered: 'DELIVERED',
  undelivered: 'UNDELIVERED',
  failed: 'UNDELIVERED',
};

export interface TwilioDeliveryCallback {
  providerMessageId: string;
  status: 'DELIVERED' | 'UNDELIVERED';
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Parse a Twilio status callback (form-encoded, not JSON).
 *
 * Returns null for non-terminal states (`queued`, `sending`, `sent`,
 * `accepted`). Those are progress, not outcomes, and writing them would walk
 * a notification backwards through its own state machine.
 */
export function parseTwilioDeliveryCallback(params: URLSearchParams): TwilioDeliveryCallback | null {
  const sid = params.get('MessageSid') ?? params.get('SmsSid');
  const rawStatus = (params.get('MessageStatus') ?? params.get('SmsStatus') ?? '').toLowerCase();

  if (!sid || sid.length > 200) return null;

  const status = TERMINAL_STATUS[rawStatus];
  if (!status) return null;

  const code = params.get('ErrorCode');
  return {
    providerMessageId: sid,
    status,
    errorCode: canonicalTwilioCode(code),
    errorMessage: code ? `Twilio error ${code}` : null,
  };
}

/**
 * Verify Twilio's `X-Twilio-Signature`.
 *
 * Twilio's scheme, not ours: HMAC-SHA1 over the full request URL with every
 * POST parameter appended in lexicographic key order, keyed with the account
 * auth token, base64-encoded. SHA-1 is Twilio's choice and cannot be changed
 * from this side; it is a signature over a short attacker-visible string with
 * a secret key, where SHA-1's collision weakness does not apply.
 *
 * Fails closed with no token, exactly like the platform's own scheme.
 */
export function verifyTwilioSignature(options: {
  authToken: string | undefined;
  signature: string | null;
  url: string;
  params: URLSearchParams;
}): boolean {
  const { authToken, signature, url, params } = options;
  if (!authToken || !signature) return false;

  const keys = [...new Set([...params.keys()])].sort();
  let payload = url;
  for (const key of keys) {
    // getAll, because Twilio concatenates repeated parameters in order.
    for (const value of params.getAll(key)) payload += key + value;
  }

  const expected = createHmac('sha1', authToken).update(payload, 'utf8').digest('base64');

  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(signature, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Build the adapter from environment variables.
 *
 * Credentials are read by NAME here and never stored in tenant config or the
 * database — the config schema references them by variable name only. Missing
 * credentials throw rather than degrade, because a Twilio adapter that cannot
 * authenticate would fail every send while looking configured.
 */
export function twilioFromEnv(env: Record<string, string | undefined>): TwilioSmsProvider {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();

  const missing = [
    !accountSid ? 'TWILIO_ACCOUNT_SID' : null,
    !authToken ? 'TWILIO_AUTH_TOKEN' : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`SMS_PROVIDER=twilio requires ${missing.join(' and ')}`);
  }

  // A sanity check on shape, so a pasted-in-wrong value fails at startup with
  // a clear message rather than as a 401 on the first food-safety alert.
  if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid as string)) {
    throw new Error('TWILIO_ACCOUNT_SID does not look like a Twilio Account SID (expected "AC" + 32 hex characters)');
  }

  return new TwilioSmsProvider({
    accountSid: accountSid as string,
    authToken: authToken as string,
    statusCallbackUrl: env.TWILIO_STATUS_CALLBACK_URL?.trim() || undefined,
  });
}

// ---------------------------------------------------------------------------
// INBOUND EVENTS
//
// Two parsers, deliberately never one.
//
// A customer text and an unanswered call are different events with different
// consequences: a text opens a conversation the engine answers, an unanswered
// call sends an unprompted recovery message to someone who did not write to us.
// Deriving one from the other — or accepting a payload that could be read as
// either — is how a customer who texted "table for 4?" receives "Sorry we
// missed your call".
//
// So each parser reads only the fields its own event carries, and returns null
// for anything else. A payload cannot satisfy both.
// ---------------------------------------------------------------------------

export interface TwilioInboundSms {
  /** Twilio's message id, used as the deduplication key. */
  eventId: string;
  /** The customer. */
  from: string;
  /** The restaurant's Twilio number this arrived on. */
  to: string;
  body: string;
}

/**
 * Parse an inbound SMS webhook.
 *
 * Requires `Body` — a call status callback never carries one, so a call event
 * cannot be parsed as a message however it is shaped. Requires `MessageSid`
 * specifically rather than accepting `CallSid`, for the same reason.
 */
export function parseTwilioInboundSms(params: URLSearchParams): TwilioInboundSms | null {
  const eventId = params.get('MessageSid') ?? params.get('SmsSid');
  const from = params.get('From');
  const to = params.get('To');
  const body = params.get('Body');

  // A call event carries CallSid and CallStatus and no Body. Refusing here is
  // what stops a voice payload arriving on the SMS route and being treated as
  // a customer message.
  if (params.get('CallStatus') || params.get('CallSid')) return null;

  if (!eventId || eventId.length > 200) return null;
  if (!from || !to) return null;
  if (body === null || body.trim().length === 0 || body.length > 2000) return null;

  return { eventId, from, to, body };
}

/**
 * Call outcomes that mean a customer rang and nobody answered.
 *
 * `completed` is deliberately absent: a completed call was answered, and
 * texting "sorry we missed you" to someone the restaurant just spoke to is
 * worse than sending nothing. `canceled` is absent too — the caller hung up
 * before it rang out, which is not the restaurant failing to answer.
 */
export const MISSED_CALL_STATUSES = new Set(['no-answer', 'busy', 'failed']);

export interface TwilioMissedCall {
  /** Twilio's call id, used as the deduplication key. */
  eventId: string;
  from: string;
  to: string;
  status: string;
}

/**
 * Parse a voice status callback, and only a qualifying missed outcome.
 *
 * Returns null for an answered call, for a non-terminal status, and for
 * anything carrying a message Body — so an SMS payload can never be parsed as
 * a missed call.
 */
export function parseTwilioCallStatus(params: URLSearchParams): TwilioMissedCall | null {
  // Symmetric with the guard above: a message payload is not a call event.
  if (params.get('Body') !== null || params.get('MessageSid')) return null;

  const eventId = params.get('CallSid');
  const from = params.get('From');
  const to = params.get('To');
  // DialCallStatus is what a <Dial> verb reports; CallStatus is the call's own.
  const status = (params.get('DialCallStatus') ?? params.get('CallStatus') ?? '').toLowerCase();

  if (!eventId || eventId.length > 200) return null;
  if (!from || !to) return null;
  if (!MISSED_CALL_STATUSES.has(status)) return null;

  return { eventId, from, to, status };
}
