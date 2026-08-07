import type { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTenantConfig, type TenantConfig } from '@/lib/frontdesk/config/schema';
import {
  buildReadinessReport,
  demoTenantBlocker,
  type PlatformFacts,
} from '@/lib/frontdesk/config/readiness';
import {
  SECRET_SPECS,
  buildSecretReport,
  containsSecretValue,
  messagingIsReal,
} from '@/lib/frontdesk/config/secrets';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import { orderedFallbackContacts } from '@/lib/frontdesk/notify/escalation';
import { getRotaStatus } from '@/lib/frontdesk/notify/verification';

/**
 * PILOT-READINESS AND SECRET HANDLING (Milestone 6)
 *
 * Two failure modes are pinned here, and they pull in opposite directions.
 *
 * The gate must not pass a deployment that would silently drop alerts — a
 * front desk that answers beautifully and tells nobody about a food-safety
 * report is worse than one that is obviously switched off.
 *
 * And the readiness report must never leak the very secrets it reports on.
 * It is the page an operator screenshots when asking for help.
 */

const SID = 'AC' + 'a'.repeat(32);
const TOKEN = 'b'.repeat(32);

/** An environment where every applicable secret is set and strong. */
const goodEnv: Record<string, string | undefined> = {
  BASIC_AUTH_USER: 'operator',
  BASIC_AUTH_PASSWORD: 'a-long-enough-password',
  CRON_SECRET: 'cron-secret-that-is-long',
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/wbi',
  SMS_PROVIDER: 'twilio',
  TWILIO_ACCOUNT_SID: SID,
  TWILIO_AUTH_TOKEN: TOKEN,
  TWILIO_STATUS_CALLBACK_URL: 'https://example.invalid/api/frontdesk/notifications/webhook',
  FRONTDESK_DISPATCH_SCHEDULED: 'true',
};

function config(overrides: Partial<TenantConfig> = {}): TenantConfig {
  return { ...demoTenantConfig, ...overrides };
}

/** A configuration with no required gaps and an owner sign-off. */
function pilotReadyConfig(): TenantConfig {
  return config({
    pilot: {
      escalationRota: ['urgent', 'manager'],
      ownerVerifiedAt: '2026-08-01T12:00:00.000Z',
      ownerVerifiedBy: 'Dana Whitfield, owner',
    },
  });
}

function facts(overrides: Partial<PlatformFacts> = {}): PlatformFacts {
  return {
    webhookSecretConfigured: true,
    dispatchWorkerScheduled: true,
    openFailures: 0,
    criticalUnreachableFailures: 0,
    rota: { order: ['urgent', 'manager'], verifiedKeys: ['urgent', 'manager'] },
    env: goodEnv,
    ...overrides,
  };
}

// ===========================================================================
// SECRETS
// ===========================================================================

