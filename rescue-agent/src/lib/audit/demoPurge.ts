import { DEMO_WEBSITE_URL } from '@/lib/audit/demo';

/**
 * DEMO DATA PURGE
 *
 * The demo audit exists to showcase the product, but once it is sitting in the
 * Leads pipeline next to real prospects it undermines the thing it was meant to
 * sell. This removes it.
 *
 * Safety: every delete is scoped by `demoMode: true` (or, for the restaurant,
 * by the fixed fictional demo URL). Nothing here can match a real audit, and
 * the shape is deliberately narrow so a test can assert that.
 *
 * Audit children (evidence, sources, scores, reports, journey stages,
 * opportunities, the job, and the captured lead) all cascade from Audit, so
 * deleting the audits is enough to remove them.
 */

/** The subset of the Prisma client this needs — keeps it unit-testable. */
export interface DemoPurgeClient {
  audit: {
    deleteMany(args: { where: { demoMode: true } }): Promise<{ count: number }>;
  };
  restaurant: {
    deleteMany(args: { where: { websiteUrl: string; audits: { none: object } } }): Promise<{ count: number }>;
  };
}

export interface DemoPurgeResult {
  auditsDeleted: number;
  restaurantsDeleted: number;
}

export async function purgeDemoData(client: DemoPurgeClient): Promise<DemoPurgeResult> {
  // 1. Demo audits — cascades to their evidence, scores, reports and leads.
  const audits = await client.audit.deleteMany({ where: { demoMode: true } });

  // 2. The fictional demo restaurant, but only once it has no audits left.
  //    The `audits: { none: {} }` guard means a real audit against this URL
  //    (impossible in practice — the domain is .invalid) would still protect it.
  const restaurants = await client.restaurant.deleteMany({
    where: { websiteUrl: DEMO_WEBSITE_URL, audits: { none: {} } },
  });

  return { auditsDeleted: audits.count, restaurantsDeleted: restaurants.count };
}
