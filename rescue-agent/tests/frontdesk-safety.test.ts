import type { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTenantConfig, type TenantConfig } from '@/lib/frontdesk/config/schema';
import { demoTenantBConfig, demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import { ALERT_CLAIM, accumulateSlots, retractAlertClaim, runTurn } from '@/lib/frontdesk/engine';
import { hasAlertPath } from '@/lib/frontdesk/guardrails';
import { startOfLocalDay, tenantTimezone } from '@/lib/frontdesk/knowledge/hours';
import { resolveKnowledge } from '@/lib/frontdesk/knowledge/resolver';
import type { ConsentStatus } from '@/lib/frontdesk/messaging/consent';
import { windowStart } from '@/lib/frontdesk/messaging/rateLimit';
import { queueMessage } from '@/lib/frontdesk/messaging/send';
import { enqueueEscalationNotifications, type EscalationToNotify } from '@/lib/frontdesk/notify/escalation';
import { normaliseNumber } from '@/lib/frontdesk/notify/provider';
import { getTodaySummary } from '@/lib/frontdesk/store';

/**
 * MILESTONE 5 — SAFETY-CRITICAL BEHAVIOUR
 *
 * Every test here pins a promise the system makes to a person who is having a
 * bad day: someone reporting food poisoning, someone in an emergency, an owner
 * reading a "Today" number they will make a staffing decision on. The common
 * failure mode is not a crash — it is the system confidently saying something
 * untrue and nobody finding out. These are the assertions that make that
 * impossible rather than unlikely.
 */

// --- Config builders --------------------------------------------------------

function config(overrides: Partial<TenantConfig> = {}): TenantConfig {
  return { ...demoTenantConfig, ...overrides };
}

/** Same restaurant, but nothing it says can leave the building by SMS. */
const noSmsConfig = config({
  messaging: { ...demoTenantConfig.messaging, smsEnabled: false },
});

const noFromNumberConfig = config({
  messaging: { ...demoTenantConfig.messaging, fromNumber: undefined },
});

const noContactPhonesConfig = config({
  escalationContacts: [{ key: 'manager', name: 'Dana Whitfield (DEMO)', email: 'manager@harbor-house-demo.invalid' }],
});

const URGENT_NUMBER = normaliseNumber('(555) 010-0199') as string;
const MANAGER_NUMBER = normaliseNumber('(555) 010-0111') as string;

// --- In-memory Prisma double ------------------------------------------------

/**
 * A hand-written fake rather than a mocking library, so what each store call
 * does is visible in this file. It implements only the calls the messaging and
 * escalation paths actually make; anything else throws loudly rather than
 * returning undefined and producing a test that passes for the wrong reason.
 */
function makeDb() {
  const notifications: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];
  const counters = new Map<string, number>();
  const consents = new Map<string, { status: ConsentStatus; lastInboundAt: Date | null }>();

  type CounterWhere = {
    tenantId_scope_subject_windowStart: { tenantId: string; scope: string; subject: string; windowStart: Date };
  };
  const counterKey = (where: CounterWhere) => {
    const k = where.tenantId_scope_subject_windowStart;
    return `${k.tenantId}|${k.scope}|${k.subject}|${new Date(k.windowStart).toISOString()}`;
  };

  const db = {
    fdConsent: {
      findUnique: async ({ where }: { where: { tenantId_phone: { tenantId: string; phone: string } } }) =>
        consents.get(`${where.tenantId_phone.tenantId}|${where.tenantId_phone.phone}`) ?? null,
    },
    fdRateCounter: {
      findUnique: async ({ where }: { where: CounterWhere }) => {
        const count = counters.get(counterKey(where));
        return count === undefined ? null : { count };
      },
      upsert: async ({ where }: { where: CounterWhere }) => {
        const key = counterKey(where);
        counters.set(key, (counters.get(key) ?? 0) + 1);
        return {};
      },
    },
    fdNotification: {
      count: async ({ where }: { where: { tenantId: string; toNumber: string; purpose: { in: string[] } } }) =>
        notifications.filter(
          (n) =>
            n.tenantId === where.tenantId &&
            n.toNumber === where.toNumber &&
            where.purpose.in.includes(n.purpose as string),
        ).length,
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
  };

  return {
    db: db as unknown as PrismaClient,
    notifications,
    failures,
    /** Numbers a message was queued to, in order. */
    sentTo: () => notifications.map((n) => n.toNumber as string),
    failureOps: () => failures.map((f) => f.operation as string),
    optOut(tenantId: string, phone: string) {
      consents.set(`${tenantId}|${phone}`, { status: 'OPTED_OUT', lastInboundAt: null });
    },
    /** Pre-load an hourly send counter as if messages had already gone out. */
    setCounter(tenantId: string, scope: 'NUMBER' | 'TENANT', subject: string, at: Date, count: number) {
      counters.set(`${tenantId}|${scope}|${subject}|${windowStart(at).toISOString()}`, count);
    },
  };
}

const TENANT = 'tenant-harbor';

function escalation(overrides: Partial<EscalationToNotify> = {}): EscalationToNotify {
  return {
    escalationId: 'esc-1',
    reason: 'FOOD_SAFETY',
    severity: 'CRITICAL',
    summary: 'Customer reported becoming unwell after dinner',
    customerName: 'Jordan',
    contact: '+15551234567',
    routeTo: 'urgent',
    ...overrides,
  };
}

// ===========================================================================
// 1. TRUTHFUL EMERGENCY ESCALATION
// ===========================================================================

describe('hasAlertPath', () => {
  it('is true when SMS is on, a sending number exists and the routed contact has a phone', () => {
    expect(hasAlertPath(demoTenantConfig, 'urgent')).toBe(true);
  });

  it('is false when SMS is switched off for the restaurant', () => {
    expect(hasAlertPath(noSmsConfig, 'urgent')).toBe(false);
  });

  it('is false when no sending number is configured', () => {
    expect(hasAlertPath(noFromNumberConfig, 'urgent')).toBe(false);
  });

  it('is false when no configured contact has a phone number at all', () => {
    expect(hasAlertPath(noContactPhonesConfig, 'urgent')).toBe(false);
  });

  it('is true when the routed contact has no phone but another contact does', () => {
    // CRITICAL alerts fall back to any reachable contact, so a path exists.
    const partial = config({
      escalationContacts: [
        { key: 'urgent', name: 'On duty (DEMO)' },
        { key: 'manager', name: 'Dana Whitfield (DEMO)', phone: '(555) 010-0111' },
      ],
    });
    expect(hasAlertPath(partial, 'urgent')).toBe(true);
  });

  it('is false for the second demo restaurant, which has SMS off', () => {
    expect(hasAlertPath(demoTenantBConfig, 'manager')).toBe(false);
  });
});

describe('emergency and food-safety replies only claim what is true', () => {
  const now = new Date('2025-03-11T18:00:00Z');
  const emergency = 'There is a fire in your kitchen, someone is hurt';
  const foodSafety = 'I got food poisoning from the fish last night and I am throwing up';

  it('always tells an emergency caller to ring 911 first', () => {
    for (const cfg of [demoTenantConfig, noSmsConfig]) {
      const turn = runTurn({ config: cfg, message: emergency, now });
      expect(turn.reply).toMatch(/911/);
    }
  });

  it('claims the team was flagged only when an alert can actually be sent', () => {
    const turn = runTurn({ config: demoTenantConfig, message: emergency, now });
    expect(turn.reply).toContain("I've flagged this for the restaurant team");
    expect(turn.needsHuman).toBe(true);
    expect(turn.answerSource).toBe('ESCALATED');
  });

  it('does NOT claim the team was flagged when no alert can leave', () => {
    const turn = runTurn({ config: noSmsConfig, message: emergency, now });
    expect(turn.reply).not.toContain('flagged');
    expect(turn.reply).not.toMatch(/notified|alerted|let (the|them) (team|staff) know/i);
  });

  it("points a caller at the restaurant's own phone number when it cannot alert anyone", () => {
    const turn = runTurn({ config: noSmsConfig, message: emergency, now });
    expect(turn.reply).toContain("not able to reach the restaurant's team directly");
    expect(turn.reply).toContain(demoTenantConfig.mainPhone as string);
  });

  it('says so plainly when there is no phone number to fall back on either', () => {
    const stranded = config({
      mainPhone: undefined,
      messaging: { ...demoTenantConfig.messaging, smsEnabled: false },
    });
    const turn = runTurn({ config: stranded, message: emergency, now });
    expect(turn.reply).toContain('please contact them directly');
    expect(turn.reply).not.toContain('flagged');
  });

  it('still escalates a food-safety report even when it cannot promise an alert', () => {
    // The escalation RECORD is the durable obligation. Losing the SMS must not
    // lose the incident.
    const turn = runTurn({ config: noSmsConfig, message: foodSafety, now });
    expect(turn.needsHuman).toBe(true);
    expect(turn.actions.some((a) => a.type === 'ESCALATE')).toBe(true);
    expect(turn.reply).not.toContain('flagged');
  });

  it('never diagnoses, apologises for liability, or promises compensation', () => {
    for (const cfg of [demoTenantConfig, noSmsConfig]) {
      const turn = runTurn({ config: cfg, message: foodSafety, now });
      expect(turn.reply).not.toMatch(/refund|compensat|our fault|we are liable|reimburse/i);
    }
  });
});

describe('retracting the alert claim when dispatch reached nobody', () => {
  const now = new Date('2025-03-11T18:00:00Z');
  const emergency = 'There is a fire in your kitchen, someone is hurt';

  it('takes the claim back out and points at the restaurant instead', () => {
    // hasAlertPath only sees CONFIGURATION. A contact who texted STOP since is
    // configured but unreachable, and only dispatch knows that.
    const promised = runTurn({ config: demoTenantConfig, message: emergency, now }).reply;
    expect(promised).toContain(ALERT_CLAIM.trim());

    const corrected = retractAlertClaim(promised, demoTenantConfig);
    expect(corrected).not.toContain('flagged');
    expect(corrected).toContain(demoTenantConfig.mainPhone as string);
    expect(corrected).toMatch(/911/);
  });

  it('leaves a reply that never made the claim untouched', () => {
    const honest = runTurn({ config: noSmsConfig, message: emergency, now }).reply;
    expect(retractAlertClaim(honest, noSmsConfig)).toBe(honest);
  });

  it('does not print the same phone number twice', () => {
    // The food-safety reply already says "call us on ...".
    const promised = runTurn({
      config: demoTenantConfig,
      message: 'I got food poisoning from the fish last night and I am throwing up',
      now,
    }).reply;
    const corrected = retractAlertClaim(promised, demoTenantConfig);

    const phone = demoTenantConfig.mainPhone as string;
    const occurrences = corrected.split(phone).length - 1;
    expect(occurrences).toBe(1);
    expect(corrected).not.toContain('flagged');
  });

  it('is a no-op for a restaurant with no phone number to redirect to', () => {
    const stranded = config({ mainPhone: undefined });
    const promised = runTurn({ config: stranded, message: emergency, now }).reply;
    const corrected = retractAlertClaim(promised, stranded);
    expect(corrected).toContain('please contact them directly');
    expect(corrected).not.toContain('flagged');
  });
});

// ===========================================================================
// 2. CRITICAL ALERTS vs SPEND LIMITS vs CONSENT
// ===========================================================================

describe('critical alerts and the hourly spend limit', () => {
  // queueMessage windows on the real clock, so the pre-loaded counter has to
  // sit in the window that is actually current when the test runs.
  const now = new Date();
  const cap = demoTenantConfig.messaging.rateLimitPerNumberPerHour as number;

  it('blocks an ordinary alert once the per-number hourly cap is reached', async () => {
    const fake = makeDb();
    fake.setCounter(TENANT, 'NUMBER', URGENT_NUMBER, now, cap);

    const result = await queueMessage(
      { tenantId: TENANT, config: demoTenantConfig, toNumber: URGENT_NUMBER, body: 'x', purpose: 'ESCALATION_ALERT' },
      fake.db,
    );

    expect(result.queued).toBe(false);
    expect(fake.notifications).toHaveLength(0);
    expect(fake.failureOps()).toContain('messaging.blocked.escalation_alert');
  });

  it('lets a CRITICAL alert through the same cap', async () => {
    // A few cents of spend must not be what silences a food-safety alert.
    const fake = makeDb();
    fake.setCounter(TENANT, 'NUMBER', URGENT_NUMBER, now, cap);

    const result = await queueMessage(
      {
        tenantId: TENANT,
        config: demoTenantConfig,
        toNumber: URGENT_NUMBER,
        body: 'x',
        purpose: 'ESCALATION_ALERT',
        critical: true,
      },
      fake.db,
    );

    expect(result.queued).toBe(true);
    expect(fake.sentTo()).toEqual([URGENT_NUMBER]);
  });

  it('still counts a critical send, so the spend stays visible', async () => {
    const fake = makeDb();
    await queueMessage(
      {
        tenantId: TENANT,
        config: demoTenantConfig,
        toNumber: URGENT_NUMBER,
        body: 'x',
        purpose: 'ESCALATION_ALERT',
        critical: true,
      },
      fake.db,
    );
    // The counter was incremented by the send itself; a following ordinary
    // message sees the higher count.
    const second = await queueMessage(
      { tenantId: TENANT, config: demoTenantConfig, toNumber: URGENT_NUMBER, body: 'x', purpose: 'ESCALATION_ALERT' },
      fake.db,
    );
    expect(second.queued).toBe(true);
    expect(fake.notifications).toHaveLength(2);
  });

  it('does NOT let a CRITICAL alert override a STOP', async () => {
    // Consent is a legal obligation, not a cost control. The refusal is filed
    // loudly instead so the routing gets fixed.
    const fake = makeDb();
    fake.optOut(TENANT, URGENT_NUMBER);

    const result = await queueMessage(
      {
        tenantId: TENANT,
        config: demoTenantConfig,
        toNumber: URGENT_NUMBER,
        body: 'x',
        purpose: 'ESCALATION_ALERT',
        critical: true,
      },
      fake.db,
    );

    expect(result).toMatchObject({ queued: false, reason: 'OPTED_OUT' });
    expect(fake.notifications).toHaveLength(0);
    expect(fake.failures[0]?.detail).toContain('STAFF ALERT NOT SENT');
  });

  it('does not let a critical flag bypass a missing sending number', async () => {
    const fake = makeDb();
    const result = await queueMessage(
      {
        tenantId: TENANT,
        config: noFromNumberConfig,
        toNumber: URGENT_NUMBER,
        body: 'x',
        purpose: 'ESCALATION_ALERT',
        critical: true,
      },
      fake.db,
    );
    expect(result).toMatchObject({ queued: false, reason: 'SMS_UNAVAILABLE' });
  });
});

// ===========================================================================
// 3. CRITICAL FALLBACK CONTACT CHAIN
// ===========================================================================

describe('critical escalation fallback chain', () => {
  it('reaches another contact when the routed one has opted out', async () => {
    const fake = makeDb();
    fake.optOut(TENANT, URGENT_NUMBER);

    const summary = await enqueueEscalationNotifications(TENANT, demoTenantConfig, [escalation()], fake.db);

    expect(summary).toEqual({ queued: 1, skipped: 0 });
    expect(fake.sentTo()).not.toContain(URGENT_NUMBER);
    expect(fake.sentTo()).toHaveLength(1);
    expect(fake.failureOps()).toContain('escalation.fallback');
  });

  it('names the primary contact in the fallback record so the routing gets fixed', async () => {
    const fake = makeDb();
    fake.optOut(TENANT, URGENT_NUMBER);

    await enqueueEscalationNotifications(TENANT, demoTenantConfig, [escalation()], fake.db);

    const fallback = fake.failures.find((f) => f.operation === 'escalation.fallback');
    expect(fallback?.detail).toContain('urgent');
    expect(fallback?.referenceId).toBe('esc-1');
  });

  it('falls back when the routed contact has no phone number configured', async () => {
    // hasAlertPath counts this restaurant as reachable, so dispatch must agree.
    const partial = config({
      escalationContacts: [
        { key: 'urgent', name: 'On duty (DEMO)' },
        { key: 'manager', name: 'Dana Whitfield (DEMO)', phone: '(555) 010-0111' },
      ],
    });
    const fake = makeDb();

    const summary = await enqueueEscalationNotifications(TENANT, partial, [escalation()], fake.db);

    expect(summary).toEqual({ queued: 1, skipped: 0 });
    expect(fake.sentTo()).toEqual([MANAGER_NUMBER]);
  });

  it('keeps going past a second unreachable contact', async () => {
    const fake = makeDb();
    fake.optOut(TENANT, URGENT_NUMBER);
    fake.optOut(TENANT, MANAGER_NUMBER);

    const summary = await enqueueEscalationNotifications(TENANT, demoTenantConfig, [escalation()], fake.db);

    expect(summary).toEqual({ queued: 1, skipped: 0 });
    expect(fake.sentTo()).toHaveLength(1);
    expect(fake.sentTo()[0]).not.toBe(URGENT_NUMBER);
    expect(fake.sentTo()[0]).not.toBe(MANAGER_NUMBER);
  });

  it('files the loudest possible failure when NOBODY can be reached', async () => {
    const fake = makeDb();
    for (const contact of demoTenantConfig.escalationContacts) {
      if (contact.phone) fake.optOut(TENANT, normaliseNumber(contact.phone) as string);
    }

    const summary = await enqueueEscalationNotifications(TENANT, demoTenantConfig, [escalation()], fake.db);

    expect(summary).toEqual({ queued: 0, skipped: 1 });
    expect(fake.notifications).toHaveLength(0);

    const unreachable = fake.failures.find((f) => f.operation === 'escalation.critical_unreachable');
    expect(unreachable).toBeDefined();
    expect(unreachable?.category).toBe('FAILED_SMS');
    expect(unreachable?.detail).toContain('CRITICAL ALERT REACHED NOBODY');
    expect(unreachable?.lastError).toBe('NO_REACHABLE_CONTACT');
  });

  it('does NOT fan out a non-critical escalation to every contact', async () => {
    // Messaging three managers about a routine complaint is how an alert
    // channel gets muted.
    const fake = makeDb();
    fake.optOut(TENANT, MANAGER_NUMBER);

    const summary = await enqueueEscalationNotifications(
      TENANT,
      demoTenantConfig,
      [escalation({ reason: 'COMPLAINT', severity: 'HIGH', routeTo: 'manager' })],
      fake.db,
    );

    expect(summary).toEqual({ queued: 0, skipped: 1 });
    expect(fake.notifications).toHaveLength(0);
    expect(fake.failureOps()).not.toContain('escalation.fallback');
    expect(fake.failureOps()).not.toContain('escalation.critical_unreachable');
  });

  it('does not attempt a fallback when SMS is switched off entirely', async () => {
    const fake = makeDb();
    const summary = await enqueueEscalationNotifications(TENANT, noSmsConfig, [escalation()], fake.db);

    expect(summary).toEqual({ queued: 0, skipped: 1 });
    expect(fake.failureOps()).toEqual(['escalation.notify']);
  });

  it('never sends the same critical alert to the same number twice', async () => {
    const fake = makeDb();
    fake.optOut(TENANT, URGENT_NUMBER);

    await enqueueEscalationNotifications(TENANT, demoTenantConfig, [escalation()], fake.db);

    const numbers = fake.sentTo();
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

// ===========================================================================
// 4. TENANT-LOCAL "TODAY" REPORTING WINDOW
// ===========================================================================

describe('tenant-local Today window', () => {
  it('starts the day at local midnight, not UTC midnight', () => {
    // 03:00 UTC on 11 March is still 23:00 on 10 March in New York, so "today"
    // for that restaurant began at 04:00 UTC — a full day earlier than a naive
    // UTC-midnight boundary would have started counting.
    const now = new Date('2025-03-11T03:00:00Z');
    const since = startOfLocalDay(now, 'America/New_York');
    expect(since.toISOString()).toBe('2025-03-10T04:00:00.000Z');
  });

  it('never returns a boundary in the future', () => {
    for (const zone of ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata', 'Pacific/Auckland']) {
      const now = new Date('2025-07-04T09:30:00Z');
      expect(startOfLocalDay(now, zone).getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it('never returns a boundary more than 24 hours back', () => {
    for (const zone of ['America/New_York', 'Asia/Kolkata', 'Pacific/Auckland', 'Pacific/Honolulu']) {
      const now = new Date('2025-07-04T09:30:00Z');
      const delta = now.getTime() - startOfLocalDay(now, zone).getTime();
      expect(delta).toBeLessThan(24 * 60 * 60 * 1000);
    }
  });

  it('handles a half-hour offset zone', () => {
    const now = new Date('2025-07-04T09:30:00Z');
    // Kolkata is UTC+05:30, so its day began at 18:30 UTC the previous day.
    expect(startOfLocalDay(now, 'Asia/Kolkata').toISOString()).toBe('2025-07-03T18:30:00.000Z');
  });

  it('handles a zone ahead of UTC, where local midnight is yesterday in UTC', () => {
    const now = new Date('2025-07-04T09:30:00Z');
    // Auckland is UTC+12 in July, so 09:30 UTC is 21:30 the same local day.
    expect(startOfLocalDay(now, 'Pacific/Auckland').toISOString()).toBe('2025-07-03T12:00:00.000Z');
  });

  it('lands on the correct instant across a spring-forward transition', () => {
    // US DST began 02:00 local on 9 March 2025. Later that day the offset is
    // -04:00, but the day itself began while the offset was still -05:00.
    const now = new Date('2025-03-09T20:00:00Z');
    expect(startOfLocalDay(now, 'America/New_York').toISOString()).toBe('2025-03-09T05:00:00.000Z');
  });

  it('lands on the correct instant across a fall-back transition', () => {
    // DST ended 02:00 local on 2 November 2025; the day began at -04:00.
    const now = new Date('2025-11-02T20:00:00Z');
    expect(startOfLocalDay(now, 'America/New_York').toISOString()).toBe('2025-11-02T04:00:00.000Z');
  });

  it('is not the same instant as UTC midnight for a US restaurant', () => {
    const now = new Date('2025-07-04T09:30:00Z');
    const utcMidnight = new Date('2025-07-04T00:00:00Z');
    expect(startOfLocalDay(now, 'America/New_York').getTime()).not.toBe(utcMidnight.getTime());
  });

  it('applies the same boundary to every metric getTodaySummary reports', async () => {
    // A window applied to conversations but not to leads would produce a
    // dashboard whose totals silently disagree with each other.
    const since = startOfLocalDay(new Date('2025-07-04T09:30:00Z'), 'America/New_York');
    const seen: Array<Record<string, unknown>> = [];
    const capture = (where: Record<string, unknown>) => {
      seen.push(where);
      return where;
    };

    const db = {
      fdConversation: { count: async ({ where }: never) => (capture(where), 0) },
      fdMessage: { findMany: async ({ where }: never) => (capture(where), []) },
      fdLead: { findMany: async ({ where }: never) => (capture(where), []) },
      fdEscalation: { count: async ({ where }: never) => (capture(where), 0) },
    } as unknown as PrismaClient;

    await getTodaySummary('tenant-a', since, db);

    // Every windowed query uses the identical boundary...
    const windowed = seen.filter((w) => 'startedAt' in w || 'createdAt' in w);
    expect(windowed.length).toBeGreaterThanOrEqual(4);
    for (const where of windowed) {
      const range = (where.startedAt ?? where.createdAt) as { gte: Date };
      expect(range.gte.getTime()).toBe(since.getTime());
    }
    // ...and every query is scoped to the tenant.
    for (const where of seen) {
      expect(where.tenantId).toBe('tenant-a');
    }
  });

  it('counts open escalations without a time window, since an old one is still open', async () => {
    const since = new Date('2025-07-04T04:00:00Z');
    let escalationWhere: Record<string, unknown> = {};
    const db = {
      fdConversation: { count: async () => 0 },
      fdMessage: { findMany: async () => [] },
      fdLead: { findMany: async () => [] },
      fdEscalation: {
        count: async ({ where }: { where: Record<string, unknown> }) => {
          escalationWhere = where;
          return 3;
        },
      },
    } as unknown as PrismaClient;

    const summary = await getTodaySummary('tenant-a', since, db);
    expect(summary.openEscalations).toBe(3);
    expect(escalationWhere).toEqual({ tenantId: 'tenant-a', status: 'OPEN' });
  });
});

// ===========================================================================
// 5. TIMEZONE CONFIGURATION
// ===========================================================================

describe('IANA timezone validation', () => {
  const withTimezone = (timezone: string) => ({
    ...demoTenantConfig,
    locations: [{ ...demoTenantConfig.locations[0], timezone }],
  });

  it.each([
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Asia/Kolkata',
    'Pacific/Auckland',
    'UTC',
  ])('accepts %s', (timezone) => {
    expect(parseTenantConfig(withTimezone(timezone)).ok).toBe(true);
  });

  it.each([
    ['EST5EDT_TYPO', 'a near-miss abbreviation'],
    ['America/New York', 'a space instead of an underscore'],
    ['Eastern Standard Time', 'a Windows-style name'],
    ['GMT+5', 'an offset that is not a zone'],
    ['', 'an empty string'],
    ['not/a/zone', 'nonsense'],
  ])('rejects %j (%s)', (timezone) => {
    const parsed = parseTenantConfig(withTimezone(timezone));
    expect(parsed.ok).toBe(false);
  });

  it('explains WHICH field is wrong so an operator can fix it', () => {
    const parsed = parseTenantConfig(withTimezone('Eastern Standard Time'));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('timezone');
      expect(parsed.error).toMatch(/IANA/i);
    }
  });

  it('rejects the whole config rather than dropping the bad location', () => {
    // A tenant that loads with one location silently missing would answer
    // "we have one location" about a two-location restaurant.
    const twoLocations = {
      ...demoTenantConfig,
      locations: [
        demoTenantConfig.locations[0],
        { ...demoTenantConfig.locations[0], label: 'Second', timezone: 'Nowhere/Fake' },
      ],
    };
    expect(parseTenantConfig(twoLocations).ok).toBe(false);
  });
});

describe('no silent UTC default', () => {
  const noLocation = config({ locations: [] });
  const now = new Date('2025-07-04T09:30:00Z');

  it('reports no timezone rather than inventing one', () => {
    expect(tenantTimezone(noLocation)).toBeNull();
    expect(tenantTimezone(demoTenantConfig)).toBe('America/New_York');
  });

  it('defers a promotions question instead of reading the date off UTC', () => {
    const withPromo = config({
      locations: [],
      promotions: [{ id: 'promo-oysters', title: 'Half-price oysters', details: 'All night', startsOn: '2025-07-04', endsOn: '2025-07-04' }],
    });
    const result = resolveKnowledge('SPECIALS', withPromo, 'any specials on?', now);
    expect(result.resolved).toBe(false);
  });

  it('still answers promotions normally once a timezone is configured', () => {
    const withPromo = config({
      promotions: [{ id: 'promo-oysters', title: 'Half-price oysters', details: 'All night', startsOn: '2025-07-04', endsOn: '2025-07-04' }],
    });
    const result = resolveKnowledge('SPECIALS', withPromo, 'any specials on?', now);
    expect(result.resolved).toBe(true);
  });

  it('does not resolve a relative date against UTC when no timezone is configured', () => {
    // 09:30 UTC on 4 July is still 3 July in Los Angeles. Guessing here writes
    // the wrong day onto a reservation lead.
    const withZone = accumulateSlots(['a table tomorrow at 7pm'], now, 'America/Los_Angeles');
    const withoutZone = accumulateSlots(['a table tomorrow at 7pm'], now, null);

    expect(withZone.requestedDate).toBeTruthy();
    expect(withoutZone.requestedDate).toBeNull();
    // The time is timezone-independent, so it is still captured.
    expect(withoutZone.requestedTime).toBe(withZone.requestedTime);
  });

  it('asks for the date rather than assuming one', () => {
    const turn = runTurn({
      config: noLocation,
      message: 'I would like a table for 4 tomorrow at 7pm, I am Jamie on 555-123-4567',
      now,
    });
    expect(turn.slots.requestedDate).toBeNull();
    expect(turn.bookingState).not.toBe('CONFIRMED');
  });

  it('hours answers refuse when there is no location at all', () => {
    expect(resolveKnowledge('HOURS', noLocation, 'are you open now?', now).resolved).toBe(false);
  });
});

// ===========================================================================
// 6. REQUESTED IS NOT CONFIRMED
// ===========================================================================

/**
 * Sentences that assert a booking EXISTS. A reply may — and should — talk about
 * confirmation as something still to come; what it may never do is say the
 * table is already held, because the customer would act on that.
 */
const FALSE_BOOKING_CLAIMS = [
  /your (table|reservation|booking) is (now )?(confirmed|booked|reserved|held|secured|set)/i,
  /you(?:'|’)?re (all )?(booked|confirmed|set)/i,
  /(we|i)(?:'ve| have)? (confirmed|booked|reserved|secured) (your|the|a) (table|reservation|booking)/i,
  /(reservation|booking) (is|has been) confirmed/i,
  /table (is|has been) (booked|reserved|held)/i,
  /see you (on|at|then|tomorrow)/i,
];

describe('reservation requests are never presented as confirmed', () => {
  const now = new Date('2025-07-04T14:00:00Z');

  /** A full booking conversation, ending with every slot filled. */
  function completedBooking() {
    const history: Array<{ role: 'CUSTOMER' | 'ASSISTANT'; body: string }> = [];
    const messages = [
      'I would like to book a table',
      'four of us',
      'this Saturday',
      '7:30pm',
      'My name is Jamie Chen and my number is 555-123-4567',
    ];
    let last = runTurn({ config: demoTenantConfig, message: messages[0], now });
    history.push({ role: 'CUSTOMER', body: messages[0] }, { role: 'ASSISTANT', body: last.reply });
    for (const message of messages.slice(1)) {
      last = runTurn({ config: demoTenantConfig, message, now, history: [...history] });
      history.push({ role: 'CUSTOMER', body: message }, { role: 'ASSISTANT', body: last.reply });
    }
    return last;
  }

  it('reaches REQUESTED, never CONFIRMED, on a fully completed booking', () => {
    const turn = completedBooking();
    expect(turn.bookingState).toBe('REQUESTED');
  });

  it('captures a lead the restaurant must act on', () => {
    const turn = completedBooking();
    expect(turn.actions.some((a) => a.type === 'CAPTURE_LEAD')).toBe(true);
  });

  it('never asserts that the booking exists', () => {
    // The word "confirm" is fine and in fact required — "someone will confirm
    // it with you" is the honest wording. What must never appear is a claim
    // that the table already exists, which is the sentence a customer would
    // turn up on.
    const turn = completedBooking();
    for (const pattern of FALSE_BOOKING_CLAIMS) {
      expect(turn.reply).not.toMatch(pattern);
    }
  });

  it('says explicitly that the restaurant still has to confirm', () => {
    const turn = completedBooking();
    expect(turn.reply).toMatch(/confirm|get back to you|follow up/i);
  });

  it('does not claim confirmation for a large party either', () => {
    const turn = runTurn({
      config: demoTenantConfig,
      message: 'Table for 20 on Saturday at 7pm, I am Priya on 555-987-6543',
      now,
    });
    expect(turn.bookingState).not.toBe('CONFIRMED');
    for (const pattern of FALSE_BOOKING_CLAIMS) {
      expect(turn.reply).not.toMatch(pattern);
    }
  });

  it('does not treat a customer asserting a booking as one', () => {
    const turn = runTurn({
      config: demoTenantConfig,
      message: 'My reservation is confirmed for 8pm, right?',
      now,
    });
    expect(turn.bookingState).not.toBe('CONFIRMED');
  });
});

describe('structural guard: CONFIRMED is unreachable', () => {
  /**
   * A source-scanning guard rather than a behavioural one. `CONFIRMED` may only
   * ever be set by a real booking-system integration reporting back a real
   * booking. Until that integration exists, no code path may produce it — and
   * a future contributor adding one should have to delete this test and think
   * about why.
   */
  const roots = ['src/lib/frontdesk', 'src/app/api/frontdesk'];

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  const scanned = roots.flatMap((root) => sourceFiles(join(process.cwd(), root)));

  it('actually reads the front desk source, so a pass is not vacuous', () => {
    expect(scanned.length).toBeGreaterThan(20);
    // The same scan finds the assignment that IS allowed, which proves the
    // pattern below would fire if CONFIRMED were ever introduced.
    const requested = scanned.filter((file) =>
      /bookingState\s*:\s*['"]REQUESTED['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(requested.length).toBeGreaterThan(0);
  });

  it('no front desk source assigns bookingState CONFIRMED', () => {
    const offenders = scanned
      .filter((file) => /bookingState\s*:\s*['"]CONFIRMED['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(process.cwd(), ''));
    expect(offenders).toEqual([]);
  });

  it('the type still allows CONFIRMED, so a real integration has somewhere to put it', () => {
    const types = readFileSync(join(process.cwd(), 'src/lib/frontdesk/types.ts'), 'utf8');
    expect(types).toContain("'CONFIRMED'");
  });
});