describe('secret reporting', () => {
  it('reports every declared secret as set when the environment is complete', () => {
    const report = buildSecretReport(goodEnv);
    expect(report.ready).toBe(true);
    expect(report.blocking).toEqual([]);
  });

  it('flags a missing secret as blocking', () => {
    const report = buildSecretReport({ ...goodEnv, CRON_SECRET: undefined });
    expect(report.ready).toBe(false);
    expect(report.blocking.map((s) => s.name)).toContain('CRON_SECRET');
    expect(report.blocking.find((s) => s.name === 'CRON_SECRET')?.state).toBe('MISSING');
  });

  it('flags a present-but-too-short secret as WEAK, not SET', () => {
    // A short cron secret is worse than a missing one: it looks configured.
    const report = buildSecretReport({ ...goodEnv, CRON_SECRET: 'short' });
    expect(report.blocking.find((s) => s.name === 'CRON_SECRET')?.state).toBe('WEAK');
  });

  it('treats whitespace as absent', () => {
    const report = buildSecretReport({ ...goodEnv, BASIC_AUTH_PASSWORD: '     ' });
    expect(report.blocking.find((s) => s.name === 'BASIC_AUTH_PASSWORD')?.state).toBe('MISSING');
  });

  it('does not require Twilio credentials when Twilio is not the provider', () => {
    const report = buildSecretReport({
      ...goodEnv,
      SMS_PROVIDER: 'mock',
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_STATUS_CALLBACK_URL: undefined,
      // A non-Twilio provider verifies callbacks with the platform scheme, so
      // this one becomes applicable in Twilio's place.
      SMS_WEBHOOK_SECRET: 'platform-webhook-secret-value',
    });
    expect(report.blocking.map((s) => s.name)).not.toContain('TWILIO_ACCOUNT_SID');
    expect(report.ready).toBe(true);
  });

  it('requires the platform webhook secret exactly when Twilio is NOT in use', () => {
    // The two callback-verification schemes are mutually exclusive, so
    // requiring both would block a correct deployment either way round.
    const onTwilio = buildSecretReport(goodEnv);
    expect(onTwilio.blocking.map((s) => s.name)).not.toContain('SMS_WEBHOOK_SECRET');

    const onMock = buildSecretReport({ ...goodEnv, SMS_PROVIDER: 'mock' });
    expect(onMock.blocking.map((s) => s.name)).toContain('SMS_WEBHOOK_SECRET');
  });

  it('requires Twilio credentials as soon as Twilio is selected', () => {
    const report = buildSecretReport({ ...goodEnv, TWILIO_AUTH_TOKEN: undefined });
    expect(report.blocking.map((s) => s.name)).toContain('TWILIO_AUTH_TOKEN');
  });

  it('NEVER includes a secret value in its output', () => {
    // The single most important assertion in this file. The report is the page
    // an operator screenshots and pastes into a chat window.
    const serialised = JSON.stringify(buildSecretReport(goodEnv));
    for (const spec of SECRET_SPECS) {
      const value = goodEnv[spec.name];
      if (value && value.length >= 8) expect(serialised).not.toContain(value);
    }
    expect(containsSecretValue(serialised, goodEnv)).toBe(false);
  });

  it('does not include secret LENGTHS either', () => {
    // Length is a real leak for short secrets, and the state carries the only
    // bit an operator needs.
    const serialised = JSON.stringify(buildSecretReport(goodEnv));
    expect(serialised).not.toMatch(/"length"/);
  });

  it('explains what breaks, for every secret', () => {
    for (const status of buildSecretReport(goodEnv).statuses) {
      expect(status.consequence.length).toBeGreaterThan(10);
      expect(status.purpose.length).toBeGreaterThan(5);
    }
  });

  it('detects a leaked value when one does appear', () => {
    // Proves the guard above is not vacuous.
    expect(containsSecretValue(`token is ${TOKEN}`, goodEnv)).toBe(true);
    expect(containsSecretValue(`password is ${goodEnv.BASIC_AUTH_PASSWORD}`, goodEnv)).toBe(true);
  });

  it('does not false-positive on a short dictionary-word value', () => {
    // BASIC_AUTH_USER="operator" would otherwise match the word "operator" in
    // ordinary prose and suppress the readiness page. A value that short is
    // already reported WEAK or MISSING and blocks activation on its own.
    expect(containsSecretValue('this text mentions an operator reviewing the queue', goodEnv)).toBe(false);
  });

  it('declares only variable names the code actually reads', () => {
    // A readiness report that checks a variable nothing consumes is worse than
    // no report: it passes while the real one is unset. This caught exactly
    // that — a spec declaring FRONTDESK_CRON_SECRET while the cron route and
    // the worker both read CRON_SECRET — so it stays as a standing guard
    // rather than a one-off fix.
    const roots = ['src', 'scripts'];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|mjs)$/.test(entry)) files.push(full);
      }
    };
    for (const root of roots) walk(join(process.cwd(), root));

    const source = files
      .filter((f) => !f.includes('config/secrets.ts'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');

    for (const spec of SECRET_SPECS) {
      expect(source.includes(spec.name), `${spec.name} is declared but never read`).toBe(true);
    }
  });

  it('knows whether messaging is real', () => {
    expect(messagingIsReal({ SMS_PROVIDER: 'twilio' })).toBe(true);
    expect(messagingIsReal({ SMS_PROVIDER: 'mock' })).toBe(false);
    expect(messagingIsReal({})).toBe(false);
  });
});

// ===========================================================================
// READINESS GATE
// ===========================================================================

