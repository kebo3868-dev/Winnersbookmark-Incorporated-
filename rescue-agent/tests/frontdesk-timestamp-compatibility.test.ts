import { describe, expect, it } from 'vitest';
import { pilotSchema } from '@/lib/frontdesk/config/schema';
import { getTenantBySlug, listTenants } from '@/lib/frontdesk/store';

const fields = ['ownerVerifiedAt', 'telecomAttestedAt', 'failureReviewAttestedAt'] as const;

describe.each(fields)('%s timestamp compatibility', field => {
  it.each(['2026-11-03T12:34Z', '2026-11-03T12:34:56Z', '2026-11-03T12:34:56.123456Z',
    '2024-02-29T00:00Z'])('accepts and preserves %s', timestamp => {
    expect(pilotSchema.parse({ [field]: timestamp })[field]).toBe(timestamp);
  });

  it.each(['2026-02-29T12:34Z', '2026-11-31T12:34Z', '2026-13-03T12:34Z',
    '2026-11-03T24:00Z', '2026-11-03T12:60Z', '2026-11-03T12:34:60Z',
    '2026-11-03', '2026-11-03T12:34', '2026-11-03T12:34+01:00',
    '2026-11-03T12:34:Z', '2026-11-03T12:34.5Z', '2026-11-03t12:34z',
    ' 2026-11-03T12:34Z', 'not a timestamp'])('rejects %s', timestamp => {
    expect(pilotSchema.safeParse({ [field]: timestamp }).success).toBe(false);
  });
});

it.each(['2026-11-03T12:34Z', '2026-11-03T12:34:56Z'])('loads stored tenants using %s without mutation or a false 404', async timestamp => {
  const row = {
    id: 'stored-tenant', slug: 'stored-restaurant', name: 'Stored Restaurant',
    status: 'ACTIVE', demoMode: false,
    config: { restaurantName: 'Stored Restaurant', pilot: Object.fromEntries(fields.map(f => [f, timestamp])) },
  };
  const original = structuredClone(row);
  const db = { fdTenant: { findUnique: async () => row, findMany: async () => [row] } };
  const loaded = await getTenantBySlug(row.slug, db as never);
  expect(loaded?.id).toBe(row.id);
  for (const field of fields) expect(loaded?.config.pilot[field]).toBe(timestamp);
  expect(await listTenants(db as never)).toMatchObject({ tenants: [{ id: row.id }], failures: [] });
  expect(row).toEqual(original);
});
