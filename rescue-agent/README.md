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

## Roadmap after MVP

- PDF export of the owner report (HTML report is authoritative today)
- Review/reputation collection via compliant APIs
- Off-site local presence (NAP consistency) checks
- Additional AI provider adapters (OpenAI, Google) behind the existing interface
- Authentication/roles for multi-user teams

---
Designed by Winnersbookmark Incorporated.