describe('pilot-readiness gate', () => {
  it('passes when everything is in place', () => {
    const report = buildReadinessReport(pilotReadyConfig(), facts());
    // The carrier-registration and daily-review checks are NOT_APPLICABLE and
    // blocking by design, so a fully configured deployment still cannot
    // activate without a human confirming them.
    expect(report.blockers.map((b) => b.id).sort()).toEqual(['ops.dailyReview', 'phone.registered']);
  });

  it('blocks on a mock provider', () => {
    const report = buildReadinessReport(pilotReadyConfig(), facts({ env: { ...goodEnv, SMS_PROVIDER: 'mock' } }));
    const check = report.checks.find((c) => c.id === 'provider.real');
    expect(check?.state).toBe('FAIL');
    expect(report.canActivate).toBe(false);
    expect(check?.detail).toMatch(/simulates/i);
  });

  it('blocks when no dispatch worker is scheduled', () => {
    // Alerts created and never sent is the same outcome as no alerting.
    const report = buildReadinessReport(pilotReadyConfig(), facts({ dispatchWorkerScheduled: false }));
    expect(report.blockers.map((b) => b.id)).toContain('worker.scheduled');
  });

  it('blocks when the restaurant owner has not verified the configuration', () => {
    const report = buildReadinessReport(config({ pilot: { escalationRota: ['manager'] } }), facts());
    const check = report.blockers.find((b) => b.id === 'owner.verified');
    expect(check).toBeDefined();
    expect(check?.owner).toBe('EXTERNAL');
  });

  it('blocks when a rota contact has never been tested', () => {
    const report = buildReadinessReport(
      pilotReadyConfig(),
      facts({ rota: { order: ['urgent', 'manager'], verifiedKeys: ['urgent'] } }),
    );
    const check = report.blockers.find((b) => b.id === 'rota.tested');
    expect(check?.detail).toContain('manager');
  });

  it('blocks when no rota is configured at all', () => {
    const report = buildReadinessReport(pilotReadyConfig(), facts({ rota: { order: [], verifiedKeys: [] } }));
    expect(report.blockers.map((b) => b.id)).toContain('rota.configured');
  });

  it('blocks on an unresolved critical-unreachable failure', () => {
    const report = buildReadinessReport(pilotReadyConfig(), facts({ criticalUnreachableFailures: 1, openFailures: 1 }));
    expect(report.blockers.map((b) => b.id)).toContain('failures.critical');
  });

  it('warns but does not block on ordinary open failures', () => {
    const report = buildReadinessReport(pilotReadyConfig(), facts({ openFailures: 3 }));
    const check = report.checks.find((c) => c.id === 'failures.reviewed');
    expect(check?.state).toBe('FAIL');
    expect(check?.blocking).toBe(false);
    expect(report.blockers.map((b) => b.id)).not.toContain('failures.reviewed');
  });

  it('blocks when the tenant has no webhook secret', () => {
    const report = buildReadinessReport(pilotReadyConfig(), facts({ webhookSecretConfigured: false }));
    expect(report.blockers.map((b) => b.id)).toContain('webhook.secret');
  });

  it('blocks when delivery receipts are not wired up', () => {
    const report = buildReadinessReport(
      pilotReadyConfig(),
      facts({ env: { ...goodEnv, TWILIO_STATUS_CALLBACK_URL: undefined } }),
    );
    const check = report.blockers.find((b) => b.id === 'delivery.receipts');
    expect(check?.detail).toMatch(/stops at SENT|nobody can tell/i);
  });

  it('blocks on required configuration gaps', () => {
    const bare = config({ locations: [], pilot: pilotReadyConfig().pilot });
    const report = buildReadinessReport(bare, facts());
    expect(report.blockers.map((b) => b.id)).toContain('config.complete');
    expect(report.configGaps.length).toBeGreaterThan(0);
  });

  it('always requires carrier registration, which it cannot verify', () => {
    // Claiming to have checked 10DLC would be exactly the false assurance this
    // product refuses to give. REQUIRES_CONFIRMATION says "unknown", and
    // unknown on a safety check defaults to no.
    const check = buildReadinessReport(pilotReadyConfig(), facts()).checks.find((c) => c.id === 'phone.registered');
    expect(check?.state).toBe('REQUIRES_CONFIRMATION');
    expect(check?.blocking).toBe(true);
    expect(check?.owner).toBe('EXTERNAL');
  });

  it('does not report a moot check as a blocker', () => {
    // Delivery receipts are a non-question until a real provider exists, and
    // `provider.real` is already the blocker. Listing both buries the item an
    // operator can act on.
    const report = buildReadinessReport(pilotReadyConfig(), facts({ env: { ...goodEnv, SMS_PROVIDER: 'mock' } }));
    const check = report.checks.find((c) => c.id === 'delivery.receipts');
    expect(check?.state).toBe('NOT_APPLICABLE');
    expect(report.blockers.map((b) => b.id)).not.toContain('delivery.receipts');
    expect(report.blockers.map((b) => b.id)).toContain('provider.real');
  });

  it('no blocker is ever reported as NOT_APPLICABLE', () => {
    // The contradiction this state split exists to remove.
    for (const env of [goodEnv, { ...goodEnv, SMS_PROVIDER: 'mock' }, {}]) {
      const report = buildReadinessReport(pilotReadyConfig(), facts({ env }));
      for (const blocker of report.blockers) {
        expect(blocker.state, `${blocker.id}`).not.toBe('NOT_APPLICABLE');
      }
    }
  });

  it('always requires a named daily failure-queue reviewer', () => {
    const check = buildReadinessReport(pilotReadyConfig(), facts()).checks.find((c) => c.id === 'ops.dailyReview');
    expect(check?.state).toBe('REQUIRES_CONFIRMATION');
    expect(check?.blocking).toBe(true);
    expect(check?.owner).toBe('EXTERNAL');
    expect(check?.detail).toMatch(/failure queue/i);
  });
});

