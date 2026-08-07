import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { getSmsProvider, SmsProviderNotConfigured } from '@/lib/frontdesk/notify/provider';
import { classifyResult, decideRetry } from '@/lib/frontdesk/notify/retry';
import {
  TWILIO_SIGNATURE_HEADER,
  TwilioSmsProvider,
  canonicalTwilioCode,
  isPermanentTwilioCode,
  parseTwilioDeliveryCallback,
  retryableFromStatus,
  twilioFromEnv,
  verifyTwilioSignature,
} from '@/lib/frontdesk/notify/twilio';

/**
 * THE FIRST REAL VENDOR
 *
 * Every test here runs against an injected fetch. Nothing reaches the network,
 * nothing needs an account, and no test can accidentally send a message —
 * which is the same property the mock provider was built for, applied to the
 * adapter that CAN spend money.
 *
 * The assertions concentrate on the two places a vendor adapter goes wrong in
 * ways the rest of the system cannot detect: calling a failure a success, and
 * getting retryability backwards. The first sends nobody an alert while the
 * dashboard shows green; the second either burns budget on a message that can
 * never arrive, or gives up on one that would have.
 */

const SID = 'AC' + 'a'.repeat(32);
const TOKEN = 'b'.repeat(32);

const message = {
  to: '+15555550123',
  from: '+15555550100',
  body: 'URGENT: food safety report',
  reference: 'notification-1',
  idempotencyKey: 'notification-1:0',
};

function respond(status: number, body: unknown, ok = status < 400) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function providerWith(fetchImpl: typeof fetch) {
  return new TwilioSmsProvider({ accountSid: SID, authToken: TOKEN }, fetchImpl);
}

describe('Twilio adapter construction', () => {
  it('refuses to construct without credentials', () => {
    expect(() => new TwilioSmsProvider({ accountSid: '', authToken: TOKEN })).toThrow();
    expect(() => new TwilioSmsProvider({ accountSid: SID, authToken: '' })).toThrow();
  });

  it('is never marked simulated', () => {
    // A real adapter reporting `simulated: true` would let the dashboard label
    // real messages as fake, and vice versa.
    expect(providerWith(vi.fn()).simulated).toBe(false);
    expect(providerWith(vi.fn()).name).toBe('twilio');
  });

  it('names every missing environment variable at once', () => {
    expect(() => twilioFromEnv({})).toThrow(/TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN/);
  });

  it('rejects an account SID that is obviously not one', () => {
    // Fails at startup with a clear message rather than as a 401 on the first
    // food-safety alert.
    expect(() => twilioFromEnv({ TWILIO_ACCOUNT_SID: 'not-a-sid', TWILIO_AUTH_TOKEN: TOKEN })).toThrow(/Account SID/);
  });

  it('constructs from a well-formed environment', () => {
    expect(() => twilioFromEnv({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN })).not.toThrow();
  });
});

