import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReadinessReport, telecomFingerprint, type PlatformFacts } from '@/lib/frontdesk/config/readiness';
import { messagingIsReal } from '@/lib/frontdesk/config/secrets';
import { REAL_SMS_PROVIDERS } from '@/lib/frontdesk/notify/provider';
import { queueMessage } from '@/lib/frontdesk/messaging/send';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import type { TenantConfig } from '@/lib/frontdesk/config/schema';
import type { MessagePurpose } from '@/lib/frontdesk/messaging/consent';

/**
 * PILOT ACTIVATION GATES — four stabilization fixes.
 *
 * These are the checks that decide whether a real restaurant's real customers
 * may be pointed at this system. Every one of them failed in the direction that
 * says "yes" when the honest answer was "unknown" or "no", which is the only
 * direction that matters on a safety gate:
 *
 *   1. `canActivate` could never be true, so the ceremony would be skipped.
 *   2. A typo'd SMS_PROVIDER reported a real provider while nothing could send.
 *   3. `rota.configured` passed on a fallback nobody chose.
 *   4. Nothing in code stopped a demo restaurant reaching a real carrier.
 *
 * The central property for item 1 is worth naming precisely, because it is easy
 * to implement the opposite by accident:
 *
 *   ATTESTATION IS AN AFFIRMATIVE HUMAN ACT, NEVER AN INFERENCE.
 *
 * No campaign id, phone number, provider name, environment variable or other
 * configuration value may satisfy it. The system never claims 10DLC was
 * approved; it records that a named administrator said so, and binds that
 * statement to the telecom setup it covered.
 */

const goodEnv = {
  SMS_PROVIDER: 'twilio',
  TWILIO_ACCOUNT_SID: 'AC' + 'x'.repeat(32),
  TWILIO_AUTH_TOKEN: 'y'.repeat(32),
  TWILIO_STATUS_CALLBACK_URL: 'https://example.test/api/frontdesk/notifications/webhook',
  CRON_SECRET: 'z'.repeat(32),
  BASIC_AUTH_USER: 'operator',
  BASIC_AUTH_PASSWORD: 'p'.repeat(20),
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/wbi',
  FRONTDESK_DISPATCH_SCHEDULED: 'true',
  NODE_ENV: 'production',
};

const ATTESTED_AT = '2026-08-20T09:00:00.000Z';
const ATTESTER = 'Keith Warren, platform administrator';

/** A tenant that is ready except for whatever the test varies. */
function readyConfig(pilotOverrides: Record<string, unknown> = {}): TenantConfig {
  return {
    ...demoTenantConfig,
    restaurantName: 'Alpha Grill',
    messaging: { ...demoTenantConfig.messaging, smsEnabled: true, fromNumber: '+15550100100' },
    pilot: {
      escalationRota: ['urgent', 'manager'],
      ownerVerifiedAt: '2026-08-01T12:00:00.000Z',
      ownerVerifiedBy: 'Dana Whitfield, owner',
      carrierCampaignId: 'CMP-12345',
      failureReviewOwner: 'Marcus Reed, operations',
      failureReviewAttestedAt: ATTESTED_AT,
      ...pilotOverrides,
    },
  } as unknown as TenantConfig;
}

/** Fully attested against the telecom setup `readyConfig` describes. */
function attestedConfig(overrides: Record<string, unknown> = {}): TenantConfig {
  const base = readyConfig();
  return readyConfig({
    telecomAttestedAt: ATTESTED_AT,
    telecomAttestedBy: ATTESTER,
    telecomAttestedFingerprint: telecomFingerprint(base, goodEnv),
    ...overrides,
  });
}

const facts = (overrides: Partial<PlatformFacts> = {}): PlatformFacts => ({
  webhookSecretConfigured: true,
  dispatchWorkerScheduled: true,
  openFailures: 0,
  criticalUnreachableFailures: 0,
  rota: { order: ['urgent', 'manager'], verifiedKeys: ['urgent', 'manager'] },
  env: goodEnv,
  ...overrides,
});

const stateOf = (config: TenantConfig, id: string, f = facts()) =>
  buildReadinessReport(config, f).checks.find((c) => c.id === id);

// ===========================================================================
// ITEM 1 — telecom / daily-review attestation
// ===========================================================================

