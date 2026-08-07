import { randomUUID } from 'node:crypto';
import type { SmsMessage, SmsProvider, SmsSendResult } from './provider';

/**
 * MOCK SMS PROVIDER
 *
 * Exercises the whole notification pipeline — accept, fail, retry, abandon,
 * delivery callback — with no network, no account and no cost.
 *
 * Behaviour is driven by the destination number so tests are deterministic and
 * a human can reproduce any path by hand. The trigger numbers are all in the
 * 555-01xx range reserved for fiction, so none of them can collide with a real
 * handset even if one leaked into a live configuration.
 */

/** Last four digits that steer the mock into a specific outcome. */
export const MOCK_BEHAVIOURS = {
  /** Provider rejects permanently — retrying can never help. */
  PERMANENT_FAILURE: '0001',
  /** Provider errors transiently — a retry may succeed. */
  TRANSIENT_FAILURE: '0002',
  /** Fails transiently forever, to prove retries stay bounded. */
  ALWAYS_TRANSIENT: '0003',
  /** Destination has opted out of messages. Never retryable. */
  OPTED_OUT: '0004',
} as const;

/** Attempt counter per reference, so TRANSIENT_FAILURE can succeed on retry. */
const attemptsByReference = new Map<string, number>();

/**
 * Results already returned for an idempotency key. A real vendor keeps this
 * server-side; the mock keeps it here so duplicate-send protection can be
 * tested rather than assumed.
 */
const resultsByIdempotencyKey = new Map<string, SmsSendResult>();

/** Everything the mock "sent". Inspectable by tests and the staging harness. */
export interface MockSentMessage {
  to: string;
  from: string;
  body: string;
  reference: string;
  providerMessageId: string;
  sentAt: Date;
}

const outbox: MockSentMessage[] = [];

export function mockOutbox(): readonly MockSentMessage[] {
  return outbox;
}

export function resetMockProvider(): void {
  outbox.length = 0;
  attemptsByReference.clear();
  resultsByIdempotencyKey.clear();
}

export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';
  /** Surfaced in the UI so a simulated send is never mistaken for a real one. */
  readonly simulated = true;

  async send(message: SmsMessage): Promise<SmsSendResult> {
    // Replaying the same attempt returns the original result without sending
    // again — this is what stops a crashed-and-restarted worker from texting a
    // manager twice.
    const seen = resultsByIdempotencyKey.get(message.idempotencyKey);
    if (seen) return seen;

    const digits = message.to.replace(/\D/g, '');
    const suffix = digits.slice(-4);
    const attempt = (attemptsByReference.get(message.reference) ?? 0) + 1;
    attemptsByReference.set(message.reference, attempt);

    const remember = (result: SmsSendResult): SmsSendResult => {
      resultsByIdempotencyKey.set(message.idempotencyKey, result);
      return result;
    };

    if (suffix === MOCK_BEHAVIOURS.PERMANENT_FAILURE) {
      return remember({
        status: 'FAILED',
        errorCode: 'INVALID_NUMBER',
        errorMessage: 'The destination number is not valid',
        retryable: false,
      });
    }

    if (suffix === MOCK_BEHAVIOURS.OPTED_OUT) {
      return remember({
        status: 'FAILED',
        errorCode: 'RECIPIENT_OPTED_OUT',
        errorMessage: 'The recipient has opted out of messages from this sender',
        retryable: false,
      });
    }

    if (suffix === MOCK_BEHAVIOURS.ALWAYS_TRANSIENT) {
      return remember({
        status: 'FAILED',
        errorCode: 'PROVIDER_UNAVAILABLE',
        errorMessage: 'Temporary provider outage',
        retryable: true,
      });
    }

    // Fails once, then succeeds — the ordinary transient case.
    if (suffix === MOCK_BEHAVIOURS.TRANSIENT_FAILURE && attempt === 1) {
      return remember({
        status: 'FAILED',
        errorCode: 'TIMEOUT',
        errorMessage: 'Request to provider timed out',
        retryable: true,
      });
    }

    const providerMessageId = `mock_${randomUUID()}`;
    outbox.push({
      to: message.to,
      from: message.from,
      body: message.body,
      reference: message.reference,
      providerMessageId,
      sentAt: new Date(),
    });

    return remember({ status: 'ACCEPTED', providerMessageId, retryable: false });
  }
}
