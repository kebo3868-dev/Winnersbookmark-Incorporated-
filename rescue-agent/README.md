# Winners Bookmark Restaurant Rescue Agent

Restaurant revenue intelligence and AI opportunity detection engine for
**Winners Bookmark Incorporated** (Founder: Keith Warren).

The agent audits a restaurant's public digital footprint, converts what it finds
into a traceable evidence chain, detects and ranks revenue leaks, and generates
two strictly separated deliverables:

1. **Owner-facing Restaurant Rescue Audit** — evidence-backed, honest about limits
2. **Internal WBI Sales Brief** — confidential lead scoring, discovery questions, talk track

## Core principle

**Find the revenue leak — with evidence.** Every finding is traced to stored
evidence records. Absence of a signal is reported as "not detected on analyzed
pages," never as proof. Findings below 60 confidence are flagged
`MANUAL VALIDATION REQUIRED`. Zero opportunities is a legitimate audit outcome.
Failed collection is reported as failure — never papered over with fabricated results.

## Quick start

```bash
cd rescue-agent
npm install
# Start PostgreSQL and set DATABASE_URL in .env (see .env.example)
npx prisma migrate dev
npm run dev        # http://localhost:3000
```

Try it immediately with **Demo Mode** (`Run Demo` on the New Audit page) — a
clearly labeled fictional restaurant run through the real analysis pipeline.

**Deploying?** See `docs/DEPLOYMENT.md`. Production requires `BASIC_AUTH_USER`
and `BASIC_AUTH_PASSWORD` — the app fails closed (503) without them because it
serves confidential sales intelligence. A `Dockerfile` (migrate-on-start) and
`docker-compose.yml` (app + PostgreSQL) are provided.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Vitest suite (46 tests: SSRF, scoring, leak rules, report separation, live-fixture collection) |
| `npm run typecheck` | TypeScript |
| `npm run db:migrate` | Prisma migrations |

## Architecture

```
src/
  app/                    UI + API routes (Next.js App Router)
    api/audits            POST create+run · GET status · POST demo
    audits/[auditId]      results · /report (owner) · /sales (internal)
  lib/
    validation/url.ts     URL syntax + DNS-level SSRF protection, redirect re-validation
    web/collector.ts      Compliant public-page retrieval (timeouts, UA, no bot-protection bypass)
    web/discovery.ts      Relevant-page discovery, max 10 pages, same-host only
    audit/evidence.ts     Raw pages → typed, source-attributed Evidence records
    audit/journey.ts      Deterministic customer journey analysis (10 stages)
    audit/leaks.ts        Rule-based revenue leak detection (evidence-gated)
    audit/orchestrator.ts Pipeline with persisted real progress stages
    audit/demo.ts         Demo Mode (fictional, labeled, real pipeline)
    scoring/priority.ts   Rescue Priority Score (35/25/25/15) — pure TypeScript
    scoring/rescueScore.ts Category scores, weight re-normalization, Coverage Score
    ai/provider.ts        Provider abstraction (env-driven; optional narrative layer)
    reports/owner.ts      Owner report generator (internal fields excluded, test-enforced)
    reports/sales.ts      Internal sales brief generator (evidence-grounded)
  types/audit.ts          Shared domain types
prisma/schema.prisma      Restaurant · Audit · AuditSource · Evidence · JourneyStage ·
                          Opportunity · AuditScore · Report · SalesIntelligence · AuditJob · SystemLog
tests/                    Business-rule tests + live fixture-site integration test
```

### Separation of concerns (by design)

DATA COLLECTION → EVIDENCE STORAGE → ANALYSIS → SCORING → RECOMMENDATION →
REPORT GENERATION → SALES INTELLIGENCE are independent modules. Deterministic
code does all math, weighting, ranking, and validation. The optional AI layer
(set `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY`) only enhances report
narrative from supplied evidence, with schema-validated output and bounded
retries; when unconfigured or failing, the deterministic summary is used and
the audit says so — AI output is never faked.