describe('item 1 — canActivate is unreachable without an affirmative attestation', () => {
  it('cannot activate when nothing is attested', () => {
    const report = buildReadinessReport(readyConfig({ failureReviewOwner: undefined, failureReviewAttestedAt: undefined }), facts());
    expect(report.canActivate).toBe(false);
    expect(report.blockers.map((b) => b.id).sort()).toEqual(['ops.dailyReview', 'phone.registered']);
  });

  it('CAN activate for a correctly configured, fully attested tenant', () => {
    const report = buildReadinessReport(attestedConfig(), facts());
    expect(report.blockers.map((b) => b.id)).toEqual([]);
    expect(report.canActivate).toBe(true);
  });

  it('reports ATTESTED, never PASS — the system verified nothing', () => {
    const check = stateOf(attestedConfig(), 'phone.registered');
    expect(check?.state).toBe('ATTESTED');
    expect(check?.state).not.toBe('PASS');
    expect(check?.detail).toContain(ATTESTER);
    expect(check?.detail).toContain(ATTESTED_AT);
    // It must say plainly that no carrier confirmed anything.
    expect(check?.detail).toMatch(/has NOT verified/i);
  });

  it('is auditable: who attested and when are both recorded', () => {
    const detail = stateOf(attestedConfig(), 'phone.registered')?.detail ?? '';
    expect(detail).toContain(ATTESTER);
    expect(detail).toContain(ATTESTED_AT);
    const review = stateOf(attestedConfig(), 'ops.dailyReview')?.detail ?? '';
    expect(review).toContain('Marcus Reed, operations');
    expect(review).toContain(ATTESTED_AT);
  });
});

describe('item 1 — no configuration value can substitute for the human act', () => {
  const base = readyConfig();

  it.each([
    ['a campaign id alone', { carrierCampaignId: 'CMP-99999' }],
    ['an owner sign-off alone', { ownerVerifiedAt: ATTESTED_AT, ownerVerifiedBy: 'Someone' }],
    ['an attester with no timestamp', { telecomAttestedBy: ATTESTER, telecomAttestedFingerprint: telecomFingerprint(base, goodEnv) }],
    ['a timestamp with no attester', { telecomAttestedAt: ATTESTED_AT, telecomAttestedFingerprint: telecomFingerprint(base, goodEnv) }],
    ['an attester and timestamp with no fingerprint', { telecomAttestedAt: ATTESTED_AT, telecomAttestedBy: ATTESTER }],
    ['an empty attester string', { telecomAttestedAt: ATTESTED_AT, telecomAttestedBy: '   ', telecomAttestedFingerprint: telecomFingerprint(base, goodEnv) }],
  ])('does not accept %s', (_label, pilot) => {
    const report = buildReadinessReport(readyConfig(pilot), facts());
    expect(report.canActivate).toBe(false);
    expect(report.blockers.map((b) => b.id)).toContain('phone.registered');
    expect(stateOf(readyConfig(pilot), 'phone.registered')?.state).toBe('REQUIRES_CONFIRMATION');
  });

  it('does not accept a real provider and valid credentials as evidence', () => {
    // Everything about the deployment is correct. Nobody certified it.
    const report = buildReadinessReport(readyConfig(), facts({ env: goodEnv }));
    expect(report.blockers.map((b) => b.id)).toContain('phone.registered');
  });

  it('makes no automated claim that 10DLC was approved', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/frontdesk/config/readiness.ts'), 'utf8');
    // No wording anywhere that asserts the platform confirmed a registration.
    expect(/we (?:have )?verified|carrier confirmed|registration verified|approved by the carrier/i.test(source)).toBe(false);
  });
});

describe('item 1 — attestation is bound to the telecom setup it certifies', () => {
  it('goes stale when the sending number changes', () => {
    const attested = attestedConfig();
    const moved = {
      ...attested,
      messaging: { ...attested.messaging, fromNumber: '+15550100200' },
    } as TenantConfig;
    const check = stateOf(moved, 'phone.registered');
    expect(check?.state).toBe('REQUIRES_CONFIRMATION');
    expect(check?.detail).toMatch(/DIFFERENT telecom setup/i);
    expect(buildReadinessReport(moved, facts()).canActivate).toBe(false);
  });

  it('goes stale when the campaign id changes', () => {
    const moved = attestedConfig({ carrierCampaignId: 'CMP-DIFFERENT' });
    expect(stateOf(moved, 'phone.registered')?.state).toBe('REQUIRES_CONFIRMATION');
  });

  it('goes stale when the provider changes', () => {
    const attested = attestedConfig();
    const otherEnv = { ...goodEnv, SMS_PROVIDER: 'mock' };
    expect(stateOf(attested, 'phone.registered', facts({ env: otherEnv }))?.state).toBe('REQUIRES_CONFIRMATION');
  });

  it('names both fingerprints so an operator can see what changed', () => {
    const attested = attestedConfig();
    const moved = { ...attested, messaging: { ...attested.messaging, fromNumber: '+15550100200' } } as TenantConfig;
    const detail = stateOf(moved, 'phone.registered')?.detail ?? '';
    expect(detail).toContain('15550100100'); // what was certified
    expect(detail).toContain('15550100200'); // what is configured now
  });

  it('fingerprints only the telecom facts, and is stable', () => {
    const c = readyConfig();
    expect(telecomFingerprint(c, goodEnv)).toBe(telecomFingerprint(c, goodEnv));
    expect(telecomFingerprint(c, goodEnv)).toContain('twilio');
    // Changing something unrelated must not invalidate a certification.
    const renamed = { ...c, restaurantName: 'Renamed Grill' } as TenantConfig;
    expect(telecomFingerprint(renamed, goodEnv)).toBe(telecomFingerprint(c, goodEnv));
  });
});

