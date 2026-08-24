import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { parseTenantConfig, type TenantConfig } from '../config/schema';
import { getEmailProvider } from '../email/factory';
import type { EmailCopyChannel, EmailCopyContext } from './emailCopy';
import type { NotificationRecord } from './dispatch';

/**
 * Builds the email channel the dispatch worker hands to `dispatchBatch`.
 *
 * Everything database-shaped lives here so `emailCopy.ts` stays a pure module
 * that can be tested without Prisma, and so `dispatch.ts` gains no persistence
 * knowledge at all.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Returns null when email is not configured for this deployment — the default,
 * and the reason receiving this code changes nothing operationally.
 *
 * A misconfigured `EMAIL_PROVIDER` throws from the factory. That is deliberate
 * at the factory, but NOT here: the caller is the SMS dispatch cycle, and a
 * typo'd email variable must not stop food-safety alerts from sending. The
 * error is swallowed into the failure queue by the worker instead.
 */
export async function buildEmailCopyChannel(
  env: Record<string, string | undefined> = process.env,
  db: Db = prisma,
): Promise<EmailCopyChannel | null> {
  const provider = await getEmailProvider(env);
  if (!provider) return null;

  // One cache per cycle. A batch of twenty alerts for one restaurant should
  // read its config once, and a cache that outlived the cycle would serve a
  // stale config after an operator fixed one.
  const configCache = new Map<string, TenantConfig | null>();

  return {
    provider,
    async resolve(notification: NotificationRecord): Promise<EmailCopyContext | null> {
      if (!notification.escalationId) return null;

      const escalation = await db.fdEscalation.findFirst({
        // Tenant-scoped like every other read in this codebase: the id came
        // from a claimed row, but the WHERE clause does not rely on that.
        where: { id: notification.escalationId, tenantId: notification.tenantId },
        select: { reason: true, severity: true, summary: true, customerName: true, routeTo: true, demoMode: true },
      });
      // Gone (retention purged it) or belongs to another tenant. Either way
      // there is nothing truthful to email.
      if (!escalation) return null;
      // A simulated escalation must never mail a real person.
      if (escalation.demoMode) return null;

      const config = await loadConfig(notification.tenantId);
      if (!config) return null;

      return {
        config,
        escalation: {
          reason: escalation.reason,
          severity: escalation.severity,
          summary: escalation.summary,
          customerName: escalation.customerName,
          routeTo: escalation.routeTo,
        },
      };
    },
  };

  async function loadConfig(tenantId: string): Promise<TenantConfig | null> {
    if (configCache.has(tenantId)) return configCache.get(tenantId) ?? null;

    const row = await db.fdTenant.findUnique({ where: { id: tenantId }, select: { config: true, demoMode: true } });
    let config: TenantConfig | null = null;
    if (row && !row.demoMode) {
      const parsed = parseTenantConfig(row.config);
      // A config that no longer validates is already surfaced by the tenant
      // list. Emailing from a config we could not parse is not an option.
      if (parsed.ok) config = parsed.config;
    }
    configCache.set(tenantId, config);
    return config;
  }
}
