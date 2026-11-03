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
  // This fixture mixes verified findings with opportunities requiring validation.
  // Its headings must preserve that distinction and must not imply measured loss.
  await expect(page.getByRole('heading', { name: 'Executive Snapshot', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revenue Leaks and Opportunities to Validate', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Optional Scenario Calculator', exact: true })).toBeVisible();
  await expect(page.getByText('Demonstration Data — this report describes a fictional restaurant', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What This Could Be Costing You', exact: true })).toHaveCount(0);
  await expect(page.getByText('ILLUSTRATIVE SCENARIO', { exact: true })).toHaveCount(0);

  // No money is invented: the calculator starts closed, and waits for all
  // user-entered assumptions. Exercise hydration and real arithmetic too.
  const calculator = page.locator('details').filter({ has: page.getByText('Open the calculator', { exact: true }) });
  await expect(calculator).not.toHaveAttribute('open');
  await page.getByText('Open the calculator', { exact: true }).click();
  const scenario = page.locator('div.card').filter({
    has: page.getByRole('heading', { name: 'Online Ordering Scenario', exact: true }),
  });
  await expect(scenario).toBeVisible();
  await expect(scenario.getByText('What-if, per month', { exact: true })).toHaveCount(0);
  await expect(scenario.getByLabel('Average order value ($)', { exact: true })).toHaveValue('38');
  await scenario.getByLabel('Orders abandoned per day', { exact: true }).fill('2');
  await scenario.getByLabel('Average order value ($)', { exact: true }).fill('20');
  await expect(scenario.getByText('What-if, per month', { exact: true })).toHaveCount(0);
  await scenario.getByLabel('Operating days per year', { exact: true }).fill('300');
  await expect(scenario.getByText('about $1,000', { exact: true })).toBeVisible();
  await expect(scenario.getByText('about $12,000', { exact: true })).toBeVisible();
  await expect(calculator.getByText(/^Optional scenario calculator — it uses only the figures you enter\. The result is a what-if/)).toBeVisible();
  await expect(scenario.getByText(/^A what-if built only on the figures entered above/)).toBeVisible();
  // The visible scope note distinguishes owner input from platform verification;
  // the first generic match lives inside the closed score-methodology disclosure.
  await expect(page.getByText(/^Review and reputation platforms are not analyzed in this audit scope\. An owner-reported rating/)).toBeVisible();

  // 4. Executive PDF downloads with the right content type.
  const pdf = await request.get(`/api/audits/${auditId}/report/pdf`);
  expect(pdf.ok()).toBeTruthy();
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  const bytes = await pdf.body();
  expect(bytes.length).toBeGreaterThan(1000);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');

  // 5. Leads view shows the captured demo lead.
  await page.goto('/leads');
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
  // Desktop and mobile markup both exist. Check the visible table row for
  // THIS audit, rather than a hidden mobile card or an older demo lead.
  const lead = page.getByRole('row').filter({ has: page.locator(`a[href="/audits/${auditId}"]`) });
  await expect(lead).toHaveCount(1);
  await expect(lead.getByRole('cell', { name: /^Sample Prospect \(DEMO\)/ })).toBeVisible();
  await expect(lead.getByRole('link', { name: 'View audit', exact: true })).toHaveAttribute('href', `/audits/${auditId}`);
});
