# Dependency remediation: isolated trial before fixes

Decision at this checkpoint: **CHANGES REQUIRED**.

The user corrected the source of truth to PR #77 head `07198e3f3eb2b11a6e707c6ee8dcbb0795d24c01`. The previous sandbox-only commit and report are unavailable and have not been reconstructed or claimed as integrated. This is a fresh trial. Application source, manifests and lockfiles are unchanged at this checkpoint; candidate experiments ran outside the checkout. The report is to be committed and pushed before fixes, as requested.

## Repository and PR diff

Repository: `kebo3868-dev/Winnersbookmark-Incorporated-`. PR #77 is open, draft and unmerged, head `fix/rescue-pdf9-client-readiness` at the above SHA. Main is `3a8b0dadf8363adee21925eb663b532d706d0d9b`. The initial checkout was clean. Remediation branch: `remediation/rescue-dependencies-2026-11-03`; PR #77 remains unchanged.

Against main, PR #77 changes 47 files, with 20,982 insertions and 139 deletions. See `before/pr77-vs-main-stat.txt` and GitHub's comparison of those exact commits.

- Executive web/PDF presentation: distinguish observed ordering-button markup from owner-confirmed business outcomes, condition pilots on demand/readiness/approval, clarify exploratory opportunities, preserve pagination, and add the telephone CTA link.
- Report publication: source-bind interpolated observations, canonicalize identifiers, regenerate or verify narratives and historical wording, screen AI summaries, and restrict evidence links.
- Sales Brief: regenerate narrative fields from published observations and return only needed audit metadata.
- Regression safeguards: engine-source scanner, generated current/historical templates, adversarial fixtures, report/publication/pilot/scoring tests, and a proposed branch-protection configuration (not applied).
- Audit engine changes are limited to approved wording and AI-summary screening. No dependency manifest, lockfile, scoring-weight, database-schema or migration changes appear in this PR diff.

## Environment and commands

Node 22.23.4 / npm 10.9.9 were installed into temporary storage to match CI's Node 22 line. Node 24/npm 11 initially rejected platform-specific lock entries; the unchanged lock installs successfully under npm 10. The npm cache is in temporary writable storage.

- `npm ci`: passes under Node 22/npm 10, Prisma client 6.19.3 generated.
- `npm run typecheck`: passes.
- `npm run build`: passes, Next 15.5.20 standalone output generated.
- Full suite: **2,428 / 2,428 tests pass in 96 files**, zero skips, using `npm test -- --maxWorkers=2 --minWorkers=1 --testTimeout=30000` with network permission for local test servers. An earlier run without network permission failed to bind localhost; a subsequent default-timeout run passed 2,427 tests and timed out on the unresolvable-host DNS test. Both attempts are retained, rather than presented as application defects.
- Focused security regressions: **318 / 318 pass in 10 files**. Exact files are auth, operator authorization, Front Desk authorization, tenant isolation, unauthenticated writes, URL validation, safe fetch, slot verification, release safety policy, and recommendation-template drift.

Logs and raw audits are under `before/`.

## Fresh vulnerability counts

These are current registry audit entries, not unique CVEs. A transitive advisory can create multiple parent entries. They supersede the inaccessible prior trial's aggregate counts.

| Environment | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Application, `npm audit --omit=dev` | 1 | 9 | 0 | 0 |
| Full application dependency tree | 3 | 11 | 3 | 0 |
| Development-only difference from production | 2 | 2 | 3 | 0 |
| Fresh Prisma migrator install matching Docker's command | 0 | 3 | 0 | 0 |

Full advisory titles, affected ranges, nodes and upstream effects are in `audit-production.json`, `audit-all.json`, and `audit-migrator.json`. `locked-inventory.json` records versions and edges.

Production chains requiring remediation:

- App → Next 15.5.20: critical framework/image-optimization advisories, plus denial-of-service and cache/SSRF findings. Image optimization is a server path; routes have operator authorization, but framework safety must not depend on that alone. Windows-only RCE is not applicable to the Linux image, while other Next findings remain relevant.
- App → Next → Sharp 0.34.5: vulnerable bundled libvips/libheif/librsvg. Image decoding is reachable through image processing and needs a secure native runtime.
- App → Next → PostCSS 8.4.31 → nanoid/source-map-js: stylesheet/source-map and generator denial-of-service findings. CSS builds consume repository-owned input; risk is primarily build tooling, but these packages are present in the production lock closure.
- App → undici 8.9.0 and App → cheerio → undici 7.x: HTTP/TLS/decompression findings. The collector handles restaurant-controlled destinations, so these packages deserve remediation even though its SSRF and network safeguards remain.
- App → Zod 3.25.76: oversized constrained-collection memory exhaustion, GHSA-mrhx-c7xc-m3w5, affected `<4.6.6`. Request/config validation is reachable. Existing payload/authorization protections reduce some exposure; they do not make the package patched.
- Prisma 6.19.3 → @prisma/config 6.19.3 → deepmerge-ts 7.1.5: recursive-graph stack exhaustion, affected `<8.0.0`. Docker installs this closure separately, ignoring any root override or root lockfile. The CLI processes operator-controlled schema/config rather than public restaurant payloads, but must still be patched and verified.

