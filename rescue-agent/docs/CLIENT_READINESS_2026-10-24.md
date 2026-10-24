# Winnersbookmark Restaurant Rescue Agent V1 — engineering assessment

Assessment date: October 24, 2026. Decision: **repair candidate; not approved for paying-client release**.

The founder's estimated 90% feature completion is not a readiness measurement. This work repairs the existing application. Production was not redeployed, its database was not accessed, and no orders, reservations, customer communications, purchases, or subscription changes were made.

## Baseline and working environment

- Repository: `kebo3868-dev/Winnersbookmark-Incorporated-`; application directory: `rescue-agent/`.
- Production/base commit: `a54065ed7b2d39b94dd9b865b3265dc9eece5bb1` (PR 58).
- Repair branch: `repair/client-readiness-2026-10-24`. Review its commits and diff for the exact changed files.
- Vercel project: `winnersbookmark-incorporated`; production URL: https://winnersbookmark-incorporated.vercel.app.
- The production URL returned HTTP 401 with application Basic authentication. This is an access limitation, not evidence of an application defect. No credentials were requested in chat or bypass attempted.
- Verified stack: Next.js 15, React 19, TypeScript, Tailwind 3, Prisma 6/PostgreSQL, Cheerio, Undici and React PDF. Vercel uses Node 24. Optional Anthropic narrative enhancement exists; core extraction and scoring are deterministic.
- The repository also contains FrontDesk. Its features were preserved; the Zod upgrade required compatibility changes to nested defaults and record schemas. Its existing automated tests pass.
- Existing PDF export, SSR reports, source persistence, destination probes, DNS rebinding defenses, time/body limits and a large test suite were present. This was not a blank application.
- The initial lockfile was not reproducible with `npm ci`; dependency repair and regeneration restored clean installation. No baseline test-pass count is asserted before dependency/client generation was repaired.

## Architecture and exact execution path

| Stage | Code | Responsibility |
| --- | --- | --- |
| URL intake | `src/app/api/audits/route.ts`, `src/lib/validation/url.ts` | Validation, request limits, creation and asynchronous dispatch |
| Orchestration | `src/lib/audit/orchestrator.ts` | Scan budget, pages/probes, database writes, stage transitions, reports |
| Discovery | `src/lib/web/discovery.ts` | Candidate URLs, prioritization, canonicalization |
| Collection | `src/lib/web/collector.ts`, `safeFetch.ts`, `robots.ts` | Safe GETs, redirect validation, robots policy, bounded bodies, extraction |
| Evidence | `src/lib/audit/evidence.ts`, `integrity.ts` | Normalized records, scoped facts, source deduplication, display status/confidence |
| Verification | `src/lib/audit/destination.ts`, `orderingChannel.ts`, `evidenceState.ts` | Customer pathway versus backend/configuration distinction |
| Journey and recommendations | `src/lib/audit/journey.ts`, `leaks.ts` | Journey status and evidence-linked opportunities |
| Scoring | `src/lib/scoring/rescueScore.ts`, `priority.ts` | Category weighting, coverage, prioritization |
| Reports and scenarios | `src/lib/reports/owner.ts`, `sales.ts`, `executive.ts`, `executiveData.ts`, `scenarios.ts` | Deterministic report DTOs, optional narrative, hypothetical calculations |
| Client report | `src/app/audits/[auditId]/page.tsx`, `report/page.tsx` | Audit evidence and owner report |
| PDF | `src/lib/pdf/ExecutivePdf.tsx`, existing audit PDF API route | React PDF rendering and HTTP delivery |
| Persistence | `prisma/schema.prisma`, `src/lib/db.ts` | Restaurants, audits, sources, evidence, reports and other existing products |

## Defect ledger

