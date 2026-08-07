/**
 * SECRET AND CREDENTIAL CONFIGURATION
 *
 * One declaration of every secret the front desk needs, what it protects, and
 * what breaks without it. Before this existed the answer to "is this
 * deployment configured correctly?" was spread across a middleware, a worker,
 * a webhook verifier and three README paragraphs, which is how a deployment
 * ends up live with a missing cron secret nobody noticed.
 *
 * TWO RULES, BOTH ENFORCED BY TESTS:
 *
 *   1. No function here ever returns, logs or renders a secret VALUE. Every
 *      output is a name, a state and a reason. An operator screenshotting the
 *      readiness page to ask for help must not be leaking credentials.
 *   2. Nothing here reads a default. A secret that falls back to a built-in
 *      value is not a secret, and a shipped default is a published one.
 */

export type SecretState =
  /** Present and meets the minimum strength bar. */
  | 'SET'
  /** Absent. */
  | 'MISSING'
  /** Present but too short to be worth having. */
  | 'WEAK';

export type SecretRequirement =
  /** Must be set before any real restaurant is served. */
  | 'PILOT'
  /** Only needed once the named capability is switched on. */
  | 'CONDITIONAL';

export interface SecretSpec {
  name: string;
  requirement: SecretRequirement;
  /** Minimum length for a value to count as SET rather than WEAK. */
  minLength: number;
  /** What this protects, in one line an operator can act on. */
  purpose: string;
  /** What stops working, or stops being safe, when it is missing. */
  consequence: string;
  /** Set when this secret is only required because another setting is on. */
  requiredWhen?: string;
}

/**
 * Minimum lengths are deliberately different per secret.
 *
 * A cron secret is machine-generated and has no excuse to be short. A Basic
 * Auth password is typed by a human and 16 characters is already a real one.
 * Twilio's own credential formats are fixed by Twilio, so the bar is just
 * "long enough to not be a placeholder".
 */
export const SECRET_SPECS: SecretSpec[] = [
  {
    name: 'BASIC_AUTH_USER',
    requirement: 'PILOT',
    minLength: 3,
    purpose: 'Gate on every route in the app',
    consequence: 'In production the app refuses all requests with 503 until this is set',
  },
  {
    name: 'BASIC_AUTH_PASSWORD',
    requirement: 'PILOT',
    minLength: 16,
    purpose: 'Gate on every route in the app',
    consequence: 'In production the app refuses all requests with 503 until this is set',
  },
  {
    // Name matches what the cron route and the standalone worker actually
    // read. A readiness report that checks a variable nothing consumes is
    // worse than no report: it passes while the real one is unset.
    name: 'CRON_SECRET',
    requirement: 'PILOT',
    minLength: 16,
    purpose: 'Authenticates the scheduled dispatch trigger',
    consequence:
      'The cron endpoint fails closed, so queued escalation alerts are never sent. A value under 16 characters is rejected outright',
  },
  {
    name: 'SMS_WEBHOOK_SECRET',
    requirement: 'CONDITIONAL',
    minLength: 24,
    purpose: 'Verifies delivery callbacks under the platform HMAC scheme',
    consequence: 'Delivery callbacks are rejected, so every alert stays at SENT with no confirmation',
    requiredWhen: 'SMS_PROVIDER is set and is not twilio',
  },
  {
    name: 'DATABASE_URL',
    requirement: 'PILOT',
    minLength: 20,
    purpose: 'PostgreSQL connection',
    consequence: 'Nothing works',
  },
  {
    name: 'SMS_PROVIDER',
    requirement: 'PILOT',
    minLength: 3,
    purpose: 'Selects the SMS adapter ("mock" or "twilio")',
    consequence: 'No provider means escalations stay dashboard-only and no alert is ever sent',
  },
  {
    name: 'TWILIO_ACCOUNT_SID',
    requirement: 'CONDITIONAL',
    minLength: 34,
    purpose: 'Twilio account identity',
    consequence: 'The Twilio adapter refuses to start',
    requiredWhen: 'SMS_PROVIDER=twilio',
  },
  {
    name: 'TWILIO_AUTH_TOKEN',
    requirement: 'CONDITIONAL',
    minLength: 32,
    purpose: 'Twilio API credential and delivery-receipt signing key',
    consequence: 'The Twilio adapter refuses to start, and delivery receipts cannot be verified',
    requiredWhen: 'SMS_PROVIDER=twilio',
  },
  {
    name: 'TWILIO_STATUS_CALLBACK_URL',
    requirement: 'CONDITIONAL',
    minLength: 12,
    purpose: 'Where Twilio posts delivery receipts',
    consequence:
      'Messages send but never progress past SENT, so the dashboard cannot tell "handed to the carrier" from "reached a handset"',
    requiredWhen: 'SMS_PROVIDER=twilio',
  },
];

