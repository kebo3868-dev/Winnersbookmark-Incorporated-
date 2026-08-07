import type { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TenantConfig } from '@/lib/frontdesk/config/schema';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import { normaliseNumber } from '@/lib/frontdesk/notify/provider';
import {
  VERIFICATION_MESSAGE,
  applyVerificationOutcome,
  requestContactVerification,
} from '@/lib/frontdesk/notify/verification';

/**
 * ROTA VERIFICATION FLOW (Milestone 6)
 *
 * The property under test is narrow and important: a contact counts as
 * verified only when a real delivery receipt says so. Everything else —
 * a queued test, an accepted send, an operator's confidence — must not be
 * enough, because the moment the rota matters is the moment nobody wants to
 * find out the number was wrong.
 */

const TENANT = 'tenant-harbor';
const MANAGER = normaliseNumber('(555) 010-0111') as string;

function config(overrides: Partial<TenantConfig> = {}): TenantConfig {
  return { ...demoTenantConfig, ...overrides };
}

/** In-memory double covering only the calls the verification path makes. */
function makeDb() {
  const notifications: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];
  const verifications: Array<Record<string, unknown>> = [];
  const consents = new Map<string, { status: string; lastInboundAt: Date | null }>();

  const db = {
    fdConsent: {
      findUnique: async ({ where }: { where: { tenantId_phone: { tenantId: string; phone: string } } }) =>
        consents.get(`${where.tenantId_phone.tenantId}|${where.tenantId_phone.phone}`) ?? null,
    },
    fdRateCounter: {
      findUnique: async () => null,
      upsert: async () => ({}),
    },
    fdNotification: {
      count: async () => 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `notification-${notifications.length + 1}`, ...data };
        notifications.push(row);
        return { id: row.id };
      },
    },
    fdFailure: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        failures.push(data);
        return data;
      },
    },
    fdContactVerification: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { tenantId_contactKey_phone: { tenantId: string; contactKey: string; phone: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const key = where.tenantId_contactKey_phone;
        const existing = verifications.find(
          (v) => v.tenantId === key.tenantId && v.contactKey === key.contactKey && v.phone === key.phone,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: `verification-${verifications.length + 1}`, ...create };
        verifications.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const row of verifications) {
          const matches = Object.entries(where).every(([field, value]) => row[field] === value);
          if (matches) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
      findMany: async () => verifications,
    },
  };

  return {
    db: db as unknown as PrismaClient,
    notifications,
    failures,
    verifications,
    optOut(tenantId: string, phone: string) {
      consents.set(`${tenantId}|${phone}`, { status: 'OPTED_OUT', lastInboundAt: null });
    },
  };
}

