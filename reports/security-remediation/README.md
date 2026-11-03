# Restaurant Rescue security remediation

Status: the four application/test blockers are remediated and Docker verification is complete. Release is on **HOLD**: final images retain 14 unique unfixed Debian high-severity CVEs (43 package/advisory findings per image). These findings have not received independent risk acceptance.

- Repository: `kebo3868-dev/Winnersbookmark-Incorporated-`.
- Baseline verified before changes: `969740c2655b064399e0cb4b8d514e9112145c8d`.
- Branch: `remediation/rescue-security-blockers-2026-11-03`.
- Application implementation commit: `4ff22b6c3fca1b0b1d5d8fbc39b58f4e898c3311`.
- Verification workflow correction: `9e21edd1d4171faa10b698ce6eb873fb7ed11b9a`.
- Browser-runner invocation and real-image startup verification: `c7b5b053f1953832f9d1ee711707890aa3a4e673`.
- Platform/tenant namespace separation: `b86b1f81d39391a742579005bc81dbe895b8ce17`.
- Runtime package-manager removal: `f7d93167a91b83e1cf62c403086ddfffb11b0f45`.
- Final application tree: `7ed64fc8b6c04414bee2c0e0841c23bdb566c6dd`. Evidence-only commits do not change this tree. The delivery message identifies the complete final commit SHA.

## Blocker evidence

| Blocker | Baseline reproduction | Remediation and verification |
| --- | --- | --- |
| Unauthenticated message audit writes | 25 anonymous POSTs produced 25 new audit rows against disposable PostgreSQL. | Database admission precedes parsing/credential work; denied messages coalesce by existing tenant, fixed reason and hour. A 250-request concurrent burst produces 120 authentication denials, 130 HTTP 429 responses, and one denial audit row with `attempts=120`. A wrong-tenant key remains refused and audited; a valid tenant message succeeds. |
| Administrator login bypass | A platform administrator still signs in after ten failed guesses; the baseline tenant-only counter has no platform protection. | Both login paths reserve source and account/source budgets before password verification. The same source is refused after ten account attempts; the owner can authenticate from another source. Refused attempts create no sessions, last-login updates or success audits. A rotating-address burst admits only 30 of 100 requests from one source. |
| Historical tenant 404 | A stored valid `2026-08-07T10:00Z` causes the baseline tenant loader to return null and the message route to return 404. | All three historical attestation fields accept UTC minute and second timestamps unchanged. Fractional seconds remain valid, as in Zod 3; fractional minutes, malformed dates/times, missing UTC markers and disallowed offsets remain rejected. The tenant loads and the real route reaches authentication, rather than an incorrect 404. 5,334 Zod 3 oracle comparisons have zero differences. |
| Browser E2E | Old report title and scenario assertions fail on the approved baseline behavior. Later `.first()` selectors also hit hidden disclosure/mobile content. | Verify the evidence-dependent `Executive Snapshot`, open the optional calculator, verify no invented monetary result, select the visible reputation limitation, and locate the newly created audit's lead in its visible table row. Complete browser flow passes, including PDF download. Report/UI production source was not changed. |
| Docker verification/storage | The retained baseline build log reports `ResourceExhausted: ... no space left on device`; its storage inventory shows 6.7 GB of VFS snapshots, including repeated 1–1.5 GB directories. | Both actual final images built successfully on an isolated runner with about 87 GB free; installed dependency audits, native Sharp, both migrators and real non-root startup passed. The whole-image scan is complete and remaining Debian findings are recorded below. No unrelated host cache, image or working file was deleted. |

Reproduction tests: [baseline](../../rescue-agent/tests-integration/baseline-reproduction.test.ts), [real PostgreSQL](../../rescue-agent/tests-integration/security.test.ts), [request protection](../../rescue-agent/tests/request-protection.test.ts). Local results: [baseline](local/baseline-three-blockers.log), [PostgreSQL](local/postgres-security.log), [browser](local/e2e-pass.log).

## Request and audit paths

