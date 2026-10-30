# Deployment checklist

Do not mark a step done without the evidence it asks for.

## Supabase
- [ ] Create a **separate** Supabase project for AgentOS (not the Rescue Agent database).
- [ ] Apply the schema: `DATABASE_URL=<direct or session-pooler URL> npm run db:migrate`. Expected output: `apply 20261030000000_agentos_core.sql`.
- [ ] In the SQL editor, confirm RLS is on for all six tables: `select relname, relrowsecurity from pg_class where relname in ('tasks','task_runs','approvals','agent_probes','audit_log','rate_limits');` — all `t`.
- [ ] Confirm the anon key reads nothing: `curl "$SUPABASE_URL/rest/v1/tasks" -H "apikey: $ANON_KEY"` returns an error or `[]`, never rows.
- [ ] Download the CA certificate into `DATABASE_CA_CERT`. Enable point-in-time recovery or daily backups.

## Vercel
- [ ] New project from this repository, **Root Directory = `agentos`**, framework Next.js. The Rescue Agent and website projects are untouched.
- [ ] Set every required variable in `docs/ENVIRONMENT.md` for Production. Use the pooled `DATABASE_URL` (port 6543).
- [ ] `AGENTOS_ALLOW_MOCK=false` once at least the agents you use are connected.
- [ ] Confirm the plan allows a 300-second function duration (`/api/tasks/[id]/run`). On a plan with a lower limit, long tasks fail and are reclaimed after 10 minutes.
- [ ] Deploy. Then `curl https://<host>/api/health` → `{"status":"ok"}`, and `curl -I https://<host>/` → `307` to `/login`.
- [ ] Without signing in, `curl -X POST https://<host>/api/tasks` → `401`.
- [ ] Sign in on the Android phone. Check the session cookie is `Secure; HttpOnly; SameSite=Strict`.

## Providers (Phase 3), one at a time
For each: set its variables → redeploy → **Check connection** → state reads "Connected · verified" → run one low-risk task → record the response ID and model served in `docs/TEST_RESULTS.md`.
- [ ] Gemini
- [ ] Roxy (OpenAI)
- [ ] Zeus (Meta Muse). Check Muse Spark access for your account and region. Never a `-contributor` model.
- [ ] Hermes, on its own host:
  - [ ] `API_SERVER_ENABLED=true`, a strong `API_SERVER_KEY` (≥ 32 random characters), CORS **not** set.
  - [ ] Reachable from Vercel only via a TLS reverse proxy with an allowlist, or a private tunnel. Never a bare public port.
  - [ ] Runs as an unprivileged user with a scoped workspace. It can execute terminal commands.
  - [ ] Set provider spending limits in each vendor's console (OpenAI, Meta, Google) as a second cap behind `AGENTOS_MAX_RUNS_PER_HOUR`.

## Security sign-off
- [ ] `npm audit` reports 0 vulnerabilities in `agentos/`.
- [ ] CI is green (`AgentOS — typecheck, tests, build` including the Postgres job).
- [ ] Rotate any secret that has ever been pasted into a chat, ticket or log.
- [ ] Planned hardening (not yet done): nonce-based `script-src` CSP; MFA (passkey) for the owner; a separate audit-reader role.
