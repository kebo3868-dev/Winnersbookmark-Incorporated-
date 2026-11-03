# Dependency remediation results

**Decision: READY FOR INDEPENDENT REVIEW.** This is not permission to merge or deploy, and is not a new approval of PR #77's restaurant-audit logic.

Repository: `kebo3868-dev/Winnersbookmark-Incorporated-`.

- Branch: `remediation/rescue-dependencies-2026-11-03`.
- Authorized source of truth: `07198e3f3eb2b11a6e707c6ee8dcbb0795d24c01` (PR #77).
- Pre-fix evidence commit, pushed before application changes: `1c475223feaaeed48acfba0ce2463b45118e9d1f`.
- Final commit: the branch head containing this report; its exact SHA is provided in the delivery message. A commit cannot embed its own SHA.
- Verified local image: `sha256:06b04789aca71858e691012ebc117a4ac6e335727b2095ff7fb9772a7f56ff15`, tag `wbi-rescue:remediated`, Linux amd64, non-root `nextjs`, 471,027,679 bytes. The image was not pushed.

The unavailable `75a37dc` sandbox commit/report was not assumed to be integrated. This work starts from the replacement source explicitly authorized by the user. All 96 original test files remain unchanged; six new regressions were added. The original source therefore has 2,428 tests, not the lost sandbox's reported 2,445.

## Findings and fixes

| Blocker / root cause | Remediation | Evidence |
| --- | --- | --- |
| Vulnerable production dependency closure: Next 15.5.20, Sharp 0.34.5, undici 8.9.0 / Cheerio's 7.29.0, Next's pinned PostCSS 8.4.31, nanoid 3.3.15, source-map-js 1.2.1 | Next 15.5.28; explicit Sharp 0.35.5 and matching override; undici 8.12.3, scoped Cheerio override 7.30.1; PostCSS 8.5.32 override; patched nanoid 3.3.20 / source-map-js 1.2.2. Compatible lock updates, no force upgrades or audit suppressions. | `after/versions.json`, production/full audits, actual-image inventory audits |
| Docker's fresh `npm install --no-save prisma@6.19.3` ignored root lock/overrides, leaving Prisma → @prisma/config → deepmerge-ts 7.1.5 exposed | Dedicated `docker/migrator/package.json` and committed lock, Prisma 6.19.3 with deepmerge-ts 8.0.2 override, installed by `npm ci --omit=dev` in a build stage and copied with its complete dependency closure | Actual image migrator: 35 physical packages, zero findings; 14 real migrations, zero drift, idempotent reapplication |
| Zod 3.25.76 remains affected by GHSA-mrhx-c7xc-m3w5 (`<4.6.6`); no secure compatible v3 release was found | Full Zod 4.6.7 migration; two-argument record schema; complete messaging default including `emailEnabled: false`; application message map; integer checks preserve the existing domain/error order; redundant type/length messages are normalized on the public enquiry response | Original v3 schemas evaluated from the exact Git source: **4,572 comparisons, zero differences** in accepted data/defaults and presented messages. Existing generic schema snapshot also identical. New security regression shows oversized constrained arrays reject before element validation. |
| Sharp 0.35's dynamic native `versions` exports were omitted by standalone tracing | Include `node_modules/@img/**/versions.json` in output tracing; retain the secure Sharp/native binaries | Actual image reports libvips **8.18.7**, libheif **1.23.5**, aom **3.15.1**. Full Next image pipeline optimizes AVIF, without fallback. |
| Development critical findings in Vitest 3.2.7 / tinypool 1.1.1, plus vulnerable Vite/browser/CSS tooling | Vitest 4.1.12 removes tinypool; explicitly select patched Vite 7.3.7 to retain the existing TSX transform behavior; browserslist 4.29.5, baseline-browser-mapping 2.11.35, postcss-selector-parser 6.1.5 | Full dependency audit: zero findings; full suite and focused regressions pass |
| The declared Node minimum permitted versions incompatible with undici | Declare Node `>=22.19.0`, matching the actual dependency requirement; CI and Docker remain on Node 22 | Node 22.23.4 / npm 10.9.9 verification, clean installs and production builds |
| Repeated VFS snapshots exhausted the managed builder's small disk | Share a base stage, bind dependency modules during build, assemble the runtime in one layer. Clear only unused trial cache; retain daemon driver/data directory and safety configuration. | Successful complete Docker build in `after/docker-build-verified.log` |

Zod's security behavior is deliberately improved: a constrained array containing 10,000 elements with a limit of two previously visited all 10,000 elements before rejection; Zod 4 visits **zero**. It rejects the same oversized input. No legacy Zod parser is imported by the application. The separate Zod 3 installation is a test oracle only.

The integer adapter preserves existing validation, including integer-valued JS numbers above `MAX_SAFE_INTEGER`; it does not remove any pre-existing min/max limits. No new threshold or scoring policy is introduced.

## Before and after audit counts

Counts are npm audit **package entries**, including affected parent entries, not deduplicated CVEs. The earlier inaccessible sandbox summary is not reused as a scan result. Full raw advisory ranges and dependency edges are retained in the pre-fix report and audit JSON files.

| Environment | Before C / H / M / L | After C / H / M / L |
| --- | --- | --- |
| Application production lock closure | 1 / 9 / 0 / 0 | **0 / 0 / 0 / 0** |
| Development-only difference from full tree | 2 / 2 / 3 / 0 | **0 / 0 / 0 / 0** |
| Full application dependency tree | 3 / 11 / 3 / 0 | **0 / 0 / 0 / 0** |
| Retained baseline standalone bundle → actual final image application packages | 1 / 4 / 0 / 0 | **0 / 0 / 0 / 0** |
| Docker-equivalent Prisma installation → actual final image migrator | 0 / 3 / 0 / 0 | **0 / 0 / 0 / 0** |

The original Docker image could not be completed during the baseline trial. Its Prisma command was reproduced in isolation; the retained original standalone bundle was audited later without rebuilding or modifying it. Neither is mislabeled as an original-image audit. The **after** Docker audits inspect the actual built image: 70 physical application packages and 35 physical migrator packages. `audit-runtime.mjs` constructs its audit inventory from installed package files rather than trusting the root manifest. Source-lock audits additionally cover modules bundled by webpack.

No unresolved npm advisory findings remain in these environments. Original chains, affected ranges and reachability/risk discussion are in `01-isolated-trial.md`, `before/audit-*.json`, and `before/locked-inventory.json`.

## Verification results

| Required verification | Result |
| --- | --- |
| Clean installation and Prisma generation | Pass, npm 10.9.9 on Node 22.23.4; also installed afresh inside Docker |
| Complete Rescue Agent test suite | **2,434 / 2,434**, 97 files, zero failures/skips (`after/tests.log`) |
| Focused security regressions | **324 / 324**, 11 files (`after/security.log`) |
| Typecheck | Pass (`after/typecheck.log`); final image build also checks types |
| Production build | Pass, Next 15.5.28; complete final Docker production build passes |
| Report preservation + Zod oracle harness | **3 / 3**, with **4,572** detailed Zod comparisons and zero differences |
| Actual Docker image application audit | **Zero findings**, 70 physical packages |
| Actual Docker image migrator audit | **Zero findings**, 35 physical packages |
| Standalone metadata and AVIF | Pass, full Next pipeline; fallback explicitly excluded |
| Real migrator / entrypoint | All **14 migrations** applied to a fresh disposable PostgreSQL 16 database; app started under `nextjs` |
| Database health | HTTP response `{"status":"ok","database":"up"}` |
| Migration schema comparison | `No difference detected.`, exit 0 |
| Second migration deployment | `No pending migrations to apply.`, exit 0 |
| Whitespace / patch integrity | `git diff --check` passes |

Test commands use `--maxWorkers=2 --testTimeout=30000`. The larger timeout accommodates this environment's unresolvable-host DNS lookup. No test is skipped or removed. Vitest 4 no longer accepts the old `--minWorkers` command option.

Build/test log carriage returns and trailing whitespace are normalized for Git; result text is retained. Audit JSON is unchanged. Original terminal logs are also retained locally in `/tmp/wbi-original-verification-logs.tar`.

### AVIF proof

The final check calls **Next's full `imageOptimizer`**, including its codec-safety gate and error fallback. Merely calling `optimizeImage` below that gate would not establish this.

- Controlled reproduction: remove only native `versions.json` metadata from an isolated copy with patched Next/Sharp. Next treats the missing libheif version as unsafe and returns the **unchanged 256×128, 294-byte AVIF**, `optimized: false`, `fallback: true`.
- Actual final image: libheif 1.23.5 is reported, the decoder is safely enabled, and the same input becomes **64×32, 289 bytes**, MIME `image/avif`. The output differs from the input, its ETag differs from the upstream ETag, and there is no fallback error: **`optimized: true`, `fallback: false`**.
- Output SHA-256: `186ef201fd16b53992e035d48d81427e141fa8aeb575278d3b9c17401006fbf4`.

See `after/avif-missing-metadata-reproduction.log` and `after/image-avif.log`. No decoder safety gate was disabled or bypassed.

### Rendered reports and stored data

Both stored local-verification fixtures pass through the real authorized Executive Report loader, Sales Brief loader, report page, Sales Brief page, and PDF route, over a read-only database double that throws on unexpected operations. Comparisons include the full report DTOs, not only status codes.

- **Current: 84/100, coverage 80%. Historical: 73/100, coverage 80%.** Both DTO score presentations explicitly checked.
- Executive and Sales Brief DTOs: exact equality for both audits.
- Report and Sales Brief HTML: byte-identical for both audits.
- PDFs: extracted layout text identical; **all 29 page raster hashes match** (15 current + 14 historical). Only non-rendered PDF metadata timestamps are outside comparison.
- Browser: eight captures at 360 and 1280 px, with no horizontal overflow. Seven original screenshot hashes match directly. One original mobile capture differs by **88 painted pixels** in a three-pixel-high region; independently rendering the **unchanged baseline** reproduces exactly the remediated capture. All eight remediated captures exactly match that repeated baseline. HTML, compiled CSS, dimensions and layout are unchanged; this is capture paint variation, not a changed report.
- Original fixture hashes remain unchanged. No report, score, historical record, publication-policy, PDF-renderer, scoring, database-schema or migration source file was modified. The audit orchestrator changes only its Zod import.

See `after/render-comparison.json`, PDF page hashes, `after/browser-pages.json`, and `baseline-repeat/browser-pages.json`. The fixture check covers these two committed local audits, not production records or all historical audits.

## Differences, remaining risks, and disposition

- **Client-facing report differences:** none found. No approval for changed narratives or report content is requested.
- **Developer/runtime differences:** minimum Node 22.19 is now declared; use Vitest 4's supported flags. Internal Zod error codes/objects use v4 representations. Established validation text, defaults, acceptance and report DTOs are preserved by the tested compatibility layer.
- **Scope of audit:** npm/Node dependency findings and packaged Sharp/native metadata are verified. This is not a separate operating-system CVE scan or a guarantee against unknown advisories. Rebuild/re-audit before a later release as feeds and base images change.
- **Override maintenance:** PostCSS, Sharp, Cheerio/undici and deepmerge-ts overrides must be rechecked during future upgrades. The deepmerge-ts major override is exercised by the real Prisma CLI, migrations and zero-drift check.
- **Publication policy:** all existing report provenance, authorization, narrative and pilot safeguards are preserved. Their broader limitations documented on PR #77 remain outside this dependency-remediation scope.
- **Review boundary:** independently review this branch and its evidence before authorizing a merge/deployment. PR #77, production data and GitHub branch protection were not modified. No manual deployment was performed.
- **Artifact publication:** automatic approval review rejected publishing rendered PDF payloads to the public repository due to possible client-data exposure. The safer push contains reports, generic schema snapshots, audit data, code, logs and hashes. Rendered PDF/HTML/DTO/text payloads remain local and excluded from Git.

## Reproduction notes

The pre-fix report commit contains the original application plus the capture harness. Check out `1c475223feaaeed48acfba0ce2463b45118e9d1f`, install/build with Node 22, and generate local `REPORT_PHASE=before` captures before switching to this remediation branch. Reinstall, typecheck, run the full/security suites, build, and run the harness with `REPORT_PHASE=after`.

The harness lives outside the application directory: first make a local `reports/node_modules` symlink to `../rescue-agent/node_modules` so its imports resolve (do not commit the symlink). Run it from `rescue-agent/` with `vitest run --config ../reports/dependency-remediation/verify.config.mts`. The extended oracle needs an isolated test-only Zod 3.25.76 installation selected with `ZOD3_REFERENCE`; browser capture needs Playwright (this run used 1.64.1, Chromium 156) selected with `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH`. Follow the report's exact comparison paths; do not publish the rendered payloads.

Build `rescue-agent/Dockerfile` using BuildKit. In this managed environment supply the proxy CA with `--secret id=proxy_ca,src="$CODEX_PROXY_CERT"`; the mount is optional outside the proxy environment and never copied into the image. Pipe `scripts/audit-runtime.mjs` and `scripts/verify-standalone.mjs` into the built image's Node process to audit physical packages and exercise image optimization. Use a disposable database for migration/health/drift checks; do not point verification at production.
