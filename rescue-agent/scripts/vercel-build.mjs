#!/usr/bin/env node
/**
 * Vercel build entrypoint: resolves the database URL from the env var names
 * managed-Postgres integrations use, applies Prisma migrations, then builds.
 * Vercel runs this automatically via the `vercel-build` npm script.
 */
import { execSync } from 'node:child_process';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
if (!url) {
  console.error('FATAL: no database URL found. Set DATABASE_URL (or POSTGRES_URL) in the Vercel project environment.');
  process.exit(1);
}
if (url.startsWith('prisma+postgres://')) {
  console.error(
    'FATAL: DATABASE_URL is a prisma+postgres:// (Accelerate) URL. This app uses the standard Prisma client and migrations, ' +
      'which need the DIRECT connection string. In the Prisma Postgres dashboard copy the direct postgres:// URL ' +
      '(host db.prisma.io, sslmode=require) and set it as DATABASE_URL.',
  );
  process.exit(1);
}

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
};

run('prisma generate');
run('prisma migrate deploy');
run('next build');
