# Production Deployment Guide — Restaurant Rescue Agent

## Chosen path: Vercel + Neon Postgres (Vercel integration)

The app is adapted for this target:

- **Two connection strings, used correctly.** Neon's integration injects a
  pooled (PgBouncer) URL and an unpooled (direct) URL. The runtime client
  prefers `POSTGRES_PRISMA_URL` (Neon's Prisma-specific pooled URL with
  `pgbouncer=true`), falling back to `DATABASE_URL` / `POSTGRES_URL`.
  Migrations (`prisma migrate deploy`, run by `vercel-build` on every deploy)
  use the **unpooled** URL (`DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING`)
  because DDL through PgBouncer transaction mode is unreliable. The build
  warns if it has to fall back to a pooled URL and fails fast with
  instructions on `prisma+postgres://` (Accelerate) URLs.
- The audit API route sets `maxDuration = 300` so the background pipeline (which continues via `after()` once the response is sent) can finish; worst case is ~3–4 minutes. **Fluid Compute must be enabled** (default for new Vercel projects) — without it, Hobby caps functions at 60s and long audits are cut off.
- Audits interrupted anyway (platform limits, redeploys) are detected by a stale-job sweep and marked FAILED with an honest explanation — they never hang in RUNNING.
- **`/api/health` is public liveness only** (`status`, `database`); it never reads a credential. **`/api/diagnostics` is the diagnostic endpoint** (operator credential required, behind the sign-in limit). It reports DB reachability, which env var supplied the runtime connection, whether an unpooled migration URL exists, and whether basic auth is configured — names and states only, never secret values.

### Exact steps (Neon database already created and connected)

1. **Root Directory must be `rescue-agent`** (project → Settings → General → Root Directory). If it isn't, Vercel builds the unrelated Vite site at the repo root — this alone explains a broken first deployment.
2. **Confirm the Neon env vars** (Settings → Environment Variables): the integration should have added `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, etc. for Production and Preview. Nothing to copy manually.
3. **Set the auth env vars** (Production): `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`. **Until these exist, every route returns 503 "ACCESS NOT CONFIGURED" by design** — if the previous deploy showed that message, this is the cause and the fix. Optionally add `AI_PROVIDER=anthropic`, `AI_MODEL`, `ANTHROPIC_API_KEY`.
4. **Check Fluid Compute is on** (Settings → Functions) and **redeploy** (Deployments → ⋯ → Redeploy, or push to main).
5. Post-deploy verification, in order:
   - `https://<app>/api/health` → expect `{"status":"ok","database":"up"}`; then, signed in as the operator, `https://<app>/api/diagnostics` → expect `"config":{"auth":"configured",...}`. Until the auth vars exist every route but `/api/health` returns 503: set the vars from step 3. If `database` is down, check the Neon integration's env vars are attached to Production.
   - Open the app → browser prompts for the basic-auth credentials → Command Center loads.
   - Run the Demo audit, then a real restaurant audit.

### Distinguish the three "auth walls"

| Symptom | Layer | Fix |
| --- | --- | --- |
| 503 "ACCESS NOT CONFIGURED" | This app (fail-closed) | Set `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` |
| Browser username/password prompt | This app (working as intended) | Sign in with those credentials |
| Vercel-branded login page | Vercel Deployment Protection | Project → Settings → Deployment Protection (separate from app auth; default-on for previews) |

### Vercel-specific caveats

- Background audit work lives inside the request function's lifetime (`after()` + `maxDuration: 300`). A pathologically slow site could still hit the ceiling; the stale sweep converts that into an honest FAILED audit.
- The in-memory rate limiter is per-function-instance on serverless — effectively advisory. Acceptable behind basic auth; move to a durable limiter if the app is ever opened up.
- Neon free-tier databases can cold-start after idling; the first request may be slow or briefly report `database: down` on `/api/health`.
- If you later prefer a persistent server, the Docker path below remains fully supported.

## Alternative: any Docker host (Railway, Render, Fly.io, VPS)

A persistent server avoids serverless time limits entirely (audits run in an
uninterruptible Node process). Use this path if audit truncation ever becomes
a problem on Vercel.