Development findings include Vitest 3.2.7 and tinypool (critical), Vite 7.3.6, browserslist, baseline-browser-mapping and postcss-selector-parser. Test/tool execution and developer servers are the relevant surfaces. These findings are not permission to suppress audits or expose a development server.

## Zod comparison

Latest published Zod 3 is 3.25.76. A fresh candidate install/audit identifies it as affected; no compatible secure Zod 3 release was found. Zod 4.6.7 is outside the affected range. See `zod3-versions.json`, `zod-candidate-audit.json`, and the candidate metadata.

Aliasing Zod 4.6.7 without source changes reproduces:

- `z.record(z.string())` is invalid (two-argument key/value form required), with a downstream routing type error.
- The messaging default no longer parses through nested defaults, and omits `emailEnabled: false`.
- Default validation messages change across every captured schema. Explicit application messages must remain exact, and validation/default/coercion semantics need comparison, not just a passing typecheck.

`zod4-typecheck.log`, `zod4-contract.log`, `zod4-trial/schema-contract.json` and `before/schema-contract.json` preserve the comparison. A complete migration must retain the baseline's behavior/messages while retaining Zod 4's security fix; importing its bundled legacy v3 would not remediate the finding.

## Sharp candidate and standalone packaging

A scratch checkout with Sharp 0.35.5 plus an override to make Next use it builds. Its standalone output omits the native `@img/.../versions.json` metadata: `sharp.versions` exposes only vips and sharp, omitting heif and other bundled-library versions. The full installed package has that metadata. Explicit tracing includes are needed.

The exact old trial's AVIF fallback was **not** reproduced with 0.35.5: an actual 128×128 AVIF resized to 64×64 produced 288 bytes successfully. This is recorded rather than inventing a failure. Final verification must check both full metadata and real Next/standalone image optimization, including output dimensions, format, and changed bytes; route success alone is insufficient.

## Report preservation

The committed current and historical local-verification fixtures contain 84/100 and 73/100 respectively, both at 80% coverage. A read-only Prisma double supplies those records to the **real** Executive Report loader, Sales Brief loader, report page, Sales Brief page, and PDF API route. Every unexpected database operation throws. Fixture checksums remain unchanged.

`preservation.test.ts` captures the full loader DTOs, server-rendered HTML, PDF text and page-raster hashes for both fixtures. **2/2 verification tests pass.** PDFs and client-payload snapshots remain local in `before/`, excluded from publication. Browser screenshots at 360 and 1280 pixels are generated from the actual page markup and compiled CSS, with external network requests blocked; their hashes/dimensions are in `browser-pages.json`. Screenshot files remain temporary. This covers the supplied local fixtures, not production data or every historical audit.

The same harness will compare the remediated outputs exactly. PDF metadata timestamps are excluded by comparing extracted text and rendered page images. Browser captures use system fallback fonts consistently because external font downloads are blocked in both phases.

Automatic approval review rejected publication of the rendered PDF blobs because the target repository is public and client data could be exposed. The safer publication contains this report, audit evidence, test logs, generic schema contracts, verification code, and hashes; no rendered PDF, HTML, report DTO or extracted client-report text is pushed.

## Docker evidence and infrastructure limitation

The unchanged Dockerfile's build was attempted. A transport-only scratch Dockerfile then supplied the managed proxy CA as a BuildKit secret to npm; no dependency/resource fix was added. This got past dependency installation but failed preparing the builder snapshot with **no space left on device**.

Docker uses the managed VFS driver. Its snapshots consumed about 6.7 GiB on the 7.9 GiB workspace filesystem. Supported builder/system cache pruning reported no reclaimable layers while those VFS directories remained. Source dependencies were moved to temporary storage with a local symlink to recover enough space for the remaining work. No daemon storage driver/data directory was changed, and no manual deletion of daemon internals was attempted.

Consequently, a complete baseline image and image audit are **not available**. The fresh host install of the Docker migrator reproduces its exact three high audit entries, but is not mislabeled as an image audit. Docker daemon/storage recovery may be necessary to complete final image verification. Build logs and the read-only storage diagnostic are retained.

## Next steps and boundary

Commit and push this report on the separate remediation branch first. Then remediate dependencies and schema compatibility, give the migrator its own committed manifest/lock/override, include Sharp metadata in tracing, and rerun the full verification. Do not merge, deploy, modify production data or branch protection, or update PR #77. Any unavailable Docker verification or output difference keeps the release decision at CHANGES REQUIRED.