| Defect | Finding and repair | Verification / remaining limitation |
| --- | --- | --- |
| Contact/email | Email was extracted but omitted from contact evidence. Visible email, decoded `mailto`, text obfuscation and contact forms now contribute. Newsletter detection is separate. | Leverock's public email is present in the repaired evidence. Regression fixtures cover email variants and forms. JS-only contacts remain manual review. |
| Ordering | Phone CTAs could override independent online channels. Mixed channels and promotional/configuration-only destinations now retain uncertainty. Assets, image-delivery hosts, careers and gift cards are excluded from food ordering. | Regression tests cover mixed, promotional, hidden, third-party and error cases. Live checkout workflows were not exercised. |
| Reservations | Existing backend-405 protection was retained; network/access restrictions do not establish customer-facing failure. Declared widgets are not called reachable merely from markup. | Backend GET 405, customer URLs, embedded widgets and inaccessible destinations covered. No booking submitted. |
| Retention | Public signup evidence previously supported a conclusion about internal follow-up. FOLLOW_UP and RETURN now remain unknown without operational evidence. | Required wording: “Internal retention and follow-up processes could not be verified from publicly available website evidence.” Interview questions replace presumed weaknesses. |
| FAQ | FAQ headings, schema and links are recognized. Negative wording is scoped to analyzed pages. | Exact scoped statement and schema/content tests. BellaBrava's FAQ link found. |
| Loyalty | Public loyalty text can be recognized independently of a link. Lack of a visible program does not establish no program exists. | Public-signal and owner-discovery tests. Private programs remain unknown. |
| Catering/private dining | Separate categories retained; recommendation titles and interview questions refer to the actual observed service. | Private dining does not establish off-site catering. Leverock's private-party link is reported without inventing a catering deficit. |
| CTAs | Raw count no longer generates a competing-CTA conversion-loss opportunity. Distinct labels and placement metadata support human hierarchy review. | Nine actions alone are not a measured loss. Mobile prominence, external CSS and behavioral conversion analysis remain manual. |
| Confidence | Numeric values are deterministic hard-coded heuristics, not calibrated probabilities. Owner-facing evidence uses High/Medium/Low with definitions. | High ≥80, Medium 60–79, Low <60. Internal numeric compatibility retained; no accuracy calibration claimed. |
| Duplicates | Canonical source/category/fact deduplication strips tracking fragments while retaining meaningful queries and path case. Menu assets deduplicated; scoring counts distinct information categories. | Distinct sources survive. Tests cover repeated menus, tracking links and uneven repetition. |
| Attribution | Probe evidence could inherit a homepage source. New records retain the exact observed source in supporting context; report loading recognizes it. | No schema migration. Historical evidence must be rerun to obtain corrected attribution. |
| Layout/export | Long sources wrap, evidence is collapsible without a fixed inner scroller, confidence/status visible, mobile spacing improved, PDF evidence retained. | Generated PDF inspected and actual report component tested at four browser sizes. Authenticated HTTP download remains unverified. |

## Evidence model and known gaps

Existing IDs, audit/restaurant associations, source records, facts, supporting context, confidence and database timestamps are retained. New source attribution uses an `Observed source:` prefix in supporting context for backward compatibility. The internal audit evidence view shows IDs and recorded timestamps. Reports preserve source links and limitations.

The six requested statuses are exposed by `findingStatus`: CONFIRMED, PARTIALLY VERIFIED, MANUAL REVIEW REQUIRED, NOT OBSERVED, SCAN ERROR, NOT APPLICABLE. **This is a conservative prose adapter, not a fully normalized persisted verification model.** Status and verification method still need dedicated schema fields, per-finding observation timestamps in every export, and migration/backfill design before claiming the complete evidence-integrity specification. High confidence does not prove a purchase or booking succeeds. A COLLECTION_FAILURE is a SCAN ERROR, never evidence of poor restaurant operations.

## Scoring methodology

Weights were inspected and preserved; there are nine categories totaling 100:

| Category | Weight |
| --- | ---: |
| Digital customer journey | 15 |
| Website conversion | 15 |
| Phone response readiness | 15 |
| Reservations | 10 |
| Online ordering | 10 |
| Review/reputation | 10 |
| Local digital presence | 10 |
| Retention | 10 |
| AI automation readiness | 5 |

Known journey stages retain HEALTHY=90, FRICTION=60 and RISK=30. UNKNOWN and RESOLVED_UNVERIFIED transaction/operational stages are excluded. Available category weights are renormalized; omitted weight lowers evidence coverage, not the restaurant score. Public NAP and automation-information availability use distinct signal categories so repeated evidence cannot add weight. An owner-reported review rating is explicitly unverified and scaled from five stars; platforms are not scraped.

The score remains a heuristic public-site assessment, not measured conversion, revenue loss, or a statistically validated restaurant ranking. A high score with low coverage must not be sold as full operational health. Some legacy score-band and recommendation language remains broad; a complete owner-facing copy review is still required. The scoring change corrects uncertainty and duplication behavior; it is not an attempt to improve headline scores. Identical inputs were checked for reproducibility.

The existing scenario engine labels assumed volumes/ticket values and shows calculations. The report now uses “Illustrative Opportunity Scenarios.” No restaurant transaction data was supplied. Dollar values in the sample are **hypothetical scenarios, not losses, forecasts or guaranteed recoveries**. Do not use them as a sales promise. Optional AI narrative output and historical summaries need semantic review; JSON validation alone cannot establish factual correctness.