describe('Twilio send', () => {
  it('posts form-encoded to the Messages endpoint with basic auth', async () => {
    const fetchImpl = vi.fn(async () => respond(201, { sid: 'SM1', status: 'queued' }));
    await providerWith(fetchImpl as unknown as typeof fetch).send(message);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/Accounts/${SID}/Messages.json`);
    expect((init.headers as Record<string, string>).authorization).toMatch(/^Basic /);
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/x-www-form-urlencoded');

    const body = init.body as URLSearchParams;
    expect(body.get('To')).toBe(message.to);
    expect(body.get('From')).toBe(message.from);
    expect(body.get('Body')).toBe(message.body);
  });

  it('does not leak the auth token into the URL', async () => {
    const fetchImpl = vi.fn(async () => respond(201, { sid: 'SM1', status: 'queued' }));
    await providerWith(fetchImpl as unknown as typeof fetch).send(message);
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).not.toContain(TOKEN);
  });

  it('includes a status callback only when one is configured', async () => {
    const withCallback = vi.fn(async () => respond(201, { sid: 'SM1', status: 'queued' }));
    await new TwilioSmsProvider(
      { accountSid: SID, authToken: TOKEN, statusCallbackUrl: 'https://example.invalid/hook' },
      withCallback as unknown as typeof fetch,
    ).send(message);
    expect(((withCallback.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams).get('StatusCallback')).toBe(
      'https://example.invalid/hook',
    );

    const without = vi.fn(async () => respond(201, { sid: 'SM1', status: 'queued' }));
    await providerWith(without as unknown as typeof fetch).send(message);
    expect(((without.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams).has('StatusCallback')).toBe(
      false,
    );
  });

  it('forwards the idempotency key as a header for support tracing', async () => {
    // Twilio has no idempotency mechanism of its own, so this is a breadcrumb
    // rather than protection. The test pins that we send it anyway.
    const fetchImpl = vi.fn(async () => respond(201, { sid: 'SM1', status: 'queued' }));
    await providerWith(fetchImpl as unknown as typeof fetch).send(message);
    const headers = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['x-wbi-idempotency-key']).toBe(message.idempotencyKey);
  });

  it('accepts a queued message and returns the sid', async () => {
    const result = await providerWith(
      vi.fn(async () => respond(201, { sid: 'SM123', status: 'queued' })) as unknown as typeof fetch,
    ).send(message);
    expect(result).toMatchObject({ status: 'ACCEPTED', providerMessageId: 'SM123' });
  });

  it('does NOT report success when Twilio returns 2xx with no sid', async () => {
    // Without a sid there is no way to match a delivery receipt later, so the
    // send is unusable even though the HTTP call succeeded.
    const result = await providerWith(
      vi.fn(async () => respond(201, { status: 'queued' })) as unknown as typeof fetch,
    ).send(message);
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'NO_MESSAGE_SID', retryable: true });
  });

  it('does NOT report success when a 2xx body says the message failed', async () => {
    const result = await providerWith(
      vi.fn(async () => respond(201, { sid: 'SM1', status: 'failed', error_code: 21610 })) as unknown as typeof fetch,
    ).send(message);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('RECIPIENT_OPTED_OUT');
    expect(result.retryable).toBe(false);
  });

  it('treats an unreadable success body as a failure rather than a send', async () => {
    const broken = {
      ok: true,
      status: 201,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response;
    const result = await providerWith(vi.fn(async () => broken) as unknown as typeof fetch).send(message);
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'MALFORMED_RESPONSE' });
  });

  it('maps a network error to a retryable failure', async () => {
    const result = await providerWith(
      vi.fn(async () => {
        throw new Error('ECONNRESET');
      }) as unknown as typeof fetch,
    ).send(message);
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'NETWORK_ERROR', retryable: true });
  });

  it('maps an abort to a timeout, and retries it', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const result = await providerWith(
      vi.fn(async () => {
        throw abort;
      }) as unknown as typeof fetch,
    ).send(message);
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'TIMEOUT', retryable: true });
  });
});

describe('Twilio error classification', () => {
  it.each([
    ['21211', 'INVALID_NUMBER'],
    ['21610', 'RECIPIENT_OPTED_OUT'],
    ['30003', 'UNREACHABLE_DESTINATION'],
    ['30007', 'BLOCKED'],
  ])('maps Twilio %s onto the vendor-neutral code %s', (twilio, canonical) => {
    expect(canonicalTwilioCode(twilio)).toBe(canonical);
  });

  it('prefixes an unknown code rather than dropping it', () => {
    expect(canonicalTwilioCode('99999')).toBe('TWILIO_99999');
    expect(canonicalTwilioCode(null)).toBeNull();
  });

  it.each(['21211', '21610', '30003', '30004', '30007', '21606'])('treats %s as permanent', (code) => {
    expect(isPermanentTwilioCode(code)).toBe(true);
  });

  it('does not treat rate limiting as permanent', () => {
    // 429 is a 4xx and is exactly the case where waiting helps.
    expect(retryableFromStatus(429)).toBe(true);
    expect(retryableFromStatus(500)).toBe(true);
    expect(retryableFromStatus(503)).toBe(true);
  });

  it('treats ordinary 4xx as permanent', () => {
    expect(retryableFromStatus(400)).toBe(false);
    expect(retryableFromStatus(401)).toBe(false);
    expect(retryableFromStatus(404)).toBe(false);
  });

  it('retries a 429 through the shared retry policy', async () => {
    const result = await providerWith(
      vi.fn(async () => respond(429, { code: 20429, message: 'Too Many Requests' })) as unknown as typeof fetch,
    ).send(message);
    expect(result.retryable).toBe(true);

    const decision = decideRetry(classifyResult(result), 1, new Date('2025-01-01T00:00:00Z'), 'ref');
    expect(decision.action).toBe('RETRY');
  });

  it('abandons an opted-out recipient on the first attempt', async () => {
    const result = await providerWith(
      vi.fn(async () => respond(400, { code: 21610, message: 'opted out' })) as unknown as typeof fetch,
    ).send(message);

    const decision = decideRetry(classifyResult(result), 1, new Date(), 'ref');
    expect(decision).toEqual({ action: 'ABANDON', reason: 'NON_RETRYABLE' });
  });
});

describe('Twilio delivery receipts', () => {
  const params = (entries: Record<string, string>) => new URLSearchParams(entries);

  it('maps delivered and undelivered', () => {
    expect(parseTwilioDeliveryCallback(params({ MessageSid: 'SM1', MessageStatus: 'delivered' }))).toMatchObject({
      providerMessageId: 'SM1',
      status: 'DELIVERED',
    });
    expect(parseTwilioDeliveryCallback(params({ MessageSid: 'SM1', MessageStatus: 'undelivered' }))).toMatchObject({
      status: 'UNDELIVERED',
    });
    expect(parseTwilioDeliveryCallback(params({ MessageSid: 'SM1', MessageStatus: 'failed' }))).toMatchObject({
      status: 'UNDELIVERED',
    });
  });

  it('does NOT treat Twilio "sent" as delivered', () => {
    // Twilio's "sent" means handed to the carrier. Treating it as delivery is
    // the exact conflation this system exists to avoid.
    expect(parseTwilioDeliveryCallback(params({ MessageSid: 'SM1', MessageStatus: 'sent' }))).toBeNull();
  });

  it.each(['queued', 'sending', 'accepted'])('ignores the non-terminal status %s', (status) => {
    expect(parseTwilioDeliveryCallback(params({ MessageSid: 'SM1', MessageStatus: status }))).toBeNull();
  });

  it('carries the error code through on an undelivered receipt', () => {
    const parsed = parseTwilioDeliveryCallback(
      params({ MessageSid: 'SM1', MessageStatus: 'undelivered', ErrorCode: '30003' }),
    );
    expect(parsed?.errorCode).toBe('UNREACHABLE_DESTINATION');
  });

  it('accepts the legacy SmsSid/SmsStatus field names', () => {
    expect(parseTwilioDeliveryCallback(params({ SmsSid: 'SM9', SmsStatus: 'delivered' }))).toMatchObject({
      providerMessageId: 'SM9',
      status: 'DELIVERED',
    });
  });

  it('rejects a callback with no message id', () => {
    expect(parseTwilioDeliveryCallback(params({ MessageStatus: 'delivered' }))).toBeNull();
  });
});

describe('Twilio signature verification', () => {
  const url = 'https://example.invalid/api/frontdesk/notifications/webhook';

  function sign(params: URLSearchParams, token = TOKEN, signedUrl = url): string {
    const keys = [...new Set([...params.keys()])].sort();
    let payload = signedUrl;
    for (const key of keys) for (const value of params.getAll(key)) payload += key + value;
    return createHmac('sha1', token).update(payload, 'utf8').digest('base64');
  }

  const params = new URLSearchParams({ MessageSid: 'SM1', MessageStatus: 'delivered', AccountSid: SID });

  it('accepts a correctly signed callback', () => {
    expect(verifyTwilioSignature({ authToken: TOKEN, signature: sign(params), url, params })).toBe(true);
  });

  it('fails closed with no auth token', () => {
    // Never "trust everything" because a variable is unset.
    expect(verifyTwilioSignature({ authToken: undefined, signature: sign(params), url, params })).toBe(false);
    expect(verifyTwilioSignature({ authToken: '', signature: sign(params), url, params })).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyTwilioSignature({ authToken: TOKEN, signature: null, url, params })).toBe(false);
  });

  it('rejects a signature computed with a different token', () => {
    expect(verifyTwilioSignature({ authToken: TOKEN, signature: sign(params, 'wrong-token'), url, params })).toBe(false);
  });

  it('rejects a signature computed over a different URL', () => {
    // The URL is part of the signed value, so a callback replayed at another
    // endpoint does not verify.
    const other = 'https://example.invalid/some/other/path';
    expect(verifyTwilioSignature({ authToken: TOKEN, signature: sign(params, TOKEN, other), url, params })).toBe(false);
  });

  it('rejects a tampered parameter', () => {
    const signature = sign(params);
    const tampered = new URLSearchParams({ MessageSid: 'SM1', MessageStatus: 'undelivered', AccountSid: SID });
    expect(verifyTwilioSignature({ authToken: TOKEN, signature, url, params: tampered })).toBe(false);
  });

  it('rejects an added parameter', () => {
    const signature = sign(params);
    const extended = new URLSearchParams(params);
    extended.set('ErrorCode', '30003');
    expect(verifyTwilioSignature({ authToken: TOKEN, signature, url, params: extended })).toBe(false);
  });

  it('sorts parameters, so field order does not change the result', () => {
    const reordered = new URLSearchParams({ AccountSid: SID, MessageStatus: 'delivered', MessageSid: 'SM1' });
    expect(verifyTwilioSignature({ authToken: TOKEN, signature: sign(params), url, params: reordered })).toBe(true);
  });

  it('exposes the header name it expects', () => {
    expect(TWILIO_SIGNATURE_HEADER).toBe('x-twilio-signature');
  });
});

describe('provider resolution', () => {
  it('returns null when nothing is configured', async () => {
    await expect(getSmsProvider({})).resolves.toBeNull();
  });

  it('resolves the mock outside production', async () => {
    const provider = await getSmsProvider({ SMS_PROVIDER: 'mock' });
    expect(provider?.simulated).toBe(true);
  });

  it('refuses the mock in production', async () => {
    await expect(getSmsProvider({ SMS_PROVIDER: 'mock', NODE_ENV: 'production' })).rejects.toBeInstanceOf(
      SmsProviderNotConfigured,
    );
  });

  it('resolves Twilio when credentials are present', async () => {
    const provider = await getSmsProvider({
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: SID,
      TWILIO_AUTH_TOKEN: TOKEN,
    });
    expect(provider?.name).toBe('twilio');
    expect(provider?.simulated).toBe(false);
  });

  it('refuses Twilio with missing credentials, without leaking any value', async () => {
    const promise = getSmsProvider({ SMS_PROVIDER: 'twilio', TWILIO_AUTH_TOKEN: TOKEN });
    await expect(promise).rejects.toBeInstanceOf(SmsProviderNotConfigured);
    await expect(promise).rejects.toThrow(/TWILIO_ACCOUNT_SID/);
    // The token that WAS supplied must not appear in the error.
    await promise.catch((error: Error) => expect(error.message).not.toContain(TOKEN));
  });

  it('names the supported adapters when asked for an unknown one', async () => {
    await expect(getSmsProvider({ SMS_PROVIDER: 'carrier-pigeon' })).rejects.toThrow(/"mock", "twilio"/);
  });
});
