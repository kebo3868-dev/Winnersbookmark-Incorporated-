/**
 * The proposed branch protection for `main` (docs/branch-protection-main.json,
 * not applied) must name exactly the jobs CI runs on pull requests: a required
 * check whose name matches no job never reports and blocks every merge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '../..');
const ci = fs.readFileSync(path.join(REPO, '.github/workflows/ci.yml'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(REPO, 'docs/branch-protection-main.json'), 'utf8')) as {
  required_status_checks: { strict: boolean; checks: { context: string; app_id: number }[] };
  enforce_admins: boolean;
  allow_force_pushes: boolean;
  allow_deletions: boolean;
};

describe('proposed branch protection for main', () => {
  const jobNames = [...ci.matchAll(/^ {4}name: (.+)$/gm)].map((m) => m[1].trim());

  it('requires every CI job by its exact name, and nothing else', () => {
    expect(config.required_status_checks.checks.map((c) => c.context).sort()).toEqual([...jobNames].sort());
    expect(jobNames).toHaveLength(3);
  });

  it('CI runs on pull requests to main', () => {
    expect(ci).toMatch(/pull_request:\n\s+branches: \[main\]/);
  });

  it('binds the checks to GitHub Actions, requires up-to-date branches, holds admins to it, and forbids force pushes and deletion', () => {
    expect(config.required_status_checks.checks.every((c) => c.app_id === 15368)).toBe(true);
    expect(config.required_status_checks.strict).toBe(true);
    expect(config.enforce_admins).toBe(true);
    expect(config.allow_force_pushes).toBe(false);
    expect(config.allow_deletions).toBe(false);
  });
});
