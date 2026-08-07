import { describe, expect, it } from 'vitest';
import {
  applyRetention,
  getConversationHistory,
  getTenantBySlug,
  getTodaySummary,
  listEscalationsForTenant,
  listLeadsForTenant,
  purgeFrontDeskDemoData,
  updateLeadStatus,
} from '@/lib/frontdesk/store';

/**
 * MULTI-TENANT ISOLATION (§XIX)
 *
 * These assert the property that matters commercially: no read or write can be
 * issued without a tenant filter. Rather than mocking a database and checking
 * returned rows — which would only prove the mock behaves — the fake records
 * every query the store issues and the tests assert on the WHERE clauses.
 *
 * That catches the specific mistake this product cannot afford: a query that
 * looks up a row by id alone and therefore returns another restaurant's data
 * whenever an id leaks or is guessed.
 */

interface RecordedQuery {
  model: string;
  operation: string;
  where: Record<string, unknown> | undefined;
}

/** A stand-in Prisma client that records what it was asked, and returns nothing. */
function recordingClient() {
  const queries: RecordedQuery[] = [];

  const model = (name: string) => ({
    findUnique: async (args: { where: Record<string, unknown> }) => {
      queries.push({ model: name, operation: 'findUnique', where: args.where });
      return null;
    },
    findFirst: async (args: { where: Record<string, unknown> }) => {
      queries.push({ model: name, operation: 'findFirst', where: args.where });
      return null;
    },
    findMany: async (args?: { where?: Record<string, unknown> }) => {
      queries.push({ model: name, operation: 'findMany', where: args?.where });
      return [];
    },
    count: async (args?: { where?: Record<string, unknown> }) => {
      queries.push({ model: name, operation: 'count', where: args?.where });
      return 0;
    },
    updateMany: async (args: { where: Record<string, unknown> }) => {
      queries.push({ model: name, operation: 'updateMany', where: args.where });
      return { count: 1 };
    },
    deleteMany: async (args: { where: Record<string, unknown> }) => {
      queries.push({ model: name, operation: 'deleteMany', where: args.where });
      return { count: 2 };
    },
    create: async (args: { data: Record<string, unknown> }) => {
      queries.push({ model: name, operation: 'create', where: args.data });
      return { id: `${name}-id` };
    },
  });

  const client = {
    fdTenant: model('fdTenant'),
    fdConversation: model('fdConversation'),
    fdMessage: model('fdMessage'),
    fdLead: model('fdLead'),
    fdEscalation: model('fdEscalation'),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };

  return { client, queries };
}

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

describe('every tenant-scoped read filters by tenantId', () => {
  it('scopes conversation history', async () => {
    const { client, queries } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getConversationHistory(TENANT_A, 'conversation-1', client as any);
    expect(queries).toHaveLength(1);
    expect(queries[0].where).toMatchObject({ tenantId: TENANT_A, conversationId: 'conversation-1' });
  });

  it('scopes the leads list', async () => {
    const { client, queries } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listLeadsForTenant(TENANT_A, {}, client as any);
    expect(queries[0].where).toMatchObject({ tenantId: TENANT_A });
  });

  it('scopes the escalations list', async () => {
    const { client, queries } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listEscalationsForTenant(TENANT_A, 10, client as any);
    expect(queries[0].where).toMatchObject({ tenantId: TENANT_A });
  });

  it('scopes every query behind the TODAY dashboard', async () => {
    const { client, queries } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getTodaySummary(TENANT_A, new Date('2026-08-12T00:00:00Z'), client as any);
    expect(queries.length).toBeGreaterThan(0);
    // Not one aggregate on this screen may reach across tenants.
    for (const query of queries) {
      expect(query.where).toMatchObject({ tenantId: TENANT_A });
    }
  });

  it('scopes retention deletion', async () => {
    const { client, queries } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await applyRetention(TENANT_A, 365, new Date('2026-08-12T00:00:00Z'), client as any);
    expect(queries[0].operation).toBe('deleteMany');
    expect(queries[0].where).toMatchObject({ tenantId: TENANT_A });
  });
});

describe('lead updates cannot cross tenants', () => {
  it('includes the tenant in the update filter, not just the lead id', async () => {
    const { client, queries } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateLeadStatus(TENANT_A, 'lead-1', { status: 'WON' }, client as any);

    expect(queries[0].operation).toBe('updateMany');
    // `update({ where: { id } })` would have been enough to change the row —
    // and enough to change another restaurant's row. The tenant filter is what
    // makes a leaked id useless.
    expect(queries[0].where).toMatchObject({ id: 'lead-1', tenantId: TENANT_A });
  });

  it('reports failure rather than success when nothing matched', async () => {
    const { client } = recordingClient();
    client.fdLead.updateMany = async () => ({ count: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await updateLeadStatus(TENANT_B, 'lead-belonging-to-a', { status: 'WON' }, client as any);
    // The API turns this into a 404, so a wrong-tenant id is indistinguishable
    // from a lead that does not exist — no existence oracle.
    expect(updated).toBe(false);
  });
});

describe('tenant lookup', () => {
  it('resolves a tenant only by its own slug', async () => {
    const { client, queries } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getTenantBySlug('harbor-house', client as any);
    expect(queries[0].where).toEqual({ slug: 'harbor-house' });
  });

  it('returns null for an unknown tenant rather than falling back to any tenant', async () => {
    const { client } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getTenantBySlug('does-not-exist', client as any)).toBeNull();
  });

  it('returns null when a tenant config is corrupt instead of running on a partial config', async () => {
    const { client } = recordingClient();
    client.fdTenant.findUnique = async () =>
      ({ id: 't1', slug: 's', name: 'n', status: 'ACTIVE', demoMode: false, config: { nonsense: true } }) as never;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getTenantBySlug('s', client as any)).toBeNull();
  });
});

describe('demo data purge', () => {
  it('scopes every delete to demo data only', async () => {
    const { client, queries } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await purgeFrontDeskDemoData(client as any);

    expect(queries).toHaveLength(4);
    for (const query of queries) {
      expect(query.operation).toBe('deleteMany');
      // Nothing here can match a real restaurant's row.
      expect(query.where).toEqual({ demoMode: true });
    }
    expect(result.tenantsDeleted).toBe(2);
  });

  it('deletes children before tenants so nothing is orphaned mid-purge', async () => {
    const { client, queries } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await purgeFrontDeskDemoData(client as any);
    expect(queries.map((q) => q.model)).toEqual([
      'fdEscalation',
      'fdLead',
      'fdConversation',
      'fdTenant',
    ]);
  });
});
