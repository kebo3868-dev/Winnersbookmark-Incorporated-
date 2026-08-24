import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TenantConfig } from '@/lib/frontdesk/config/schema';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import { REVIEW_TENANT_HEADROOM, requestReviewForConversation } from '@/lib/frontdesk/reviews/store';
import { queueMessage } from '@/lib/frontdesk/messaging/send';
import { claimDueNotifications } from '@/lib/frontdesk/notify/store';
import { windowStart } from '@/lib/frontdesk/messaging/rateLimit';

/**
 * REVIEW REQUEST ACTIVATION — SMS.
 *
 * M7c decided who may be asked. This is the part that actually messages a
 * customer, which changes what a mistake costs: an eligibility bug used to
 * write a wrong row, and now sends a real text to a real person on a
 * restaurant's behalf.
 *
 * Two properties carry the weight here:
 *
 *   1. THE ANTI-GATING RULE SURVIVES ACTIVATION. The tempting place to smuggle
 *      "only ask the happy ones" back in is the sending layer, where it would
 *      slip past every test guarding eligibility.ts. One test below reads this
 *      feature's source to assert no sentiment input exists at either layer.
 *
 *   2. A REVIEW REQUEST NEVER COSTS AN ESCALATION. Reviews share the SMS queue,
 *      the rate limits and the dispatch worker with food-safety alerts. Every
 *      way one could displace the other is tested rather than asserted in prose.
 */

const now = new Date('2026-09-01T12:00:00Z');
const TENANT = 'tenant-a';
const CONVO = 'convo-1';
const PHONE = '+17275550142';

const config = (overrides: Partial<TenantConfig> = {}): TenantConfig =>
  ({
    ...demoTenantConfig,
    restaurantName: "Leverock's",
    reviewLink: 'https://g.page/r/leverocks/review',
    reviews: { enabled: true, channel: 'SMS' },
    ...overrides,
  }) as TenantConfig;

/** In-memory stand-in for the Prisma delegates this path touches. */
function fakeDb(options: { escalated?: boolean; demoMode?: boolean; phone?: string | null; tenantSends?: number } = {}) {
  const reviewRequests: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  const consents = new Map<string, { status: string; lastInboundAt: Date | null }>([
    [`${TENANT}:${PHONE}`, { status: 'IMPLIED', lastInboundAt: new Date('2026-09-01T11:00:00Z') }],
  ]);
  const counters = new Map<string, number>();
  if (options.tenantSends) counters.set(`TENANT:${TENANT}`, options.tenantSends);
  let seq = 0;

  const db = {
    fdConversation: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === CONVO && where.tenantId === TENANT
          ? {
              id: CONVO,
              customerPhone: options.phone === undefined ? PHONE : options.phone,
              escalated: options.escalated ?? false,
              demoMode: options.demoMode ?? false,
            }
          : null,
    },
    fdTenant: {
      findUnique: async () => ({ demoMode: options.demoMode ?? false }),
    },
    fdReviewRequest: {
      findUnique: async ({ where }: { where: { tenantId_conversationId: { tenantId: string; conversationId: string } } }) =>
        reviewRequests.find(
          (r) =>
            r.tenantId === where.tenantId_conversationId.tenantId &&
            r.conversationId === where.tenantId_conversationId.conversationId,
        ) ?? null,
      findFirst: async ({ where }: { where: { tenantId: string; destination: string; status: { in: string[] } } }) =>
        reviewRequests
          .filter(
            (r) => r.tenantId === where.tenantId && r.destination === where.destination && where.status.in.includes(r.status as string),
          )
          .sort((a, b) => Number(b.requestedAt ?? 0) - Number(a.requestedAt ?? 0))[0] ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        // The real guard is a UNIQUE index; the fake enforces it so the
        // idempotency tests exercise a constraint rather than a lucky path.
        const clash = reviewRequests.some(
          (r) => r.tenantId === data.tenantId && r.conversationId === data.conversationId,
        );
        if (clash) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        const row = { id: `rr-${++seq}`, ...data };
        reviewRequests.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = reviewRequests.find((r) => r.id === where.id) as Record<string, unknown>;
        Object.assign(row, data);
        return row;
      },
    },
    fdConsent: {
      findUnique: async ({ where }: { where: { tenantId_phone: { tenantId: string; phone: string } } }) =>
        consents.get(`${where.tenantId_phone.tenantId}:${where.tenantId_phone.phone}`) ?? null,
    },
    fdRateCounter: {
      findUnique: async ({ where }: { where: { tenantId_scope_subject_windowStart: { scope: string; subject: string } } }) => {
        const k = `${where.tenantId_scope_subject_windowStart.scope}:${where.tenantId_scope_subject_windowStart.subject}`;
        return counters.has(k) ? { count: counters.get(k) } : null;
      },
      upsert: async ({ where }: { where: { tenantId_scope_subject_windowStart: { scope: string; subject: string } } }) => {
        const k = `${where.tenantId_scope_subject_windowStart.scope}:${where.tenantId_scope_subject_windowStart.subject}`;
        counters.set(k, (counters.get(k) ?? 0) + 1);
        return {};
      },
    },
    fdNotification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `n-${++seq}`, ...data };
        notifications.push(row);
        return row;
      },
      count: async () => 0,
    },
    fdFailure: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        failures.push(data);
        return data;
      },
    },
  };

  // `db` is the cast the production signature wants; `raw` keeps the concrete
  // shape so a spy can reach a delegate without fighting the cast.
  return { db: db as never, raw: db, reviewRequests, notifications, failures, counters, consents };
}

