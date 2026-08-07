import type { TenantConfig } from './schema';
import { buildCompletenessReport, type ConfigGap } from './completeness';
import { buildSecretReport, messagingIsReal, type SecretStatus } from './secrets';

/**
 * PILOT-READINESS GATE
 *
 * The MISSING INFORMATION REPORT answers "can this restaurant's front desk
 * answer questions?". This answers a harder question: "is it safe to point a
 * real restaurant's real customers at this?"
 *
 * They are not the same. A tenant can have perfect configuration while the
 * deployment around it has a mock SMS provider, no scheduled worker and an
 * unverified escalation rota — a front desk that answers beautifully and
 * silently drops every food-safety alert on the floor.
 *
 * So this gate is the thing that says no. `canActivate` is consulted by the
 * activation endpoint, and activation is refused rather than warned about,
 * because a warning at onboarding time is read once and a gate is enforced
 * every time.
 *
 * WHO CAN FIX IT is part of every check. An engineer cannot buy a phone
 * number and an owner cannot write a retry policy; a checklist that does not
 * say which is which just gets ignored by both.
 */

/**
 * Four states, not three.
 *
 * The first draft had only PASS / FAIL / NOT_APPLICABLE, and 10DLC
 * registration came out as "NOT_APPLICABLE, blocking" — which reads as a
 * contradiction and is genuinely ambiguous: does it not apply, or does it
 * block? Two different things were sharing a name.
 *
 *   NOT_APPLICABLE        — moot given the rest of the configuration. Never
 *                           blocks. Delivery receipts before a provider is
 *                           chosen are not a problem, they are a non-question.
 *   REQUIRES_CONFIRMATION — the platform CANNOT determine this and must not
 *                           pretend to. A carrier registration or a named
 *                           daily reviewer exists outside this system.
 *                           Always blocks, because the honest default for
 *                           "unknown" on a safety check is "no".
 */
export type CheckState = 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'REQUIRES_CONFIRMATION';

export type CheckOwner =
  /** Fixable in this repository. */
  | 'CODE'
  /** Someone must enter configuration or a secret. No code required. */
  | 'OPERATOR'
  /** Requires the outside world: a carrier, a vendor, a restaurant owner. */
  | 'EXTERNAL';

export interface ReadinessCheck {
  id: string;
  label: string;
  state: CheckState;
  /** A failing blocking check prevents activation. Non-blocking ones warn. */
  blocking: boolean;
  owner: CheckOwner;
  detail: string;
  /** The concrete next action, phrased for whoever owns it. */
  action?: string;
}

export interface RotaFacts {
  /** Contact keys, in the order a critical alert should try them. */
  order: string[];
  /** Contact keys with a delivery-confirmed test alert. */
  verifiedKeys: string[];
}

export interface PlatformFacts {
  /** Tenant has its own inbound webhook secret stored. */
  webhookSecretConfigured: boolean;
  /** A scheduled dispatch trigger is known to be running. */
  dispatchWorkerScheduled: boolean;
  /** Open, unresolved entries in this restaurant's failure queue. */
  openFailures: number;
  /** Open failures specifically recording that a critical alert reached nobody. */
  criticalUnreachableFailures: number;
  rota: RotaFacts;
  env?: Record<string, string | undefined>;
}

export interface ReadinessReport {
  checks: ReadinessCheck[];
  blockers: ReadinessCheck[];
  canActivate: boolean;
  /** Blockers grouped by who can clear them, for the activation checklist. */
  byOwner: Record<CheckOwner, ReadinessCheck[]>;
  /** Configuration gaps carried through from the completeness report. */
  configGaps: ConfigGap[];
  secretBlockers: SecretStatus[];
}