describe('requesting a rota test', () => {
  it('queues a test alert and opens a verification in SENT, not VERIFIED', async () => {
    const fake = makeDb();
    const result = await requestContactVerification(TENANT, demoTenantConfig, 'manager', 'WBI_ADMIN', fake.db);

    expect(result.ok).toBe(true);
    expect(fake.notifications).toHaveLength(1);
    expect(fake.verifications[0].status).toBe('SENT');
    expect(fake.verifications[0].verifiedAt).toBeUndefined();
  });

  it('sends the same message wording every time, so it is recognisable', async () => {
    const fake = makeDb();
    await requestContactVerification(TENANT, demoTenantConfig, 'manager', null, fake.db);
    expect(fake.notifications[0].body).toBe(VERIFICATION_MESSAGE);
    // The recipient must be told how to opt out, like any other message.
    expect(VERIFICATION_MESSAGE).toMatch(/STOP/);
  });

  it('masks the destination in what it returns', async () => {
    const fake = makeDb();
    const result = await requestContactVerification(TENANT, demoTenantConfig, 'manager', null, fake.db);
    if (result.ok) {
      expect(result.masked).toBe('***0111');
      expect(result.masked).not.toContain('555');
    }
  });

  it('refuses an unknown contact key', async () => {
    const fake = makeDb();
    const result = await requestContactVerification(TENANT, demoTenantConfig, 'nobody', null, fake.db);
    expect(result).toMatchObject({ ok: false, reason: 'NO_SUCH_CONTACT' });
    expect(fake.notifications).toHaveLength(0);
  });

  it('refuses a contact with no phone number', async () => {
    const noPhone = config({ escalationContacts: [{ key: 'manager', name: 'Dana', email: 'd@example.invalid' }] });
    const fake = makeDb();
    const result = await requestContactVerification(TENANT, noPhone, 'manager', null, fake.db);
    expect(result).toMatchObject({ ok: false, reason: 'NO_PHONE' });
  });

  it('goes through the gated send path, so a STOP blocks the test too', async () => {
    // A test that took a shortcut around consent would prove nothing about the
    // path a real alert uses.
    const fake = makeDb();
    fake.optOut(TENANT, MANAGER);

    const result = await requestContactVerification(TENANT, demoTenantConfig, 'manager', null, fake.db);

    expect(result).toMatchObject({ ok: false, reason: 'OPTED_OUT' });
    expect(fake.notifications).toHaveLength(0);
    // Recorded as tested-and-failed, not left looking untested.
    expect(fake.verifications[0].status).toBe('FAILED');
    expect(fake.verifications[0].failureReason).toContain('OPTED_OUT');
  });

  it('does not mark a test as critical, so it cannot bypass spend limits', async () => {
    // The critical exemption exists for a food-safety incident. A verification
    // run that could burn an unbounded budget is a footgun.
    const source = readFileSync(
      join(process.cwd(), 'src/lib/frontdesk/notify/verification.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/critical:\s*true/);
  });

  it('clears a previous pass when a re-test is requested', async () => {
    const fake = makeDb();
    await requestContactVerification(TENANT, demoTenantConfig, 'manager', null, fake.db);
    await applyVerificationOutcome(
      fake.notifications[0].id as string,
      TENANT,
      'DELIVERED',
      { at: new Date() },
      fake.db,
    );
    expect(fake.verifications[0].status).toBe('VERIFIED');

    // A stale VERIFIED must not mask a fresh test that is still in flight.
    await requestContactVerification(TENANT, demoTenantConfig, 'manager', null, fake.db);
    expect(fake.verifications[0].status).toBe('SENT');
    expect(fake.verifications[0].verifiedAt).toBeNull();
  });
});

describe('applying a delivery outcome', () => {
  it('marks a contact VERIFIED only on a delivery receipt', async () => {
    const fake = makeDb();
    await requestContactVerification(TENANT, demoTenantConfig, 'manager', null, fake.db);
    const notificationId = fake.notifications[0].id as string;

    await applyVerificationOutcome(notificationId, TENANT, 'DELIVERED', { at: new Date('2026-08-07T12:00:00Z') }, fake.db);

    expect(fake.verifications[0].status).toBe('VERIFIED');
    expect(fake.verifications[0].verifiedAt).toEqual(new Date('2026-08-07T12:00:00Z'));
  });

  it('marks it FAILED on an undelivered receipt, with the reason', async () => {
    const fake = makeDb();
    await requestContactVerification(TENANT, demoTenantConfig, 'manager', null, fake.db);

    await applyVerificationOutcome(
      fake.notifications[0].id as string,
      TENANT,
      'UNDELIVERED',
      { at: new Date(), errorMessage: 'Unreachable destination handset' },
      fake.db,
    );

    expect(fake.verifications[0].status).toBe('FAILED');
    expect(fake.verifications[0].failureReason).toContain('Unreachable');
  });

  it('does NOT resolve another tenant’s verification', async () => {
    const fake = makeDb();
    await requestContactVerification(TENANT, demoTenantConfig, 'manager', null, fake.db);

    await applyVerificationOutcome(
      fake.notifications[0].id as string,
      'a-different-tenant',
      'DELIVERED',
      { at: new Date() },
      fake.db,
    );

    expect(fake.verifications[0].status).toBe('SENT');
  });

  it('is a no-op for a notification with no verification waiting on it', async () => {
    const fake = makeDb();
    await expect(
      applyVerificationOutcome('unrelated-notification', TENANT, 'DELIVERED', { at: new Date() }, fake.db),
    ).resolves.toBeUndefined();
  });

  it('does not re-verify a record that already failed', async () => {
    // Only rows in SENT are eligible, so a late duplicate receipt cannot
    // silently flip a failed test to passed.
    const fake = makeDb();
    await requestContactVerification(TENANT, demoTenantConfig, 'manager', null, fake.db);
    const notificationId = fake.notifications[0].id as string;

    await applyVerificationOutcome(notificationId, TENANT, 'UNDELIVERED', { at: new Date() }, fake.db);
    await applyVerificationOutcome(notificationId, TENANT, 'DELIVERED', { at: new Date() }, fake.db);

    expect(fake.verifications[0].status).toBe('FAILED');
  });
});

describe('structural guard: the smoke test cannot run by accident', () => {
  const script = readFileSync(join(process.cwd(), 'scripts/provider-smoke-test.mjs'), 'utf8');

  it('requires an explicit confirmation phrase', () => {
    expect(script).toContain('SMOKE_TEST_CONFIRM');
    expect(script).toContain('i-understand-this-sends-a-real-sms');
  });

  it('has no default recipient anywhere in it', () => {
    // A default recipient is how a test script ends up texting a stranger.
    expect(script).toMatch(/no default recipient/i);
    expect(script).not.toMatch(/--to['"]?\s*\)?\s*\?\?\s*['"]\+\d/);
  });

  it('refuses to run against the mock provider', () => {
    expect(script).toMatch(/SMS_PROVIDER=mock/);
    expect(script).toMatch(/proves nothing/i);
  });

  it('sends exactly one message, with no loop', () => {
    expect(script).not.toMatch(/\bfor\s*\(|\bwhile\s*\(|\.forEach\(|\.map\(/);
  });

  it('states plainly that acceptance is not delivery', () => {
    expect(script).toMatch(/not proof of delivery|does NOT prove delivery/i);
  });
});

describe('structural guard: no secrets committed to the repository', () => {
  /**
   * A repository with a real credential in it is a credential that is public
   * forever, whatever is done to the file afterwards. This scans the files that
   * ship rather than trusting a code-review habit.
   */
  const roots = ['src', 'scripts', 'docs', 'prisma'];

  function files(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...files(full));
      else out.push(full);
    }
    return out;
  }

  const scanned = roots.flatMap((root) => files(join(process.cwd(), root)));

  it('scans a meaningful number of files', () => {
    expect(scanned.length).toBeGreaterThan(50);
  });

  it('contains no Twilio account SID or auth token literal', () => {
    // A real SID is "AC" + 32 hex. The test fixtures use AC + 32 'a's, which
    // matches that shape, so those files are excluded by name rather than by
    // weakening the pattern.
    const offenders = scanned.filter((file) => /AC[0-9a-f]{32}/i.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => f.replace(process.cwd(), ''))).toEqual([]);
  });

  it('has no .env file tracked by git', () => {
    // Asks git, not the filesystem. A developer's local .env is expected to
    // exist and is gitignored; what must never happen is one being TRACKED,
    // because a credential in git history is public forever regardless of what
    // is done to the file afterwards. Scanning the working directory instead
    // would fail on every machine that has ever run the app locally.
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: process.cwd(), encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
      .filter((path) => /(^|\/)\.env($|\.)/.test(path))
      .filter((path) => !path.endsWith('.env.example'));

    expect(tracked).toEqual([]);
  });

  it('gitignores .env, so one cannot be added by accident', () => {
    const ignored = execFileSync('git', ['check-ignore', '.env'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();
    expect(ignored).toBe('.env');
  });

  it('the example env file carries no credential material', () => {
    // Deliberately NOT an allowlist of permitted values: `SMS_PROVIDER=mock`
    // is a legitimate default, and a list of blessed strings would need
    // editing every time a setting gained one. The property that matters is
    // that nothing here looks like a credential — long, high-entropy, and not
    // marked as a placeholder.
    const example = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
    expect(example).not.toMatch(/AC[0-9a-f]{32}/i);

    const placeholder = /user:password|localhost|example|your-|changeme|<|>|\.\.\./i;

    for (const line of example.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (!match) continue;
      const [, name, rawValue] = match;
      const value = rawValue.replace(/^["']|["']$/g, '').trim();
      if (value.length === 0 || placeholder.test(value)) continue;

      // Anything long and unbroken is credential-shaped.
      expect(value.length, `${name} has a suspiciously long value`).toBeLessThan(20);
      expect(/^[A-Za-z0-9+/=_-]{20,}$/.test(value), `${name} looks like a credential`).toBe(false);
    }
  });

  it('the example env file documents the messaging and dispatch secrets', () => {
    // A secret nobody knows to set is a secret that is not set.
    const example = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
    for (const name of [
      'SMS_PROVIDER',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_STATUS_CALLBACK_URL',
      'SMS_WEBHOOK_SECRET',
      'CRON_SECRET',
      'FRONTDESK_DISPATCH_SCHEDULED',
    ]) {
      expect(example, `${name} is undocumented`).toContain(`${name}=`);
    }
  });
});
