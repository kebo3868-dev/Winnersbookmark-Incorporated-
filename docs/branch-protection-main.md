# Branch protection for `main` — proposed, not applied

**Status:** proposal only. Nothing here has been applied. Changing repository rules or branch protection needs explicit founder authorisation; apply it yourself (or authorise someone to) from **Settings → Branches** or with the API call below.

## Why

The read-only security review of PR #77 at `5bfac83` found that `main` is unprotected. The public API reports `"protected": false`, no required status checks and no rulesets. So nothing stops a merge while CI is red, and nothing requires a review.

This doesn't make a passing CI run proof of safety; it only stops merges that skip it.

## Required status checks

These are the job names from `.github/workflows/ci.yml`, which runs on every pull request to `main`. GitHub matches required checks by these exact strings, and the app id `15368` is GitHub Actions.

| Check (exact context) | Job | What it proves |
| --- | --- | --- |
| `Rescue Agent — typecheck, tests, build` | `build` | The Rescue Agent typechecks, its full test suite passes, and the production build succeeds. |
| `Marketing site — typecheck, tests, build` | `website` | The marketing site typechecks, tests and builds. |
| `Migrations apply cleanly with zero drift` | `migrations` | Every Prisma migration applies to an empty database, with no drift from the schema. |

The names contain an em dash (`—`), not a hyphen. A required check whose name doesn't match exactly never reports, and blocks every merge.

### Vercel deployment statuses (optional; founder's decision)

Vercel also posts commit statuses: `Vercel – website`, `Vercel – winnersbookmark-incorporated` and `Vercel – winnersbookmark-incorporated-53l2`. They report whether a preview deployed, not whether the code is correct. Requiring them blocks merges whenever Vercel is degraded, so they are left out of the configuration below.

## Exact configuration

Send this with `PUT /repos/kebo3868-dev/Winnersbookmark-Incorporated-/branches/main/protection`, using a token with administration rights on the repository:

```json
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Rescue Agent — typecheck, tests, build", "app_id": 15368 },
      { "context": "Marketing site — typecheck, tests, build", "app_id": 15368 },
      { "context": "Migrations apply cleanly with zero drift", "app_id": 15368 }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
```

With the GitHub CLI:

```bash
gh api -X PUT repos/kebo3868-dev/Winnersbookmark-Incorporated-/branches/main/protection \
  -H "Accept: application/vnd.github+json" --input docs/branch-protection-main.json
```

The same body is in `docs/branch-protection-main.json`.

### What each setting does

- **`strict: true`:** a pull request must be up to date with `main` before it merges, so checks run against the code that will actually land.
- **`enforce_admins: true`:** administrators are held to the same rules. Without this, an admin can still merge on red.
- **`required_approving_review_count: 1`:** one approving review, and **`require_last_push_approval`** means the approver is not the person who pushed last. With a single maintainer, that person can't merge their own PR alone; add a second reviewer, or set this to `false` knowingly.
- **`dismiss_stale_reviews`:** a new push invalidates earlier approvals.
- **`required_conversation_resolution`:** unresolved review threads block the merge.
- **No force pushes or deletion of `main`.**

## Verification after applying

1. `gh api repos/kebo3868-dev/Winnersbookmark-Incorporated-/branches/main --jq '.protected, .protection.required_status_checks.checks'` should print `true` and the three checks.
2. Open a draft PR that fails one job on purpose. GitHub should show **Merging is blocked**.
3. Confirm a PR whose three checks pass shows those three as **Required**.

## What it does not do

Branch protection enforces process, not correctness. A passing suite proves only what its tests assert. PR #77 still needs a genuinely author-independent review: see "Independent re-review" in the PR description.
