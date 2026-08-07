import { beforeEach, describe, expect, it } from 'vitest';
import type { TenantConfig } from '@/lib/frontdesk/config/schema';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import {
  attemptSend,
  buildEscalationMessage,
  dispatchBatch,
  prepareEscalationNotification,
  type DispatchPorts,
  type FailureInput,
  type NotificationRecord,
  type NotificationUpdate,
} from '@/lib/frontdesk/notify/dispatch';
import { MOCK_BEHAVIOURS, MockSmsProvider, mockOutbox, resetMockProvider } from '@/lib/frontdesk/notify/mock';
import {
  getSmsProvider,
  maskNumber,
  normaliseNumber,
  SmsProviderNotConfigured,
  type SmsProvider,
} from '@/lib/frontdesk/notify/provider';
import { classifyResult, decideRetry, MAX_ATTEMPTS } from '@/lib/frontdesk/notify/retry';

/**
 * SMS ESCALATION NOTIFICATIONS (Phase 2, milestone 2)
 *
 * What these protect: an escalation that nobody is told about. The dashboard
 * row was never the alert — it is the record. These tests cover the paths
 * where the alert silently does not happen, because those are invisible in
 * production until someone asks why a manager never called a customer back.
 */

const config = demoTenantConfig;
const now = new Date('2026-08-07T12:00:00Z');

const escalation = {
  reason: 'FOOD_SAFETY' as const,
  severity: 'CRITICAL' as const,
  summary: 'Possible food-safety incident — requires immediate management attention',
  customerName: 'Dana Whitfield',
  contact: '(727) 555-0142',
  routeTo: 'urgent',
};

/** Records what dispatch asked the outside world to do. */
function testPorts() {
  const updates: { id: string; update: NotificationUpdate }[] = [];
  const failures: FailureInput[] = [];
  const ports: DispatchPorts = {
    updateNotification: async (id, update) => {
      updates.push({ id, update });
    },
    recordFailure: async (failure) => {
      failures.push(failure);
    },
    now: () => now,
  };
  return { ports, updates, failures };
}

function notification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: 'notif-1',
    tenantId: 'tenant-a',
    escalationId: 'esc-1',
    toNumber: '+15550100199',
    fromNumber: '+15550100100',
    body: 'test',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    ...overrides,
  };
}

beforeEach(() => resetMockProvider());

describe('phone number handling', () => {
  it.each([
    ['(727) 555-0142', '+17275550142'],
    ['727-555-0142', '+17275550142'],
    ['7275550142', '+17275550142'],
    ['17275550142', '+17275550142'],
    ['+17275550142', '+17275550142'],
    ['+442071234567', '+442071234567'],
  ])('normalises %j', (input, expected) => {
    expect(normaliseNumber(input)).toBe(expected);
  });

  it.each([['', 'not a number'], ['123', 'too short'], ['abcdefghij', 'letters'], ['+1', 'just a prefix']])(
    'rejects %j (%s)',
    (input) => {
      expect(normaliseNumber(input)).toBeNull();
    },
  );

  it('masks numbers so logs never carry one whole', () => {
    expect(maskNumber('+17275550142')).toBe('***0142');
    expect(maskNumber('+17275550142')).not.toContain('727');
  });
});

describe('provider selection', () => {
  it('returns null when no provider is configured, so escalations degrade rather than crash', async () => {
    expect(await getSmsProvider({})).toBeNull();
  });

  it('returns the mock when explicitly selected outside production', async () => {
    const provider = await getSmsProvider({ SMS_PROVIDER: 'mock', NODE_ENV: 'development' });
    expect(provider?.name).toBe('mock');
    expect(provider?.simulated).toBe(true);
  });

  it('REFUSES the mock in production, so alerts cannot be silently simulated', async () => {
    // The failure this prevents: a production deploy showing SENT alerts while
    // no manager ever receives one.
    await expect(getSmsProvider({ SMS_PROVIDER: 'mock', NODE_ENV: 'production' })).rejects.toBeInstanceOf(
      SmsProviderNotConfigured,
    );
  });

  it('allows the mock in production only with an explicit staging override', async () => {
    const provider = await getSmsProvider({
      SMS_PROVIDER: 'mock',
      NODE_ENV: 'production',
      SMS_ALLOW_MOCK_IN_PRODUCTION: 'true',
    });
    expect(provider?.simulated).toBe(true);
  });

  it('refuses an unknown provider rather than silently doing nothing', async () => {
    await expect(getSmsProvider({ SMS_PROVIDER: 'twilio' })).rejects.toBeInstanceOf(SmsProviderNotConfigured);
  });
});