## Three-site validation scope

One public homepage per restaurant was captured on October 24, 2026 after reviewing its robots policy. No access restrictions were bypassed. Different builders were represented: SpotHopper, Sociavore and Wix. The captured HTML went through the real extractor, evidence normalizer, journey, scoring, prioritization and report builder. No database-backed full crawl, live transaction probe, owner interview or authenticated production UI test was run.

| Site | Evidence records | Heuristic score | Weighted coverage |
| --- | ---: | ---: | ---: |
| Leverock's Great Seafood — https://leverocks.com/ | 21 | 82 | 60% |
| BellaBrava multi-location site — https://www.bellabrava.com/ | 23 | 92 | 60% |
| Fourth Street Shrimp Store — https://www.theshrimpstore.com/ | 20 | 82 | 60% |

These are **development snapshot outputs**, not finished restaurant audits. BellaBrava's homepage represents multiple locations; its first extracted phone is not asserted to belong to St. Petersburg. Location-to-phone/menu/order binding needs manual review before a location-specific report.

### Manual factual sample

Selection was purposive: six high-confidence, directly observable records per homepage, emphasizing contact and customer-pathway presence. The raw captured markup was independently inspected, separately from accepting the application's classification. Link presence was checked; successful checkout/booking was not inferred. 18 of 18 selected presence facts matched the captured evidence; no discrepancy remained in this selected sample. This is not a statistical 95% accuracy guarantee and does not validate every record or every business conclusion.

| Site | Sample record IDs | Facts checked |
| --- | --- | --- |
| Leverock's | 3, 4, 5, 8, 11, 18 | Published phone; telephone link; hours; menu links; public email; newsletter invitation |
| BellaBrava | 1, 4, 9, 10, 11, 16 | Site title; a site-level phone; menu links; OpenTable links; Toast ordering links; FAQ link |
| Shrimp Store | 1, 4, 6, 8, 10, 15 | Site title; phone; hours; menu; food ordering; distinct gift-card destination |

Discrepancies found before repair included missing Leverock's email, image-delivery URLs classified as ordering, Toast gift cards mixed with food ordering and career URLs mistaken for contact. Added regression cases address these. Full population accuracy and high-impact business recommendations remain unverified.

Snapshot SHA-256 hashes (join the four groups; HTML is not committed):

```text
leverocks.html 99512301b8190922 9cb34f4ec7963fff 3d342e33f8a150a7 bec55009b253e023
bellabrava.html 27a860d29490f08f e8ef979c9039308b c1e6ab7523a88d6a d2b1c5804fcee50b
shrimpstore.html 56927806dbba812d 734fd9facc6412c8 eaee3f09a6a05c2f 8f8092792fe05750
```

## Security and dependency review

URL credentials and additional non-public/documentation address ranges are rejected. Existing per-hop DNS validation and socket-level rebinding protection remain in place. Robots rules are checked for each crawl redirect; policy fetches are bounded, cached and fail closed for ambiguous responses. HTML challenges are not interpreted as an empty policy. Robots redirects currently stop collection conservatively. Existing limits include five redirects, 2.5 MB page bodies and bounded script/probe scans. No authentication bypass is attempted.

The lockfile now installs reproducibly. Resolved Next.js is 15.5.28; Vitest is 5.0.5; Zod is 4.6.7. Explicit transitive overrides address PostCSS, selector-parser and deepmerge-ts advisories. Node >=22.12 is declared; validation used Node 24.22.1. `npm audit` reported zero known vulnerabilities after repair. This is an advisory-database result, **not a penetration-test certification**.

Preview builds and runtime refuse production database fallback. Both `RESCUE_PREVIEW_DATABASE_URL` and `RESCUE_PREVIEW_DIRECT_URL` must deliberately point to an isolated database before a preview build can migrate. No database schema changes were made in this branch. Runtime rate limiting remains per instance; distributed abuse protection, authenticated tenant isolation, logging/retention review, DNS-resolution budget behavior and dynamic-content prompt-injection testing remain release-review items. The optional AI provider has not been exercised with live credentials.

## Executed checks and reproducibility

