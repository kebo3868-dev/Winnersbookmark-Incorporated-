import type { EmailProvider } from './provider';

/**
 * Email provider selection.
 *
 * Mirrors `getSmsProvider`, including the part that matters most: an unset
 * `EMAIL_PROVIDER` returns null rather than falling back to something. There is
 * no default provider, because the failure mode of a default is a deployment
 * that believes it is emailing staff and is not.
 *
 * No real adapter exists yet. Until one does, production returns null and staff
 * alerts remain SMS-only — which is the behaviour before this code, unchanged.
 */
export class EmailProviderNotConfigured extends Error {}

export async function getEmailProvider(
  env: Record<string, string | undefined> = process.env,
): Promise<EmailProvider | null> {
  const configured = (env.EMAIL_PROVIDER || '').toLowerCase().trim();
  if (!configured) return null;

  if (configured === 'mock') {
    // The mock refuses production in its own constructor too. Checked here as
    // well so the refusal names the environment variable that caused it.
    if (env.NODE_ENV === 'production' && env.EMAIL_ALLOW_MOCK_IN_PRODUCTION !== 'true') {
      throw new EmailProviderNotConfigured(
        'EMAIL_PROVIDER=mock refused in production: staff alerts would be recorded as accepted while no mail is sent. ' +
          'Configure a real provider, or set EMAIL_ALLOW_MOCK_IN_PRODUCTION=true for a staging deploy.',
      );
    }
    const { MockEmailProvider } = await import('./mock');
    return new MockEmailProvider();
  }

  throw new EmailProviderNotConfigured(
    `EMAIL_PROVIDER="${configured}" has no adapter. Supported today: "mock".`,
  );
}
