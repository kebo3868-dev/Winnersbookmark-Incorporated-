# Test results

Recorded 2026-10-30 at the end of Phase 1 and Phase 2, on Node 22, Next.js 16.4.3 and
PostgreSQL 16.

## Summary

| Check | Result |
|---|---|
| TypeScript (`npm run typecheck`, strict) | Pass |
| Unit + integration (`npm test`) | **93 / 93 pass** (7 files) |
| Postgres integration (part of the above) | 7 / 7 pass against a real PostgreSQL 16 |
| Production build (`npm run build`) | Pass |
| Dependency audit (`npm audit`) | 0 vulnerabilities |
| Client bundle scan for secret names and server code | Clean |
| Migration runner: empty database, then re-run | Applies, then skips (idempotent) |
| Android acceptance (`npm run test:e2e`, Pixel 7, 412×839) | **26 / 26 pass** |

## What is verified, and what is not

**Verified:** application logic, authentication, authorization, origin checks, schema
constraints, the orchestration and retry logic, honest status rendering, the
approval flow, and each adapter's request and response handling against the
documented wire formats (recorded fixtures plus a real HTTP round trip).

**NOT verified: no real provider has been called.** This session had no OpenAI, Meta,
Gemini or Hermes credentials, and no Hermes host. The documentation hosts for OpenAI,
Meta and Hermes were also blocked by the session's network policy (see
`ENVIRONMENT.md`). Every agent is therefore unverified until its Phase 3 probe succeeds
on a deployment with real keys. The dashboard enforces this: it cannot show "verified"
without a recorded successful probe.

**About the acceptance run's "Hermes · Connected · verified".** In the acceptance test,
Hermes was pointed at `tests-e2e/stub-provider.mjs`. That is a local server speaking the
documented Responses format, written for this test. **It is not Hermes and not an AI.**
Its replies say so ("PROTOCOL STUB — not Hermes, not an AI"). It exists to exercise
AgentOS's real HTTP path end to end: bearer auth, request shape, parsing, replayed
tool-call items, error mapping and key redaction. Screenshots 02, 04 and 05 show
that stub's output.

## Unit and integration suite (93)

| File | Tests | Covers |
|---|---|---|
| `providers.test.ts` | 21 | OpenAI, Meta and Hermes request shape and URLs; Gemini header auth (key never in the URL); answer text only (reasoning, tool replays and commentary skipped); empty, failed and incomplete responses treated as errors; HTTP status → retryable or not; Retry-After; timeouts; API key redaction; Meta contributor-model block; mock and production resolution rules |
| `orchestrator.test.ts` | 19 | Full slice; simulated runs labelled and a simulated review never passing; retry with backoff; no retry on auth errors; time budget; reviewer failure fails the task; no concurrent double run; stale-run reclaim; review parsing (fences, a "pass" with high findings downgraded, prose → unparseable); reviewer selection matrix |
| `structure.test.ts` | 22 | Every API route and page calls its owner check; every POST requires the same origin; proxy exemptions match exactly; client components import no server module and read no env; no `NEXT_PUBLIC_` secret; no `dangerouslySetInnerHTML` |
| `auth.test.ts` | 10 | scrypt verify; salting; weak or malformed hashes refused; fail-closed configuration; session expiry and tampering; invalidation by password change or secret rotation; origin check; security headers |
| `status.test.ts` | 9 | A key alone is never "verified"; verification expires after 24 hours or on a model change; a failed probe shows "error"; contributor model "blocked"; mock adapters are not probed |
| `pg-store.test.ts` | 7 | Real Postgres: full slice persisted and audited; 8 concurrent claims → exactly 1 wins; stale reclaim; evidence and audit append-only; tasks with evidence undeletable; no self-review; no unattributed approval; shared rate limit; latest probe per agent |
| `approvals.test.ts` | 5 | All 6 gated actions; an `ApprovedAction` only for an approved record with matching task and action; forged objects rejected; no double decision; task status and audit updated |

## Android acceptance run (26)

```
PASS  Unauthenticated page request is redirected to sign-in — status 307
PASS  Unauthenticated API request is refused — status 401
PASS  Security headers are served
PASS  Viewport is Android-sized — 412×839
PASS  Wrong password is rejected — INCORRECT PASSWORD
PASS  Owner signs in
PASS  Session cookie is HttpOnly, Secure and SameSite=Strict
PASS  Cross-origin write with a valid session is refused — status 403
PASS  Roxy: configured, not yet verified
PASS  Zeus: honestly not connected
PASS  Hermes: configured, not yet verified
PASS  Gemini: honestly not connected
PASS  Hermes connection check succeeds over HTTP (protocol stub)
PASS  Roxy connection check fails and is shown as an error
PASS  Rejected API key is redacted from the displayed error
PASS  Task created and assigned to Hermes
PASS  Primary result came over the live HTTP path and is labelled Live
PASS  Evidence saved: provider response id and token counts
PASS  Independent review by a different agent (Gemini) is shown
PASS  Simulated review is labelled and does not pass
PASS  Task awaits founder approval
PASS  Approval warning names exactly what was simulated (the review, not the result)
PASS  Founder approval recorded with attribution
PASS  Task is Approved
PASS  Audit trail lists creation, run and approval
PASS  Auth failure is not retried and the task is marked Failed
26/26 acceptance checks passed
```

Screenshots are in `docs/evidence/`. In full-page captures, the fixed header and bottom
navigation are drawn where the viewport ended, partway down the image. This is a
capture artifact, not the on-device layout.

1. `01-dashboard-initial.jpg`: two agents not connected, two configured but unverified
2. `02-dashboard-after-checks.jpg`: Hermes (stub) verified; Roxy error with the key redacted
3. `03-new-task-form.jpg`: Mission Control on a phone
4. `04-task-awaiting-approval.jpg`: result, independent review (simulated, "Concerns"), evidence, approval panel
5. `05-task-approved.jpg`: attributed decision and audit trail
6. `06-task-failed-honestly.jpg`: rejected key → one attempt, no retry, task Failed

## Defects found and fixed during testing

- **Approval warning overstated simulation.** It said "No agent produced it" when only
  the review was simulated. It now names exactly which part was simulated. A regression
  check was added.
- **Sign-in dropped input typed before hydration.** On a slow phone, a password typed
  before the page finished loading was lost and the button stayed disabled. The form is
  now uncontrolled.
- **Test harness left a stale server running.** Killing `npx` orphaned `next-server`, so a
  later run tested an old build. The harness now runs Next directly in its own process
  group and refuses to start if the port is already in use.

## Reproduce

```bash
cd agentos
AGENTOS_TEST_DATABASE_URL=postgresql://…/disposable_db npm test
npm run build
AGENTOS_E2E_DATABASE_URL=postgresql://…/another_disposable_db npm run test:e2e
```