describe('escalation message content', () => {
  it('names the restaurant, the issue and the callback number', () => {
    const body = buildEscalationMessage(escalation, config);
    expect(body).toContain('Harbor House');
    expect(body).toContain('food safety');
    expect(body).toContain('(727) 555-0142');
    expect(body).toContain('URGENT');
  });

  it('says so explicitly when no callback number was captured', () => {
    const body = buildEscalationMessage({ ...escalation, contact: null }, config);
    expect(body).toContain('No callback number captured');
  });

  it('stays short enough to be readable on a lock screen', () => {
    const body = buildEscalationMessage(escalation, config);
    expect(body.length).toBeLessThanOrEqual(320);
  });

  it('truncates rather than letting a carrier fragment it', () => {
    const body = buildEscalationMessage({ ...escalation, summary: 'x'.repeat(1000) }, config);
    expect(body.length).toBeLessThanOrEqual(320);
    expect(body.endsWith('...')).toBe(true);
  });
});

describe('preparing a notification', () => {
  const smsOn: TenantConfig = {
    ...config,
    messaging: { ...config.messaging, smsEnabled: true, fromNumber: '(555) 010-0100' },
  };

  it('routes to the configured contact for the escalation', () => {
    const prepared = prepareEscalationNotification(escalation, smsOn);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      // "urgent" contact is (555) 010-0199 in the demo config.
      expect(prepared.toNumber).toBe('+15550100199');
      expect(prepared.fromNumber).toBe('+15550100100');
    }
  });

  it('refuses when SMS is switched off, and says why', () => {
    // Stated explicitly rather than inherited from the demo config: a
    // restaurant onboarded with messaging off must not look fully armed.
    const smsOff: TenantConfig = {
      ...config,
      messaging: { ...config.messaging, smsEnabled: false },
    };
    const prepared = prepareEscalationNotification(escalation, smsOff);
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.reason).toBe('SMS_DISABLED');
  });

  it('refuses when no sending number is configured', () => {
    const prepared = prepareEscalationNotification(escalation, {
      ...smsOn,
      messaging: { ...smsOn.messaging, fromNumber: undefined },
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.reason).toBe('NO_FROM_NUMBER');
  });

  it('refuses when the routed contact has no phone number', () => {
    const prepared = prepareEscalationNotification(escalation, {
      ...smsOn,
      escalationContacts: [{ key: 'urgent', name: 'On duty', email: 'x@example.invalid' }],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.reason).toBe('NO_CONTACT');
  });

  it('refuses when the contact number is unusable', () => {
    const prepared = prepareEscalationNotification(escalation, {
      ...smsOn,
      escalationContacts: [{ key: 'urgent', name: 'On duty', phone: 'call the desk' }],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.reason).toBe('INVALID_CONTACT_NUMBER');
  });
});

describe('retry policy', () => {
  it('never retries a permanent failure', () => {
    const decision = decideRetry(
      { status: 'FAILED', retryable: false, errorCode: 'INVALID_NUMBER' },
      1,
      now,
      'notif-1',
    );
    expect(decision).toEqual({ action: 'ABANDON', reason: 'NON_RETRYABLE' });
  });

  it('schedules a retry for a transient failure', () => {
    const decision = decideRetry({ status: 'FAILED', retryable: true, errorCode: 'TIMEOUT' }, 1, now, 'notif-1');
    expect(decision.action).toBe('RETRY');
    if (decision.action === 'RETRY') {
      expect(decision.nextAttemptAt.getTime()).toBeGreaterThan(now.getTime());
      expect(decision.attempt).toBe(2);
    }
  });

  it('backs off further on the second failure', () => {
    const first = decideRetry({ status: 'FAILED', retryable: true }, 1, now, 'notif-1');
    const second = decideRetry({ status: 'FAILED', retryable: true }, 2, now, 'notif-1');
    if (first.action === 'RETRY' && second.action === 'RETRY') {
      expect(second.nextAttemptAt.getTime()).toBeGreaterThan(first.nextAttemptAt.getTime());
    }
  });

  it('STOPS at the attempt ceiling — retries are bounded', () => {
    const decision = decideRetry({ status: 'FAILED', retryable: true }, MAX_ATTEMPTS, now, 'notif-1');
    expect(decision).toEqual({ action: 'ABANDON', reason: 'MAX_ATTEMPTS_EXCEEDED' });
  });

  it('never loops forever even for an always-failing destination', () => {
    let attempts = 0;
    for (let i = 1; i <= 50; i++) {
      const decision = decideRetry({ status: 'FAILED', retryable: true }, i, now, 'notif-1');
      if (decision.action === 'ABANDON') break;
      attempts++;
    }
    expect(attempts).toBeLessThan(MAX_ATTEMPTS);
  });

  it('overrides a provider that calls a permanent error retryable', () => {
    // A vendor marking "invalid number" retryable would otherwise cost three
    // attempts every time for a number that can never work.
    const classified = classifyResult({ status: 'FAILED', retryable: true, errorCode: 'INVALID_NUMBER' });
    expect(classified.retryable).toBe(false);
  });

  it('spreads retries so a batch does not stampede', () => {
    const a = decideRetry({ status: 'FAILED', retryable: true }, 1, now, 'notif-a');
    const b = decideRetry({ status: 'FAILED', retryable: true }, 1, now, 'notif-zzz');
    if (a.action === 'RETRY' && b.action === 'RETRY') {
      expect(a.nextAttemptAt.getTime()).not.toBe(b.nextAttemptAt.getTime());
    }
  });
});

describe('sending', () => {
  const provider = new MockSmsProvider();

  it('marks an accepted message SENT, not DELIVERED', () => {
    // Only the carrier callback can claim delivery. Conflating the two is how
    // a system believes a manager was reached when the message is still queued.
    const { ports, updates } = testPorts();
    return attemptSend(notification(), provider, ports).then((result) => {
      expect(result.outcome).toBe('SENT');
      expect(updates[0].update.status).toBe('SENT');
      expect(updates[0].update.simulated).toBe(true);
    });
  });

  it('actually hands the message to the provider', async () => {
    const { ports } = testPorts();
    await attemptSend(notification({ body: 'URGENT: Harbor House' }), provider, ports);
    expect(mockOutbox()).toHaveLength(1);
    expect(mockOutbox()[0].body).toContain('URGENT');
  });

  it('abandons immediately on a permanent failure and files it for an operator', async () => {
    const { ports, updates, failures } = testPorts();
    const result = await attemptSend(
      notification({ toNumber: `+1555010${MOCK_BEHAVIOURS.PERMANENT_FAILURE}` }),
      provider,
      ports,
    );
    expect(result.outcome).toBe('ABANDONED');
    expect(updates[0].update.status).toBe('ABANDONED');
    expect(failures).toHaveLength(1);
    expect(failures[0].category).toBe('FAILED_SMS');
  });

  it('never puts a whole phone number in the failure record', async () => {
    const { ports, failures } = testPorts();
    await attemptSend(
      notification({ toNumber: `+1555010${MOCK_BEHAVIOURS.PERMANENT_FAILURE}` }),
      provider,
      ports,
    );
    expect(failures[0].detail).not.toContain('5550100001');
    expect(failures[0].detail).toContain('***');
  });

  it('schedules a retry on a transient failure and succeeds on the next attempt', async () => {
    const { ports, updates } = testPorts();
    const record = notification({ toNumber: `+1555010${MOCK_BEHAVIOURS.TRANSIENT_FAILURE}` });

    const first = await attemptSend(record, provider, ports);
    expect(first.outcome).toBe('RETRY_SCHEDULED');
    expect(updates[0].update.status).toBe('QUEUED');

    const second = await attemptSend({ ...record, attempts: 1 }, provider, ports);
    expect(second.outcome).toBe('SENT');
  });

  it('gives up after the ceiling when a destination always fails', async () => {
    const { ports, failures } = testPorts();
    const record = notification({ toNumber: `+1555010${MOCK_BEHAVIOURS.ALWAYS_TRANSIENT}` });

    const outcomes = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      outcomes.push((await attemptSend({ ...record, attempts: attempt }, provider, ports)).outcome);
    }
    expect(outcomes).toEqual(['RETRY_SCHEDULED', 'RETRY_SCHEDULED', 'ABANDONED']);
    expect(failures.some((f) => f.detail.includes('Gave up after 3 attempts'))).toBe(true);
  });

  it('treats a provider exception as retryable rather than letting it escape', async () => {
    const exploding: SmsProvider = {
      name: 'exploding',
      simulated: true,
      send: async () => {
        throw new Error('socket hang up');
      },
    };
    const { ports, updates } = testPorts();
    const result = await attemptSend(notification(), exploding, ports);
    expect(result.outcome).toBe('RETRY_SCHEDULED');
    expect(updates[0].update.errorCode).toBe('PROVIDER_EXCEPTION');
  });

  it('does not leak a provider stack trace into the stored error', async () => {
    const exploding: SmsProvider = {
      name: 'exploding',
      simulated: true,
      send: async () => {
        throw new Error('x'.repeat(5000));
      },
    };
    const { ports, updates } = testPorts();
    await attemptSend(notification(), exploding, ports);
    expect((updates[0].update.errorMessage ?? '').length).toBeLessThanOrEqual(200);
  });
});