const run = (cfg: TenantConfig, fake: ReturnType<typeof fakeDb>, at: Date = now) =>
  requestReviewForConversation(TENANT, CONVO, cfg, fake.db, at);

const sourceOf = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/**
 * Source with comments removed.
 *
 * The absence assertions below are about CODE. Run against raw text they fail
 * on the doc comments explaining why the thing is absent, which would train the
 * next person to delete the explanation to make the test pass.
 */
const codeOf = (path: string) =>
  sourceOf(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('reviews are off until a restaurant turns them on', () => {
  it('sends nothing when reviews are disabled', async () => {
    const fake = fakeDb();
    const result = await run(config({ reviews: { enabled: false, channel: 'SMS' } }), fake);
    expect(result.outcome).toBe('SUPPRESSED');
    if (result.outcome === 'SUPPRESSED') expect(result.reason).toBe('REVIEWS_DISABLED');
    expect(fake.notifications).toHaveLength(0);
  });

  it('sends nothing under the shipped default, so gaining this code messages nobody', async () => {
    // demoTenantConfig ships reviews.enabled false; this asserts the DEFAULT
    // rather than an explicitly-disabled override.
    expect(demoTenantConfig.reviews.enabled).toBe(false);
    const fake = fakeDb();
    const result = await run(demoTenantConfig, fake);
    expect(result.outcome).toBe('SUPPRESSED');
    expect(fake.notifications).toHaveLength(0);
  });

  it('records the refusal instead of leaving no trace', async () => {
    const fake = fakeDb();
    await run(config({ reviews: { enabled: false, channel: 'SMS' } }), fake);
    expect(fake.reviewRequests).toHaveLength(1);
    expect(fake.reviewRequests[0].status).toBe('SUPPRESSED');
    expect(fake.reviewRequests[0].suppressedReason).toMatch(/REVIEWS_DISABLED/);
  });

  it('refuses a channel that is not SMS rather than silently substituting one', async () => {
    const fake = fakeDb();
    const result = await run(config({ reviews: { enabled: true, channel: 'EMAIL' } }), fake);
    expect(result.outcome).toBe('SUPPRESSED');
    if (result.outcome === 'SUPPRESSED') expect(result.reason).toBe('CHANNEL_UNAVAILABLE');
    expect(fake.notifications).toHaveLength(0);
  });
});

describe('a destination is never invented', () => {
  it('sends nothing when no review URL is configured', async () => {
    const fake = fakeDb();
    const result = await run(config({ reviewLink: undefined }), fake);
    expect(result.outcome).toBe('SUPPRESSED');
    if (result.outcome === 'SUPPRESSED') expect(result.reason).toBe('NO_REVIEW_LINK');
    expect(fake.notifications).toHaveLength(0);
  });

  it('never constructs a Google or Yelp URL', async () => {
    expect(/google\.|g\.page|yelp\./i.test(codeOf('src/lib/frontdesk/reviews/store.ts')), 'no review destination is hardcoded').toBe(false);
  });

  it('sends the restaurant-configured link verbatim', async () => {
    const fake = fakeDb();
    await run(config(), fake);
    expect(fake.notifications[0].body).toContain('https://g.page/r/leverocks/review');
  });

  it('sends nothing when the conversation has no usable phone number', async () => {
    const fake = fakeDb({ phone: null });
    const result = await run(config(), fake);
    expect(result.outcome).toBe('SUPPRESSED');
    expect(fake.notifications).toHaveLength(0);
  });
});

describe('escalated interactions are never solicited', () => {
  it('sends nothing for an interaction that escalated', async () => {
    const fake = fakeDb({ escalated: true });
    const result = await run(config(), fake);
    expect(result.outcome).toBe('SUPPRESSED');
    if (result.outcome === 'SUPPRESSED') {
      expect(result.reason).toBe('ESCALATED');
      // Protective, not selective: they are owed follow-up, not filtered out.
      expect(result.detail).toMatch(/owed follow-up/i);
    }
    expect(fake.notifications).toHaveLength(0);
  });
});

describe('the anti-gating rule survives activation', () => {
  it('takes no sentiment input at the sending layer either', () => {
    // The sending layer is where a sentiment check would evade every test
    // guarding eligibility.ts, so the absence is asserted here too.
    expect(
      /(sentiment|satisfaction|rating|happiness|mood|positive|negative)/i.test(codeOf('src/lib/frontdesk/reviews/store.ts')),
      'no sentiment-like value is consulted in code',
    ).toBe(false);
  });

  it('calls eligibility with exactly the inputs it already took', () => {
    const source = sourceOf('src/lib/frontdesk/reviews/store.ts');
    const call = source.slice(source.indexOf('checkReviewEligibility({'));
    const keys = Array.from(call.slice(0, call.indexOf('});')).matchAll(/^\s{6}(\w+)[:,]/gm)).map((m) => m[1]);
    expect(keys.sort()).toEqual(
      ['alreadyRequestedForInteraction', 'config', 'consentStatus', 'demoMode', 'escalated', 'lastRequestedAt', 'now'].sort(),
    );
  });

  it('sends for two customers whose conversations differed only in what was said', async () => {
    // The store reads `escalated` and nothing else about the conversation, so
    // two non-escalated interactions are indistinguishable to it.
    const a = fakeDb();
    const b = fakeDb();
    const first = await run(config(), a);
    const second = await run(config(), b);
    expect(first.outcome).toBe('SENT');
    expect(second.outcome).toBe('SENT');
    expect(a.notifications[0].body).toBe(b.notifications[0].body);
  });

  it('asks for honest feedback and offers nothing in exchange', async () => {
    const fake = fakeDb();
    await run(config(), fake);
    const body = fake.notifications[0].body as string;
    expect(body).toMatch(/honest feedback/i);
    expect(body).not.toMatch(/5[- ]star|five[- ]star|positive review|good review/i);
    expect(body).not.toMatch(/discount|free|voucher|reward|coupon/i);
    expect(body).toMatch(/STOP/);
  });
});

describe('demo tenants never message anyone', () => {
  it('refuses a demo conversation', async () => {
    const fake = fakeDb({ demoMode: true });
    const result = await run(config(), fake);
    expect(result.outcome).toBe('SUPPRESSED');
    if (result.outcome === 'SUPPRESSED') expect(result.reason).toBe('DEMO_TENANT');
    expect(fake.notifications).toHaveLength(0);
  });
});

describe('idempotency — one interaction can never be asked twice', () => {
  it('does not send a second message when processed twice', async () => {
    const fake = fakeDb();
    const first = await run(config(), fake);
    const second = await run(config(), fake);
    expect(first.outcome).toBe('SENT');
    expect(second.outcome).toBe('ALREADY_REQUESTED');
    expect(fake.notifications).toHaveLength(1);
    expect(fake.reviewRequests).toHaveLength(1);
  });

  it('loses the insert rather than sending, when two callers race past the read', async () => {
    // Simulates the window the fast-path read cannot cover: both callers see no
    // row, both proceed, and the database decides. The loser must not message.
    const fake = fakeDb();
    vi.spyOn(fake.raw.fdReviewRequest, 'findUnique').mockResolvedValue(null as never);
    const [a, b] = await Promise.all([run(config(), fake), run(config(), fake)]);
    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(['ALREADY_REQUESTED', 'SENT']);
    expect(fake.notifications).toHaveLength(1);
  });

  it('does not re-ask after a suppression, and does not send then either', async () => {
    const fake = fakeDb({ escalated: true });
    await run(config(), fake);
    const second = await run(config(), fake);
    expect(second.outcome).toBe('ALREADY_REQUESTED');
    expect(fake.notifications).toHaveLength(0);
  });

  it('does not let a suppressed row start the 90-day cooldown', async () => {
    // A refusal means nobody was messaged. Counting it as "last asked" would
    // turn one misconfiguration into three months of silence.
    expect(codeOf('src/lib/frontdesk/reviews/store.ts')).toMatch(/status: \{ in: \['SENT', 'DELIVERED'\] \}/);
  });
});

describe('a review request never costs an escalation', () => {
  it('yields the last of the hourly budget to alerts and replies', async () => {
    const limit = demoTenantConfig.messaging.rateLimitPerTenantPerHour ?? 200;
    const fake = fakeDb({ tenantSends: limit - REVIEW_TENANT_HEADROOM });
    const result = await run(config(), fake);
    expect(result.outcome).toBe('SUPPRESSED');
    if (result.outcome === 'SUPPRESSED') expect(result.reason).toBe('TENANT_BUDGET_RESERVED');
    expect(fake.notifications).toHaveLength(0);
  });

  it('still sends while headroom remains', async () => {
    const limit = demoTenantConfig.messaging.rateLimitPerTenantPerHour ?? 200;
    const fake = fakeDb({ tenantSends: limit - REVIEW_TENANT_HEADROOM - 1 });
    expect((await run(config(), fake)).outcome).toBe('SENT');
  });

  it('leaves an escalation sendable at a budget that refuses a review', async () => {
    const cfg = config();
    const limit = cfg.messaging.rateLimitPerTenantPerHour ?? 200;
    const fake = fakeDb({ tenantSends: limit - REVIEW_TENANT_HEADROOM });

    expect((await run(cfg, fake)).outcome).toBe('SUPPRESSED');

    // The escalation the reserve exists to protect: non-critical, so it is NOT
    // exempt from the cap, and would have been refused had the review spent it.
    const alert = await queueMessage(
      { tenantId: TENANT, config: cfg, toNumber: '+15550100111', body: 'Priority alert', purpose: 'ESCALATION_ALERT' },
      fake.db,
    );
    expect(alert.queued).toBe(true);
  });

  it('is never marked critical, so it cannot bypass a rate limit', () => {
    expect(/critical:\s*true/.test(codeOf('src/lib/frontdesk/reviews/store.ts'))).toBe(false);
  });

  it('sorts behind every other purpose in the dispatch queue', async () => {
    // The batch is capped, so whatever fills it delays whatever does not.
    let sql = '';
    const db = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        sql = strings.join('?');
        return [];
      },
    };
    await claimDueNotifications(now, 25, db as never, 'w1');
    expect(sql).toContain(`ORDER BY (c.purpose = 'REVIEW_REQUEST') ASC, c."createdAt" ASC`);
  });
});

