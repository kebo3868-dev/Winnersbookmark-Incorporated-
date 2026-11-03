# Independent-review blocker remediation — 2026-11-03

Ready for independent review. No merge, deployment, production request, production database access, or production configuration change was performed.

Repository: `kebo3868-dev/Winnersbookmark-Incorporated-`.
Branch: `remediation/rescue-dependencies-2026-11-03`.
Reviewed parent: `969740c2655b064399e0cb4b8d514e9112145c8d`.
The final 40-character commit SHA is supplied in the completion message; a commit cannot embed its own SHA.

## Checkout verification

`/workspace` had no Git checkout. A fresh single-branch clone was created at `/workspace/winnersbookmark`. Its origin, branch, clean working tree and exact reviewed HEAD were verified before modifications. The remote branch was still at the reviewed parent before committing. No unrelated checkout, data or cache was overwritten or deleted.

## Changes

- **Rejected messages:** replace per-request `FdAuditLog.create` with existing atomic rejection coalescing. Requests without credentials write nothing; failed presented credentials produce at most one `FdFailure` row per existing tenant / fixed reason / hour. Caller-controlled tokens, messages and request IDs cannot fragment the key. Wrong-tenant probes remain operator-visible, and authenticated messages retain their success audit records.
- **Administrator login:** apply the existing ten-failures-per-account-per-hour policy to administrators too. `FdAdminLoginCounter` uses a non-null unique `(subject, windowStart)` key and atomic increments; immutable account IDs and one unknown-account subject bound cardinality. Tenant counters and their history are unchanged. Password verification still precedes the lockout check, which precedes session creation. Refusals remain generic. The additive migration is `20261103220000_administrator_login_counters`; it has been applied only to disposable local databases. A future authorized release must apply this migration before using the updated application.
- **Timestamp compatibility:** the three pilot attestation fields accept UTC minute precision, whole seconds and fractional seconds, preserve the original stored string, and still reject invalid dates, times, offsets, missing timezone and malformed input. Validation expands only a minute-precision copy before strict Zod 4 ISO validation. No Zod downgrade, permissive `Date.parse`, data rewrite or security-fix reversal.
- **Browser E2E:** pin the verified mixed-evidence headings and visible scope note; target the new audit's visible desktop lead row instead of hidden responsive markup. Exercise the closed calculator, withheld result until all inputs are supplied, intake-derived ticket prefill, exact arithmetic, disclaimers, PDF signature and lead-to-audit linkage. No assertion was skipped or relaxed into mere presence.
- **Reproducibility:** extend the Zod 3 oracle with timestamp cases, allow independent report-comparison phases, resolve evidence paths relative to the harness, and retain a loopback-only live blocker-check script.

Dependency manifests, lockfiles, Dockerfile, scoring, collection, evidence provenance, report generators, report pages, PDF code and stored fixtures are unchanged from the reviewed commit.

## Verification

Evidence is in [`review-verification/`](review-verification/). Rendered report payloads, screenshots, database data and credentials are not included in Git.

| Check | Result |
| --- | --- |
| New regression reproduction before fixes | **12 failures**, 112 passes; demonstrates the message, administrator and timestamp regressions |
| Focused regression suite after fixes | **124/124 passed**, two files |
| Full application suite | **2,496/2,496 passed**, 98 files, no failures/skips |
| Typecheck | Passed |
| Production build | Passed locally on Node 24.19.0; Docker independently builds on Node 22 with npm 10.9.9 |
| Zod 3 compatibility oracle | **5,461 comparisons, zero differences**, including added timestamp cases |
| Report preservation harness | **3/3 passed**, current and historical fixtures through real authorized loaders, HTML and PDF routes |
| Committed browser E2E | Original assertion failure reproduced; final test **1/1 passed** against the Docker image and disposable PostgreSQL database |
| Live message accounting on final image | 40 concurrent unsigned requests: no writes; 40 concurrent varied forged keys: one failure row, attempts 40, no audit rows; authenticated request succeeds and is audited; cross-tenant key refused |
| Live administrator authentication on final image | Ten wrong passwords across normalized email variants lock out the correct password without another session; unrelated administrator still signs in; 25 concurrent unknown addresses share one persisted counter |
| Live tenant authentication on final image | Same ten-failure lockout, no refused session; same email at a different tenant remains independent |
| Docker final image | Built successfully; `nextjs` user, 471,037,714 bytes; local tag only, not pushed |
| Actual image migrations / health | All **15 migrations** applied to fresh PostgreSQL 16; database `up`; zero schema drift; second deployment has no pending migrations |
| Actual image AVIF optimization | Passed full Next image pipeline, 256×128 → 64×32, **optimized true, fallback false** |
| Patch integrity | `git diff --check` passed |

