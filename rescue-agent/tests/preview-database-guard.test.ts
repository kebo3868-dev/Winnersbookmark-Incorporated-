/**
 * PREVIEW AND DEVELOPMENT DEPLOYMENTS NEVER CONNECT TO OR MIGRATE A DATABASE.
 *
 * Vercel's database variables were scoped to Preview as well as Production, and
 * every build ran `prisma migrate deploy`: a preview of any branch could migrate
 * the production database, and a running preview read and wrote it. The
 * variables are now Production-only; these tests pin the code guard that keeps
 * it that way at build time (scripts/vercel-build-plan.mjs) and at runtime
 * (src/lib/db.ts). Production behaviour is pinned as unchanged.
 *
 * All connection strings below are fakes on the reserved `.invalid` domain.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATABASE_VARIABLES, MIGRATION_URL_SOURCES, RUNTIME_URL_SOURCES, planVercelBuild } from '../scripts/vercel-build-plan.mjs';
import {
  NON_PRODUCTION_DATABASE_URL,
  RUNTIME_URL_SOURCES as DB_RUNTIME_URL_SOURCES,
  isNonProductionDeployment,
  resolveDatabaseUrl,
  resolveDatabaseUrlSource,
} from '@/lib/db';

const ROOT = path.resolve(__dirname, '..');
const fake = (name: string) => `postgresql://user:pass@${name.toLowerCase()}.fake.invalid:5432/db`;
/** Every database variable the guard knows about, each set to a distinct fake. */
const ALL_DB_VARS = Object.fromEntries(DATABASE_VARIABLES.map((n) => [n, fake(n)]));
/** The three variables Vercel's inspection found scoped to Preview as well. */
/**
 * A production configuration: every variable names the SAME database (the
 * build refuses one whose migration and runtime databases differ), each with
 * its own credentials so a test can tell which variable was chosen.
 */
const prod = (name: string, pooled = true) =>
  `postgresql://${name.toLowerCase()}:pass@ep-app-1${pooled ? '-pooler' : ''}.fake.invalid:5432/db`;
const SHARED = { DATABASE_URL: prod('DATABASE_URL'), DATABASE_URL_UNPOOLED: prod('DATABASE_URL_UNPOOLED', false), POSTGRES_PRISMA_URL: prod('POSTGRES_PRISMA_URL') };

describe('build plan — production is unchanged', () => {
  it('generates, migrates over the unpooled URL, then builds', () => {
    const plan = planVercelBuild({ VERCEL_ENV: 'production', ...SHARED });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.migrate).toBe(true);
    expect(plan.steps.map((s) => s.cmd)).toEqual(['prisma generate', 'prisma migrate deploy', 'next build']);
    expect(plan.steps[1].env).toEqual({ DATABASE_URL: SHARED.DATABASE_URL_UNPOOLED });
    expect(plan.notes[0]).toMatch(/^Using DATABASE_URL_UNPOOLED for migrations \(unpooled\) and POSTGRES_PRISMA_URL for runtime\.$/);
  });

  it('keeps the same precedence: RESCUE_DIRECT_URL first for migrations', () => {
    const plan = planVercelBuild({ VERCEL_ENV: 'production', ...SHARED, RESCUE_DIRECT_URL: prod('RESCUE_DIRECT_URL', false), RESCUE_DATABASE_URL: prod('RESCUE_DATABASE_URL') });
    expect(plan.ok && plan.steps[1].env).toEqual({ DATABASE_URL: prod('RESCUE_DIRECT_URL', false) });
  });

  it('refuses when migrations and the runtime would use different databases, naming the variables only', () => {
    // RESCUE_DATABASE_URL wins for runtime; without RESCUE_DIRECT_URL, migrations
    // would run on the integration's DATABASE_URL_UNPOOLED: another database.
    const other = 'postgresql://integration:secret-value@ep-integration-9.fake.invalid:5432/db';
    const plan = planVercelBuild({ VERCEL_ENV: 'production', ...SHARED, DATABASE_URL_UNPOOLED: other, RESCUE_DATABASE_URL: prod('RESCUE_DATABASE_URL') });
    expect(plan).toMatchObject({ ok: false, error: expect.stringMatching(/^FATAL: migrations would run on DATABASE_URL_UNPOOLED but the app reads RESCUE_DATABASE_URL/) });
    expect(!plan.ok && plan.error).not.toContain('secret-value');
    // Different database name on the same host is refused too.
    expect(planVercelBuild({ VERCEL_ENV: 'production', DATABASE_URL_UNPOOLED: prod('U', false), POSTGRES_PRISMA_URL: prod('P').replace('/db', '/other') }).ok).toBe(false);
  });

  it('warns when only a pooled URL is available, and still migrates', () => {
    const plan = planVercelBuild({ VERCEL_ENV: 'production', DATABASE_URL: fake('DATABASE_URL') });
    expect(plan.ok && plan.migrate).toBe(true);
    expect(plan.ok && plan.notes[0]).toMatch(/^WARNING: migrations will run over DATABASE_URL/);
  });

  it('still refuses a production build with no database URL, or an Accelerate URL', () => {
    expect(planVercelBuild({ VERCEL_ENV: 'production' })).toMatchObject({ ok: false, error: expect.stringMatching(/^FATAL: no database URL found/) });
    expect(planVercelBuild({ VERCEL_ENV: 'production', DATABASE_URL: 'prisma+postgres://x' })).toMatchObject({ ok: false, error: expect.stringMatching(/prisma\+postgres/) });
  });

  it('mirrors the runtime variable order in src/lib/db.ts', () => {
    expect(RUNTIME_URL_SOURCES).toEqual([...DB_RUNTIME_URL_SOURCES]);
    for (const n of [...MIGRATION_URL_SOURCES, ...RUNTIME_URL_SOURCES]) expect(DATABASE_VARIABLES).toContain(n);
  });
});