| Reachable path | Authentication and write boundary |
| --- | --- |
| `/api/frontdesk/{tenant}/message` | Source admission → validated body → existing tenant → tenant key/operator verification. Authentication failure upserts one hourly reason summary. Success retains conversation ownership checks, message persistence, escalation/notification behavior and the individual `MESSAGE_HANDLED` audit. |
| `/api/frontdesk/sms/inbound` | Absent signature is refused without database work. Presented signature requires source admission, existing tenant and tenant-specific HMAC before any conversation, consent or message writes. Invalid credentials retain bounded hourly failure accounting. |
| `/api/frontdesk/{tenant}/sms/twilio`, `/voice/twilio-status` | Absent signature is refused without database work. Source admission precedes raw-body/tenant processing. Signature and destination-number tenant binding remain mandatory; event claims still deduplicate valid redeliveries. |
| `/api/frontdesk/notifications/webhook` | The configured provider's signature scheme determines credential presence. Presented credentials require source admission. Invalid signatures retain bounded failure summaries; valid delivery events use the existing pipeline. |
| `/api/frontdesk/notifications/cron`, `/dispatch`, server actions and demo routes | Existing scheduler/operator/session authorization remains mandatory before outbound messaging or demo writes. Unauthenticated cron failures already use bounded `noteRejection`; missing credentials write nothing. No new public route or middleware exemption was added. |
| `/api/frontdesk/auth/login` | Source admission applies to every request. Existing tenants use their database id for account namespaces; administrators use the platform namespace. Normalized email plus canonical source determines account admission without revealing whether an account exists. Password verification remains side-effect-free. |
| `/api/frontdesk/auth/logout` and other protected tenant/operator surfaces | Existing session/operator authorization remains unchanged. Forged sessions cannot authorize writes. Operator Basic Auth remains the separate existing app-wide credential boundary. |

`FdSecurityBucket` reuses a fixed primary key across windows: at most 65,536 slots per code-defined source namespace or existing-tenant account namespace. Raw IPs, emails, credentials and caller-generated request ids are not stored in these counters/denial summaries. Keyed hashing prevents outsiders from calculating deliberate slot collisions. Atomic PostgreSQL conflict handling caps increments under concurrency and never moves a window backwards. Historical audit rows have null dedupe keys and remain intact; no historical record is deleted or rewritten. Only new denial summaries increment `attempts`.

## Test results

| Verification | Local result |
| --- | --- |
| Clean locked install / Prisma generation | Pass after selecting a writable task-specific npm cache |
| Committed application full suite | **2,451 passed**, 98 files, zero failures/skips; repeated on final source in CI |
| Focused authorization/security suite | **402 passed**, 12 files |
| Real PostgreSQL security/concurrency suite | **8 passed** |
| Exact-baseline exploit reproductions | **3 passed**, confirming all three vulnerable behaviors |
| Typecheck | Pass |
| Production build | Pass locally and inside the actual final Docker build |
| Stored Executive/Sales loaders, HTML, PDF text and page rasters | Pass; both audits preserved |
| Zod oracle | **5,334 comparisons, zero differences** |
| Browser E2E | **1 passed**, Chromium, real production server and disposable database |
| Stored-report browser output comparisons | **8/8 surfaces reproduce exact baseline hashes across repeated captures**, 360/1280 px, compiled CSS identical, no horizontal overflow; paint variance retained below |
| Application full and production dependency audits | **0 findings** |
| Locked Prisma migrator dependency audit | **0 findings** |
| Packaged standalone Sharp / full Next AVIF pipeline | Native optimization succeeds: 256×128 → 64×32, no fallback |
| Actual final image package audits | **0 findings**; 70 physical application packages and 35 physical migrator packages |
| Whole-image Trivy language-package scan | **0 findings** in both final images |
| Actual image health / administrator login / generated Prisma client | Pass; database up, authenticated administrator, correct additive client model |
| Patch integrity / untouched report and fixture sources | Pass |