describe('who can clear each blocker', () => {
  it('sorts every blocker into CODE, OPERATOR or EXTERNAL', () => {
    const report = buildReadinessReport(config(), facts({ dispatchWorkerScheduled: false, webhookSecretConfigured: false }));
    const sorted = [...report.byOwner.CODE, ...report.byOwner.OPERATOR, ...report.byOwner.EXTERNAL];
    expect(sorted).toHaveLength(report.blockers.length);
  });

  it('leaves nothing for engineering to fix in a correct deployment', () => {
    // Everything still blocking a well-configured pilot is a human or an
    // external process, not missing code. That is the milestone's claim, so it
    // is asserted rather than described.
    const report = buildReadinessReport(pilotReadyConfig(), facts());
    expect(report.byOwner.CODE).toEqual([]);
  });

  it('gives every blocker a concrete next action', () => {
    const report = buildReadinessReport(config(), facts({ dispatchWorkerScheduled: false }));
    for (const blocker of report.blockers) {
      expect(blocker.action, `${blocker.id} has no action`).toBeTruthy();
    }
  });

  it('never leaks a secret value through a blocker detail', () => {
    const report = buildReadinessReport(pilotReadyConfig(), facts({ env: { ...goodEnv, TWILIO_AUTH_TOKEN: undefined } }));
    expect(containsSecretValue(JSON.stringify(report), goodEnv)).toBe(false);
  });
});

describe('demo restaurants can never be activated', () => {
  it('is a blocking check in its own right', () => {
    const blocker = demoTenantBlocker();
    expect(blocker.blocking).toBe(true);
    expect(blocker.state).toBe('FAIL');
    expect(blocker.detail).toMatch(/fictional/i);
  });
});

// ===========================================================================
// ROTA
// ===========================================================================