describe('build plan — preview and development never touch a database', () => {
  for (const target of ['preview', 'development']) {
    it(`${target}: with no database variables, generates and builds only`, () => {
      const plan = planVercelBuild({ VERCEL_ENV: target, VERCEL: '1' });
      expect(plan).toMatchObject({ ok: true, migrate: false });
      expect(plan.ok && plan.steps.map((s) => s.cmd)).toEqual(['prisma generate', 'next build']);
      expect(JSON.stringify(plan)).not.toMatch(/migrate deploy/);
    });

    it(`${target}: refuses the build when any database variable is visible, naming it`, () => {
      for (const name of DATABASE_VARIABLES) {
        const plan = planVercelBuild({ VERCEL_ENV: target, [name]: fake(name) });
        expect(plan.ok, name).toBe(false);
        expect(!plan.ok && plan.error, name).toMatch(new RegExp(`^FATAL: this ${target} build can see database variable\\(s\\) ${name}\\.`));
        // The refusal names the variable, never its value.
        expect(!plan.ok && plan.error, name).not.toContain(fake(name));
      }
    });
  }

  it('refuses a build whose target is unknown', () => {
    for (const env of [{}, { VERCEL: '1' }, { VERCEL: '1', ...SHARED }]) {
      expect(planVercelBuild(env)).toMatchObject({ ok: false, error: expect.stringMatching(/^FATAL: VERCEL_ENV is not set/) });
    }
  });
});