The stored fixtures remain **84/100 and 73/100, both 80% coverage**. Executive and Sales Brief DTOs and HTML are byte-identical; PDF extracted text and all **29 page raster hashes** match. PDF metadata timestamps are excluded. [Comparison hashes](local/output-comparisons.json) and [browser comparisons](local/browser-comparisons.json) contain no rendered client payloads. All eight browser surfaces reproduce their exact original baseline hash across repeated final captures using separately compiled, byte-identical CSS. Individual screenshot batches have intermittent small paint differences, including on an unchanged baseline repeat; they are not claimed to be consistently pixel-identical batches. Existing scoring, evidence, report wording, 30-day plans, PDF rendering, Sales Brief, fixture and dependency-lock source paths have no diff from the specified baseline. Docker changes remove unused global package managers and run the migrator as the existing non-root user.

### Failures and repeats

- Initial `npm ci` could not write its default home-directory cache; retry using `/tmp/rescue-npm-cache` succeeded without changing the lockfile.
- The first PDF capture could not spawn `pdftotext` under the restricted command sandbox; the supported execution permission resolved it and both captures passed.
- A baseline full suite from a Git archive had **2 failures / 2,432 passes**, because an archive has no Git metadata. The affected **24-test file passed** in a detached worktree at the exact baseline. These are harness failures, retained in the evidence.
- An exploratory test process was discarded because files changed while it was running. Only the later frozen/committed-source results are used for remediation verification.
- Initial new route tests had three failures because their fixture omitted configured operator authentication. Configuring the realistic boundary resolved them. One PostgreSQL assertion expected 403 instead of the existing cross-tenant 401; the API's non-enumerating 401 was preserved and the assertion corrected.
- Browser iterations exposed the stale heading, collapsed calculator, hidden first reputation match, and hidden first mobile lead match. All intermediate failures are retained; the final test opens the disclosure and binds the visible lead assertion to the newly created audit.
- Final full-page screenshot batches had intermittent small paint variation: one 360 px historical report capture differed by 104 pixels, including 88 pixels in a three-pixel-high region and 16 right-edge pixels. An unchanged baseline repeat also varied at right-edge pixels. Repeated final captures reproduced the exact original baseline hash for every one of the eight surfaces. HTML, compiled CSS, dimensions, PDF text and all PDF page rasters remained identical. [Pixel-region evidence](local/browser-paint-variation.json) and all capture hashes are retained; no pixel tolerance or masking was applied.
- Initial isolated CI passed full tests, typecheck, dependency audits, migrations and PostgreSQL checks, then failed because `git archive` ran from the application subdirectory. The workflow now archives from the repository root. Hidden evidence artifact inclusion was also corrected. [Failed run](https://github.com/kebo3868-dev/Winnersbookmark-Incorporated-/actions/runs/41708564152).
- The second isolated run also passed baseline reproductions, report comparisons and production build, then could not find the separately installed Playwright binary through npm's normal PATH. CI now invokes that installation directly. [Failed run](https://github.com/kebo3868-dev/Winnersbookmark-Incorporated-/actions/runs/41709179031). The GitHub CLI's artifact redirect was refused by the command proxy; the connected GitHub artifact download successfully retrieved the same evidence.
- The first successful broad image scan found ten high-severity findings in global npm tooling, in addition to Debian findings. A separate pinned npm 12.2.1 trial still produced one high and 33 moderate package entries, so it was not shipped. Both runtime targets instead remove unused npm/Corepack/Yarn; the application and locked Prisma CLI run directly with Node. Their physical inventories are exported from the actual images and audited on the verification host. Original tool-containing image scans remain in `image-tooling-before/`.

## Docker verification

**Completed successfully:** [final isolated verification run](https://github.com/kebo3868-dev/Winnersbookmark-Incorporated-/actions/runs/41713071822), source `f7d93167a91b83e1cf62c403086ddfffb11b0f45`. Earlier successful complete runs: [application/image checks](https://github.com/kebo3868-dev/Winnersbookmark-Incorporated-/actions/runs/41710279789), [namespace correction](https://github.com/kebo3868-dev/Winnersbookmark-Incorporated-/actions/runs/41711553277). Full final [CI log](local/ci-final-complete.log), [summary](verification-summary.json), and [raw artifacts](final-image/) are retained in Git. The final evidence-only commit has the identical application tree.

The workflow builds the actual final application and locked migrator targets, inventories/audits their installed packages, runs the full native Sharp/Next AVIF probe in the application container, exercises both real Prisma migrators against the disposable database, starts the final image through its actual entrypoint, checks health and administrator login, verifies the generated client schema, and scans both images with Trivy for OS and package findings. It publishes evidence artifacts only; it has no image-push, merge or deployment action. The isolated runner has a 145 GB filesystem with approximately 87 GB free before verification.

| Actual final image | Image ID (Linux amd64, Node 22.23.4, user `nextjs`) |
| --- | --- |
| Application | `sha256:d47d8734044f0f1cfa4add65fed546cd3a7ebb02d87b40cc492fc45c93d79928` |
| Locked Prisma migrator | `sha256:d4c943fe6c2c232525dada4ad59f8d1afa9743ccd67cf17ff3282894617b5223` |

Both installed-package audits and Trivy's Node package scans have zero findings. Native Sharp reports libvips 8.18.7, libheif 1.23.5 and aom 3.15.1; Next's complete AVIF pipeline produces a 64×32 optimized output with `fallback=false`. Both real migrators succeed; the real entrypoint starts the server, health reports `database=up`, administrator login succeeds, and generated Prisma metadata contains `dedupeKey`, `attempts` and `FdSecurityBucket`. See [image metadata](final-image/images.json), [AVIF](final-image/image-sharp.json), [health](final-image/image-health.json), [startup](final-image/image-server.log), and [migrator](final-image/migrator-image-migrations.log).

The **raw OS scan per image** reports **1 critical / 43 high / 130 medium / 150 low / 1 unknown** package/advisory entries. Counts are not deduplicated CVEs. The 43 high entries represent **14 unique CVEs**: 30 entries have `affected` status and 13 `fix_deferred`, with no fixed Debian version listed. They are not suppressed or described as resolved. These remain a release blocker. Raw reports: [application](final-image/trivy-app.json), [migrator](final-image/trivy-migrator.json).

The critical entry is CVE-2023-45853 against `zlib1g`. Debian's [official tracker](https://security-tracker.debian.org/tracker/CVE-2023-45853) states that the affected MiniZip code is not built/provided in Bookworm's zlib binaries: "no binary package built by the vulnerable source is affected". The actual [installed OS package inventory](final-image/image-os-packages.tsv) contains no MiniZip package. This supports a **not affected** disposition for this specific critical result; the raw finding remains present for independent review. [Vendor evidence](debian-zlib-disposition.txt).

Original ENOSPC evidence: [build failure](../dependency-remediation/before/docker-build-transport.log), [VFS inventory](../dependency-remediation/before/docker-storage.log). Current session: [filesystem](local/filesystems.log), [daemon inventory](local/docker-storage.log). A successful standalone probe is supplemental evidence and is not labeled as an actual-image verification.

## Files changed and reasons

The complete per-file inventory is in [files-changed.json](files-changed.json). Imported text logs have carriage returns, trailing spaces and final blank lines normalized; raw audit/scan JSON is retained unchanged.

| File(s) | Reason |
| --- | --- |
| `.github/workflows/rescue-security-review.yml` | Isolated storage gate, all regression checks, exact-baseline comparisons, browser E2E, actual-image audits and native/OS verification; safe evidence retention |
| `.gitignore` | Keep rendered local client payloads and the temporary reports dependency symlink out of Git |
| `rescue-agent/.env.example` | Document required trusted-ingress source identity and stable shared collision-protection secret |
| `rescue-agent/Dockerfile` | Remove unused vulnerable global package managers from the application and migrator runtime filesystems; retain build tools in build stages and run both runtime targets as `nextjs` |
| `rescue-agent/scripts/audit-runtime.mjs` | Export/import actual physical package inventories so the runtime images do not need npm to be audited; preserve the existing direct audit mode |
| `rescue-agent/prisma/schema.prisma`, `prisma/migrations/20261103194500_request_protection/migration.sql` | Add bounded reusable admission buckets and optional denial-summary keys/counters without deleting historical data |
| `src/lib/frontdesk/security/throttle.ts` | Canonical source identities, keyed bounded slots, atomic cross-worker admission and fail-closed behavior |
| `src/lib/frontdesk/auth/store.ts` | Coalesced message-auth denial recorder; existing individual authorized audits retained |
| `src/app/api/frontdesk/[tenantSlug]/message/route.ts` | Enforce admission and bounded denials while preserving the existing authorized messaging pipeline |
| `src/app/api/frontdesk/[tenantSlug]/sms/twilio/route.ts` | Throttle presented-credential requests before processing |
| `src/app/api/frontdesk/[tenantSlug]/voice/twilio-status/route.ts` | Same protection for public call-status callbacks |
| `src/app/api/frontdesk/sms/inbound/route.ts` | Same protection for the tenant-HMAC inbound bridge |
| `src/app/api/frontdesk/notifications/webhook/route.ts` | Same protection for the configured delivery-callback scheme |
| `src/app/api/frontdesk/auth/login/route.ts` | Apply source/account admission before password work for administrator and tenant logins; remove the global victim-account lockout |
| `src/lib/validation/zod.ts`, `src/lib/frontdesk/config/schema.ts` | Restore only the verified historical UTC minute timestamp compatibility |
| `tests/request-protection.test.ts` | New trust, failure, session, normalization, tenant-loader and timestamp regressions |
| `tests/frontdesk-unauth-writes.test.ts` | Replace 20 obsolete counter/lockout assertions with the new admission suite; retain other unauthenticated-write guards and adapt their SQL double |
| `tests/pilot-enablement.test.ts` | Admit requests through the SQL test double so the existing signed-provider tests continue exercising their intended boundary |
| `tests-integration/security.test.ts`, `security.config.mts` | Actual PostgreSQL abuse, boundary, concurrency, session, storage and tenant-isolation tests |
| `tests-integration/baseline-reproduction.test.ts`, `baseline.config.mts` | Independently execute and prove the three baseline vulnerabilities |
| `tests-e2e/audit-flow.spec.ts` | Assertions for independently verified disclosures, evidence-based labels and visible audit-specific lead |
| `reports/dependency-remediation/preservation.test.ts` | Select the exact-baseline reference directory; compare hashes so failed assertions cannot print client report payloads |
| `reports/dependency-remediation/zod-compatibility.test.ts` | Extend the legacy oracle to historical minute/fraction cases and select an isolated evidence directory |
| `reports/security-remediation/**` | Review report, reproduction logs, audit results and output/image evidence |

Paths abbreviated under `src/`, `tests/` and `tests-integration/` in this table are relative to `rescue-agent/`.

## Release boundary and remaining risks

- **Release blocker:** unresolved Debian high-severity findings from the whole-image scan. Vendor status/fix availability and the MiniZip critical false positive require explicit independent disposition. A successful verification workflow is not a vulnerability-free-image claim. No advisory ignore file, severity filter, or finding suppression was used.
- Production must explicitly configure a single-IP header overwritten by a trusted ingress, block direct origin access, and share a stable random `FRONTDESK_THROTTLE_SECRET` of at least 32 characters across workers. Missing/invalid protection configuration fails closed with 503. No production ingress configuration was inspected or modified.
- Fixed windows can admit up to twice the budget across a boundary. Source login admission is 30/minute; account/source admission is 10/15 minutes; inbound message admission is 120/minute. Account budgets are scoped by tenant and source to avoid remote account-wide denial of service. Distributed guessing across independent sources remains a tradeoff; this change does not claim botnet-wide prevention or introduce MFA.
- Sources behind one NAT share its source budget. IPv6 privacy addresses share a /64; IPv4-mapped IPv6 is normalized to its IPv4 identity. Secret-keyed slot collisions can conservatively share a budget, but cannot cross tenant account namespaces or disclose tenant data.
- The additive migration takes normal PostgreSQL DDL/index locks. Its production duration depends on the existing audit table size and needs release scheduling review. Verification used only disposable PostgreSQL; no production data was changed.
- Dependency findings are point-in-time results. The isolated Zod 3 package is a test oracle outside the application's dependency tree and is never shipped. Report comparisons cover the two committed historical/current fixtures, not every production audit.
- Recommendation: **HOLD release** for independent review and disposition/remediation of the unresolved Debian high-severity findings. All requested verification has completed; these OS findings remain uncleared. Nothing has been merged or deployed, and this report grants no client-readiness approval.