The test commands use `--maxWorkers=2 --testTimeout=30000`. An initial installation attempt could not write npm's home cache; installation succeeded with a task-local workspace cache. The first report-harness attempt exposed its dependence on the caller's working directory and a missing test-only Zod reference; those harness issues were corrected and the complete comparison passed. Intermediate browser locator failures were corrected without skipping checks. These are not presented as passing attempts.

### Current and historical reports

The baseline was captured from the reviewed application before source changes. Current score **84**, historical score **73**, coverage **80%** for each. The full Executive Report and Sales Brief DTOs and HTML are byte-identical. PDF extracted layout text and **all 29 page raster hashes** match. Fixture contents remain unchanged. Non-rendered PDF metadata timestamps are outside the equality comparison. This verifies the two committed fixtures, not every historical or production record.

Eight browser captures at 360 and 1280 pixels have matching dimensions and no horizontal overflow. Seven screenshot hashes match; the historical mobile Sales Brief differs by 16 painted pixels at the right edge. Repeating the unchanged baseline also produces an 88-pixel paint variation on a historical report. **Exact screenshot byte equality is not claimed**; HTML, DTO, PDF text and PDF raster equality are asserted independently. The pixel comparison is retained as `browser-comparison.json`.

### Dependency audit counts

Counts are npm advisory package entries. All five audits completed successfully.

| Audit | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Application production lock closure | 0 | 0 | 0 | 0 |
| Full application dependency tree | 0 | 0 | 0 | 0 |
| Locked migrator closure | 0 | 0 | 0 | 0 |
| Actual image runtime: 70 physical packages | 0 | 0 | 0 | 0 |
| Actual image migrator: 35 physical packages | 0 | 0 | 0 | 0 |

These are npm/Node package audits and a native-codec functionality check, not an operating-system vulnerability scan or a guarantee against unknown advisories.

### Docker disk assessment and result

The current environment has a 32 GB filesystem with roughly 30 GB free initially, rather than the earlier 8 GB filesystem. Docker was healthy, using VFS, with no pre-existing images or containers. Free space was monitored during the build and remained about 19 GB at completion. No pruning or deletion of unrelated caches/data was needed.

An initial Buildx attempt failed because `/home/agent/.docker/buildx` is read-only. Retrying with `BUILDX_CONFIG=/workspace/.buildx-review` preserved Docker credentials and daemon configuration and succeeded. Proxy configuration and TLS verification remained enabled, with the supplied CA mounted only where needed. No ENOSPC occurred in the successful run.

Verified image: `sha256:77e1c487e5f5f8cc3904cce820e75cbdd3f4554795f9ee88dbcfa5e7a92986ff`.

## Reproduction

Install the application's committed dependencies with `npm ci`, run `prisma generate`, then the focused tests, full suite, `npm run typecheck`, `npm run build`, and production/full `npm audit --json`. Audit `docker/migrator` separately. Supply a writable task-local npm cache if the home directory is read-only.

For report comparisons, capture the reviewed parent with `REPORT_PHASE=review-before` and run the changed application with `REPORT_PHASE=review-after REPORT_COMPARE=1 REPORT_BASELINE_PHASE=review-before`, using `vitest run --config ../reports/dependency-remediation/verify.config.mts` from `rescue-agent`. Install a separate test-only Zod 3.25.76 reference and supply `ZOD3_REFERENCE`; make `reports/node_modules` resolve the application's dependencies. Browser capture also needs the separately installed Playwright module and Chromium. Keep rendered payloads local.

Build the existing Dockerfile with BuildKit, supplying the proxy CA as described in the preceding report when applicable. Run the image against a **fresh disposable local database**, with the local-only message exposure flag enabled for the accounting checks. `verify-blockers.mjs` requires loopback API/database URLs and database name `review` or `review_image`; it seeds isolated fictional fixtures and should not be run on a database containing real users. Run the committed Playwright test with local `E2E_BASE_URL`, operator credentials and `PW_CHROMIUM`. Execute the existing `audit-runtime.mjs` for `/app` and `/app/migrator`, and `verify-standalone.mjs` for `/app`, inside the actual image.

## Remaining blockers and boundary

No required verification remains incomplete and no implementation blocker remains among the five requested findings. Exact browser screenshot equality is the explicitly qualified comparison above. Independent review is still required. Production functionality, production data and operating-system CVEs were not inspected, and production was not changed. The image and databases used here are local verification artifacts only.
