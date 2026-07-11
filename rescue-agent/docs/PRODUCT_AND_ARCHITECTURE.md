# Restaurant Rescue Agent — Product Requirements & System Design

Company: Winners Bookmark Incorporated · Founder: Keith Warren

## 1. Product Requirements (MVP)

The MVP must do five things exceptionally well:

1. **Accept a restaurant website URL** (only required input; name/city/state/concern optional).
2. **Collect traceable public evidence** — every fact stored with source URL, type, supporting context, confidence.
3. **Identify and rank the top three revenue leaks** — deterministic, evidence-gated rules; zero leaks is valid.
4. **Generate a professional Restaurant Rescue Audit** (owner-facing).
5. **Generate a private WBI Sales Brief** (internal-only; hard separation enforced by tests).

Non-goals for MVP: review-platform scraping, off-site listing comparison, PDF export,
multi-tenant auth, social profile crawling. Each is marked INSUFFICIENT DATA or
out-of-scope in reports rather than faked.

### Honesty requirements (product-defining)

- No claim without evidence; absence phrased as "not detected on analyzed pages."
- Confidence < 60 ⇒ `manualValidationRequired = true`.
- Missed calls are never asserted; only "potential missed-call exposure" / "phone-dependent customer journey."
- No revenue figures anywhere; impact is described as exposure, with assumptions disclosed.
- Collection failure ⇒ FAILED or PARTIALLY_COMPLETED audit with the reason displayed.
- Demo Mode is fictional, labeled on every surface, and runs the *real* pipeline.

## 2. System Architecture

Next.js 15 (App Router, TypeScript) · Tailwind CSS · PostgreSQL · Prisma · Zod ·
optional AI provider layer (env-driven).

Pipeline (each stage persisted to `AuditJob.currentStage`, polled live by the UI):

```
VALIDATING_WEBSITE → DISCOVERING_PAGES → COLLECTING_EVIDENCE
→ ANALYZING_CUSTOMER_JOURNEY → DETECTING_REVENUE_LEAKS → SCORING_OPPORTUNITIES
→ CALCULATING_RESCUE_SCORE → GENERATING_OWNER_REPORT → GENERATING_SALES_BRIEF
→ COMPLETED | PARTIALLY_COMPLETED | FAILED
```

Layer separation: collection / evidence / analysis / scoring / recommendation /
report generation / sales intelligence are independent modules under `src/lib`.

## 3. Database Schema

See `prisma/schema.prisma`. Entities: Restaurant, Audit, AuditSource, Evidence,
JourneyStage, Opportunity, AuditScore, Report (JSON content, typed
OWNER_AUDIT | INTERNAL_SALES), SalesIntelligence, AuditJob, SystemLog.
Evidence links to its AuditSource, creating the claim→evidence→source chain.

## 4. Agent Architecture

Specialized modules instead of one giant prompt:

| Spec agent | Implementation |
| --- | --- |
| Restaurant Discovery | `web/collector.ts` + `web/discovery.ts` |
| Customer Journey | `audit/journey.ts` (deterministic rules over evidence) |
| Website Forensics | `collector.ts` extraction + `evidence.ts` normalization |
| Phone Opportunity | phone rules in `journey.ts` + `leaks.ts` |
| Reservation & Ordering | categorized-link probing + rules |
| Reputation Intelligence | out of MVP scope — marked INSUFFICIENT DATA |
| Revenue Leak Detection | `audit/leaks.ts` |
| AI Solution Architect | tier recommendation in `reports/owner.ts` |
| Executive Report | `reports/owner.ts` |
| Sales Intelligence | `reports/sales.ts` |

AI is used only for narrative enhancement over supplied evidence
(`ai/provider.ts`: schema-validated, bounded retries, graceful fallback).
All math/weighting/ranking is TypeScript.

## 5. Evidence & Confidence Model

`Evidence { evidenceType, fact, supportingContext, confidence 0–100, sourceUrl }`.
Facts use precise language; negative facts state detection scope. Journey stages
and opportunities carry `evidenceIds`; a rule with no evidence emits nothing.

## 6. Scoring Engine

- **Rescue Priority** = Impact×0.35 + Urgency×0.25 + Confidence×0.25 + AIFit×0.15,
  inputs validated 0–100, rounded; top three selected by rank.
- **Category weights**: journey 15, website 15, phone 15, reservation 10,
  ordering 10, reviews 10, local presence 10, retention 10, AI readiness 5.
- **Overall score**: weighted mean over categories with sufficient data,
  weights re-normalized; **Coverage Score** = share of intended weight analyzed.
  Both displayed, never conflated.

## 7. Technical Risk Register

| Risk | Status / mitigation |
| --- | --- |
| Bot protection blocks collection | Recorded as BLOCKED; audit fails honestly. No bypass by policy. |
| JS-only websites yield thin HTML | Evidence reflects what static HTML shows; coverage/confidence drop accordingly. Headless rendering is a post-MVP option. |
| Sandbox/egress proxies (dev environments) | Failure surfaces as UNAVAILABLE/BLOCKED with note; production deployments need open egress. |
| Heuristic false positives (regex extraction) | Conservative wording + confidence caps + manual-validation flags; unit-tested extractors. |
| AI hallucination | AI restricted to narrative over supplied JSON evidence; schema-validated; deterministic fallback. |
| Review data legality | Deferred; category marked INSUFFICIENT DATA rather than scraped. |

## 8. Verification (performed)

- 46 automated tests: SSRF/URL validation, priority formula (bounds, rounding,
  ranking, top-3), weight re-normalization, insufficient-data handling,
  leak rules (zero-finding case, confidence floor, cap at 10), report
  separation (owner report scanned for internal markers), collector extraction,
  page limit/dedup, live fixture-site integration (broken-link detection),
  unreachable-site honesty.
- `tsc --noEmit` clean; `next build` clean.
- Live server verification: demo audit COMPLETED (score 70, coverage 90%,
  top-3 leaks, both reports rendering, owner report free of internal fields);
  blocked external site produced an honest FAILED audit; invalid/SSRF inputs
  rejected with the specified error strings.
