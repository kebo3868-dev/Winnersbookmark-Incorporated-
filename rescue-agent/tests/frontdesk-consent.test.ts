import { describe, expect, it } from 'vitest';
import type { TenantConfig } from '@/lib/frontdesk/config/schema';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import {
  classifyInboundKeyword,
  isCustomerDirected,
  keywordReply,
  maySend,
  statusAfterKeyword,
  type ConsentStatus,
} from '@/lib/frontdesk/messaging/consent';
import {
  DEFAULT_PER_NUMBER_PER_HOUR,
  checkRate,
  resolveLimits,
  windowStart,
} from '@/lib/frontdesk/messaging/rateLimit';

/**
 * CONSENT, OPT-OUT AND RATE LIMITING (Phase 2, milestone 3)
 *
 * These guard the first feature that messages CUSTOMERS rather than staff.
 * A missed STOP is a regulatory exposure for the restaurant, and an unbounded
 * send loop is both a cost and a harassment risk — so every refusal path is
 * exercised explicitly.
 */

const config = demoTenantConfig;

const base = {
  purpose: 'CONVERSATION_REPLY' as const,
  unansweredOutbound: 0,
  config,
};

describe('opt-out keyword classification', () => {
  it.each(['STOP', 'stop', 'Stop', 'STOP.', 'stop!', ' STOP ', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'])(
    'treats %j as an opt-out',
    (message) => {
      expect(classifyInboundKeyword(message, config)).toBe('STOP');
    },
  );

  it.each(['START', 'start', 'YES', 'UNSTOP'])('treats %j as an opt-in', (message) => {
    expect(classifyInboundKeyword(message, config)).toBe('START');
  });

  it.each(['HELP', 'help', 'INFO'])('treats %j as a help request', (message) => {
    expect(classifyInboundKeyword(message, config)).toBe('HELP');
  });

  it.each([
    ['Stop by around 7?', 'a reservation enquiry'],
    ['Can I cancel my reservation', 'a booking change'],
    ['Do you have a stop for the bus nearby', 'incidental use'],
    ['Please cancel table for 4', 'a cancellation request'],
    ['help me book a table', 'a help-shaped request'],
  ])('does NOT treat %j as a keyword (%s)', (message) => {
    // Silencing a paying customer because they wrote "stop by" would be worse
    // than missing a keyword — carriers expect the bare word.
    expect(classifyInboundKeyword(message, config)).toBe('NONE');
  });

  it('honours a restaurant-specific keyword list', () => {
    const custom: TenantConfig = {
      ...config,
      messaging: { ...config.messaging, optOutKeywords: ['BASTA'] },
    };
    expect(classifyInboundKeyword('BASTA', custom)).toBe('STOP');
    // Replacing the list replaces it — the restaurant owns this decision.
    expect(classifyInboundKeyword('STOP', custom)).toBe('NONE');
  });

  it('ignores empty input', () => {
    expect(classifyInboundKeyword('   ', config)).toBe('NONE');
  });
});

describe('the send gate', () => {
  it('blocks every purpose for an opted-out number', () => {
    for (const purpose of ['CONVERSATION_REPLY', 'MISSED_CALL_RECOVERY', 'ESCALATION_ALERT'] as const) {
      const verdict = maySend({ ...base, purpose, status: 'OPTED_OUT' });
      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) expect(verdict.reason).toBe('OPTED_OUT');
    }
  });

  it('blocks a STAFF ALERT to someone who opted out', () => {
    // Deliberate: consent wins over operational convenience. The refusal is
    // filed to the failure queue so an operator fixes the routing instead of
    // the system quietly ignoring a STOP.
    const verdict = maySend({ ...base, purpose: 'ESCALATION_ALERT', status: 'OPTED_OUT' });
    expect(verdict.allowed).toBe(false);
  });

  it('allows a staff alert to a number that never interacted', () => {
    // Staff numbers come from the restaurant's own configuration, so there is
    // no prior-contact requirement — only the STOP check.
    expect(maySend({ ...base, purpose: 'ESCALATION_ALERT', status: 'UNKNOWN' }).allowed).toBe(true);
  });

  it('refuses to cold-message a customer number we have never heard from', () => {
    const verdict = maySend({ ...base, purpose: 'MISSED_CALL_RECOVERY', status: 'UNKNOWN' });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reason).toBe('NO_CONSENT');
  });

  it.each(['IMPLIED', 'OPTED_IN'] as ConsentStatus[])(
    'allows a customer reply when consent is %s',
    (status) => {
      expect(maySend({ ...base, status }).allowed).toBe(true);
    },
  );

  it('enforces the follow-up cap', () => {
    const cap = config.messaging.maxFollowUps;
    expect(maySend({ ...base, status: 'IMPLIED', unansweredOutbound: cap - 1 }).allowed).toBe(true);

    const verdict = maySend({ ...base, status: 'IMPLIED', unansweredOutbound: cap });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reason).toBe('FOLLOW_UP_CAP');
  });

  it('does not let the follow-up cap block a staff alert', () => {
    // Alerts are not follow-ups to a customer and must not consume that budget.
    expect(
      maySend({ ...base, purpose: 'ESCALATION_ALERT', status: 'IMPLIED', unansweredOutbound: 99 }).allowed,
    ).toBe(true);
  });

  it('respects a restaurant that sets the cap to zero', () => {
    const noFollowUps: TenantConfig = {
      ...config,
      messaging: { ...config.messaging, maxFollowUps: 0 },
    };
    const verdict = maySend({ ...base, status: 'IMPLIED', config: noFollowUps, unansweredOutbound: 0 });
    expect(verdict.allowed).toBe(false);
  });
});

