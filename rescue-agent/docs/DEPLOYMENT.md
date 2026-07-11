# Production Deployment Guide — Restaurant Rescue Agent

## Recommended path (in order)

**Recommended: a single Docker container on a persistent-server host (Railway, Render, Fly.io, or any VPS), with a managed PostgreSQL database (the host's own Postgres offering, or Neon/Supabase).**

Why this shape and not serverless:

1. **Audit jobs run for minutes.** The pipeline continues after the HTTP response (page fetches with 15s timeouts × up to 10 pages, plus link probes). Worst case is 3–4 minutes per audit. Serverless function lifetimes can kill audits mid-run; a persistent Node process cannot be interrupted that way.
2. **Outbound egress.** The collector needs unrestricted outbound HTTPS to arbitrary restaurant websites. Persistent hosts allow this by default.
3. **In-memory rate limiting** assumes a single instance. One container is the intended topology for the MVP.

Vercel is workable (Next-native, `after()` is supported) but requires configuring `maxDuration` generously and accepting platform time limits on background work — use it only if you already live on Vercel.

## Exact steps (any Docker host)

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
| `DATABASE_URL` | yes | PostgreSQL connection string (Prisma) |
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
