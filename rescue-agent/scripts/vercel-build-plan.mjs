/**
 * What a Vercel build is allowed to do, decided from its environment alone.
 * Pure: no I/O, no process access. scripts/vercel-build.mjs executes the plan.
 *
 * PREVIEW AND DEVELOPMENT BUILDS NEVER TOUCH A DATABASE.
 *
 * Every Vercel build used to run `prisma migrate deploy` against whichever
 * database variable it found first. With those variables scoped to Preview as
 * well as Production, a preview build of any branch could apply that branch's
 * migrations to the production database before review. The variables are now
 * Production-only; this guard makes the rule hold in code as well:
 *
 * - production: unchanged — generate, migrate, build, with the same variable
 *   precedence and the same fatal checks as before;
 * - any other target: generate and build only. No migration is run, and if any
 *   database variable is visible to the build at all the build is refused, so
 *   a variable re-scoped to Preview by mistake fails loudly instead of
 *   connecting;
 * - VERCEL_ENV missing: refused. Without it the build cannot tell production
 *   from a preview, and guessing either way is unsafe. (Vercel sets it when
 *   "Automatically expose System Environment Variables" is enabled.)
 */

// Migration URL: this app's own override first, then unpooled/direct names,
// then pooled names as fallback. RESCUE_DIRECT_URL exists because a managed
// integration (Neon's Vercel integration) owns DATABASE_URL_UNPOOLED and locks
// it to the database it provisioned; set it to the UNPOOLED/direct endpoint.
export const MIGRATION_URL_SOURCES = ['RESCUE_DIRECT_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DIRECT_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL', 'PRISMA_DATABASE_URL'];

// Runtime URL (only validated here; the client resolves it again at runtime).
// Mirrors RUNTIME_URL_SOURCES in src/lib/db.ts — keep the two in step.
export const RUNTIME_URL_SOURCES = ['RESCUE_DATABASE_URL', 'POSTGRES_PRISMA_URL', 'DATABASE_URL', 'POSTGRES_URL', 'PRISMA_DATABASE_URL'];

const UNPOOLED_SOURCES = ['RESCUE_DIRECT_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DIRECT_DATABASE_URL'];

/**
 * Every variable that can carry a database location or credential: the names
 * above, and the rest of what the Neon integration injects. A non-production
 * build that can see any of them is refused.
 */
export const DATABASE_VARIABLES = [
  ...new Set([
    ...MIGRATION_URL_SOURCES,
    ...RUNTIME_URL_SOURCES,
    'POSTGRES_URL_NO_SSL', 'POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DATABASE',
    'PGHOST', 'PGHOST_UNPOOLED', 'PGUSER', 'PGPASSWORD', 'PGDATABASE',
  ]),
];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: false, error: string } | { ok: true, target: string, migrate: boolean, steps: { cmd: string, env?: Record<string, string> }[], notes: string[] }}
 */
export function planVercelBuild(env) {
  const target = env.VERCEL_ENV;
  if (!target) {
    return {
      ok: false,
      error:
        'FATAL: VERCEL_ENV is not set, so this build cannot tell production from a preview. Enable ' +
        '"Automatically expose System Environment Variables" in the Vercel project settings. No database was contacted.',
    };
  }

  if (target !== 'production') {
    const visible = DATABASE_VARIABLES.filter((name) => env[name]);
    if (visible.length > 0) {
      return {
        ok: false,
        error:
          `FATAL: this ${target} build can see database variable(s) ${visible.join(', ')}. Database variables must be ` +
          `scoped to Production only: a ${target} build never connects to or migrates a database. Remove the ` +
          `${target} scope from these variables in Vercel. No database was contacted.`,
      };
    }
    return {
      ok: true,
      target,
      migrate: false,
      steps: [{ cmd: 'prisma generate' }, { cmd: 'next build' }],
      notes: [`${target} build: no database variables visible; migrations skipped. This deployment runs without a database.`],
    };
  }

  // Production: behaviour unchanged.
  const migrationSource = MIGRATION_URL_SOURCES.find((name) => env[name]);
  const migrationUrl = migrationSource ? env[migrationSource] : undefined;
  const runtimeSource = RUNTIME_URL_SOURCES.find((name) => env[name]);
  const runtimeUrl = runtimeSource ? env[runtimeSource] : undefined;

  if (!migrationUrl || !runtimeUrl) {
    return {
      ok: false,
      error:
        'FATAL: no database URL found. Connect the Neon (or another Postgres) integration to this Vercel project, ' +
        'or set DATABASE_URL in the project environment. Expected one of: ' +
        MIGRATION_URL_SOURCES.join(', ') + '.',
    };
  }
  for (const [label, url] of [['migration', migrationUrl], ['runtime', runtimeUrl]]) {
    if (url.startsWith('prisma+postgres://')) {
      return {
        ok: false,
        error:
          `FATAL: the ${label} database URL is a prisma+postgres:// (Accelerate) URL. This app uses the standard Prisma ` +
          'client and migrations, which need a direct postgres:// connection string. With the Neon integration this is ' +
          'injected automatically; otherwise copy the direct URL from your database dashboard into DATABASE_URL.',
      };
    }
  }
  // Migrations must reach the database the app reads. They are chosen from
  // different variable lists (an override such as RESCUE_DATABASE_URL can win
  // for runtime while DATABASE_URL_UNPOOLED wins for migrations), and a
  // mismatch used to deploy silently: the runtime database then lacks the
  // latest tables, and since operator sign-in fails closed without its counter
  // table, the operator would be locked out (independent review of PR #80).
  if (!sameDatabase(migrationUrl, runtimeUrl)) {
    return {
      ok: false,
      error:
        `FATAL: migrations would run on ${migrationSource} but the app reads ${runtimeSource}, and they name different ` +
        'databases. Point both at the same database (with RESCUE_DATABASE_URL set, also set RESCUE_DIRECT_URL to its ' +
        'unpooled endpoint). No database was contacted.',
    };
  }
  const notes = UNPOOLED_SOURCES.includes(migrationSource)
    ? [`Using ${migrationSource} for migrations (unpooled) and ${runtimeSource} for runtime.`]
    : [
        `WARNING: migrations will run over ${migrationSource}, which may be a pooled (PgBouncer) endpoint. ` +
          'If `prisma migrate deploy` fails or hangs, expose the unpooled URL as DATABASE_URL_UNPOOLED.',
      ];
  return {
    ok: true,
    target,
    migrate: true,
    steps: [{ cmd: 'prisma generate' }, { cmd: 'prisma migrate deploy', env: { DATABASE_URL: migrationUrl } }, { cmd: 'next build' }],
    notes,
  };
}

/**
 * Whether two connection strings name the same database: same host (a Neon
 * pooled endpoint `ep-…-pooler.` equals its direct `ep-….`), same port and same
 * database name. Credentials and query parameters are ignored. A URL that
 * cannot be parsed is treated as different.
 */
export function sameDatabase(a, b) {
  const key = (raw) => {
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase().replace(/^([^.]+)-pooler\./, '$1.');
      return `${host}:${u.port || '5432'}/${decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres'}`;
    } catch {
      return null;
    }
  };
  const ka = key(a);
  return ka !== null && ka === key(b);
}
