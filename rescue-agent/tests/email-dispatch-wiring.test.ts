import { beforeEach, describe, expect, it } from 'vitest';
import type { TenantConfig } from '@/lib/frontdesk/config/schema';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import {
  dispatchBatch,
  MAX_ATTEMPTS,
  type DispatchPorts,
  type FailureInput,
  type NotificationRecord,
  type NotificationUpdate,
} from '@/lib/frontdesk/notify/dispatch';
import {
  prepareEscalationEmail,
  type EmailCopyChannel,
  type EmailCopyContext,
} from '@/lib/frontdesk/notify/emailCopy';
import { MOCK_BEHAVIOURS, MockSmsProvider, resetMockProvider } from '@/lib/frontdesk/notify/mock';
import { MockEmailProvider } from '@/lib/frontdesk/email/mock';
import { getEmailProvider, EmailProviderNotConfigured } from '@/lib/frontdesk/email/factory';
import type { EmailProvider, EmailSendResult } from '@/lib/frontdesk/email/provider';

/**
 * EMAIL COPIES OF ESCALATION ALERTS — dispatch wiring.
 *
 * The feature is one optional argument to `dispatchBatch`. The risk is that it
 * sits inside the code path that tells a manager about a food-safety report,
 * where a mistake is invisible until the day it matters.
 *
 * So the centre of this file is not "does email work". It is:
 *
 *   THE SMS PATH BEHAVES IDENTICALLY WITH AND WITHOUT EMAIL.
 *
 * `smsTrace()` below runs a realistic batch — accepted, permanently failed,
 * retried, retry-exhausted, plus a customer-facing message — and captures every
 * SMS-relevant thing dispatch did. The A/B tests then compare that capture
 * across email states, including an email provider that rejects and one that
 * throws. If any of them differ, the alerting path changed and the diff says so.
 */

const now = new Date('2026-08-07T12:00:00Z');

/** A tenant with email switched on and a routed contact that has an address. */
const emailOn: TenantConfig = {
  ...demoTenantConfig,
  messaging: { ...demoTenantConfig.messaging, emailEnabled: true, fromEmail: 'alerts@harbor-house-demo.invalid' },
};

const escalationContext = (routeTo = 'manager'): EmailCopyContext => ({
  config: emailOn,
  escalation: {
    reason: 'FOOD_SAFETY',
    severity: 'CRITICAL',
    summary: 'Possible food-safety incident — requires immediate management attention',
    customerName: 'Dana Whitfield',
    routeTo,
  },
});

const number = (suffix: string) => `+1555010${suffix}`;

function notification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: 'notif-1',
    tenantId: 'tenant-a',
    escalationId: 'esc-1',
    toNumber: number('0199'),
    fromNumber: number('0100'),
    body: 'URGENT: Harbor House front desk',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    ...overrides,
  };
}

/**
 * The batch every A/B run processes.
 *
 * Chosen to cover each terminal state dispatch can reach, because "identical
 * behaviour" is only meaningful if the comparison exercises the failure paths
 * as well as the happy one.
 */
const batch = (): NotificationRecord[] => [
  notification({ id: 'n-accept', escalationId: 'esc-1', toNumber: number('0199') }),
  // Permanent provider rejection → ABANDONED on the first attempt.
  notification({ id: 'n-permanent', escalationId: 'esc-2', toNumber: number(MOCK_BEHAVIOURS.PERMANENT_FAILURE) }),
  // Transient → RETRY_SCHEDULED.
  notification({ id: 'n-transient', escalationId: 'esc-3', toNumber: number(MOCK_BEHAVIOURS.TRANSIENT_FAILURE) }),
  // Already at the ceiling → ABANDONED for exhaustion, not for a bad number.
  notification({
    id: 'n-exhausted',
    escalationId: 'esc-4',
    toNumber: number(MOCK_BEHAVIOURS.ALWAYS_TRANSIENT),
    attempts: MAX_ATTEMPTS - 1,
  }),
  // A customer-facing message: a conversation reply carries no escalation.
  notification({ id: 'n-customer', escalationId: null, toNumber: number('0199') }),
];

interface Run {
  summary: Awaited<ReturnType<typeof dispatchBatch>>;
  updates: { id: string; update: NotificationUpdate }[];
  failures: FailureInput[];
  /** Ordered log of every side effect, for the ordering assertions. */
  order: string[];
  email: MockEmailProvider | null;
}

