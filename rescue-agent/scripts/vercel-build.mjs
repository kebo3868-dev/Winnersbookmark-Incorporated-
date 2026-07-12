#!/usr/bin/env node
/**
 * Vercel build entrypoint: prisma generate → prisma migrate deploy → next build.
 * Vercel runs this automatically via the `vercel-build` npm script.
 *
 * Migrations and runtime need DIFFERENT connection strings on Neon:
 * - `prisma migrate deploy` must use the UNPOOLED (direct) endpoint — running
 *   DDL through PgBouncer in transaction mode is unreliable (advisory locks,
 *   prepared statements). Neon's Vercel integration provides
 *   DATABASE_URL_UNPOOLED and POSTGRES_URL_NON_POOLING for this.
 * - The runtime client uses the pooled endpoint (resolved in src/lib/db.ts).
 */
import { execSync } from 'node:child_process';

const env = process.env;

// Migration URL: unpooled/direct names first, pooled names as fallback.
const MIGRATION_URL_SOURCES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DIRECT_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL'];
const migrationSource = MIGRATION_URL_SOURCES.find((name) => env[name]);
const migrationUrl = migrationSource ? env[migrationSource] : undefined;

// Runtime URL (only validated here; the client resolves it again at runtime).
const runtimeUrl = env.POSTGRES_PRISMA_URL || env.DATABASE_URL || env.POSTGRES_URL || env.PRISMA_DATABASE_URL;

if (!migrationUrl || !runtimeUrl) {
  console.error(
    'FATAL: no database URL found. Connect the Neon (or another Postgres) integration to this Vercel project, ' +
      'or set DATABASE_URL in the project environment. Expected one of: ' +
      MIGRATION_URL_SOURCES.join(', ') + '.',
  );
  process.exit(1);
}
for (const [label, url] of [['migration', migrationUrl], ['runtime', runtimeUrl]]) {
  if (url.startsWith('prisma+postgres://')) {
    console.error(
      `FATAL: the ${label} database URL is a prisma+postgres:// (Accelerate) URL. This app uses the standard Prisma ` +
        'client and migrations, which need a direct postgres:// connection string. With the Neon integration this is ' +
        'injected automatically; otherwise copy the direct URL from your database dashboard into DATABASE_URL.',
    );
    process.exit(1);
  }
}

if (migrationSource === 'DATABASE_URL' || migrationSource === 'POSTGRES_URL') {
  console.warn(
    `WARNING: migrations will run over ${migrationSource}, which may be a pooled (PgBouncer) endpoint. ` +
      'If `prisma migrate deploy` fails or hangs, expose the unpooled URL as DATABASE_URL_UNPOOLED.',
  );
} else {
  console.log(`Using ${migrationSource} for migrations (unpooled) and ${env.POSTGRES_PRISMA_URL ? 'POSTGRES_PRISMA_URL' : 'DATABASE_URL'} for runtime.`);
}

const run = (cmd, extraEnv = {}) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: { ...env, ...extraEnv } });
};

run('prisma generate');
run('prisma migrate deploy', { DATABASE_URL: migrationUrl });
run('next build');
