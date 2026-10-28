# Front Desk login entry repair

The browser flow is `/frontdesk/login` → existing `POST /api/frontdesk/auth/login`
→ server-issued `wbi_fd_session` → `/frontdesk`. The form requires a restaurant
slug, email and password. It uses a fixed destination and a full navigation to
discard anonymous router state. Passwords never enter a URL or browser storage.

Only exact GET/HEAD `/frontdesk/login` gains a Basic Auth exemption. Anonymous
Front Desk browser requests redirect there; API and write requests keep their
existing checks. The index and tenant dashboard redirect missing server-side
actors before reading tenant data. Wrong-tenant actors still receive a denial.
The public page reads no tenant/session data and never redirects merely because
a cookie is present. Its layout does not prefetch operator pages.

Session verification, role permissions, tenant isolation, operator guards,
message exposure and Bearer semantics are unchanged. Simulator authorization
is unchanged. No database schema, production credential or environment changes
are part of this repair. Issues #71, #72 and #73 remain open.

## Required collision check before release

**Production collision status is unverified in this workspace. Do not merge or
deploy until a read-only check against the correct production Front Desk
database confirms that no tenant uses slug `login`.** The new static route
would otherwise shadow that tenant's dashboard. Do not rename or delete an
existing tenant as part of this repair.

With the intended database connection already configured, run:

```sh
node scripts/check-frontdesk-login-slug.mjs
```

The script uses the runtime URL precedence from `src/lib/db.ts`, selects only
the matching tenant's id, prints no credentials or tenant identifiers, and
exits nonzero on a collision or failed check. A read-only database identity is
sufficient. An equivalent query is:

```sql
SELECT EXISTS (SELECT 1 FROM "FdTenant" WHERE slug = 'login') AS collision;
```

The result must be false. Check all rows regardless of status/config validity.
The tenant-creation API now rejects this reserved slug so normal onboarding
cannot introduce a later collision. Direct database writes must respect it too.

The repository root and both app directories include `vercel.json` with
automatic Git deployments disabled **only** for `fix/frontdesk-login-entry`.
Other branches retain their settings. Merging and deployment still require the
user's explicit authorization.

Publication incident: the first PR commit included suppression in both app
directories, but an additional Vercel project with a repository-root build
(`winnersbookmark-incorporated-53l2`, rootDirectory null in the Vercel bot's PR
metadata) automatically created a preview anyway. GitHub reported deployment
`GThkpwE1gUZgxGmAfrBmmxXboQrq` ready. The connected Vercel tools returned 404 for
that project/deployment, including explicit team and project IDs, so removal
could not be performed through this connection. Root-level branch suppression
was added before the next push. The unintended preview requires cleanup by an
account with access; do not treat the no-deploy requirement as satisfied.

## Isolated verification

Use the checked-in lockfile (npm 10 `npm ci` works; npm 11 rejects its optional
dependency metadata). No dependency or lockfile changes are required.

```sh
npm run typecheck
npm test -- --maxWorkers=2
DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:55432/wbi_frontdesk_fixture npm run build
```

The suite includes real DNS/local-server checks. This workspace needed network
permission and `RES_OPTIONS='attempts:1 timeout:1'` to keep the negative DNS
lookup within its existing timeout; assertions and production code were unchanged.

For browser verification, use a **fresh disposable local PostgreSQL database**
named `wbi_frontdesk_fixture`, apply the existing schema, and start the production
build locally with `BASIC_AUTH_USER=fixture-operator` and
`BASIC_AUTH_PASSWORD=fixture-operator-password`. Install `@playwright/test` outside
the dependency manifest as described in `playwright.config.ts`, then run:

```sh
DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:55432/wbi_frontdesk_fixture \
E2E_FRONTDESK_ISOLATED=1 E2E_BASE_URL=http://localhost:3000 \
PW_CHROMIUM=/usr/bin/chromium npm run test:e2e -- tests-e2e/frontdesk-login.spec.ts --workers=1
```

The suite refuses nonlocal URLs, a different database name, inherited database
override variables, or a nonempty Front Desk tenant table. It creates fictional
fixtures and deletes only those fixtures afterward. It exercises browser login,
generic failures, session cookie flags/digest storage, logout revocation, invalid
session states, all four restaurant roles, cross-tenant and RSC denials, operator
fallback precedence, exact methods, trailing/double slashes, encoded paths,
prefetch, and middleware-bypass headers. It never submits messages.

The existing `tests-e2e/audit-flow.spec.ts` runs separately against the same local
server with the fixture operator credentials to verify reports and PDF access.
No production sign-in, messages or writes are needed.

## Results in this workspace

| Check | Result |
| --- | --- |
| Rescue Agent suite | 82 files, 2,154 tests passed |
| Typecheck | Passed |
| Production build | Passed with locked Next.js 15.5.20 |
| Front Desk browser/routing regressions | 18 passed against the local production build |
| Existing operator audit → report → PDF → leads E2E | Passed after updating stale selectors to the existing report labels and visible desktop leads table |
| Missing operator configuration | Login 200; Front Desk navigation 307 to login; Command Center, Sales Brief and PDF 503 |
| Collision preflight | Local absence and collision cases passed; production check remains blocked |

The actual Next server exercised the middleware matcher as well as the handler.
Dynamic prefetch can return an empty RSC shell with HTTP 200; full RSC navigation
was also checked for the serialized denial and absence of unauthorized data.
Operator surfaces rejected normal, HEAD, POST/Next-Action, RSC/prefetch, forged
cookies, encoded traversal and middleware-bypass header variants. All test
writes were confined to disposable local fixtures. No merge or explicit
deployment command was performed; the automatic preview incident above remains
a separate release/cleanup blocker.