### Scores

- **Restaurant Rescue Score (0–100)** — weighted category quality, computed only
  over categories with sufficient evidence (weights re-normalized, disclosed).
- **Audit Coverage Score (0–100)** — how much of the intended audit could
  actually be analyzed. Kept strictly distinct from the Rescue Score.
- **Rescue Priority Score** = Impact×0.35 + Urgency×0.25 + Confidence×0.25 + AI Fit×0.15.

### Compliance boundaries

The collector fetches public HTML only: honest User-Agent, 15s timeouts, max 10
pages, manual redirect following with SSRF re-validation on every hop. It never
bypasses logins, CAPTCHAs, paywalls, or bot protection — a 401/403/429 is
recorded as `BLOCKED` and disclosed. Review-platform scraping is out of MVP
scope; the REVIEW journey stage and reputation score are honestly marked
`INSUFFICIENT DATA`.

### Database

PostgreSQL + Prisma. Local dev credentials live in `.env` (never committed).
`RESCUE_AGENT_ALLOW_PRIVATE_TARGETS=1` is a test-only hook for the fixture-site
integration test and is hard-disabled when `NODE_ENV=production`.

---

# Winners Bookmark AI Front Desk

A **second product** sharing this application's database, deployment and auth.
The Rescue Audit sells to a prospect; the Front Desk is what the restaurant then
runs day to day. Routes live under `/frontdesk`, code under `src/lib/frontdesk`,
and every table is prefixed `Fd`. Nothing in the audit pipeline was changed.

## The two layers

**Layer 1 — the engine.** One reusable pipeline, in `src/lib/frontdesk/`.
It contains no restaurant facts at all.

**Layer 2 — tenant configuration.** Each restaurant is a row in `FdTenant` whose
`config` column holds a validated `TenantConfig` (`config/schema.ts`). Onboarding
restaurant #2 or #100 means writing one of these objects — never editing engine code.

```
src/lib/frontdesk/
  config/schema.ts        Tenant configuration contract (zod). Secrets are
                          referenced by env-var NAME only, never by value.
  config/completeness.ts  Missing Information Report — blocks activation and
                          names the capability each gap switches off
  intent.ts               Deterministic intent detection + entity extraction
  guardrails.ts           Screening (injection, cross-tenant, staff data,
                          payment data) and escalation triggers
  knowledge/hours.ts      Hours in the LOCATION's timezone; holidays override
  knowledge/resolver.ts   Verified-answer resolution — the only source of
                          restaurant facts
  leads.ts                Lead categorisation, priority, ESTIMATED value
  engine.ts               The turn engine (pure function: no I/O, no clock)
  store.ts                Tenant-scoped persistence — every query filters by
                          tenantId, including lookups by primary key
  demo/tenant.ts          Two fictional restaurants (.invalid domains, 555 numbers)
```

## Why replies are composed, not generated

The engine builds replies from templates plus verified config values. This is a
deliberate MVP constraint: there is no code path from "customer asked" to
"sentence invented", so the front desk **cannot** fabricate a price, an allergen
claim or a booking. Every assistant turn stores an `answerSource`
(`VERIFIED_CONFIG` / `VERIFIED_FAQ` / `VERIFIED_PATHWAY` / `CLARIFYING` /
`UNVERIFIED_DEFERRED` / `ESCALATED` / `REFUSED`) so an operator can audit whether
it spoke from data or correctly declined. A later phase may pass a composed reply
through a model to smooth phrasing — the facts will still come from here.

## Safety rules that are structural, not stylistic

- **Allergens** — never certified. `guardrails.ts` runs before knowledge
  resolution, so no path answers an allergen question from menu data. A severe
  allergy always reaches a human.
- **Reservations** — `bookingState` is `REQUESTED`, never `CONFIRMED`, until a
  real booking integration says otherwise.
