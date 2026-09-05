import type { EmailMessage, EmailProvider, EmailSendResult } from './provider';

/**
 * RESEND EMAIL ADAPTER
 *
 * The first real email provider in this application. Until now `getEmailProvider`
 * only knew "mock", which is refused in production — so every email-shaped path
 * (staff escalation alerts, and now marketing lead notifications) had nowhere to
 * go on a production deployment.
 *
 * Chosen because it is a single authenticated POST with no SDK, which keeps the
 * dependency surface unchanged and makes the failure modes easy to reason about.
 *
 * The contract this must honour, from provider.ts:
 *   ACCEPTED means the provider took the message. It does NOT mean it arrived.
 * Nothing here upgrades a 200 into a delivery claim.
 */

const ENDPOINT = 'https://api.resend.com/emails';

/** Beyond this, a send is abandoned rather than holding a request open. */
const TIMEOUT_MS = 10_000;

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  readonly simulated = false;

  constructor(private readonly apiKey: string) {
    if (!apiKey.trim()) {
      throw new Error('ResendEmailProvider requires a non-empty API key.');
    }
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
          // Resend deduplicates on this, which is what makes the at-least-once
          // retry in the worker safe: a redelivered attempt does not produce a
          // second email.
          'idempotency-key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          headers: { 'X-Entity-Ref-ID': message.reference },
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { id?: string } | null;
        return {
          status: 'ACCEPTED',
          providerMessageId: body?.id,
          retryable: false,
        };
      }

      const detail = await response.text().catch(() => '');

      // Retryability is the field that matters most here. Getting it wrong in
      // the retryable direction burns sending reputation on mail that can never
      // be delivered, and sending reputation is slow to repair.
      //
      // 429 and 5xx are transient. Everything else in the 4xx range is a
      // rejection of THIS message — a malformed address, an unverified sending
      // domain, a revoked key — and will fail identically on every retry.
      const retryable = response.status === 429 || response.status >= 500;

      return {
        status: 'FAILED',
        errorCode: `HTTP_${response.status}`,
        errorMessage: detail.slice(0, 500) || response.statusText,
        retryable,
      };
    } catch (error) {
      // Aborts and network faults are genuinely transient: the message may not
      // have reached Resend at all, so it is safe and correct to retry — the
      // idempotency key prevents a duplicate if it actually did land.
      const aborted = error instanceof Error && error.name === 'AbortError';
      return {
        status: 'FAILED',
        errorCode: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown transport failure',
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
