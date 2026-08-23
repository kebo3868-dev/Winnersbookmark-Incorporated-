/**
 * EMAIL PROVIDER ABSTRACTION (§XXIII)
 *
 * Deliberately the same shape as `SmsProvider`, because it carries the same
 * hard-won distinction:
 *
 *   ACCEPTED means the provider took the message. It does NOT mean it arrived.
 *
 * That conflation is what M5 and M6 removed from the SMS path — a system that
 * believed a manager had been told about a food-safety report while the message
 * sat queued. Email makes it easier to get wrong, not harder: an SMTP 250 feels
 * final, and a bounce arrives minutes later through a different channel.
 *
 * Nothing here reaches the network. The only implementation shipped today is a
 * mock, so the whole notification path is testable without an account, a
 * domain, or a sending reputation to damage.
 */

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  /** Plain text. Always populated — some staff clients show nothing else. */
  text: string;
  /** Optional HTML alternative. */
  html?: string;
  /** Correlates provider logs with our notification record. */
  reference: string;
  /**
   * Stable per-attempt key. Delivery is at-least-once: a worker that dies after
   * the provider accepted a message but before the outcome was recorded will
   * retry. Adapters MUST forward this to the vendor's idempotency header where
   * one exists.
   */
  idempotencyKey: string;
}

/**
 * Result of handing a message to a provider.
 *
 * Mirrors `SmsSendResult` exactly, including `retryable`. A malformed address
 * never succeeds on retry; a timeout might. Getting that wrong in the retryable
 * direction burns reputation on mail that cannot be delivered — and sending
 * reputation, unlike an SMS rate limit, is slow to repair.
 */
export interface EmailSendResult {
  status: 'ACCEPTED' | 'FAILED';
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable: boolean;
}

export interface EmailProvider {
  readonly name: string;
  /** True for mocks. Surfaced so a simulated send is never mistaken for a real one. */
  readonly simulated: boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/**
 * Whether an address is plausibly sendable.
 *
 * Deliberately shallow. Full RFC 5322 validation rejects addresses that work in
 * practice, and no regex settles deliverability — only the provider does. This
 * catches the configuration mistakes worth catching before a send is queued.
 */
export function isPlausibleEmail(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  if (/\s/.test(trimmed)) return false;
  const at = trimmed.indexOf('@');
  if (at <= 0 || at !== trimmed.lastIndexOf('@')) return false;
  const domain = trimmed.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

/** Mask an address for logs: never write a staff address out in full (§XXIV). */
export function maskEmail(address: string): string {
  const at = address.indexOf('@');
  if (at <= 0) return '***';
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
}