1. Provision a PostgreSQL 16 database; note its connection string.
2. Build and deploy the container from `rescue-agent/` (the provided `Dockerfile`). The entrypoint runs `prisma migrate deploy` automatically on every start, then boots the server on `$PORT`.
3. Set environment variables (see table). The app **refuses requests (503) in production until `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` are set** — it serves confidential sales intelligence and fails closed by design.
4. Point the platform health check at `GET /api/health` (exempt from auth; verifies DB connectivity).
5. Open the app, sign in with the basic-auth credentials, run the Demo audit, then a real audit.

### Self-hosted / staging shortcut

```bash
cd rescue-agent
cp .env.example .env   # fill POSTGRES_PASSWORD, BASIC_AUTH_USER, BASIC_AUTH_PASSWORD
docker compose up -d --build
```

This brings up the app plus a persistent PostgreSQL with migrations applied.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Direct PostgreSQL connection string (`POSTGRES_URL` / `PRISMA_DATABASE_URL` accepted as fallbacks) |
| `RESCUE_DATABASE_URL` | see below | **Overrides every other runtime URL.** Pooled endpoint. Use when a managed integration locks `DATABASE_URL` to the wrong database |
| `RESCUE_DIRECT_URL` | see below | **Overrides every other migration URL.** Unpooled/direct endpoint — DDL through PgBouncer is unreliable |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | yes in production | App-wide HTTP Basic Auth; production fails closed without them |
| `OPERATOR_DEVICE_SECRET` | recommended | 32+ random characters. Signs the trusted-device cookie that keeps the operator's own browser signed in through a global sign-in lockdown. Unset = no cookie, and a lockdown applies to everyone |
| `OPERATOR_TRUSTED_SOURCE_HEADER` | self-hosted only | Header your reverse proxy overwrites with the client IP (e.g. `x-real-ip`). On Vercel, `x-real-ip` is used automatically. Unset off Vercel = only the global sign-in limit applies |
| `AUDIT_BUDGET_MS` | no | Collection time budget (default 45000, clamped 5000–280000). Past the deadline remaining targets are skipped and the audit completes as `PARTIALLY_COMPLETED` rather than being killed by the platform |
| `LEAD_RETENTION_DAYS` | no | Days after which lead contact details are redacted. **Unset = retention disabled and personal data is kept indefinitely** |
| `POSTGRES_PASSWORD` | compose only | Provisions the bundled Postgres |
| `AI_PROVIDER` / `AI_MODEL` / `ANTHROPIC_API_KEY` | no | Optional AI narrative layer; deterministic fallback when unset |
| `RESCUE_AGENT_ALLOW_PRIVATE_TARGETS` | never in production | Test-only fixture hook; hard-disabled when `NODE_ENV=production` |

### Operator sign-in limit (issue #73)

Every wrong operator password is counted in the `OperatorLoginThrottle` table,
shared by every instance (`src/lib/operatorThrottle.ts`):

| Counter | Limit | Lock |
| --- | --- | --- |
| Per client address | 10 wrong passwords in 15 minutes | that address, 15 minutes |
| All addresses together | 100 wrong passwords in 15 minutes | every browser without a trusted-device cookie, 15 minutes |

- While locked, the right password is refused too (HTTP 429 with `Retry-After`),
  so a lock cannot reveal a correct guess.
- Requests without credentials, and requests with the right password, never
  count. A correct sign-in clears its address's count.
- A browser that has signed in successfully keeps working through a global
  lockdown when `OPERATOR_DEVICE_SECRET` is set. Rotating
  `BASIC_AUTH_PASSWORD` revokes every trusted device.
- Preview deployments have no database, so they count per instance in memory.
- **Production fails closed.** If the database or the `OperatorLoginThrottle`
  table is unavailable, every request presenting credentials — right or wrong
  — gets HTTP 503 "Sign-in is temporarily unavailable" until it is back. The
  limit is never silently weakened to a per-instance count. This also means
  the migration must be applied before this code serves traffic: the
  production build does that automatically (`prisma migrate deploy` runs
  before `next build`), and it **refuses to run** when the migration and runtime
  variables name different databases (e.g. `RESCUE_DATABASE_URL` set without a
  matching `RESCUE_DIRECT_URL`), so the table can never land in the wrong one.
- Every exempt route (Front Desk sessions, sign-out, webhooks) that receives a
  Basic credential checks it through the same counted limit.

**Locked out?** Wait 15 minutes, or clear the lock (this changes production
data — authorised operators only):

