import { test, expect } from '@playwright/test';

/**
 * Full browser E2E of the client-facing flow against a running production
 * build: Command Center → run the (fictional) demo audit → Executive Report
 * renders with Phase 3 sections → PDF downloads → Leads view shows the
 * captured demo lead. Uses the demo path so it needs no external network.
 */

test('demo audit → executive report → PDF → leads', async ({ page, request, baseURL }) => {
  // 1. Command Center loads (behind basic auth via httpCredentials).
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Restaurant Revenue Intelligence/i })).toBeVisible();

  // 2. Kick off the demo audit via its API (deterministic, no network).
  const res = await request.post('/api/audits/demo');
  expect(res.ok()).toBeTruthy();
  const { auditId } = await res.json();
  expect(auditId).toBeTruthy();

  // 3. Executive report renders with Phase 3 sections.
  await page.goto(`/audits/${auditId}/report`);
  await expect(page.getByRole('heading', { name: 'RESTAURANT RESCUE AUDIT' })).toBeVisible();
  // The demo mixes evidence classifications. reportHeadlines() deliberately
  // uses Executive Snapshot; the optional calculator waits for owner inputs.
  // Both behaviours are present on the independently verified baseline.
  await expect(page.getByRole('heading', { name: 'Executive Snapshot', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Optional Scenario Calculator', exact: true })).toBeVisible();
  await page.getByText('Open the calculator', { exact: true }).click();
  await expect(page.getByText('Optional · your figures').first()).toBeVisible();
  await expect(page.getByText(/Enter all .* figures to see a what-if/).first()).toBeVisible();
  await expect(page.getByText('What-if, per month', { exact: true })).toHaveCount(0);
  // Owner-reported review data is surfaced (Phase 3), never scraped.
  await expect(page.getByText(/Review and reputation platforms are not analyzed in this audit scope/)).toBeVisible();

  // 4. Executive PDF downloads with the right content type.
  const pdf = await request.get(`/api/audits/${auditId}/report/pdf`);
  expect(pdf.ok()).toBeTruthy();
  expect(pdf.headers()['content-type']).toContain('application/pdf');

  // 5. Leads view shows the captured demo lead.
  await page.goto('/leads');
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
  const leadRow = page.getByRole('row').filter({ has: page.locator(`a[href="/audits/${auditId}"]`) });
  await expect(leadRow.getByRole('cell', { name: /^Sample Prospect \(DEMO\)/ })).toBeVisible();
});
