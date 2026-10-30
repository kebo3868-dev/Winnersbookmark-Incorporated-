# AgentOS architecture and implementation plan

## What it is

A private, single-owner web console that sends business tasks to four AI agents, has a
second agent check the work when the risk justifies it, keeps the evidence, and holds
every result for the founder's decision. Agents produce text only. Nothing acts on the
outside world without an approval recorded in the database.

| Agent  | Role                              | Provider        | Protocol                                   |
|--------|-----------------------------------|-----------------|--------------------------------------------|
| Roxy   | Chief Strategy                    | OpenAI          | Responses API `POST /v1/responses`         |
| Zeus   | Creative Strategy                 | Meta Muse       | Meta Model API, OpenAI-compatible Responses|
| Hermes | Research & Automation             | Hermes Agent    | Hermes API server, OpenAI-compatible Responses |
| Gemini | Intelligence & Verification       | Google Gemini   | `POST /v1beta/models/{m}:generateContent`  |

Claude Code builds and maintains AgentOS. It is not a runtime agent.

## Placement

`agentos/` is a fourth independent app in this monorepo, next to `rescue-agent/`
(Rescue Agent + Front Desk) and `website/`. It has its own `package.json`, lockfile, CI
job, Supabase project and Vercel project (Root Directory = `agentos/`). It imports
nothing from the other apps and they import nothing from it. The production Rescue
Agent and Front Desk were not modified.

The directory can be lifted into its own repository with `git subtree split -P agentos`
if separate access control is wanted later. Nothing in it depends on the monorepo.

## Request flow

```
Phone (Chrome, Android)
  │  HttpOnly SameSite=Strict session cookie
  ▼
src/proxy.ts ── no valid session → /login (pages) or 401 (API)
  ▼
Page / API route ── requireOwnerPage / requireOwnerRequest (checked again; writes also need same Origin)
  ▼
Orchestrator (src/lib/orchestrator/runTask.ts)
  1. claimTask           atomic queued|failed → running (stale running reclaimed after 10 min)
  2. primary agent       adapter.complete(), bounded retries on transient errors only
  3. independent review  a DIFFERENT agent returns {verdict, summary, findings} JSON
  4. approval            accept_result approval created; task → awaiting_approval
  ▼
Founder approves / rejects ── decision + audit + task status in one transaction
```

## Components

| Path | Responsibility |
|---|---|
| `src/lib/agents/registry.ts` | The four agents: identity, role, provider, standing instructions, default reviewer |
| `src/lib/config.ts` | All environment reading; model defaults; mock policy; spend cap |
| `src/lib/providers/responses.ts` | One Responses-protocol client serving OpenAI, Meta Muse and Hermes |
| `src/lib/providers/gemini.ts` | Gemini `generateContent` adapter |
| `src/lib/providers/http.ts` | Timeouts, error classification (retryable or not), secret redaction |
| `src/lib/providers/mock.ts` | Simulation adapter, labelled everywhere; a simulated review never passes |
| `src/lib/providers/status.ts` | Honest connection state; probes that make a real minimal call |
| `src/lib/orchestrator/` | Task execution, retries, review prompt and verdict parsing, reviewer selection |
| `src/lib/approvals/policy.ts` | The 7 action types; `ApprovedAction` capability for future side-effect code |
| `src/lib/store/` | `Store` interface; `PgStore` (Supabase) and `MemoryStore` (development/tests) |
| `src/lib/auth/` | scrypt password, HMAC sessions, owner checks, origin check |
| `supabase/migrations/` | Schema with integrity rules enforced by the database itself |

## Design decisions and trade-offs

**One protocol client for three providers.** OpenAI, Meta's Model API and the Hermes API
server all document the Responses wire format. One hardened client means one parser,
one error map and one set of tests. Risk: a vendor diverges. Mitigation: each vendor has
its own factory (`openAiAdapter`, `metaAdapter`, `hermesAdapter`) where vendor-specific
fields already live (`store: false`, the Meta contributor-model block).

**`pg` driver, not supabase-js.** All data access is server-side with the database owner
role. Row Level Security is on for every table with no policies, so the browser-facing
anon and authenticated keys can read nothing even if leaked. The trade-off is giving up
Supabase Realtime and Storage helpers for now. Both can be added later without changing
this access model.

**Synchronous execution inside the request (Phase 2).** A task runs inside
`POST /api/tasks/:id/run` (`maxDuration = 300`, internal budget 280 s). This is simple and
observable, and fine for one founder. Limits: long Hermes jobs could exceed it. A killed
executor leaves the task `running`, and the next claim reclaims it after 10 minutes.
Phase 4 moves execution to a queue with a worker (Supabase cron or Hermes `/v1/runs`).

**The database enforces the invariants, not just the code.** No self-review (CHECK), a
verdict only on review runs, append-only evidence and audit log (triggers), no deleting
tasks that have evidence (FK RESTRICT), no unattributed decisions (CHECK), and one open
approval per task and action (partial unique index).

**Honesty is structural.** `mode = 'mock'` is written on every simulated run. The UI badges
it, and the approval summary and warning state exactly which part was simulated.
"Verified" requires a successful live probe of the currently configured model within
24 hours. A key alone shows as "Configured · not verified". Production refuses
simulation unless `AGENTOS_ALLOW_MOCK=true`.

**Meta contributor models are refused in code.** Meta's `-contributor` model IDs are
discounted because Meta may train on your prompts and completions. AgentOS carries
client business data, so those IDs are blocked regardless of configuration.

**Hermes isolation.** The Hermes API server can run terminal commands. AgentOS only ever
calls it server-to-server with a bearer key. It must run on separate infrastructure,
bound to a private network or behind TLS, never on the AgentOS host, and never with
`API_SERVER_CORS_ORIGINS` open to browsers. See the deployment checklist.

## Implementation plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Environment review, architecture, independent `agentos/` app, schema, CI | **Done** |
| 2 | Dashboard, task DB, mock providers, approval interface: smallest working vertical slice | **Done** (this build) |
| 3 | Connect each real provider one at a time; probe; record evidence in `docs/TEST_RESULTS.md` | Next. Needs keys and a Hermes host |
| 4 | Queued background execution, cross-agent handoffs (task chains), cost tracking in USD, partial resume after reviewer failure | Planned |
| 5 | Full test pass with live providers, security review, deployment | Planned |

Phase 3 detail: for each provider, set its variables in Vercel → "Check connection" on the
dashboard → run one low-risk task → record the response ID and model served. Recommended
order: Gemini (reviewer for everyone else), then Roxy, Zeus, and Hermes last, because it
needs infrastructure.

Phase 4 detail:
- A `task_links` table for handoffs, where one task's approved output becomes another's input. A handoff only proceeds from an approved result.
- `provider_prices` plus per-run cost, computed from stored token counts.
- A worker that claims queued tasks, so a run outlives the HTTP request.
- Shared knowledge: `projects` and `knowledge_items` (source reference, owner, permission scope), retrieval injected into prompts with citations, all reads audited.
- Business module interfaces: Restaurant Rescue, AI Front Desk, Client Acquisition, Revenue Reporting, SOPs. Each is a read-only adapter into AgentOS, with any write to its own production system behind an `ApprovedAction`.

## Not built yet (deliberately)

Shared knowledge storage, business-module connectors, cost in currency, background
execution, and multi-step handoffs. The schema and the `ApprovedAction` type are shaped
so these can be added without loosening any existing guarantee.
