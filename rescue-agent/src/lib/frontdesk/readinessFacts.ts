import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { TenantConfig } from './config/schema';
import { buildReadinessReport, demoTenantBlocker, type ReadinessReport } from './config/readiness';
import { getRotaStatus } from './notify/verification';

/**
 * Gather the live facts the readiness gate needs, then run it.
 *
 * The gate itself is pure — it takes facts and returns a verdict — so that
 * every branch is testable without a database. This is the thin layer that
 * goes and finds the facts, kept separate for exactly that reason.
 */
export async function loadReadiness(
  tenant: { id: string; demoMode: boolean; config: TenantConfig; webhookSecretHash?: string | null },
  db: PrismaClient = prisma,
  env: Record<string, string | undefined> = process.env,
): Promise<ReadinessReport> {
  const [rota, openFailures, criticalUnreachable, webhookSecretHash] = await Promise.all([
    getRotaStatus(tenant.id, tenant.config, db),
    db.fdFailure.count({ where: { tenantId: tenant.id, status: 'OPEN' } }),
    db.fdFailure.count({
      where: { tenantId: tenant.id, status: 'OPEN', operation: 'escalation.critical_unreachable' },
    }),
    tenant.webhookSecretHash !== undefined
      ? Promise.resolve(tenant.webhookSecretHash)
      : db.fdTenant
          .findUnique({ where: { id: tenant.id }, select: { webhookSecretHash: true } })
          .then((row) => row?.webhookSecretHash ?? null),
  ]);

  const report = buildReadinessReport(tenant.config, {
    webhookSecretConfigured: Boolean(webhookSecretHash),
    // Whether a scheduler is actually firing cannot be observed from inside a
    // request. It is asserted by configuration and confirmed by the operator,
    // which is why the check's owner is OPERATOR rather than CODE.
    dispatchWorkerScheduled: env.FRONTDESK_DISPATCH_SCHEDULED === 'true',
    openFailures,
    criticalUnreachableFailures: criticalUnreachable,
    rota: { order: rota.order, verifiedKeys: rota.verifiedKeys },
    env,
  });

  if (!tenant.demoMode) return report;

  // A demo restaurant can never be activated, whatever else passes.
  const blocker = demoTenantBlocker();
  const checks = [blocker, ...report.checks];
  const blockers = [blocker, ...report.blockers];
  return {
    ...report,
    checks,
    blockers,
    canActivate: false,
    byOwner: { ...report.byOwner, OPERATOR: [blocker, ...report.byOwner.OPERATOR] },
  };
}
