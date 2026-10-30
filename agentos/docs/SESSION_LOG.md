# Session record — AgentOS build, 2026-10-30

A written record of the Claude Code session that produced Phase 1 and the Phase 2
vertical slice of Winnersbookmark AgentOS. It contains the founder's messages verbatim, a
log of the work, and the final report. It is a record, not a raw transcript export: tool
output is summarised.

- Branch: `claude/winnersbookmark-agentos-arch-8fk5vi`
- Build commit: `1c7157c feat(agentos): Phase 1 architecture and Phase 2 vertical slice`
- Session: https://claude.ai/code/session_01HMF8wrj95ujQ3gLgV5CU7m

---

## 1. Founder's directive (verbatim)

> WINNERSBOOKMARK AGENTOS — MASTER BUILD DIRECTIVE V1.0
>
> You are my principal AI systems architect and lead software engineer.
>
> I am building Winnersbookmark AgentOS, a private, founder-controlled, multi-agent AI operating platform for Winnersbookmark, an AI consulting business initially serving restaurants.
>
> **Mission**
>
> Build a functional, mobile-first web application that coordinates four AI systems:
>
> 1. OpenAI / ChatGPT — Roxy: Chief Strategy Agent. Business planning, executive analysis, recommendations, and final synthesis.
> 2. Meta Muse — Zeus: Creative Strategy Agent. Alternative approaches, marketing ideas, critical analysis, and strategic challenges.
> 3. Hermes Agent: Research and Automation Agent. Research, repeatable workflows, scheduled assignments, and retained operational knowledge.
> 4. Google Gemini: Intelligence and Verification Agent. Document analysis, secondary research, quality assurance, and independent verification.
>
> Claude Code is the engineering system responsible for building, testing, and maintaining AgentOS. It does not need to be a continuously running production agent.
>
> **Technical foundation**
>
> Use the following stack unless repository inspection establishes a better reason to change it:
>
> - Next.js with TypeScript
> - Tailwind CSS
> - Supabase PostgreSQL
> - Vercel for web deployment
> - Secure server-side provider adapters
> - Responsive Android-first interface
>
> Use current, documented APIs and SDKs. Do not invent endpoints or model names.
>
> **Core requirements**
>
> 1. Agent Dashboard — Display agent name, role, connection status, assigned tasks, recent results, and errors.
> 2. Mission Control — Allow the founder to create tasks, assign an agent, specify objectives, review output, and approve subsequent actions.
> 3. Multi-Agent Orchestration — Implement structured task handoffs, independent validation, retry handling, and controlled parallel execution. Use one primary agent per task by default. Add a second reviewer only when justified by risk or complexity.
> 4. Provider Integrations — Create independent adapters for: OpenAI Responses API; Meta Muse Model API; Google Gemini API; Hermes Agent's documented HTTP interface. Check credentials and connection requirements. Supply mock adapters where real credentials or infrastructure are unavailable. Never represent simulated outputs as live agent results.
> 5. Shared Business Knowledge — Create project-specific, permission-controlled knowledge storage with source references, retrieval, and an audit trail.
> 6. Human Approval — Require explicit owner approval before: sending messages externally; spending money; publishing content; modifying production databases; deploying production changes; creating contractual commitments.
> 7. Security — Use environment variables or managed secrets, authentication, authorization, scoped permissions, validation, rate limits, and audit logs. Never expose provider API keys in browser code. Keep Hermes execution isolated and authenticated.
> 8. Business Modules — Prepare future integration interfaces for: Restaurant Rescue Agent; AI Front Desk; Client Acquisition; Revenue Reporting; Standard Operating Procedures. Do not modify the existing Rescue Agent or Front Desk production applications during this initial build.
>
> **Implementation sequence**
>
> Phase 1: Examine the environment, define the architecture, and create the independent AgentOS repository.
> Phase 2: Build the functional dashboard, task database, mock providers, and approval interface.
> Phase 3: Integrate the real providers individually and verify each connection.
> Phase 4: Build cross-agent handoffs, task history, cost tracking, and fault recovery.
> Phase 5: Run automated tests, security checks, and a complete end-to-end workflow before deployment.
>
> **Acceptance criteria**
>
> Demonstrate a task created on an Android-sized interface, assigned to an agent, processed, independently checked, saved with evidence, and displayed for founder approval.
>
> Show connected and disconnected states honestly.
>
> Produce setup instructions, environment variable documentation, test results, and a deployment checklist.
>
> Do not claim completion if APIs, authentication, security, or functionality remain unverified.
>
> Start by presenting the architecture and implementation plan, then implement Phase 1 and the smallest functioning Phase 2 vertical slice.