describe('review failures cannot reach the SMS paths that matter', () => {
  it('never throws, even when the database fails mid-request', async () => {
    const fake = fakeDb();
    vi.spyOn(fake.raw.fdReviewRequest, 'create').mockRejectedValue(new Error('connection reset'));
    const result = await run(config(), fake);
    expect(result.outcome).toBe('SUPPRESSED');
    if (result.outcome === 'SUPPRESSED') expect(result.reason).toBe('ERROR');
    expect(fake.failures.some((f) => f.operation === 'reviews.request')).toBe(true);
  });

  it('leaves an escalation queueable after a review request has failed', async () => {
    const cfg = config();
    const fake = fakeDb();
    vi.spyOn(fake.raw.fdReviewRequest, 'create').mockRejectedValue(new Error('connection reset'));
    await run(cfg, fake);

    const alert = await queueMessage(
      {
        tenantId: TENANT,
        config: cfg,
        toNumber: '+15550100111',
        body: 'URGENT: food safety',
        purpose: 'ESCALATION_ALERT',
        critical: true,
      },
      fake.db,
    );
    expect(alert.queued).toBe(true);
  });

  it('does not consume a send when it refuses', async () => {
    const fake = fakeDb({ escalated: true });
    await run(config(), fake);
    // A refusal must not increment the counter an alert is measured against.
    expect(fake.counters.get(`TENANT:${TENANT}`) ?? 0).toBe(0);
  });
});

