import { beforeEach, describe, expect, it } from 'vitest';
import { attemptSend, type DispatchPorts, type NotificationRecord } from '@/lib/frontdesk/notify/dispatch';
import { MockSmsProvider, mockOutbox, resetMockProvider } from '@/lib/frontdesk/notify/mock';
import { cronSecretMatches } from '@/lib/frontdesk/notify/worker';

/**
 * DISPATCH WORKER
 *
 * The unit-testable half. Concurrency and crash recovery depend on Postgres
 * row locking and are covered by the live harness (tests/README notes this),
 * because a mock cannot prove FOR UPDATE SKIP LOCKED works.
 */

const now = new Date('2026-08-07T12:00:00Z');

function ports() {
  const updates: { id: string; status: string }[] = [];
  const port: DispatchPorts = {
    updateNotification: async (id, update) => {
      updates.push({ id, status: update.status });
    },
    recordFailure: async () => {},
    now: () => now,
  };
  return { port, updates };
}

function notification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: 'notif-1',
    tenantId: 'tenant-a',
    escalationId: 'esc-1',
    toNumber: '+15550100199',
    fromNumber: '+15550100100',
    body: 'alert',
    attempts: 0,
    maxAttempts: 3,
    ...overrides,
  };
}

beforeEach(() => resetMockProvider());

describe('duplicate-send protection via idempotency key', () => {
  const provider = new MockSmsProvider();

  it('re-running the SAME attempt does not send twice', async () => {
    // Models a worker that crashed after the provider accepted the message but
    // before the outcome was recorded: the row is reclaimed and re-sent with
    // the same attempt number, and the vendor must recognise the repeat.
    const { port } = ports();
    const record = notification();

    await attemptSend(record, provider, port);
    await attemptSend(record, provider, port);

    expect(mockOutbox()).toHaveLength(1);
  });

  it('a genuine retry after a transient failure IS a new send', async () => {
    // Attempt 2 must not be deduplicated against attempt 1, or a transient
    // failure would permanently swallow the alert.
    const { port } = ports();
    const record = notification({ toNumber: '+15550100002' }); // transient once

    const first = await attemptSend({ ...record, attempts: 0 }, provider, port);
    const second = await attemptSend({ ...record, attempts: 1 }, provider, port);

    expect(first.outcome).toBe('RETRY_SCHEDULED');
    expect(second.outcome).toBe('SENT');
    expect(mockOutbox()).toHaveLength(1);
  });

  it('different notifications are never deduplicated against each other', async () => {
    const { port } = ports();
    await attemptSend(notification({ id: 'n1' }), provider, port);
    await attemptSend(notification({ id: 'n2' }), provider, port);
    expect(mockOutbox()).toHaveLength(2);
  });

  it('replaying an attempt returns the original outcome, not a fresh success', async () => {
    const { port } = ports();
    const record = notification({ toNumber: '+15550100001' }); // permanent failure

    const first = await attemptSend(record, provider, port);
    const replay = await attemptSend(record, provider, port);

    expect(first.outcome).toBe('ABANDONED');
    expect(replay.outcome).toBe('ABANDONED');
    expect(mockOutbox()).toHaveLength(0);
  });
});

describe('cron secret', () => {
  const secret = 'a-sufficiently-long-cron-secret';

  it('accepts the correct secret', () => {
    expect(cronSecretMatches(`Bearer ${secret}`, secret)).toBe(true);
  });

  it('FAILS CLOSED when no secret is configured', () => {
    // Unsetting the variable must never make a queue-draining endpoint open.
    expect(cronSecretMatches(`Bearer ${secret}`, undefined)).toBe(false);
    expect(cronSecretMatches(`Bearer anything`, '')).toBe(false);
  });

  it('refuses a weak secret outright', () => {
    // An endpoint that drains the queue must not be reachable because someone
    // set CRON_SECRET=test.
    expect(cronSecretMatches('Bearer test', 'test')).toBe(false);
    expect(cronSecretMatches('Bearer short-secret', 'short-secret')).toBe(false);
  });

  it.each([
    ['no header', null],
    ['wrong secret', 'Bearer wrong-but-long-enough-secret'],
    ['basic credential', 'Basic dXNlcjpwYXNz'],
    ['bare token without Bearer', 'a-sufficiently-long-cron-secret'],
    ['secret with trailing junk', 'Bearer a-sufficiently-long-cron-secretX'],
    ['prefix of the secret', 'Bearer a-sufficiently-long-cron-secre'],
  ])('rejects %s', (_label, header) => {
    expect(cronSecretMatches(header, secret)).toBe(false);
  });
});