describe('item 1 — the daily-review attestation behaves the same way', () => {
  it('blocks with an owner but no agreed date', () => {
    const c = attestedConfig({ failureReviewOwner: 'Marcus Reed', failureReviewAttestedAt: undefined });
    expect(stateOf(c, 'ops.dailyReview')?.state).toBe('REQUIRES_CONFIRMATION');
    expect(buildReadinessReport(c, facts()).canActivate).toBe(false);
  });

  it('blocks with a date but nobody named', () => {
    const c = attestedConfig({ failureReviewOwner: undefined, failureReviewAttestedAt: ATTESTED_AT });
    expect(stateOf(c, 'ops.dailyReview')?.state).toBe('REQUIRES_CONFIRMATION');
  });

  it('attests with both, and says the platform cannot observe it', () => {
    const check = stateOf(attestedConfig(), 'ops.dailyReview');
    expect(check?.state).toBe('ATTESTED');
    expect(check?.detail).toMatch(/cannot observe/i);
  });
});

// ===========================================================================
// ITEM 2 — messagingIsReal
// ===========================================================================

describe('item 2 — a readiness gate must not go green on a typo', () => {
  it('accepts a provider the loader can actually construct', () => {
    expect(messagingIsReal({ SMS_PROVIDER: 'twilio' })).toBe(true);
  });

  it('rejects a typo that previously reported a real provider', () => {
    // The defect: any non-mock string returned true, so this went green while
    // getSmsProvider threw on every dispatch cycle.
    for (const typo of ['twilioo', 'twilo', 'Twilio ', 'sendgrid', 'real', 'yes', 'true']) {
      expect(messagingIsReal({ SMS_PROVIDER: typo }), typo).toBe(typo.trim().toLowerCase() === 'twilio');
    }
  });

  it('rejects mock, unset, empty and whitespace', () => {
    for (const value of ['mock', 'MOCK', '', '   ', undefined]) {
      expect(messagingIsReal({ SMS_PROVIDER: value }), String(value)).toBe(false);
    }
  });

  it('tolerates case and surrounding whitespace on a valid name', () => {
    expect(messagingIsReal({ SMS_PROVIDER: '  TWILIO  ' })).toBe(true);
  });

  it('does not drift from what getSmsProvider dispatches on', () => {
    // One list, two consumers. If an adapter is added to the loader without
    // being added here, readiness would under-report rather than over-report —
    // but they should simply not diverge.
    const source = readFileSync(join(process.cwd(), 'src/lib/frontdesk/notify/provider.ts'), 'utf8');
    for (const name of REAL_SMS_PROVIDERS) {
      expect(source).toContain(`configured === '${name}'`);
    }
    expect(REAL_SMS_PROVIDERS).not.toContain('mock' as never);
  });

  it('blocks activation for an unrecognised provider', () => {
    const env = { ...goodEnv, SMS_PROVIDER: 'twilioo' };
    const report = buildReadinessReport(attestedConfig(), facts({ env }));
    expect(report.checks.find((c) => c.id === 'provider.real')?.state).toBe('FAIL');
    expect(report.canActivate).toBe(false);
  });
});

// ===========================================================================
// ITEM 3 — rota.configured
// ===========================================================================