describe('escalation rota ordering', () => {
  it('tries contacts in the order the restaurant chose', () => {
    const ordered = orderedFallbackContacts(
      config({ pilot: { escalationRota: ['events', 'manager', 'urgent'] } }),
    );
    expect(ordered.slice(0, 3).map((c) => c.key)).toEqual(['events', 'manager', 'urgent']);
  });

  it('still includes contacts left off the rota, last', () => {
    // A rota is a priority list, not a whitelist. Dropping a reachable person
    // from a life-safety alert because they were left off would be the wrong
    // trade.
    const ordered = orderedFallbackContacts(config({ pilot: { escalationRota: ['manager'] } }));
    expect(ordered[0].key).toBe('manager');
    expect(ordered.map((c) => c.key)).toContain('catering');
  });

  it('ignores rota entries with no phone number', () => {
    const ordered = orderedFallbackContacts(
      config({
        escalationContacts: [{ key: 'manager', name: 'M', phone: '(555) 010-0111' }, { key: 'ghost', name: 'G' }],
        pilot: { escalationRota: ['ghost', 'manager'] },
      }),
    );
    expect(ordered.map((c) => c.key)).toEqual(['manager']);
  });

  it('never lists the same contact twice', () => {
    const ordered = orderedFallbackContacts(
      config({ pilot: { escalationRota: ['manager', 'manager', 'urgent'] } }),
    );
    const keys = ordered.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('falls back to config order when no rota is set', () => {
    const ordered = orderedFallbackContacts(config({ pilot: { escalationRota: [] } }));
    expect(ordered.map((c) => c.key)).toEqual(['manager', 'catering', 'events', 'urgent']);
  });
});

describe('rota verification status', () => {
  function dbWith(rows: Array<{ contactKey: string; phone: string; status: string; failureReason?: string | null }>) {
    return {
      fdContactVerification: {
        findMany: async () => rows.map((r) => ({ ...r, failureReason: r.failureReason ?? null })),
      },
    } as unknown as PrismaClient;
  }

  const cfg = config({ pilot: { escalationRota: ['manager', 'urgent'] } });

  it('counts a delivery-confirmed contact as verified', async () => {
    const status = await getRotaStatus(
      't1',
      cfg,
      dbWith([{ contactKey: 'manager', phone: '+15550100111', status: 'VERIFIED' }]),
    );
    expect(status.verifiedKeys).toEqual(['manager']);
    expect(status.untestedKeys).toEqual(['urgent']);
  });

  it('does NOT count a merely-sent test as verified', async () => {
    // The vendor accepting a message proves nothing about a handset.
    const status = await getRotaStatus(
      't1',
      cfg,
      dbWith([{ contactKey: 'manager', phone: '+15550100111', status: 'SENT' }]),
    );
    expect(status.verifiedKeys).toEqual([]);
    expect(status.pendingKeys).toEqual(['manager']);
  });

  it('surfaces a failed test with its reason', async () => {
    const status = await getRotaStatus(
      't1',
      cfg,
      dbWith([
        { contactKey: 'manager', phone: '+15550100111', status: 'FAILED', failureReason: 'OPTED_OUT: texted STOP' },
      ]),
    );
    expect(status.failed).toEqual([{ contactKey: 'manager', reason: 'OPTED_OUT: texted STOP' }]);
    expect(status.verifiedKeys).toEqual([]);
  });

  it('invalidates a verification when the contact number changes', async () => {
    // The proof was about the old number. Inheriting it would defeat the point
    // of testing the number at all.
    const status = await getRotaStatus(
      't1',
      cfg,
      dbWith([{ contactKey: 'manager', phone: '+15559999999', status: 'VERIFIED' }]),
    );
    expect(status.verifiedKeys).toEqual([]);
    expect(status.untestedKeys).toContain('manager');
  });

  it('defaults the order to every contact with a phone when no rota is set', async () => {
    const status = await getRotaStatus('t1', config({ pilot: { escalationRota: [] } }), dbWith([]));
    expect(status.order).toEqual(['manager', 'catering', 'events', 'urgent']);
  });
});

// ===========================================================================
// SCHEMA
// ===========================================================================

describe('pilot configuration schema', () => {
  it('defaults to an empty rota rather than inventing one', () => {
    const parsed = parseTenantConfig({ ...demoTenantConfig, pilot: undefined });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.config.pilot.escalationRota).toEqual([]);
  });

  it('rejects a non-ISO owner verification timestamp', () => {
    const parsed = parseTenantConfig({
      ...demoTenantConfig,
      pilot: { escalationRota: [], ownerVerifiedAt: 'last Tuesday' },
    });
    expect(parsed.ok).toBe(false);
  });

  it('accepts a complete pilot block', () => {
    const parsed = parseTenantConfig({
      ...demoTenantConfig,
      pilot: {
        escalationRota: ['manager'],
        ownerVerifiedAt: '2026-08-01T12:00:00.000Z',
        ownerVerifiedBy: 'Dana Whitfield',
        carrierCampaignId: 'CMP123',
      },
    });
    expect(parsed.ok).toBe(true);
  });

  it('keeps the demo restaurants unactivatable: no owner sign-off', () => {
    expect(demoTenantConfig.pilot.ownerVerifiedAt).toBeUndefined();
    expect(demoTenantConfig.pilot.carrierCampaignId).toBeUndefined();
  });
});