describe('existing SMS behaviour is unchanged', () => {
  const cfg = config();

  it('queues an escalation alert exactly as before', async () => {
    const fake = fakeDb();
    const result = await queueMessage(
      { tenantId: TENANT, config: cfg, toNumber: '+15550100111', body: 'alert', purpose: 'ESCALATION_ALERT' },
      fake.db,
    );
    expect(result.queued).toBe(true);
    expect(fake.notifications[0].purpose).toBe('ESCALATION_ALERT');
    expect(fake.notifications[0].status).toBe('QUEUED');
  });

  it('still refuses a customer message from a number we have never heard from', async () => {
    const fake = fakeDb();
    const result = await queueMessage(
      { tenantId: TENANT, config: cfg, toNumber: '+17275559999', body: 'hello', purpose: 'CONVERSATION_REPLY' },
      fake.db,
    );
    expect(result.queued).toBe(false);
    if (!result.queued) expect(result.reason).toBe('NO_CONSENT');
  });

  it('still refuses every purpose for an opted-out number, review requests included', async () => {
    const fake = fakeDb();
    fake.consents.set(`${TENANT}:${PHONE}`, { status: 'OPTED_OUT', lastInboundAt: null });
    const result = await run(cfg, fake);
    expect(result.outcome).toBe('SUPPRESSED');
    if (result.outcome === 'SUPPRESSED') expect(result.reason).toBe('OPTED_OUT');
    expect(fake.notifications).toHaveLength(0);
  });

  it('still switches off entirely when the restaurant has SMS disabled', async () => {
    const fake = fakeDb();
    const off = config({ messaging: { ...cfg.messaging, smsEnabled: false } });
    const result = await run(off, fake);
    expect(result.outcome).toBe('SUPPRESSED');
    expect(fake.notifications).toHaveLength(0);
  });

  it('keeps the dispatch claim FIFO for every pre-existing purpose', async () => {
    // `(purpose = 'REVIEW_REQUEST')` is constant-false across any queue with no
    // review rows, so the ordering degrades to the original createdAt ASC.
    let sql = '';
    const db = { $queryRaw: async (s: TemplateStringsArray) => ((sql = s.join('?')), []) };
    await claimDueNotifications(now, 25, db as never, 'w1');
    const order = sql.slice(sql.indexOf('ORDER BY'));
    expect(order).toContain('c."createdAt" ASC');
    expect(order.indexOf('REVIEW_REQUEST')).toBeLessThan(order.indexOf('createdAt'));
  });

  it('counts a review request against the follow-up cap like any other outbound', async () => {
    expect(codeOf('src/lib/frontdesk/messaging/store.ts')).toMatch(
      /'MISSED_CALL_RECOVERY', 'CONVERSATION_REPLY', 'REVIEW_REQUEST'/,
    );
  });

  it('records the send against the rate counters on a successful review', async () => {
    const fake = fakeDb();
    await run(cfg, fake);
    expect(fake.counters.get(`TENANT:${TENANT}`)).toBe(1);
    expect(fake.counters.get(`NUMBER:${PHONE}`)).toBe(1);
    expect(windowStart(now).getTime()).toBeLessThanOrEqual(now.getTime());
  });
});

describe('the audit trail', () => {
  it('records destination, link, channel and time on a sent request', async () => {
    const fake = fakeDb();
    await run(config(), fake);
    const row = fake.reviewRequests[0];
    expect(row.status).toBe('SENT');
    expect(row.channel).toBe('SMS');
    expect(row.destination).toBe(PHONE);
    expect(row.reviewLink).toBe('https://g.page/r/leverocks/review');
    expect(row.requestedAt).toEqual(now);
  });

  it('records the reason on every refusal', async () => {
    for (const [cfgOverride, expected] of [
      [config({ reviews: { enabled: false, channel: 'SMS' } }), 'REVIEWS_DISABLED'],
      [config({ reviewLink: undefined }), 'NO_REVIEW_LINK'],
    ] as const) {
      const fake = fakeDb();
      await run(cfgOverride, fake);
      expect(fake.reviewRequests[0].suppressedReason).toContain(expected);
    }
  });

  it('reads a conversation only within its own tenant', async () => {
    const fake = fakeDb();
    const result = await requestReviewForConversation('other-tenant', CONVO, config(), fake.db, now);
    expect(result.outcome).toBe('CONVERSATION_NOT_FOUND');
    expect(fake.notifications).toHaveLength(0);
  });
});
