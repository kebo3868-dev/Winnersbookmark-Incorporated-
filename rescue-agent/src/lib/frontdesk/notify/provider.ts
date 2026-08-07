/**
 * SMS PROVIDER ABSTRACTION (§XXIII)
 *
 * The front desk must not know which SMS vendor a deployment uses. Everything
 * above this interface — escalation dispatch, retries, the failure queue —
 * works against `SmsProvider`, so swapping Twilio for MessageBird later is a
 * new adapter rather than a rewrite.
 *
 * Equally important for this milestone: nothing here reaches the network. The
 * only implementation shipped today is a mock, so the entire notification
 * pipeline is testable end to end without an account, a phone number, or a
 * purchase.
 */

export interface SmsMessage {
  to: string;
  from: string;
  body: string;
  /** Correlates provider logs with our notification record. */
  reference: string;
}

/**
 * Result of handing a message to a provider.
 *
 * ACCEPTED means the provider took it, NOT that it reached a handset —
 * delivery is confirmed asynchronously by webhook. Conflating the two is how
 * a system ends up believing a manager was told about a food-safety report
 * when the message was still queued at the carrier.
 */
export interface SmsSendResult {
  status: 'ACCEPTED' | 'FAILED';
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  /**
   * Whether trying again could plausibly succeed. A malformed number never
   * will; a timeout might. Getting this wrong in the retryable direction
   * burns money and rate limit on a message that cannot be delivered.
   */
  retryable: boolean;
}

export interface SmsProvider {
  readonly name: string;
  /** True when messages are simulated and no real SMS leaves the system. */
  readonly simulated: boolean;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

export class SmsProviderNotConfigured extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsProviderNotConfigured';
  }
}

/**
 * Resolve the configured provider.
 *
 * Returns null rather than throwing when nothing is configured: a deployment
 * without SMS should degrade to "escalations are dashboard-only" (which the
 * README already documents), not crash on every escalation.
 *
 * The mock is refused in production unless explicitly permitted. Without that
 * guard a production deployment could look healthy while silently sending
 * nothing — the operator would see SENT notifications and no manager would
 * ever get a message. That failure is invisible exactly when it matters most.
 */
export async function getSmsProvider(
  env: Record<string, string | undefined> = process.env,
): Promise<SmsProvider | null> {
  const configured = (env.SMS_PROVIDER || '').toLowerCase().trim();
  if (!configured) return null;

  if (configured === 'mock') {
    const isProduction = env.NODE_ENV === 'production';
    const permitted = env.SMS_ALLOW_MOCK_IN_PRODUCTION === 'true';
    if (isProduction && !permitted) {
      throw new SmsProviderNotConfigured(
        'SMS_PROVIDER=mock refused in production: notifications would be silently simulated. ' +
          'Configure a real provider, or set SMS_ALLOW_MOCK_IN_PRODUCTION=true for a staging deploy.',
      );
    }
    const { MockSmsProvider } = await import('./mock');
    return new MockSmsProvider();
  }

  // Real vendor adapters plug in here, behind the same interface. None is
  // implemented yet: connecting one requires credentials and an account, which
  // is a deliberate, separately approved step.
  throw new SmsProviderNotConfigured(
    `SMS_PROVIDER="${configured}" has no adapter. Supported today: "mock".`,
  );
}

/** Mask a number for logs and audit detail — never store or print it whole. */
export function maskNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

/**
 * E.164-ish validation. Deliberately permissive about formatting and strict
 * about content: anything that is not plausibly dialable is rejected before it
 * reaches a provider, where it would cost a request to learn the same thing.
 */
export function normaliseNumber(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    const rest = digits.slice(1);
    if (!/^\d{8,15}$/.test(rest)) return null;
    return `+${rest}`;
  }
  const plain = digits.replace(/\D/g, '');
  // Bare 10-digit numbers are assumed North American, which is where this
  // product is sold. An 11-digit number starting with 1 is the same thing.
  if (/^\d{10}$/.test(plain)) return `+1${plain}`;
  if (/^1\d{10}$/.test(plain)) return `+${plain}`;
  return null;
}
