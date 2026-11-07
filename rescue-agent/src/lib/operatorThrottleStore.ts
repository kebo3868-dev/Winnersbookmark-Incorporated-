/**
 * Which store holds the operator sign-in counters (see operatorThrottle.ts).
 *
 * - Production with a database: Postgres, shared by every instance, falling
 *   back to per-instance memory if the database errors.
 * - Preview and development deployments have no database by design, and local
 *   development may have none: per-instance memory.
 */
import { isNonProductionDeployment, resolveDatabaseUrl } from '@/lib/db';
import { memoryStore, postgresStore, resilientStore, type ThrottleStore } from '@/lib/operatorThrottle';

const fallback = memoryStore();
let chosen: ThrottleStore | null = null;
let lastWarning = 0;

export async function operatorThrottleStore(): Promise<ThrottleStore> {
  if (chosen) return chosen;
  if (isNonProductionDeployment() || !resolveDatabaseUrl()) {
    chosen = fallback;
    return chosen;
  }
  const { prisma } = await import('@/lib/db');
  chosen = resilientStore(postgresStore(prisma), fallback, () => {
    // Never the error text: it can carry connection details.
    if (Date.now() - lastWarning > 60_000) {
      lastWarning = Date.now();
      console.error('[operator-auth] sign-in counters unavailable; using per-instance limits');
    }
  });
  return chosen;
}
