import { describe, expect, it } from 'vitest';
import { resolveLeadRetentionDays, redactExpiredLeads, type LeadRetentionClient } from '@/lib/leads/retention';

describe('resolveLeadRetentionDays', () => {
  it('is disabled unless explicitly configured — no silent deletion by default', () => {
    expect(resolveLeadRetentionDays({})).toBeNull();
    expect(resolveLeadRetentionDays({ LEAD_RETENTION_DAYS: '' })).toBeNull();
  });

  it('honours a configured window', () => {
    expect(resolveLeadRetentionDays({ LEAD_RETENTION_DAYS: '365' })).toBe(365);
    expect(resolveLeadRetentionDays({ LEAD_RETENTION_DAYS: '30' })).toBe(30);
  });

  it('disables rather than guessing when the value is nonsense', () => {
    expect(resolveLeadRetentionDays({ LEAD_RETENTION_DAYS: 'forever' })).toBeNull();
    expect(resolveLeadRetentionDays({ LEAD_RETENTION_DAYS: '0' })).toBeNull();
    expect(resolveLeadRetentionDays({ LEAD_RETENTION_DAYS: '-30' })).toBeNull();
  });

  it('clamps extreme windows', () => {
    expect(resolveLeadRetentionDays({ LEAD_RETENTION_DAYS: '99999' })).toBe(3650);
    expect(resolveLeadRetentionDays({ LEAD_RETENTION_DAYS: '0.2' })).toBe(1);
  });
});

function fakeClient(count = 2) {
  const calls: { where: unknown; data: unknown }[] = [];
  const client: LeadRetentionClient = {
    auditLead: {
      updateMany: async (args) => {
        calls.push({ where: args.where, data: args.data });
        return { count };
      },
    },
  };
  return { client, calls };
}

describe('redactExpiredLeads', () => {
  const now = new Date('2026-07-26T00:00:00.000Z');

  it('redacts every personal field, and only those', () => {
    const { client, calls } = fakeClient();
    return redactExpiredLeads(client, 365, now).then(() => {
      expect(calls[0].data).toEqual({ contactName: null, email: null, phone: null });
    });
  });

  it('targets only leads older than the retention window', async () => {
    const { client, calls } = fakeClient();
    await redactExpiredLeads(client, 30, now);
    const where = calls[0].where as { createdAt: { lt: Date } };
    // 30 days before 2026-07-26 is 2026-06-26
    expect(where.createdAt.lt.toISOString()).toBe('2026-06-26T00:00:00.000Z');
  });

  it('is idempotent — already-redacted rows are excluded from the match', async () => {
    const { client, calls } = fakeClient();
    await redactExpiredLeads(client, 365, now);
    const where = calls[0].where as { OR: unknown[] };
    expect(where.OR).toEqual([
      { contactName: { not: null } },
      { email: { not: null } },
      { phone: { not: null } },
    ]);
  });

  it('reports how many rows it redacted', async () => {
    const { client } = fakeClient(7);
    expect(await redactExpiredLeads(client, 365, now)).toBe(7);
  });

  it('keeps the lead row itself — pipeline history survives redaction', async () => {
    const { client, calls } = fakeClient();
    await redactExpiredLeads(client, 365, now);
    // The sweep only ever issues an update; deletion is the separate,
    // explicit erasure path (DELETE /api/leads/[id]).
    expect(calls).toHaveLength(1);
    expect(calls[0].data).not.toHaveProperty('status');
    expect(calls[0].data).not.toHaveProperty('auditId');
  });
});
