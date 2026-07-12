import { PrismaClient } from '@prisma/client';

/**
 * Runtime connection string resolution, in priority order:
 *
 * 1. POSTGRES_PRISMA_URL — Neon's Vercel integration provides this specifically
 *    for Prisma: the pooled (PgBouncer) endpoint with `pgbouncer=true` set so
 *    the client avoids prepared-statement conflicts in transaction mode.
 * 2. DATABASE_URL — standard name (Neon sets this to the pooled URL too).
 * 3. POSTGRES_URL / PRISMA_DATABASE_URL — other integrations' aliases.
 *
 * Must be a direct postgres:// URL (never prisma+postgres://). Migrations use
 * the UNPOOLED URL instead — see scripts/vercel-build.mjs.
 */
export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.POSTGRES_PRISMA_URL || env.DATABASE_URL || env.POSTGRES_URL || env.PRISMA_DATABASE_URL;
}

/** Name of the env var the runtime connection came from (for diagnostics). */
export function resolveDatabaseUrlSource(env: Record<string, string | undefined> = process.env): string | null {
  for (const name of ['POSTGRES_PRISMA_URL', 'DATABASE_URL', 'POSTGRES_URL', 'PRISMA_DATABASE_URL']) {
    if (env[name]) return name;
  }
  return null;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
