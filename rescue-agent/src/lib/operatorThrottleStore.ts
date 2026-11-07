/**
 * Which store holds the operator sign-in counters (see operatorThrottle.ts).
 *
 * - Production (NODE_ENV=production, and not a Vercel preview/development
 *   deployment): ALWAYS the shared Postgres store. There is no fallback. If the
 *   database or the table is unavailable, the gate refuses credentialed
 *   requests with 503 (operatorGate.ts) — sign-in protection is never quietly
 *   downgraded to a per-instance count.
 * - Vercel preview/development deployments have no database by design
 *   (db.ts, isNonProductionDeployment), and local development needs none:
 *   per-instance memory.
 */
import { isNonProductionDeployment } from '@/lib/db';
import { memoryStore, postgresStore, type ThrottleStore } from '@/lib/operatorThrottle';

export type ThrottleBackend = 'shared-postgres' | 'per-instance-memory';

export function throttleBackend(env: Record<string, string | undefined> = process.env): ThrottleBackend {
  if (isNonProductionDeployment(env)) return 'per-instance-memory';
  return env.NODE_ENV === 'production' ? 'shared-postgres' : 'per-instance-memory';
}

let chosen: ThrottleStore | null = null;

export async function operatorThrottleStore(): Promise<ThrottleStore> {
  if (chosen) return chosen;
  if (throttleBackend() === 'per-instance-memory') {
    chosen = memoryStore();
  } else {
    const { prisma } = await import('@/lib/db');
    chosen = postgresStore(prisma);
  }
  return chosen;
}