- Clean `npm ci --ignore-scripts --no-audit --no-fund` and `npx prisma generate`: passed.
- Automated suite: 66 files, 1,450 tests passed. Database store tests use fakes; this does not prove live database behavior.
- Opt-in snapshot suite: 67 files, 1,451 tests passed, including the above suite and the three-site rendering/reproducibility test.
- `npm run build` and `npm run typecheck`: passed on the repaired code.
- `npm audit --json`: zero known vulnerabilities; `git diff --check`: clean.
- Real report component rendered with a fixture DTO: browser widths 360, 390, 800 and 1440 pixels, with evidence closed and expanded. Eight checks found no horizontal overflow. This is Chromium viewport emulation, not physical Android-device certification or a test of every application page.
- Leverock's development PDF: 11 pages, generated with the application's real React PDF component; every page rendered and visually inspected. No blank pages, cropped content or broken source wrapping observed in this sample. PDF is not tagged for accessibility. HTTP authentication/download and Android PDF viewer behavior remain untested.

From the app directory:

```sh
npm ci
npm test
npm run build
npm run typecheck
npm audit
SNAPSHOT_DIR=/absolute/captured-html VALIDATION_OUTPUT_DIR=/absolute/output npx vitest run --config scripts/validation.config.ts
```

For the opt-in layout check, install Playwright/Chromium in the development environment, then run `REPORT_HTML_PATH=/absolute/output/report.html VALIDATION_OUTPUT_DIR=/absolute/output node scripts/verify-report-layout.mjs`. An existing browser/runtime can be supplied through `CHROMIUM_EXECUTABLE` and `PLAYWRIGHT_MODULE`. This check uses a local file, not an authenticated server.

The optional snapshot script expects `leverocks.html`, `bellabrava.html` and `shrimpstore.html`. Capture current public pages with permission/robots review and modest request limits. Do not treat changed websites as identical regression fixtures. Run the build before rendering the HTML sample so compiled CSS exists. The sample is visibly marked DEVELOPMENT VALIDATION SAMPLE and must not be sent as a finished paid-client audit.

## Acceptance gates

| Founder criterion | Status | Evidence / remaining requirement |
| --- | --- | --- |
| Zero known critical defects | Not established | Authenticated live/preview flows and operational controls not fully exercised |
| Zero high-severity factual errors in validated cases | Partial | Selected static facts corrected; full scans and customer workflows outstanding |
| ≥95% verified high-confidence factual accuracy | Partial | 18/18 purposive presence checks only; larger complete review required, no statistical guarantee |
| No fabricated findings or revenue guarantees | Partial | Deterministic corrections and scenario labels; historical/AI narratives and all business copy need review |
| All critical links and exports tested | Blocked | Component PDF works; authenticated HTTP export and customer-side links require preview |
| No severe mobile defects | Partial | Report component passed four viewport sizes; intake/status/other pages need end-to-end review |
| Reproducible identical-input scoring | Passed locally | Regression and three-site repeated-input checks |
| No unresolved critical/high security vulnerabilities | Not established | Dependency audit clean; application/tenant/operational review incomplete |
| Professional demonstration and sample report | Partial | Development sample available; live demo not established |
| Limitations and operating instructions documented | Passed | This assessment and release procedure below |

No readiness percentage is assigned. The acceptance gates do not support a client-ready declaration.

## Preview, mobile review and production approval procedure

1. On the repair PR, review the defect ledger and changed files from phone/tablet. Keep the PR in draft and production on the existing deployment.
2. Through the authorized Vercel/database interfaces, provision or select a genuinely isolated preview database. Set preview-only `RESCUE_PREVIEW_DATABASE_URL` and `RESCUE_PREVIEW_DIRECT_URL`; keep credentials out of chat and git. Do not reuse live data without separate approval. No paid resource creation is authorized by this repair.
3. Provide an authorized application login through the supported secure account flow. Deploy this branch to preview after isolation is verified. A branch preview may fail closed until these settings exist; that is intentional.
4. Run three complete audits, starting with Leverock's. Check state transitions, persisted evidence/source timestamps, scan errors, repeatability and report reload. Review every high-impact finding against current customer-visible pages without submitting orders or bookings. Expand the factual sample and record all discrepancies.
5. On Android phone/tablet and desktop, test intake, history, detail, report, expand/collapse, links and actual PDF downloads. Inspect PDFs for short/long reports and failure cases. Verify no cross-client access and appropriate authenticated responses; review retention and logs.
6. Close the evidence-model, factual-copy, security and operational gaps above. Produce an updated acceptance matrix and a stable preview URL. Only then ask the founder for explicit production approval, identifying the tested commit and rollback target.

Production approval has **not** been requested or granted. Do not merge/deploy based on this assessment alone. After explicit approval, deploy the exact approved commit using the existing Vercel pipeline and verify smoke checks. Rollback is restoration of the previously working production deployment at `a54065e`; this repair introduces no database migration. Never run destructive migration resets to roll back. Preserve existing data and investigate before further changes if a release fails.