async function run(emailCopy?: EmailCopyChannel, email: MockEmailProvider | null = null): Promise<Run> {
  // The SMS mock caches results by idempotency key in module state. Without
  // this reset the second run of an A/B pair would replay the first run's
  // results and match it for the wrong reason.
  resetMockProvider();

  const updates: { id: string; update: NotificationUpdate }[] = [];
  const failures: FailureInput[] = [];
  const order: string[] = [];

  const ports: DispatchPorts = {
    updateNotification: async (id, update) => {
      order.push(`sms:update:${id}:${update.status}`);
      updates.push({ id, update });
    },
    recordFailure: async (failure) => {
      order.push(`failure:${failure.operation}:${failure.referenceId ?? '-'}`);
      failures.push(failure);
    },
    now: () => now,
  };

  const summary = await dispatchBatch(batch(), new MockSmsProvider(), ports, emailCopy);
  return { summary, updates, failures, order, email };
}

/**
 * What the SMS path did, in a form two runs can be compared by.
 *
 * `providerMessageId` is a fresh UUID per send, so it is normalised to a marker
 * — its presence still distinguishes an accepted send from a failed one.
 * Failures under `dispatch.emailCopy` are excluded because those are the email
 * channel's own records, which are additions rather than changes; every
 * SMS-owned failure (`escalation.notify`, `dispatch.batch`) is compared in full.
 */
function smsTrace(result: Run) {
  const stable = (value: unknown) =>
    JSON.parse(
      JSON.stringify(value, (key, v) => (key === 'providerMessageId' && typeof v === 'string' ? '<id>' : v)),
    );
  return stable({
    summary: result.summary,
    updates: result.updates,
    failures: result.failures.filter((f) => f.operation !== 'dispatch.emailCopy'),
    order: result.order.filter((entry) => !entry.startsWith('failure:dispatch.emailCopy')),
  });
}

const channel = (provider: EmailProvider, resolve?: EmailCopyChannel['resolve']): EmailCopyChannel => ({
  provider,
  resolve: resolve ?? (async () => escalationContext()),
});

beforeEach(() => {
  resetMockProvider();
});

describe('the SMS escalation path is unchanged by the email wiring', () => {
  it('produces an identical trace with no email channel and with a working one', async () => {
    const baseline = await run();
    const withEmail = await run(channel(new MockEmailProvider()));

    expect(smsTrace(withEmail)).toEqual(smsTrace(baseline));
    // Guard against the comparison passing because the batch did nothing.
    expect(baseline.summary).toEqual({ processed: 5, sent: 2, retryScheduled: 1, abandoned: 2 });
  });

  it('produces an identical trace when the email provider REJECTS every message', async () => {
    const rejecting = new MockEmailProvider({
      result: { status: 'FAILED', errorCode: 'MAILBOX_FULL', errorMessage: 'over quota', retryable: false },
    });
    expect(smsTrace(await run(channel(rejecting)))).toEqual(smsTrace(await run()));
  });

  it('produces an identical trace when the email provider THROWS', async () => {
    const exploding: EmailProvider = {
      name: 'exploding',
      simulated: true,
      send: async () => {
        throw new Error('SMTP connection reset');
      },
    };
    expect(smsTrace(await run(channel(exploding)))).toEqual(smsTrace(await run()));
  });

  it('produces an identical trace when the escalation lookup throws', async () => {
    const resolve = async () => {
      throw new Error('database unavailable');
    };
    expect(smsTrace(await run(channel(new MockEmailProvider(), resolve)))).toEqual(smsTrace(await run()));
  });

  it('produces an identical trace when the tenant has email switched off', async () => {
    const resolve = async () => ({ ...escalationContext(), config: demoTenantConfig });
    expect(smsTrace(await run(channel(new MockEmailProvider(), resolve)))).toEqual(smsTrace(await run()));
  });

  it('still records the SMS failures an operator depends on', async () => {
    // The A/B comparison would also pass if BOTH runs recorded nothing, so the
    // baseline's own alerting is asserted directly.
    const baseline = await run();
    const smsFailures = baseline.failures.filter((f) => f.category === 'FAILED_SMS');
    expect(smsFailures.map((f) => f.referenceId).sort()).toEqual(['n-exhausted', 'n-permanent']);
    expect(smsFailures.every((f) => f.operation === 'escalation.notify')).toBe(true);
  });
});

