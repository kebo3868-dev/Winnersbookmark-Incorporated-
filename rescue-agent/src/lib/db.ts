import { PrismaClient } from '@prisma/client';

/**
 * Connection string resolution. Managed-Postgres integrations name the
 * variable differently (Vercel's Prisma Postgres integration may expose
 * POSTGRES_URL / PRISMA_DATABASE_URL alongside or instead of DATABASE_URL),
 * so accept the common aliases in priority order. Must be a direct
 * postgres:// / postgresql:// URL — see docs/DEPLOYMENT.md.
 */
export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.DATABASE_URL || env.POSTGRES_URL || env.PRISMA_DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
