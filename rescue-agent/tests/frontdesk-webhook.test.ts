import { describe, expect, it } from 'vitest';
import {
  MAX_SKEW_SECONDS,
  parseDeliveryCallback,
  signPayload,
  verifyWebhook,
} from '@/lib/frontdesk/notify/webhook';

/**
 * DELIVERY-STATUS WEBHOOK
 *
 * The only route a third party is meant to reach, so it is tested as hostile
 * input. The specific harm being prevented: a forged callback marking a failed
 * escalation alert as DELIVERED, which would hide from an operator that a
 * manager was never reached.
 */

const SECRET = 'test-webhook-secret';
const now = new Date('2026-08-07T12:00:00Z');
const timestamp = String(Math.floor(now.getTime() / 1000));
const body = JSON.stringify({ providerMessageId: 'mock_123', status: 'DELIVERED' });

const valid = {
  secret: SECRET,
  signature: signPayload(SECRET, timestamp, body),
  timestamp,
  rawBody: body,
  now,
};

describe('signature verification', () => {
  it('accepts a correctly signed, current request', () => {
    expect(verifyWebhook(valid)).toEqual({ ok: true });
  });

  it('FAILS CLOSED when no secret is configured', () => {
    // Unsetting a variable must never turn verification off.
    expect(verifyWebhook({ ...valid, secret: undefined })).toEqual({
      ok: false,
      reason: 'NO_SECRET_CONFIGURED',
    });
  });

  it('rejects a request signed with the wrong secret', () => {
    expect(verifyWebhook({ ...valid, signature: signPayload('wrong-secret', timestamp, body) })).toEqual({
      ok: false,
      reason: 'BAD_SIGNATURE',
    });
  });

  it('rejects a missing signature', () => {
    expect(verifyWebhook({ ...valid, signature: null })).toEqual({ ok: false, reason: 'MISSING_SIGNATURE' });
  });

  it('rejects a missing timestamp', () => {
    expect(verifyWebhook({ ...valid, timestamp: null })).toEqual({ ok: false, reason: 'MISSING_TIMESTAMP' });
  });

  it.each([['not-a-number'], ['12'], ['1e10'], ['-1700000000']])('rejects the malformed timestamp %j', (value) => {
    expect(verifyWebhook({ ...valid, timestamp: value }).ok).toBe(false);
  });

  it('rejects a replayed callback from the past', () => {
    // A captured "DELIVERED" callback must not be replayable later to mask a
    // subsequent failure.
    const old = String(Math.floor(now.getTime() / 1000) - MAX_SKEW_SECONDS - 60);
    expect(
      verifyWebhook({ ...valid, timestamp: old, signature: signPayload(SECRET, old, body) }),
    ).toEqual({ ok: false, reason: 'STALE_TIMESTAMP' });
  });

  it('rejects a timestamp from the future', () => {
    const future = String(Math.floor(now.getTime() / 1000) + MAX_SKEW_SECONDS + 60);
    expect(
      verifyWebhook({ ...valid, timestamp: future, signature: signPayload(SECRET, future, body) }),
    ).toEqual({ ok: false, reason: 'STALE_TIMESTAMP' });
  });

  it('accepts a small clock skew in either direction', () => {
    for (const offset of [-60, 60]) {
      const shifted = String(Math.floor(now.getTime() / 1000) + offset);
      expect(
        verifyWebhook({ ...valid, timestamp: shifted, signature: signPayload(SECRET, shifted, body) }).ok,
      ).toBe(true);
    }
  });

  it('rejects a body altered after signing', () => {
    const tampered = JSON.stringify({ providerMessageId: 'mock_999', status: 'DELIVERED' });
    expect(verifyWebhook({ ...valid, rawBody: tampered })).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
  });

  it('binds the timestamp into the signature, so it cannot be swapped', () => {
    // Re-using a valid signature with a fresher timestamp must not verify.
    const fresher = String(Math.floor(now.getTime() / 1000) + 30);
    expect(verifyWebhook({ ...valid, timestamp: fresher }).ok).toBe(false);
  });

  it('signs the raw bytes, so re-ordered JSON is a different payload', () => {
    // Verifying a re-serialised object would let an attacker vary the payload
    // in ways that survive a JSON round-trip.
    const reordered = JSON.stringify({ status: 'DELIVERED', providerMessageId: 'mock_123' });
    expect(reordered).not.toBe(body);
    expect(verifyWebhook({ ...valid, rawBody: reordered }).ok).toBe(false);
  });
});

describe('callback payload parsing', () => {
  it('accepts a well-formed delivery callback', () => {
    expect(parseDeliveryCallback({ providerMessageId: 'mock_1', status: 'DELIVERED' })).toEqual({
      providerMessageId: 'mock_1',
      status: 'DELIVERED',
      errorCode: null,
      errorMessage: null,
    });
  });

  it('accepts an undelivered callback with a reason', () => {
    const parsed = parseDeliveryCallback({
      providerMessageId: 'mock_1',
      status: 'UNDELIVERED',
      errorCode: 'HANDSET_UNREACHABLE',
      errorMessage: 'Phone switched off',
    });
    expect(parsed?.status).toBe('UNDELIVERED');
    expect(parsed?.errorCode).toBe('HANDSET_UNREACHABLE');
  });

  it.each([
    ['null', null],
    ['a string', 'DELIVERED'],
    ['no message id', { status: 'DELIVERED' }],
    ['empty message id', { providerMessageId: '', status: 'DELIVERED' }],
    ['unknown status', { providerMessageId: 'm', status: 'MAYBE' }],
    ['status we do not set', { providerMessageId: 'm', status: 'SENT' }],
    ['numeric message id', { providerMessageId: 123, status: 'DELIVERED' }],
  ])('rejects %s', (_label, payload) => {
    expect(parseDeliveryCallback(payload)).toBeNull();
  });

  it('bounds oversized fields rather than storing them whole', () => {
    const parsed = parseDeliveryCallback({
      providerMessageId: 'mock_1',
      status: 'UNDELIVERED',
      errorMessage: 'x'.repeat(10_000),
    });
    expect((parsed?.errorMessage ?? '').length).toBeLessThanOrEqual(200);
  });

  it('rejects an absurdly long message id before it reaches a database lookup', () => {
    expect(parseDeliveryCallback({ providerMessageId: 'x'.repeat(5000), status: 'DELIVERED' })).toBeNull();
  });
});
