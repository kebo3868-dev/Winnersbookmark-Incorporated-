import type { EmailMessage, EmailProvider, EmailSendResult } from './provider';

/**
 * Mock email provider.
 *
 * Offline and deterministic, so the notification path is testable without an
 * account, a verified domain, or a sending reputation.
 *
 * REFUSED IN PRODUCTION, exactly like the SMS mock. A deployment that silently
 * fell back to this would record escalation alerts as ACCEPTED while no mail
 * left the building — the precise failure the front desk's alerting exists to
 * make impossible.
 */
export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  readonly simulated = true;

  /** Sent messages, for assertions. Never persisted. */
  readonly sent: EmailMessage[] = [];
  private readonly seen = new Map<string, EmailSendResult>();
  private readonly behaviour: MockEmailBehaviour;

  constructor(behaviour: MockEmailBehaviour = {}) {
    if (process.env.NODE_ENV === 'production' && !behaviour.allowInProduction) {
      throw new Error(
        'MockEmailProvider refused in production: alerts would be recorded as accepted while no mail is sent. ' +
          'Configure a real email provider.',
      );
    }
    this.behaviour = behaviour;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    // Model vendor idempotency rather than assume it: a real provider returns
    // the original result for a repeated key. Inventing a second message id
    // would make the duplicate-protection test pass against behaviour no vendor
    // exhibits.
    const previous = this.seen.get(message.idempotencyKey);
    if (previous) return previous;

    const result: EmailSendResult = this.behaviour.result ?? {
      status: 'ACCEPTED',
      providerMessageId: `mock-email-${message.idempotencyKey.slice(0, 12)}`,
      retryable: false,
    };

    if (result.status === 'ACCEPTED') this.sent.push(message);
    this.seen.set(message.idempotencyKey, result);
    return result;
  }
}

export interface MockEmailBehaviour {
  result?: EmailSendResult;
  /** Test-only escape hatch. Never set outside a test asserting the refusal. */
  allowInProduction?: boolean;
}
