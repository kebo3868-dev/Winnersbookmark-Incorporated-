# Production Deployment Guide — Restaurant Rescue Agent

## Chosen path: Vercel + Prisma Postgres (Vercel integration)

The app is adapted for this target:

- `vercel-build` script applies Prisma migrations (`prisma migrate deploy`) during every deploy, then builds.
- The audit API route sets `maxDuration = 300` so the background pipeline (which continues via `after()` once the response is sent) can finish; worst case is ~3–4 minutes. **Fluid Compute must be enabled** (it is the default for new Vercel projects) — without it, Hobby caps functions at 60s and long audits will be cut off.
- Audits interrupted anyway (platform limits, redeploys) are detected by a stale-job sweep and marked FAILED with an honest explanation — they never hang in RUNNING.
- The database URL is accepted from `DATABASE_URL`, `POSTGRES_URL`, or `PRISMA_DATABASE_URL` (integrations differ in naming). It must be the **direct** `postgres://` connection string — the build fails fast with instructions if it receives a `prisma+postgres://` (Accelerate) URL, because migrations and the standard client need the direct one.

### Exact steps

1. **Import the repo into Vercel** (Add New → Project → import `kebo3868-dev/Winnersbookmark-Incorporated-`).
2. **Set Root Directory to `rescue-agent`** in the project configuration screen (Framework: Next.js is auto-detected; leave build command as default — Vercel picks up the `vercel-build` script automatically).
3. **Add Prisma Postgres**: project → Storage → Create Database → Prisma Postgres, and connect it to the project. Then check the injected env vars: if the integration set only a `prisma+postgres://` URL, open the Prisma Postgres dashboard, copy the **direct connection string** (`postgres://…db.prisma.io…sslmode=require`) and set it as `DATABASE_URL` for Production (and Preview if wanted).
4. **Set the auth env vars** (Settings → Environment Variables, Production): `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` — the app refuses all requests (503) until these exist. Optionally `AI_PROVIDER=anthropic`, `AI_MODEL`, `ANTHROPIC_API_KEY`.
5. **Verify Fluid Compute is on** (Settings → Functions) and deploy.
6. Post-deploy: open `/api/health` (should return `{"status":"ok","database":"up"}` without auth), sign in with the basic-auth credentials, run the Demo audit, then a real audit.

### Vercel-specific caveats

- Background audit work lives inside the request function's lifetime (`after()` + `maxDuration: 300`). A pathologically slow site could still hit the ceiling; the stale sweep converts that into an honest FAILED audit.
- The in-memory rate limiter is per-function-instance on serverless — effectively advisory. Acceptable behind basic auth; move to a durable limiter if the app is ever opened up.
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
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | yes in production | App-wide HTTP Basic Auth; production fails closed without them |
| `POSTGRES_PASSWORD` | compose only | Provisions the bundled Postgres |
| `AI_PROVIDER` / `AI_MODEL` / `ANTHROPIC_API_KEY` | no | Optional AI narrative layer; deterministic fallback when unset |
| `RESCUE_AGENT_ALLOW_PRIVATE_TARGETS` | never in production | Test-only fixture hook; hard-disabled when `NODE_ENV=production` |

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
- [ ] Run one Demo audit and one real audit post-deploy

## Known limitations to plan around

- **Single instance intended**: rate limiting is in-memory; audits run inside the web process. Scale vertically before horizontally; a queue (e.g. pg-boss) is the upgrade path for multi-instance.
- **In-flight audits die on restart/redeploy**: an audit caught mid-run stays in RUNNING; re-run it. A startup sweep marking stale RUNNING audits as FAILED is a sensible follow-up.
- **Basic Auth is a single shared credential** — appropriate for an internal one-team tool; move to real user accounts before wider rollout.