describe('email cannot delay or suppress an SMS', () => {
  it('sends every email strictly AFTER that notification\'s SMS outcome is recorded', async () => {
    const email = new MockEmailProvider();
    const provider: EmailProvider = {
      name: 'ordered',
      simulated: true,
      send: async (message) => {
        order.push(`email:send:${message.reference}`);
        return email.send(message);
      },
    };
    const order: string[] = [];

    resetMockProvider();
    const updates: string[] = [];
    const ports: DispatchPorts = {
      updateNotification: async (id, update) => {
        order.push(`sms:update:${id}:${update.status}`);
        updates.push(id);
      },
      recordFailure: async () => {},
      now: () => now,
    };
    await dispatchBatch(batch(), new MockSmsProvider(), ports, channel(provider));

    for (const id of ['n-accept', 'n-permanent', 'n-transient']) {
      const smsAt = order.indexOf(order.find((e) => e.startsWith(`sms:update:${id}:`)) as string);
      const emailAt = order.indexOf(`email:send:${id}`);
      expect(smsAt, `${id} SMS outcome recorded`).toBeGreaterThanOrEqual(0);
      expect(emailAt, `${id} email sent`).toBeGreaterThan(smsAt);
    }
  });

  it('still emails when the SMS was abandoned — email does not depend on SMS succeeding', async () => {
    const email = new MockEmailProvider();
    await run(channel(email), email);
    // n-permanent's SMS was permanently rejected; the manager still gets mail.
    expect(email.sent.map((m) => m.reference)).toContain('n-permanent');
  });

  it('still emails when attemptSend itself throws', async () => {
    // A port that throws drives dispatchBatch into its own catch. The email is
    // outside that catch on purpose: an SMS that could not even be recorded is
    // the case where a second channel matters most.
    resetMockProvider();
    const email = new MockEmailProvider();
    const ports: DispatchPorts = {
      updateNotification: async () => {
        throw new Error('write failed');
      },
      recordFailure: async () => {},
      now: () => now,
    };
    const summary = await dispatchBatch([notification({ id: 'n-broken' })], new MockSmsProvider(), ports, channel(email));
    expect(summary).toEqual({ processed: 1, sent: 0, retryScheduled: 0, abandoned: 1 });
    expect(email.sent.map((m) => m.reference)).toEqual(['n-broken']);
  });

  it('never counts an email in the dispatch summary', async () => {
    const withEmail = await run(channel(new MockEmailProvider()));
    expect(withEmail.summary).toEqual({ processed: 5, sent: 2, retryScheduled: 1, abandoned: 2 });
  });
});

describe('who gets an email, and when', () => {
  it('emails escalations only — never a customer-facing message', async () => {
    const email = new MockEmailProvider();
    await run(channel(email), email);
    // n-customer is a conversation reply addressed to a customer. Copying it to
    // a staff inbox would be a disclosure, not an alert.
    expect(email.sent.map((m) => m.reference)).not.toContain('n-customer');
  });

  it('emails once, on the first attempt, and not again on a retry', async () => {
    const email = new MockEmailProvider();
    await run(channel(email), email);
    // n-exhausted is on its final retry; three copies of one alert in an inbox
    // is how an alert channel gets ignored.
    expect(email.sent.map((m) => m.reference)).not.toContain('n-exhausted');
    expect(email.sent.map((m) => m.reference).sort()).toEqual(['n-accept', 'n-permanent', 'n-transient']);
  });

  it('deduplicates a replayed first attempt by idempotency key', async () => {
    const email = new MockEmailProvider();
    const ports: DispatchPorts = {
      updateNotification: async () => {},
      recordFailure: async () => {},
      now: () => now,
    };
    resetMockProvider();
    const one = [notification({ id: 'n-replay' })];
    await dispatchBatch(one, new MockSmsProvider(), ports, channel(email));
    await dispatchBatch(one, new MockSmsProvider(), ports, channel(email));
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].idempotencyKey).toBe('n-replay:email');
  });

  it('does not email when the escalation cannot be loaded', async () => {
    const email = new MockEmailProvider();
    await run(channel(email, async () => null), email);
    expect(email.sent).toHaveLength(0);
  });
});