describe('consent state transitions', () => {
  it('STOP always wins, from any prior state', () => {
    for (const current of ['UNKNOWN', 'IMPLIED', 'OPTED_IN', 'OPTED_OUT'] as ConsentStatus[]) {
      expect(statusAfterKeyword('STOP', current)).toBe('OPTED_OUT');
    }
  });

  it('only an explicit START resurrects an opted-out number', () => {
    expect(statusAfterKeyword('START', 'OPTED_OUT')).toBe('OPTED_IN');
    // An ordinary message from an opted-out number must NOT re-subscribe them.
    expect(statusAfterKeyword('NONE', 'OPTED_OUT')).toBe('OPTED_OUT');
    expect(statusAfterKeyword('HELP', 'OPTED_OUT')).toBe('OPTED_OUT');
  });

  it('an ordinary inbound message establishes an implied basis', () => {
    expect(statusAfterKeyword('NONE', 'UNKNOWN')).toBe('IMPLIED');
  });

  it('does not downgrade an explicit opt-in', () => {
    expect(statusAfterKeyword('NONE', 'OPTED_IN')).toBe('OPTED_IN');
  });
});

describe('keyword acknowledgements', () => {
  it('confirms an opt-out and states how to return', () => {
    const reply = keywordReply('STOP', config);
    expect(reply).toMatch(/unsubscribed/i);
    expect(reply).toMatch(/START/);
  });

  it('names the restaurant so the customer knows who they unsubscribed from', () => {
    expect(keywordReply('STOP', config)).toContain('Harbor House');
  });

  it('offers a way to reach a human in the HELP reply', () => {
    expect(keywordReply('HELP', config)).toContain(config.mainPhone!);
  });

  it('produces nothing for an ordinary message', () => {
    expect(keywordReply('NONE', config)).toBeNull();
  });
});

describe('purpose classification', () => {
  it('separates customer-directed messages from staff alerts', () => {
    expect(isCustomerDirected('CONVERSATION_REPLY')).toBe(true);
    expect(isCustomerDirected('MISSED_CALL_RECOVERY')).toBe(true);
    expect(isCustomerDirected('ESCALATION_ALERT')).toBe(false);
  });
});

describe('rate limits', () => {
  const limits = { perNumberPerHour: 3, perTenantPerHour: 10 };

  it('allows sends below both limits', () => {
    expect(checkRate({ number: 2, tenant: 5 }, limits).allowed).toBe(true);
  });

  it('blocks at the per-number limit, protecting the person', () => {
    const verdict = checkRate({ number: 3, tenant: 0 }, limits);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.scope).toBe('NUMBER');
  });

  it('blocks at the per-tenant limit, protecting the bill', () => {
    const verdict = checkRate({ number: 0, tenant: 10 }, limits);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.scope).toBe('TENANT');
  });

  it('reports the per-number breach first when both are exceeded', () => {
    // The one that protects a person outranks the one that protects spend.
    const verdict = checkRate({ number: 99, tenant: 99 }, limits);
    if (!verdict.allowed) expect(verdict.scope).toBe('NUMBER');
  });

  it('falls back to conservative defaults, never to unlimited', () => {
    const noLimits: TenantConfig = {
      ...config,
      messaging: {
        ...config.messaging,
        rateLimitPerNumberPerHour: undefined,
        rateLimitPerTenantPerHour: undefined,
      },
    };
    const resolved = resolveLimits(noLimits);
    expect(resolved.perNumberPerHour).toBe(DEFAULT_PER_NUMBER_PER_HOUR);
    expect(resolved.perNumberPerHour).toBeGreaterThan(0);
    expect(Number.isFinite(resolved.perTenantPerHour)).toBe(true);
  });

  it('uses a restaurant-specific limit when configured', () => {
    expect(resolveLimits(config).perNumberPerHour).toBe(5);
  });

  it('buckets timestamps into stable hourly windows', () => {
    const a = windowStart(new Date('2026-08-07T12:00:00Z'));
    const b = windowStart(new Date('2026-08-07T12:59:59Z'));
    const c = windowStart(new Date('2026-08-07T13:00:00Z'));
    expect(a.toISOString()).toBe(b.toISOString());
    expect(a.toISOString()).not.toBe(c.toISOString());
    expect(a.toISOString()).toBe('2026-08-07T12:00:00.000Z');
  });
});

/**
 * REGRESSION — found by driving the live inbound webhook, not by unit tests.
 *
 * A second missed call from a number that never replied used to reset the
 * follow-up baseline and send another recovery text. Auto-redial would have
 * produced a text per call, which is exactly the pestering the cap exists to
 * prevent (§VII). The fix: only an inbound MESSAGE moves that baseline.
 */
describe('a repeated missed call does not reset the follow-up cap', () => {
  it('counts a previous unanswered recovery text against the cap', () => {
    // What the store now reports for a caller who rang twice and never replied:
    // lastInboundAt is unchanged, so the earlier recovery text is still counted.
    const verdict = maySend({
      ...base,
      purpose: 'MISSED_CALL_RECOVERY',
      status: 'IMPLIED',
      unansweredOutbound: 1,
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reason).toBe('FOLLOW_UP_CAP');
  });

  it('allows the first recovery text to a caller we have not messaged', () => {
    expect(
      maySend({ ...base, purpose: 'MISSED_CALL_RECOVERY', status: 'IMPLIED', unansweredOutbound: 0 }).allowed,
    ).toBe(true);
  });
});