describe('item 3 — the rota check reads where a human would have decided', () => {
  it('FAILS when no rota is set, even though the fallback filled the order', () => {
    // The defect: getRotaStatus fills an empty rota with every phone-bearing
    // contact, and this check read that fallback as evidence of a decision.
    const noRota = attestedConfig({ escalationRota: [] });
    const check = stateOf(noRota, 'rota.configured', facts({ rota: { order: ['urgent', 'manager'], verifiedKeys: ['urgent', 'manager'] } }));
    expect(check?.state).toBe('FAIL');
    expect(buildReadinessReport(noRota, facts()).canActivate).toBe(false);
  });

  it('PASSES when a rota is explicitly set', () => {
    expect(stateOf(attestedConfig(), 'rota.configured')?.state).toBe('PASS');
  });

  it('leaves rota.tested NOT_APPLICABLE when no rota is configured', () => {
    const noRota = attestedConfig({ escalationRota: [] });
    expect(stateOf(noRota, 'rota.tested')?.state).toBe('NOT_APPLICABLE');
  });

  it('does NOT change dispatch fallback behaviour', async () => {
    // The fallback is correct for dispatch — during an emergency, reaching
    // someone beats refusing over a missing list. Only the readiness evidence
    // changed.
    const { orderedFallbackContacts } = await import('@/lib/frontdesk/notify/escalation');
    const noRota = attestedConfig({ escalationRota: [] });
    const ordered = orderedFallbackContacts(noRota);
    expect(ordered.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// ITEM 4 — demo restaurants may never reach a real provider
// ===========================================================================

describe('item 4 — a demo restaurant cannot reach a real provider', () => {
  const original = process.env.SMS_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.SMS_PROVIDER;
    else process.env.SMS_PROVIDER = original;
  });

  function fakeDb(demoMode: boolean) {
    const notifications: Record<string, unknown>[] = [];
    const failures: Record<string, unknown>[] = [];
    return {
      notifications,
      failures,
      db: {
        fdTenant: { findUnique: async () => ({ demoMode }) },
        fdConsent: { findUnique: async () => ({ status: 'IMPLIED', lastInboundAt: null }) },
        fdRateCounter: { findUnique: async () => null, upsert: async () => ({}) },
        fdNotification: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            notifications.push(data);
            return { id: 'n-1' };
          },
          count: async () => 0,
        },
        fdFailure: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            failures.push(data);
            return data;
          },
        },
      } as never,
    };
  }

  const send = (fake: ReturnType<typeof fakeDb>, purpose: MessagePurpose = 'ESCALATION_ALERT') =>
    queueMessage(
      {
        tenantId: 'tenant-1',
        config: { ...demoTenantConfig, messaging: { ...demoTenantConfig.messaging, smsEnabled: true, fromNumber: '+15550100100' } } as TenantConfig,
        toNumber: '+15550100111',
        body: 'URGENT: food safety',
        purpose,
      },
      fake.db,
    );

  it('REFUSES a demo tenant when the provider is real', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    const fake = fakeDb(true);
    const result = await send(fake);
    expect(result.queued).toBe(false);
    if (!result.queued) expect(result.reason).toBe('DEMO_TENANT');
    expect(fake.notifications).toHaveLength(0);
    // Refusals are never silent.
    expect(fake.failures.some((f) => f.lastError === 'DEMO_TENANT')).toBe(true);
  });

  it('still queues for a demo tenant under the mock, so the demo keeps working', async () => {
    process.env.SMS_PROVIDER = 'mock';
    const fake = fakeDb(true);
    expect((await send(fake)).queued).toBe(true);
    expect(fake.notifications).toHaveLength(1);
  });

  it('still queues for a demo tenant when no provider is configured', async () => {
    delete process.env.SMS_PROVIDER;
    const fake = fakeDb(true);
    expect((await send(fake)).queued).toBe(true);
  });

  it('does not affect a real tenant on a real provider', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    const fake = fakeDb(false);
    expect((await send(fake)).queued).toBe(true);
    expect(fake.notifications).toHaveLength(1);
  });

  it('does not affect a real tenant on the mock', async () => {
    process.env.SMS_PROVIDER = 'mock';
    const fake = fakeDb(false);
    expect((await send(fake)).queued).toBe(true);
  });

  it('applies to every purpose, not just escalations', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    for (const purpose of ['ESCALATION_ALERT', 'MISSED_CALL_RECOVERY', 'CONVERSATION_REPLY', 'REVIEW_REQUEST'] as const) {
      const fake = fakeDb(true);
      const result = await send(fake, purpose);
      expect(result.queued, purpose).toBe(false);
      expect(fake.notifications, purpose).toHaveLength(0);
    }
  });

  it('refuses before consent and rate limits are consulted', async () => {
    // The guard must not depend on anything downstream of it.
    process.env.SMS_PROVIDER = 'twilio';
    const fake = fakeDb(true);
    const consent = vi.fn();
    (fake.db as unknown as { fdConsent: { findUnique: unknown } }).fdConsent.findUnique = consent;
    await send(fake);
    expect(consent).not.toHaveBeenCalled();
  });
});
