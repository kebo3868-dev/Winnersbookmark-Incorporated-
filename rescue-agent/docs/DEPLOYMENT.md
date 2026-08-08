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
- **`/api/health` is the diagnostic endpoint** (no auth needed). It reports DB reachability, which env var supplied the runtime connection, whether an unpooled migration URL exists, and whether basic auth is configured — names and states only, never secret values.

### Exact steps (Neon database already created and connected)

1. **Root Directory must be `rescue-agent`** (project → Settings → General → Root Directory). If it isn't, Vercel builds the unrelated Vite site at the repo root — this alone explains a broken first deployment.
2. **Confirm the Neon env vars** (Settings → Environment Variables): the integration should have added `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, etc. for Production and Preview. Nothing to copy manually.
3. **Set the auth env vars** (Production): `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`. **Until these exist, every route returns 503 "ACCESS NOT CONFIGURED" by design** — if the previous deploy showed that message, this is the cause and the fix. Optionally add `AI_PROVIDER=anthropic`, `AI_MODEL`, `ANTHROPIC_API_KEY`.
4. **Check Fluid Compute is on** (Settings → Functions) and **redeploy** (Deployments → ⋯ → Redeploy, or push to main).
5. Post-deploy verification, in order:
   - `https://<app>/api/health` → expect `{"status":"ok","database":"up","config":{"auth":"configured",...}}`. If `auth` says MISSING, set the vars from step 3. If `database` is down, check the Neon integration's env vars are attached to Production.
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
| `AUDIT_BUDGET_MS` | no | Collection time budget (default 45000, clamped 5000–280000). Past the deadline remaining targets are skipped and the audit completes as `PARTIALLY_COMPLETED` rather than being killed by the platform |
| `LEAD_RETENTION_DAYS` | no | Days after which lead contact details are redacted. **Unset = retention disabled and personal data is kept indefinitely** |
| `POSTGRES_PASSWORD` | compose only | Provisions the bundled Postgres |
| `AI_PROVIDER` / `AI_MODEL` / `ANTHROPIC_API_KEY` | no | Optional AI narrative layer; deterministic fallback when unset |
| `RESCUE_AGENT_ALLOW_PRIVATE_TARGETS` | never in production | Test-only fixture hook; hard-disabled when `NODE_ENV=production` |

### Database URL overrides

`RESCUE_DATABASE_URL` / `RESCUE_DIRECT_URL` take priority over `DATABASE_URL`,
`POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED` and the rest. They exist because
a managed integration (for example Neon's Vercel integration) owns the standard
names and locks them to the database it provisioned — which is the wrong one if
this app has its own database alongside another application's. Setting these two
points the app at its own database without fighting the integration, and without
disconnecting it. Leave them unset and resolution falls back to the standard
names unchanged.

Confirm which one is in effect from `/api/health` → `config.databaseSource`.

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
`/api/health` → `config.leadRetention` reports the deployed policy.

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
- [ ] TLS termination in front of the app (platform default or reverse proxy) — Basic Auth must never cross plain HTTP
- [ ] Health check wired to `/api/health`
- [ ] Outbound HTTPS egress unrestricted (collector requirement)
- [ ] Optional: `ANTHROPIC_API_KEY` set if AI narrative is wanted
- [ ] `LEAD_RETENTION_DAYS` decided and set — leads hold third-party personal data, and it is kept indefinitely while this is unset
- [ ] Confirm `/api/health` reports the expected `databaseSource` and `leadRetention`
- [ ] Demo data removed before showing the pipeline to a client (**Remove demo data** on `/leads`)
- [ ] Run one Demo audit and one real audit post-deploy

## Known limitations to plan around

- **Single instance intended**: rate limiting is in-memory; audits run inside the web process. Scale vertically before horizontally; a queue (e.g. pg-boss) is the upgrade path for multi-instance.
- **In-flight audits die on restart/redeploy**: an audit caught mid-run stays in RUNNING; re-run it. A startup sweep marking stale RUNNING audits as FAILED is a sensible follow-up.
- **Basic Auth is a single shared credential** — appropriate for an internal one-team tool; move to real user accounts before wider rollout.