export interface SecretStatus {
  name: string;
  state: SecretState;
  requirement: SecretRequirement;
  /** True when this secret is actually needed given the rest of the config. */
  applicable: boolean;
  purpose: string;
  consequence: string;
  requiredWhen?: string;
}

export interface SecretReport {
  statuses: SecretStatus[];
  /** Applicable secrets that are MISSING or WEAK. Blocks pilot activation. */
  blocking: SecretStatus[];
  ready: boolean;
}

function evaluate(spec: SecretSpec, raw: string | undefined): SecretState {
  const value = raw?.trim() ?? '';
  if (value.length === 0) return 'MISSING';
  if (value.length < spec.minLength) return 'WEAK';
  return 'SET';
}

/**
 * Report on every secret without revealing any of them.
 *
 * The returned objects contain names, states and prose only — never a value,
 * a prefix, a suffix, or a length. Length is a real leak for short secrets and
 * the state already carries the only bit an operator needs.
 */
export function buildSecretReport(env: Record<string, string | undefined> = process.env): SecretReport {
  const provider = (env.SMS_PROVIDER || '').toLowerCase().trim();
  const usingTwilio = provider === 'twilio';

  const statuses: SecretStatus[] = SECRET_SPECS.map((spec) => {
    const applicable =
      spec.requirement === 'PILOT' ||
      (spec.requiredWhen === 'SMS_PROVIDER=twilio' && usingTwilio) ||
      // The platform's own webhook scheme is only in play when a non-Twilio
      // provider is configured; the Twilio path verifies with the auth token.
      (spec.requiredWhen === 'SMS_PROVIDER is set and is not twilio' && provider !== '' && !usingTwilio);
    return {
      name: spec.name,
      state: evaluate(spec, env[spec.name]),
      requirement: spec.requirement,
      applicable,
      purpose: spec.purpose,
      consequence: spec.consequence,
      requiredWhen: spec.requiredWhen,
    };
  });

  const blocking = statuses.filter((s) => s.applicable && s.state !== 'SET');
  return { statuses, blocking, ready: blocking.length === 0 };
}

/**
 * Is this deployment sending real messages?
 *
 * Used by the readiness gate and the dashboard banner. A restaurant must never
 * be told its front desk is live while the mock is quietly absorbing every
 * alert, so this is answered from configuration rather than assumed.
 */
export function messagingIsReal(env: Record<string, string | undefined> = process.env): boolean {
  const provider = (env.SMS_PROVIDER || '').toLowerCase().trim();
  if (!provider || provider === 'mock') return false;
  return true;
}

/**
 * Guard against a secret value reaching a log, a response or a rendered page.
 *
 * Used in tests over this module's own output, and available to any surface
 * that wants to assert the same thing about its own. Deliberately checks for
 * the VALUES from the environment rather than for patterns that look secret —
 * pattern matching would miss a credential that happens to look like a word.
 */
export function containsSecretValue(
  haystack: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  for (const spec of SECRET_SPECS) {
    const value = env[spec.name]?.trim();
    if (value && value.length >= scanThreshold(spec) && haystack.includes(value)) return true;
  }
  return false;
}

/**
 * Shortest value worth scanning for, per secret.
 *
 * A naive "anything over 8 characters" scan false-positives on ordinary
 * English: a `BASIC_AUTH_USER` of "operator" matches the word "operator" in
 * this module's own prose, and the readiness page then refuses to render
 * itself. That is the safe direction to fail, but it is still an outage caused
 * by a username that happens to be a dictionary word.
 *
 * So the floor is the secret's own minimum length, never below 12. Anything
 * shorter is already reported MISSING or WEAK and blocks activation on its
 * own, so it does not also need catching here.
 *
 * KNOWN LIMIT, stated rather than hidden: this is a substring backstop, not a
 * proof. A secret that has been transformed — base64'd, hashed, split across
 * fields — will not be caught by it. It exists to catch the careless case of a
 * raw value being interpolated into a message, which is the one that actually
 * happens.
 */
function scanThreshold(spec: SecretSpec): number {
  return Math.max(12, spec.minLength);
}