```bash
node scripts/operator-unlock.mjs --status
node scripts/operator-unlock.mjs --source 203.0.113.7   # one address
node scripts/operator-unlock.mjs --global               # a global lockdown
```

### Preview deployments have no database

Database variables are scoped to **Production only** in Vercel, and the code
enforces the same rule:

- **Build** (`scripts/vercel-build-plan.mjs`): only a production build runs
  `prisma migrate deploy`. A preview or development build runs `prisma generate`
  and `next build` only, and is **refused** if it can see any database
  variable. A build without `VERCEL_ENV` is refused too, so keep
  "Automatically expose System Environment Variables" enabled.
- **Runtime** (`src/lib/db.ts`): a preview or development deployment connects to
  an unreachable `.invalid` address whatever is configured. Its database-backed
  pages fail, `/api/health` reports the database down, and `/api/diagnostics`
  reports the source "DISABLED — non-production deployment".

Production, local development, Docker and CI are unchanged.

### Database URL overrides

`RESCUE_DATABASE_URL` / `RESCUE_DIRECT_URL` take priority over `DATABASE_URL`,
`POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED` and the rest. They exist because
a managed integration (for example Neon's Vercel integration) owns the standard
names and locks them to the database it provisioned — which is the wrong one if
this app has its own database alongside another application's. Setting these two
points the app at its own database without fighting the integration, and without
disconnecting it. Leave them unset and resolution falls back to the standard
names unchanged.

Confirm which one is in effect from `/api/diagnostics` → `config.databaseSource`.

### Personal data retention

A captured lead stores a name, email and phone belonging to someone who is not
your customer. Two controls:

- **Erasure on request** — `DELETE /api/leads/[id]`, surfaced as the **Erase**
  action on each row of `/leads`. A hard delete of the personal record; the
  audit itself is untouched.
- **Automatic expiry** — set `LEAD_RETENTION_DAYS`. Leads older than the window
  have `contactName`, `email` and `phone` set to null while the row is kept, so
  pipeline history and conversion counts survive but the data identifying a
  person does not. The sweep runs lazily when `/leads` is read (serverless has
  no daemon) and is idempotent.

Retention is **off unless configured** — deleting personal data on a default the
operator never chose would be the wrong trade-off. Decide a window and set it.
`/api/diagnostics` → `config.leadRetention` reports the deployed policy.

## Build / run reference

| Step | Command |
| --- | --- |
| Install (runs `prisma generate`) | `npm ci` |
| Tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Production build | `npm run build` (standalone output) |
| Apply migrations (production) | `npm run db:deploy` (`prisma migrate deploy`) |
| Start | `npm start` (bare metal) / `node server.js` (standalone, used by Docker) |

Node >= 20.9 (pinned in `package.json` engines; image uses Node 22).

## Pre-launch checklist

- [ ] `DATABASE_URL` points at a managed PostgreSQL with backups enabled
- [ ] `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` set to strong values (503 until they are)
- [ ] `OPERATOR_DEVICE_SECRET` set (32+ random characters) so the operator keeps working through a global sign-in lockdown
- [ ] TLS termination in front of the app (platform default or reverse proxy) — Basic Auth must never cross plain HTTP
- [ ] Health check wired to `/api/health`
- [ ] Outbound HTTPS egress unrestricted (collector requirement)
- [ ] Optional: `ANTHROPIC_API_KEY` set if AI narrative is wanted
- [ ] `LEAD_RETENTION_DAYS` decided and set — leads hold third-party personal data, and it is kept indefinitely while this is unset
- [ ] Confirm `/api/diagnostics` (as the operator) reports the expected `databaseSource` and `leadRetention`
- [ ] Demo data removed before showing the pipeline to a client (**Remove demo data** on `/leads`)
- [ ] Run one Demo audit and one real audit post-deploy

## Known limitations to plan around

- **Single instance intended**: rate limiting is in-memory; audits run inside the web process. Scale vertically before horizontally; a queue (e.g. pg-boss) is the upgrade path for multi-instance.
- **In-flight audits die on restart/redeploy**: an audit caught mid-run stays in RUNNING; re-run it. A startup sweep marking stale RUNNING audits as FAILED is a sensible follow-up.
- **Basic Auth is a single shared credential** — appropriate for an internal one-team tool; move to real user accounts before wider rollout.