describe('the real build script executes only the plan', () => {
  // Stand-ins for `prisma` and `next` that record their arguments and whether
  // DATABASE_URL was set, then succeed. Nothing real is built or contacted.
  function runBuild(env: Record<string, string>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vercel-build-'));
    const logFile = path.join(dir, 'calls.log');
    for (const bin of ['prisma', 'next']) {
      fs.writeFileSync(path.join(dir, bin), `#!/bin/sh\necho "${bin} $* DATABASE_URL=\${DATABASE_URL:-<unset>}" >> "${logFile}"\n`, { mode: 0o755 });
    }
    const result = spawnSync(process.execPath, ['scripts/vercel-build.mjs'], {
      cwd: ROOT,
      // A minimal environment, so nothing from this machine leaks into the build.
      env: { PATH: `${dir}:${process.env.PATH}`, HOME: dir, ...env } as unknown as NodeJS.ProcessEnv,
      encoding: 'utf8',
    });
    const calls = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n') : [];
    fs.rmSync(dir, { recursive: true, force: true });
    return { status: result.status, calls, stderr: result.stderr };
  }

  it('production: generate, migrate deploy with the unpooled URL, build — as before', () => {
    const r = runBuild({ VERCEL: '1', VERCEL_ENV: 'production', ...SHARED });
    expect(r.status).toBe(0);
    expect(r.calls).toEqual([
      `prisma generate DATABASE_URL=${SHARED.DATABASE_URL}`,
      `prisma migrate deploy DATABASE_URL=${SHARED.DATABASE_URL_UNPOOLED}`,
      `next build DATABASE_URL=${SHARED.DATABASE_URL}`,
    ]);
  });

  it('preview with no database variables: generate and build, never migrate', () => {
    const r = runBuild({ VERCEL: '1', VERCEL_ENV: 'preview' });
    expect(r.status).toBe(0);
    expect(r.calls).toEqual(['prisma generate DATABASE_URL=<unset>', 'next build DATABASE_URL=<unset>']);
  });

  it('preview that can see a production variable: exits non-zero before running anything', () => {
    const r = runBuild({ VERCEL: '1', VERCEL_ENV: 'preview', ...ALL_DB_VARS });
    expect(r.status).toBe(1);
    expect(r.calls).toEqual([]);
    expect(r.stderr).toMatch(/FATAL: this preview build can see database variable/);
    for (const value of Object.values(ALL_DB_VARS)) expect(r.stderr).not.toContain(value);
  });

  it('unknown target: exits non-zero before running anything', () => {
    const r = runBuild({ VERCEL: '1', ...SHARED });
    expect(r.status).toBe(1);
    expect(r.calls).toEqual([]);
  });

  it('runs migrations nowhere except through the plan', () => {
    const script = fs.readFileSync(path.join(ROOT, 'scripts/vercel-build.mjs'), 'utf8');
    expect(script).not.toMatch(/migrate deploy'|migrate deploy"/);
    expect(script).toMatch(/planVercelBuild\(process\.env\)/);
  });
});

describe('runtime — a non-production deployment never resolves a configured database', () => {
  it('preview and development get the unreachable address, whatever is configured', () => {
    for (const target of ['preview', 'development']) {
      const env = { VERCEL: '1', VERCEL_ENV: target, ...ALL_DB_VARS };
      expect(isNonProductionDeployment(env)).toBe(true);
      expect(resolveDatabaseUrl(env)).toBe(NON_PRODUCTION_DATABASE_URL);
      expect(resolveDatabaseUrlSource(env)).toBe('DISABLED — non-production deployment');
    }
  });

  it('on Vercel with no target, fails closed too', () => {
    expect(resolveDatabaseUrl({ VERCEL: '1', ...SHARED })).toBe(NON_PRODUCTION_DATABASE_URL);
  });

  it('the address is defined, so Prisma cannot fall back to env("DATABASE_URL"), and can never resolve', () => {
    expect(NON_PRODUCTION_DATABASE_URL).toBeTruthy();
    expect(new URL(NON_PRODUCTION_DATABASE_URL).hostname).toMatch(/\.invalid$/);
    const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8');
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
    const db = fs.readFileSync(path.join(ROOT, 'src/lib/db.ts'), 'utf8');
    expect(db).toMatch(/datasourceUrl: resolveDatabaseUrl\(\)/);
  });

  it('production, local development, Docker and CI resolve exactly as before', () => {
    expect(resolveDatabaseUrl({ VERCEL: '1', VERCEL_ENV: 'production', ...SHARED })).toBe(SHARED.POSTGRES_PRISMA_URL);
    expect(resolveDatabaseUrl({ VERCEL_ENV: 'production', RESCUE_DATABASE_URL: 'postgres://r', ...SHARED })).toBe('postgres://r');
    expect(resolveDatabaseUrl({ DATABASE_URL: 'postgres://local' })).toBe('postgres://local');
    expect(resolveDatabaseUrlSource({ DATABASE_URL: 'postgres://local' })).toBe('DATABASE_URL');
    expect(resolveDatabaseUrl({})).toBeUndefined();
    expect(isNonProductionDeployment({ DATABASE_URL: 'postgres://local' })).toBe(false);
  });
});