- **Complaints** — acknowledge → capture → escalate. Never promises a refund,
  never admits liability, never argues.
- **Estimated value** — labelled ESTIMATED everywhere. When the restaurant has
  supplied no average check, the estimate is `null`, not a guess.
- **Multi-tenant** — every read and write is filtered by `tenantId`. Lead updates
  use `updateMany` with a tenant filter so a leaked id is useless.

## Try it

```bash
npm run dev
# open /frontdesk → "Create demo restaurants" → open a restaurant → "Try the front desk"
```

The simulator talks to the real API route and shows the provenance badge on every
reply. "Remove demo data" deletes only rows marked `demoMode` and asks first.

## Escalation alerts by SMS (Phase 2)

An escalation now queues an SMS to the staff contact its routing rules select,
and the whole path is tracked:

```
escalation recorded → notification QUEUED → provider accepts → SENT
                                          → carrier callback → DELIVERED
                                          → transient error  → retry (max 3) → ABANDONED
                                          → permanent error  → ABANDONED immediately
```

**SENT is not DELIVERED.** SENT means a provider accepted the message; only a
carrier callback confirms it reached a handset. The dashboard shows both, and
never conflates them — believing a manager was reached when the message is
still queued is the failure this distinction exists to prevent.

Anything that ends ABANDONED, plus every configuration reason an alert could
not be sent at all (`smsEnabled` off, no sending number, contact has no phone),
is written to the **failure queue** and shown at the top of the TODAY dashboard.
Nothing fails silently.

### Configuration

| Variable | Purpose |
| --- | --- |
| `SMS_PROVIDER` | `mock` today. Unset means no alerts — escalations stay dashboard-only. |
| `SMS_WEBHOOK_SECRET` | HMAC secret for delivery callbacks. **Verification fails closed without it.** |
| `SMS_ALLOW_MOCK_IN_PRODUCTION` | Staging escape hatch. See below. |

**The mock is refused when `NODE_ENV=production`** unless
`SMS_ALLOW_MOCK_IN_PRODUCTION=true`. Without that guard a production deploy
would look healthy — notifications marked SENT — while no manager ever received
anything. Every simulated message is also labelled `Simulated` in the UI and in
the dispatch response.

No real provider adapter is implemented. Connecting one requires an account and
credentials, and is a separate, explicitly approved step; it plugs in behind the
existing `SmsProvider` interface without touching dispatch, retries or the
failure queue.

### Draining the queue — the dispatch worker

Queued alerts do not send themselves. Three triggers drive the **same** dispatch
cycle (`notify/worker.ts`), so behaviour never depends on how it was started:

| Trigger | Auth | Use |
| --- | --- | --- |
| `GET/POST /api/frontdesk/notifications/cron` | `Authorization: Bearer $CRON_SECRET` | Managed schedulers (Vercel Cron) |
| `npm run worker:notifications` | same secret, over HTTP | Long-lived deploys (Docker, VM) |
| `POST /api/frontdesk/notifications/dispatch` | WBI admin | Manual runs during a pilot |

The endpoint refuses a missing secret *and* one shorter than 16 characters, so
a queue-draining route cannot become reachable because someone set
`CRON_SECRET=test`.

