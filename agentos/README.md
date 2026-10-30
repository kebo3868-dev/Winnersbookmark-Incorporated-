# Winnersbookmark AgentOS

A private, founder-controlled console that coordinates four AI agents: **Roxy** (OpenAI,
strategy), **Zeus** (Meta Muse, creative strategy), **Hermes** (Hermes Agent, research and
automation) and **Gemini** (Google, verification). It assigns tasks, has a second agent
check the work independently, keeps the evidence, and holds every result for the founder's
approval. Mobile-first, built for an Android phone.

Status: **Phase 1 and the Phase 2 vertical slice are complete and tested. No real provider
is connected yet (Phase 3).** Until a provider is connected, its agent is shown as
"Not connected", and any work it does is labelled SIMULATED.

- Architecture and phase plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Environment variables: [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)
- Test results and evidence: [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md)
- Deployment checklist: [`docs/DEPLOYMENT_CHECKLIST.md`](docs/DEPLOYMENT_CHECKLIST.md)

## Local setup

Requires Node 20.9+ (CI uses 22).

```bash
cd agentos
npm install
cp .env.example .env.local
printf '%s' 'choose-a-long-password' | npm run --silent hash-password   # → AGENTOS_OWNER_PASSWORD_HASH
openssl rand -hex 32                                                     # → AGENTOS_SESSION_SECRET
npm run dev                                                              # http://localhost:3000
```

With `DATABASE_URL` empty, data is kept in memory and lost on restart (a banner says so).
To use Postgres:

```bash
DATABASE_URL=postgresql://... npm run db:migrate
```

`db:migrate` applies `supabase/migrations/*.sql` once each. If you use the Supabase CLI
instead (`supabase db push`), use only one of the two methods per database.

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript, strict |
| `npm test` | Unit and integration suite (hermetic; the Postgres tests run when `AGENTOS_TEST_DATABASE_URL` points at a disposable database) |
| `npm run build` | Production build |
| `npm run test:e2e` | Android-viewport acceptance test against the production build. Needs `AGENTOS_E2E_DATABASE_URL` (disposable) and a prior `npm run build` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run hash-password` | Produce the owner password hash from stdin |

## Using it

1. **Dashboard** shows each agent's role, connection state, model, assigned and open tasks, last result and last error. "Check connection" makes one minimal real call and records the outcome.
2. **New task** (Mission Control): title, objective, agent, risk. Medium and high risk add an independent reviewer automatically (high always does).
3. **Run** executes the primary agent, then the reviewer. Every attempt is stored with provider, model served, response ID, tokens and latency.
4. **Approve or reject** on the task page or under Approvals. The decision, who made it and when go to the append-only audit log.
