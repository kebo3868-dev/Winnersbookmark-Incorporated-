import { PrismaClient } from '@prisma/client';

/**
 * Runtime connection string resolution, in priority order:
 *
 * 1. RESCUE_DATABASE_URL — this app's own override, and the only name a
 *    managed integration will not overwrite. The Neon Vercel integration owns
 *    DATABASE_URL/DATABASE_URL_UNPOOLED and locks them to the database it
 *    provisioned, so pointing this app at a different database (it has its own,
 *    separate from the other application sharing the Neon project) requires a
 *    name the integration does not manage. Set it to the POOLED endpoint.
 * 2. POSTGRES_PRISMA_URL — Neon's Vercel integration provides this specifically
 *    for Prisma: the pooled (PgBouncer) endpoint with `pgbouncer=true` set so
 *    the client avoids prepared-statement conflicts in transaction mode.
 * 3. DATABASE_URL — standard name (Neon sets this to the pooled URL too).
 * 4. POSTGRES_URL / PRISMA_DATABASE_URL — other integrations' aliases.
 *
 * Must be a direct postgres:// URL (never prisma+postgres://). Migrations use
 * the UNPOOLED URL instead — see scripts/vercel-build-plan.mjs.
 *
 * Not on a non-production Vercel deployment: see NON_PRODUCTION_DATABASE_URL.
 */
export const RUNTIME_URL_SOURCES = [
  'RESCUE_DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL',
  'POSTGRES_URL',
  'PRISMA_DATABASE_URL',
] as const;

/**
 * PREVIEW AND DEVELOPMENT DEPLOYMENTS NEVER CONNECT TO A DATABASE.
 *
 * A Vercel deployment that is not production gets this address instead of any
 * configured variable. `.invalid` is reserved (RFC 2606) and never resolves, so
 * every query fails to connect. It is never `undefined`: with no URL, Prisma
 * falls back to the schema's `env("DATABASE_URL")`, which is exactly the
 * variable that must not be used here. Database variables are scoped to
 * Production only in Vercel; this keeps a re-scoped variable harmless at
 * runtime too. The build refuses the same situation (scripts/vercel-build-plan.mjs).
 */
export const NON_PRODUCTION_DATABASE_URL = 'postgresql://non-production-database-disabled.invalid:5432/disabled';

/**
 * True on a Vercel deployment that is not production (preview, development),
 * and on Vercel when the target cannot be determined. Local development,
 * Docker and CI (no Vercel variables) are unaffected.
 */
export function isNonProductionDeployment(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV !== 'production';
  return env.VERCEL === '1';
}

export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  if (isNonProductionDeployment(env)) return NON_PRODUCTION_DATABASE_URL;
  for (const name of RUNTIME_URL_SOURCES) {
    if (env[name]) return env[name];
  }
  return undefined;
}

/** Name of the env var the runtime connection came from (for diagnostics). */
export function resolveDatabaseUrlSource(env: Record<string, string | undefined> = process.env): string | null {
  if (isNonProductionDeployment(env)) return 'DISABLED — non-production deployment';
  for (const name of RUNTIME_URL_SOURCES) {
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
