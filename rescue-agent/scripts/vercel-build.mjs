#!/usr/bin/env node
/**
 * Vercel build entrypoint. Vercel runs this automatically via the
 * `vercel-build` npm script.
 *
 * Production: prisma generate → prisma migrate deploy → next build.
 * Preview / development: prisma generate → next build, and never a database.
 * What runs is decided by planVercelBuild (scripts/vercel-build-plan.mjs);
 * this file only executes the plan.
 *
 * Migrations and runtime need DIFFERENT connection strings on Neon:
 * - `prisma migrate deploy` must use the UNPOOLED (direct) endpoint — running
 *   DDL through PgBouncer in transaction mode is unreliable (advisory locks,
 *   prepared statements). Neon's Vercel integration provides
 *   DATABASE_URL_UNPOOLED and POSTGRES_URL_NON_POOLING for this.
 * - The runtime client uses the pooled endpoint (resolved in src/lib/db.ts).
 */
import { execSync } from 'node:child_process';
import { planVercelBuild } from './vercel-build-plan.mjs';

const plan = planVercelBuild(process.env);
if (!plan.ok) {
  console.error(plan.error);
  process.exit(1);
}
for (const note of plan.notes) {
  (note.startsWith('WARNING') ? console.warn : console.log)(note);
}
for (const step of plan.steps) {
  console.log(`\n> ${step.cmd}`);
  execSync(step.cmd, { stdio: 'inherit', env: { ...process.env, ...(step.env ?? {}) } });
}