export function buildReadinessReport(config: TenantConfig, facts: PlatformFacts): ReadinessReport {
  const env = facts.env ?? process.env;
  const checks: ReadinessCheck[] = [];
  const add = (check: ReadinessCheck) => checks.push(check);

  // --- Restaurant configuration --------------------------------------------
  const completeness = buildCompletenessReport(config);
  add({
    id: 'config.complete',
    label: 'Restaurant configuration has no required gaps',
    state: completeness.readyToActivate ? 'PASS' : 'FAIL',
    blocking: true,
    owner: 'OPERATOR',
    detail: completeness.readyToActivate
      ? `Configuration score ${completeness.score}/100 with no required gaps.`
      : `${completeness.requiredGaps.length} required gap(s): ${completeness.requiredGaps
          .map((g) => g.field)
          .join(', ')}.`,
    action: completeness.readyToActivate ? undefined : 'Fill the required fields in the missing-information report.',
  });

  // --- Owner sign-off -------------------------------------------------------
  // The restaurant owner is the only person who can confirm that what the
  // front desk will say about their business is true. No amount of validation
  // substitutes for that, so it is a check the platform cannot pass for them.
  add({
    id: 'owner.verified',
    label: 'Restaurant owner has verified the configuration',
    state: config.pilot.ownerVerifiedAt ? 'PASS' : 'FAIL',
    blocking: true,
    owner: 'EXTERNAL',
    detail: config.pilot.ownerVerifiedAt
      ? `Verified ${config.pilot.ownerVerifiedAt}${config.pilot.ownerVerifiedBy ? ` by ${config.pilot.ownerVerifiedBy}` : ''}.`
      : 'Nobody at the restaurant has confirmed that the hours, menu, policies and contacts are correct.',
    action: config.pilot.ownerVerifiedAt
      ? undefined
      : 'Walk the owner through the configuration and record who signed off and when.',
  });

  // --- Messaging ------------------------------------------------------------
  const realProvider = messagingIsReal(env);
  add({
    id: 'provider.real',
    label: 'A real SMS provider is configured',
    state: realProvider ? 'PASS' : 'FAIL',
    blocking: true,
    owner: 'OPERATOR',
    detail: realProvider
      ? `SMS_PROVIDER=${(env.SMS_PROVIDER || '').trim()}.`
      : 'The mock provider simulates every send. Alerts would be marked SENT and reach nobody.',
    action: realProvider ? undefined : 'Set SMS_PROVIDER and the matching credentials for the chosen vendor.',
  });

  const secrets = buildSecretReport(env);
  add({
    id: 'secrets.configured',
    label: 'Every required secret is set and strong enough',
    state: secrets.ready ? 'PASS' : 'FAIL',
    blocking: true,
    owner: 'OPERATOR',
    detail: secrets.ready
      ? 'All applicable secrets are set.'
      : `Missing or weak: ${secrets.blocking.map((s) => `${s.name} (${s.state})`).join(', ')}.`,
    action: secrets.ready ? undefined : 'Set the listed environment variables. Never commit them to the repository.',
  });

  add({
    id: 'phone.registered',
    label: 'Sending number is carrier-registered for business messaging',
    state: 'REQUIRES_CONFIRMATION',
    blocking: true,
    owner: 'EXTERNAL',
    detail:
      'US A2P 10DLC registration (brand + campaign) cannot be verified from inside this system, and unregistered traffic is filtered or blocked by carriers.',
    action: 'Complete 10DLC brand and campaign registration with the provider, then record the campaign id.',
  });

  // --- Delivery receipts ----------------------------------------------------
  const callbackConfigured = Boolean(env.TWILIO_STATUS_CALLBACK_URL?.trim());
  add({
    id: 'delivery.receipts',
    label: 'Delivery receipts are wired up',
    state: !realProvider ? 'NOT_APPLICABLE' : callbackConfigured ? 'PASS' : 'FAIL',
    // Only blocks once a real provider is in play. Before that, `provider.real`
    // is already the blocker and reporting this one too is noise that buries
    // the item an operator can actually act on.
    blocking: realProvider,
    owner: 'OPERATOR',
    detail: callbackConfigured
      ? 'A status callback URL is configured, so SENT can progress to DELIVERED.'
      : 'Without a status callback, every alert stops at SENT and nobody can tell whether it arrived.',
    action: callbackConfigured ? undefined : 'Set the provider status-callback URL to the notifications webhook route.',
  });

  add({
    id: 'webhook.secret',
    label: 'This restaurant has its own inbound webhook secret',
    state: facts.webhookSecretConfigured ? 'PASS' : 'FAIL',
    blocking: true,
    owner: 'OPERATOR',
    detail: facts.webhookSecretConfigured
      ? 'A per-tenant secret digest is stored.'
      : 'Inbound events for this restaurant fail closed, so inbound SMS and delivery receipts are rejected.',
    action: facts.webhookSecretConfigured ? undefined : 'Generate a webhook secret for this restaurant and give it to the provider.',
  });

  // --- The thing that actually sends ---------------------------------------
  add({
    id: 'worker.scheduled',
    label: 'A scheduled dispatch worker is running',
    state: facts.dispatchWorkerScheduled ? 'PASS' : 'FAIL',
    blocking: true,
    owner: 'OPERATOR',
    detail: facts.dispatchWorkerScheduled
      ? 'Queued notifications are being drained on a schedule.'
      : 'Nothing is draining the queue. Alerts would be created and never sent — the same outcome as having no alerting at all.',
    action: facts.dispatchWorkerScheduled
      ? undefined
      : 'Schedule the cron endpoint, or run `npm run worker:notifications` as a long-lived process.',
  });

  // --- Escalation rota ------------------------------------------------------
  const rotaConfigured = facts.rota.order.length > 0;
  add({
    id: 'rota.configured',
    label: 'An escalation rota is configured',
    state: rotaConfigured ? 'PASS' : 'FAIL',
    blocking: true,
    owner: 'OPERATOR',
    detail: rotaConfigured
      ? `Rota order: ${facts.rota.order.join(' → ')}.`
      : 'No rota. A critical alert would fall back to contacts in whatever order they happen to be listed.',
    action: rotaConfigured ? undefined : 'Set pilot.escalationRota to the contact keys in the order they should be tried.',
  });

  const unverified = facts.rota.order.filter((key) => !facts.rota.verifiedKeys.includes(key));
  add({
    id: 'rota.tested',
    label: 'Every rota contact has received a test alert',
    state: !rotaConfigured ? 'NOT_APPLICABLE' : unverified.length === 0 ? 'PASS' : 'FAIL',
    blocking: true,
    owner: 'EXTERNAL',
    detail:
      unverified.length === 0 && rotaConfigured
        ? 'Every rota contact has a delivery-confirmed test alert.'
        : `Untested contact(s): ${unverified.join(', ') || 'none'}. An untested number is an assumption, not a route.`,
    action: unverified.length === 0 ? undefined : 'Send a test alert to each rota contact and confirm they received it.',
  });

  // --- Operational readiness ------------------------------------------------
  add({
    id: 'failures.reviewed',
    label: 'Failure queue is clear',
    state: facts.openFailures === 0 ? 'PASS' : 'FAIL',
    // Not blocking on its own: some open failures are historical and expected
    // during setup. The critical-unreachable check below is the blocking one.
    blocking: false,
    owner: 'OPERATOR',
    detail:
      facts.openFailures === 0
        ? 'No open failures.'
        : `${facts.openFailures} open failure(s) need review before a real customer sees this.`,
    action: facts.openFailures === 0 ? undefined : 'Work the failure queue to zero and resolve each entry.',
  });

  add({
    id: 'failures.critical',
    label: 'No unresolved "critical alert reached nobody" failures',
    state: facts.criticalUnreachableFailures === 0 ? 'PASS' : 'FAIL',
    blocking: true,
    owner: 'OPERATOR',
    detail:
      facts.criticalUnreachableFailures === 0
        ? 'None recorded.'
        : `${facts.criticalUnreachableFailures} unresolved case(s) where a life-safety or food-safety alert reached nobody.`,
    action:
      facts.criticalUnreachableFailures === 0
        ? undefined
        : 'Fix the escalation routing that caused this, then resolve the failure.',
  });

  add({
    id: 'ops.dailyReview',
    label: 'Daily failure-queue review is assigned to a named person',
    state: 'REQUIRES_CONFIRMATION',
    blocking: true,
    owner: 'EXTERNAL',
    detail:
      'Every safety guarantee in this system ends at "and an operator sees it in the failure queue". Nobody reading the queue means those guarantees stop at a database row.',
    action: 'Name the person who reviews the failure queue daily, and agree what they do when it is not empty.',
  });

  // NOT_APPLICABLE never blocks — it means the question does not arise.
  // REQUIRES_CONFIRMATION always can, because unknown is not a pass.
  const blockers = checks.filter(
    (c) => c.blocking && (c.state === 'FAIL' || c.state === 'REQUIRES_CONFIRMATION'),
  );

  const byOwner: Record<CheckOwner, ReadinessCheck[]> = { CODE: [], OPERATOR: [], EXTERNAL: [] };
  for (const blocker of blockers) byOwner[blocker.owner].push(blocker);

  return {
    checks,
    blockers,
    canActivate: blockers.length === 0,
    byOwner,
    configGaps: completeness.requiredGaps,
    secretBlockers: secrets.blocking,
  };
}

/**
 * A demo tenant is never pilot-ready, whatever its configuration says.
 *
 * Demo restaurants are fictional: fictional numbers, fictional hours, an
 * `.invalid` domain. Activating one would point the activation machinery at a
 * restaurant that does not exist, and the numbers in the 555-01xx range would
 * fail at the carrier anyway. Called out as its own function so the reason is
 * stated once rather than implied by a scattered `demoMode` check.
 */
export function demoTenantBlocker(): ReadinessCheck {
  return {
    id: 'tenant.notDemo',
    label: 'Not a demo restaurant',
    state: 'FAIL',
    blocking: true,
    owner: 'OPERATOR',
    detail: 'Demo restaurants are fictional and cannot be activated for a pilot.',
    action: 'Create a real tenant from the restaurant’s own verified configuration.',
  };
}