**No schedule is committed to this repo, deliberately.** Vercel rejects
sub-daily cron schedules on Hobby plans *at build time*, so shipping an active
`vercel.json` could break a deploy depending on the account's plan. Add it once
you have confirmed the plan supports it:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/frontdesk/notifications/cron", "schedule": "* * * * *" }]
}
```

Vercel Cron issues a `GET` and supplies `Authorization: Bearer $CRON_SECRET`
automatically once `CRON_SECRET` is set in project settings. On a Hobby plan, or
any container deploy, run `npm run worker:notifications` instead — it polls the
same endpoint on an interval and has no plan restriction.

**Until one of these is running, alerts queue and are never sent.**

#### Duplicate-send protection

Claiming is a single `UPDATE … FOR UPDATE SKIP LOCKED` statement that flips rows
to `SENDING` as it selects them. Concurrent workers therefore take **disjoint**
batches rather than both reading the same rows — the cron tick overlapping a
manual dispatch, or two container replicas, cannot text a manager twice or
double-bill a send. Verified live with six simultaneous cycles against one
queue: every alert processed exactly once.

Each attempt also carries an idempotency key (`<notification id>:<attempt>`).
Delivery is **at-least-once**: a worker that dies between "the provider accepted
it" and "we recorded that" will retry that attempt, and the key is what lets the
vendor recognise the repeat. A real adapter MUST forward it to the vendor's
idempotency header.

#### Crash recovery

A worker that dies mid-send leaves its row in `SENDING`. After a 5-minute lease
another worker reclaims it, so a stranded food-safety alert is never lost. A
claim that is still within its lease is not stolen from the worker holding it.

### Delivery callback

`POST /api/frontdesk/notifications/webhook` — HMAC-signed over the raw body,
with a required recent timestamp so a captured callback cannot be replayed to
mark a failed alert as delivered. It is the one route exempt from the app-wide
Basic Auth, which is safe precisely because it fails closed without a valid
signature. Duplicate and out-of-order callbacks are idempotent: a late
`UNDELIVERED` never overwrites a `DELIVERED`.

### Customer-facing wording is unchanged, deliberately

Replies still say an issue has been *flagged for the team* — never that someone
is being alerted. At the moment of reply the system genuinely does not know
whether the SMS will be accepted, delivered, or abandoned, so promising delivery
would be a claim it cannot stand behind. Anything time-critical still points the
customer at the restaurant's own number, which reaches a human immediately.

## Inbound messaging, consent and rate limits (Phase 2 M3)

The front desk now receives as well as sends: customer SMS and missed-call
events arrive on one signed webhook.

### Missed-call recovery (§VII)

A missed call creates a conversation and queues **one** recovery text. The
customer replies or does not — and if they do not, the follow-up cap stops us
chasing them. A caller who rings five times without replying still gets one
text: only an inbound *message* resets that baseline, never another call.

### Consent — checked before every outbound message

`messaging/send.ts` is the **only** path that queues a message, and it applies
consent, rate limits and the follow-up cap there rather than at each call site,
so a future feature cannot skip them.

| Status | Meaning |
| --- | --- |
| `UNKNOWN` | Never interacted. Customer-directed messages are refused. |
| `IMPLIED` | They called or texted us. Bounded operational replies allowed. |
| `OPTED_IN` | Explicit START after a STOP. |
| `OPTED_OUT` | Sent STOP. **Blocks every outbound message, including staff alerts.** |

STOP is absolute and applies to *every* purpose. If a manager texts STOP, their
escalation alerts stop — and the refusal is filed loudly to the failure queue so
an operator fixes the routing instead of the system quietly ignoring consent.
The STOP acknowledgement itself is the one message an opted-out number still
receives, because carriers expect it.

Keyword matching is deliberately strict: only a message that is essentially just
the keyword counts. "Stop by around 7?" is a reservation enquiry, and silencing
a paying customer over it would be worse than missing a keyword.

**Consent is per (restaurant, number), never global.** Opting out of one
restaurant does not silence another — they are separate businesses.

**NOT LEGAL ADVICE.** The encoded policy is a defensible default for US A2P
messaging. Each restaurant remains responsible for confirming its own
obligations; every threshold is per-tenant configuration so it can be tightened
without a code change.

### Rate limits

Per-number (default 5/hour) protects a person from being messaged repeatedly by
a bug or a redelivery storm. Per-tenant (default 200/hour) caps spend and
contains a misconfiguration to one client. Both fall back to conservative
defaults, never to unlimited. Fixed hourly windows, so an operator can be shown
exactly which counter throttled a message; the tradeoff is up to 2x across a
window boundary.

### Duplicate webhook protection

Every inbound event is claimed by a unique-constrained insert on
(provider, eventId) before any work happens. Concurrent redeliveries race and
exactly one proceeds — verified live: three deliveries of one missed call
produce one text.

## Tenant users, roles and isolation (Phase 4 M4)

Until M4 the dashboard was all-or-nothing: one operator credential that saw
every restaurant. A restaurant owner could not be given access to their own
dashboard without being given access to everyone's. Now each restaurant has its
own users.

### Roles (§XXVI)

| Role | Scope | May |
| --- | --- | --- |
| `WBI_ADMIN` | all tenants | everything, incl. creating restaurants and demo data |
| `RESTAURANT_OWNER` | own restaurant | read, leads, API keys, configuration |
| `RESTAURANT_MANAGER` | own restaurant | read, leads |
| `RESTAURANT_STAFF` | own restaurant | read, leads |
| `READ_ONLY` | own restaurant | read |

**Two questions, never one.** Every authorization asks *does this actor hold the
permission* AND *for THIS restaurant*, together, in a single `authorize()` call.
A permission check alone passes for every restaurant — that is the classic
multi-tenant hole, and the API makes it impossible to write.

`tenantId` on the user row IS the boundary: NULL only for `WBI_ADMIN`, non-null
for every restaurant role, and a row violating that is refused rather than
interpreted generously.

### Credentials

Passwords use **scrypt** (`node:crypto`, no dependency) — deliberately expensive,
because a password is human-chosen and the threat is offline brute force after a
leak. API keys and session tokens use **SHA-256** — deliberately fast, because
they are 256-bit random values where brute force is not the threat. Using either
in the other's place would be wrong.

Sessions store only a token digest, expire absolutely after 12 hours, are
revoked server-side on logout, and die the moment a user is suspended. The
cookie is httpOnly, sameSite=lax, and Secure in production.

Sign-in is rate-limited per (restaurant, email) per hour, and wrong password,
unknown user and unknown restaurant are byte-identical responses — so the
endpoint is neither a brute-force target nor an account-enumeration oracle.

### Two structural guards

Behavioural tests prove today's code is correct; they cannot prove tomorrow's
will be. Two source-scanning tests run in CI:

1. **Query scoping** — fails if any query against customer data omits a tenant
   filter. Extended in M4 to the consent, notification, rate-counter, inbound-event
   and user models, all of which were outside it until now.
2. **Surface authorization** — fails if any page or route under `/frontdesk` is
   added without authorizing itself. This is what makes the middleware's
   session bypass safe, and it caught a real privilege escalation during M4.

## FOUNDER ACTION REQUIRED — before real customer traffic

The `/api/frontdesk/[tenantSlug]/message` route currently sits behind the same
Basic Auth as the rest of the app. That is correct for demos and internal use.
**Before pointing a website widget or a telephony webhook at it**, it needs a
public per-tenant authentication path (a per-tenant key or signed webhook
verification) — otherwise making it publicly reachable would expose every
tenant's endpoint. This is the first Phase 2 task, not an optional hardening step.

## Phase status

- **Phase 1 (MVP) — built:** tenant configuration, intent detection, FAQ
  answering, lead capture, human escalation, TODAY dashboard, demo mode.
- **Phase 2 — not started:** missed-call recovery, SMS, follow-up workflows,
  notifications, the operator failure queue (`FAILED_SMS` and friends).
- **Phase 3 — not started:** reservation/ordering integrations, telephony,
  email, review workflow.
- **Phase 4 — not started:** RBAC roles, monthly owner report, billing,
  onboarding automation.

## Roadmap after MVP

- PDF export of the owner report (HTML report is authoritative today)
- Review/reputation collection via compliant APIs
- Off-site local presence (NAP consistency) checks
- Additional AI provider adapters (OpenAI, Google) behind the existing interface
- Authentication/roles for multi-user teams

---
Designed by Winnersbookmark Incorporated.