describe('batch dispatch', () => {
  const provider = new MockSmsProvider();

  it('processes every notification and reports what happened', async () => {
    const { ports } = testPorts();
    const summary = await dispatchBatch(
      [
        notification({ id: 'n1' }),
        notification({ id: 'n2', toNumber: `+1555010${MOCK_BEHAVIOURS.PERMANENT_FAILURE}` }),
        notification({ id: 'n3', toNumber: `+1555010${MOCK_BEHAVIOURS.ALWAYS_TRANSIENT}` }),
      ],
      provider,
      ports,
    );
    expect(summary).toEqual({ processed: 3, sent: 1, retryScheduled: 1, abandoned: 1 });
  });

  it('one bad notification does not stop the rest of the batch', async () => {
    // The loop is what gets a manager told; it has to survive a bad row.
    const { ports, failures } = testPorts();
    let calls = 0;
    const flaky: DispatchPorts = {
      ...ports,
      updateNotification: async (id, update) => {
        calls++;
        if (id === 'n1') throw new Error('database write failed');
        return ports.updateNotification(id, update);
      },
    };

    const summary = await dispatchBatch([notification({ id: 'n1' }), notification({ id: 'n2' })], provider, flaky);
    expect(summary.processed).toBe(2);
    expect(summary.sent).toBe(1);
    expect(calls).toBeGreaterThan(1);
    expect(failures.some((f) => f.category === 'FAILED_NOTIFICATION')).toBe(true);
  });

  it('handles an empty queue without error', async () => {
    const { ports } = testPorts();
    expect(await dispatchBatch([], provider, ports)).toEqual({
      processed: 0,
      sent: 0,
      retryScheduled: 0,
      abandoned: 0,
    });
  });
});