describe('email is off unless the restaurant configured it', () => {
  it('defaults emailEnabled to false, so gaining this code emails nobody', () => {
    expect(demoTenantConfig.messaging.emailEnabled).toBe(false);
    const prepared = prepareEscalationEmail(escalationContext().escalation, demoTenantConfig);
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.reason).toBe('EMAIL_DISABLED');
  });

  it('refuses without a from address', () => {
    const config = { ...emailOn, messaging: { ...emailOn.messaging, fromEmail: undefined } };
    const prepared = prepareEscalationEmail(escalationContext().escalation, config);
    if (!prepared.ok) expect(prepared.reason).toBe('NO_FROM_ADDRESS');
    else throw new Error('expected a refusal');
  });

  it('refuses when the routed contact has no email address', () => {
    // "urgent" is configured with a phone number and no address. Falling back
    // to another contact's inbox would send a food-safety report to the wrong
    // person; refusing surfaces the gap instead.
    const prepared = prepareEscalationEmail(escalationContext('urgent').escalation, emailOn);
    if (!prepared.ok) expect(prepared.reason).toBe('NO_CONTACT_EMAIL');
    else throw new Error('expected a refusal');
  });

  it('renders the alert to the routed contact when configured', () => {
    const prepared = prepareEscalationEmail(escalationContext().escalation, emailOn);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.to).toBe('manager@harbor-house-demo.invalid');
      expect(prepared.from).toBe('alerts@harbor-house-demo.invalid');
      expect(prepared.subject).toMatch(/CRITICAL/);
      expect(prepared.text).toMatch(/food-safety/i);
    }
  });
});

describe('email problems are visible to an operator, silence is not', () => {
  const failuresFrom = (result: Run) => result.failures.filter((f) => f.operation === 'dispatch.emailCopy');

  it('files a failure when the provider rejects', async () => {
    const rejecting = new MockEmailProvider({
      result: { status: 'FAILED', errorCode: 'MAILBOX_FULL', errorMessage: 'over quota', retryable: false },
    });
    const result = await run(channel(rejecting));
    expect(failuresFrom(result).length).toBeGreaterThan(0);
    expect(failuresFrom(result)[0].lastError).toBe('MAILBOX_FULL');
    // The address is masked — a staff address is not written into an audit row.
    expect(failuresFrom(result)[0].detail).not.toContain('manager@harbor-house-demo.invalid');
  });

  it('files a failure when the provider throws', async () => {
    const exploding: EmailProvider = {
      name: 'exploding',
      simulated: true,
      send: async () => {
        throw new Error('SMTP connection reset');
      },
    };
    const result = await run(channel(exploding));
    expect(failuresFrom(result)[0].lastError).toBe('SMTP connection reset');
  });

  it('files a failure when a configured contact has no address', async () => {
    const result = await run(channel(new MockEmailProvider(), async () => escalationContext('urgent')));
    expect(failuresFrom(result)[0].lastError).toBe('NO_CONTACT_EMAIL');
  });

  it('files NOTHING when the restaurant simply has email switched off', async () => {
    // A restaurant that never asked for email alerts must not generate a
    // failure-queue entry per escalation — that is how a real failure gets lost.
    const result = await run(
      channel(new MockEmailProvider(), async () => ({ ...escalationContext(), config: demoTenantConfig })),
    );
    expect(failuresFrom(result)).toHaveLength(0);
  });

  it('does not throw even when the failure queue is itself unavailable', async () => {
    resetMockProvider();
    const exploding: EmailProvider = {
      name: 'exploding',
      simulated: true,
      send: async () => {
        throw new Error('SMTP connection reset');
      },
    };
    const ports: DispatchPorts = {
      updateNotification: async () => {},
      recordFailure: async () => {
        throw new Error('failure queue down');
      },
      now: () => now,
    };
    const summary = await dispatchBatch([notification()], new MockSmsProvider(), ports, channel(exploding));
    expect(summary.sent).toBe(1);
  });
});

describe('provider selection is off by default', () => {
  it('returns null when EMAIL_PROVIDER is unset', async () => {
    expect(await getEmailProvider({})).toBeNull();
  });

  it('refuses the mock in production', async () => {
    await expect(getEmailProvider({ EMAIL_PROVIDER: 'mock', NODE_ENV: 'production' })).rejects.toBeInstanceOf(
      EmailProviderNotConfigured,
    );
  });

  it('refuses an unknown provider rather than silently sending nothing', async () => {
    await expect(getEmailProvider({ EMAIL_PROVIDER: 'sendgrid' })).rejects.toBeInstanceOf(EmailProviderNotConfigured);
  });

  it('returns the mock outside production', async () => {
    const provider = await getEmailProvider({ EMAIL_PROVIDER: 'mock' });
    expect(provider?.simulated).toBe(true);
  });
});

describe('the email result type still cannot claim delivery', () => {
  it('has no DELIVERED status', () => {
    // Same rule as SMS: ACCEPTED means the provider took it, and a bounce
    // arrives later through a different channel.
    const accepted: EmailSendResult = { status: 'ACCEPTED', retryable: false };
    expect(accepted.status).toBe('ACCEPTED');
    // @ts-expect-error DELIVERED is not a value this union admits
    const delivered: EmailSendResult = { status: 'DELIVERED', retryable: false };
    expect(delivered).toBeTruthy();
  });
});