## 2. Work log

1. **Repository inspection.** Found a monorepo with three apps: the root Vite blog, `rescue-agent/` (Next.js, Rescue Agent and Front Desk) and `website/`, each its own Vercel project, with CI gating `rescue-agent/` and `website/`. Adopted their conventions: fail-closed auth, per-route authorization (from issue #72), "never fake output", and structural tests.
2. **Provider research.** Network policy blocked the official documentation for OpenAI, Meta and Hermes. Read Hermes's API server docs from its GitHub repository, OpenAI model IDs from the official `openai-node` source, Gemini from the official `@google/genai` README, and Meta's Model API from two independent integrations (promptfoo, Mastra).
   - OpenAI, Meta and Hermes all speak the Responses protocol, so one client serves all three.
   - Meta's `-contributor` model IDs license training on prompts, so they are blocked in code.
   - The Hermes API server can run terminal commands, so it must be isolated.
3. **Placement.** `agentos/` as a fourth independent app; nothing in Rescue Agent, Front Desk or the website was touched.
4. **Dependencies.** Started on Next 15, found high and critical advisories, and moved to Next 16.4, Vitest 5 and Zod 4. `npm audit` reports 0 vulnerabilities.
5. **Schema.** Supabase/Postgres migration, verified against a local PostgreSQL 16. All six invariants were confirmed to reject bad writes: no self-review, a verdict only on reviews, immutable evidence, no deleting tasks that have evidence, attributed decisions, and an append-only audit log.
6. **Core.** Provider adapters, mock adapter, honest connection status and probes, orchestrator (claim, retries, independent review, approval), approval capability, and stores (Postgres and memory).
7. **Security.** scrypt owner password, HMAC session cookie, proxy plus per-route checks, origin checks, rate limits and security headers.
8. **UI.** Mobile-first dashboard, Mission Control, task evidence page and approvals.
9. **Tests.** 93 unit and integration tests (7 against real Postgres), and a 26-check acceptance test on a Pixel 7 viewport against the production build.
10. **Defects found and fixed.**
    - The approval warning overstated what was simulated.
    - The sign-in form lost input typed before hydration.
    - The test harness left a stale server running.
11. **Docs and CI.** README, architecture, environment, test results, deployment checklist, and an `agentos` CI job with a Postgres service. Committed `1c7157c` and pushed.

## 3. Final report (as delivered)

Phase 1 and the smallest working Phase 2 slice of AgentOS are built, tested and pushed. **None of the four AI providers has actually been called yet**: the session had no API keys and no Hermes server, so connecting them is Phase 3.

| Check | Result |
|---|---|
| Automated tests | 93/93 pass, 7 against a real PostgreSQL 16 database |
| Phone acceptance test (Pixel 7, production build) | 26/26 pass |
| Production build and type checks | pass |
| `npm audit` | 0 vulnerabilities |
| Browser code scanned for API keys | clean |

The phone test covered sign in → create a task → assign Hermes → run → Gemini reviews independently → evidence saved → waits for approval → approved. It showed four honest states:

- Hermes "verified" against a labelled local protocol stub. This is not Hermes; it proves only the connection code.
- Roxy "Connection error" with a deliberately wrong key, which is redacted in the display.
- Zeus and Gemini "Not connected", with their output labelled SIMULATED. A simulated review never passes.

**Not verified yet:**
- The provider APIs themselves; the first live connection check in Phase 3 is the proof.
- Long tasks run inside a ~5-minute request; a background worker comes in Phase 4.
- Not started: shared knowledge, dollar cost tracking, agent handoffs and the business-module connectors.

**Next steps:**
1. Create the Supabase and Vercel projects (see `DEPLOYMENT_CHECKLIST.md`).
2. Connect providers one at a time, Gemini first.
3. Set up Hermes last, on its own locked-down server.
4. Set spending limits in each provider console.

## 4. Follow-up request (verbatim)

> I want you to save the chat and put it in projects or artifact or even both.

Saved as this file in the repository, and published as a private Artifact page.
