import { describe, expect, it } from 'vitest';
import { LEAD_STATUSES, parseLeadStatus } from '@/lib/leads/status';
import { purgeDemoData, type DemoPurgeClient } from '@/lib/audit/demoPurge';
import { DEMO_WEBSITE_URL } from '@/lib/audit/demo';

describe('lead status validation', () => {
  it('accepts every pipeline stage the UI offers', () => {
    for (const s of LEAD_STATUSES) expect(parseLeadStatus(s)).toBe(s);
  });

  it('rejects anything else, so the API cannot be driven off the enum', () => {
    expect(parseLeadStatus('QUOTED')).toBeNull(); // the other app's enum value
    expect(parseLeadStatus('new')).toBeNull(); // case matters
    expect(parseLeadStatus('')).toBeNull();
    expect(parseLeadStatus(null)).toBeNull();
    expect(parseLeadStatus(42)).toBeNull();
    expect(parseLeadStatus({ status: 'WON' })).toBeNull();
  });
});

/** Records what the purge asked the database to do, without a database. */
function fakeClient(auditCount = 1, restaurantCount = 1) {
  const calls: { model: string; where: unknown }[] = [];
  const client: DemoPurgeClient = {
    audit: {
      deleteMany: async (args) => {
        calls.push({ model: 'audit', where: args.where });
        return { count: auditCount };
      },
    },
    restaurant: {
      deleteMany: async (args) => {
        calls.push({ model: 'restaurant', where: args.where });
        return { count: restaurantCount };
      },
    },
  };
  return { client, calls };
}

describe('purgeDemoData', () => {
  it('deletes audits only where demoMode is true — never real audits', () => {
    const { client, calls } = fakeClient();
    return purgeDemoData(client).then(() => {
      const auditCall = calls.find((c) => c.model === 'audit');
      expect(auditCall?.where).toEqual({ demoMode: true });
    });
  });

  it('deletes only the fictional demo restaurant, and only once it has no audits', async () => {
    const { client, calls } = fakeClient();
    await purgeDemoData(client);
    const restaurantCall = calls.find((c) => c.model === 'restaurant');
    expect(restaurantCall?.where).toEqual({ websiteUrl: DEMO_WEBSITE_URL, audits: { none: {} } });
    // The demo URL is a .invalid domain, so it can never collide with a real site.
    expect(DEMO_WEBSITE_URL).toContain('.invalid');
  });

  it('removes audits before the restaurant, so the restaurant is unreferenced', async () => {
    const { client, calls } = fakeClient();
    await purgeDemoData(client);
    expect(calls.map((c) => c.model)).toEqual(['audit', 'restaurant']);
  });

  it('reports what it deleted', async () => {
    const { client } = fakeClient(3, 1);
    expect(await purgeDemoData(client)).toEqual({ auditsDeleted: 3, restaurantsDeleted: 1 });
  });

  it('is a no-op that reports zero when there is no demo data', async () => {
    const { client } = fakeClient(0, 0);
    expect(await purgeDemoData(client)).toEqual({ auditsDeleted: 0, restaurantsDeleted: 0 });
  });
});
