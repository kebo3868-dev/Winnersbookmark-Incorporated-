#!/usr/bin/env node
/**
 * ACCEPTANCE TEST — the founder workflow on an Android-sized screen.
 *
 * Builds nothing: run `npm run build` first. Then:
 *
 *   AGENTOS_E2E_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/agentos_dev npm run test:e2e
 *
 * The database must be DISPOSABLE: its public schema is dropped and rebuilt
 * with scripts/migrate.mjs. The test starts the production server
 * (`next start`) and a local protocol stub, then drives Chromium as a Pixel 7.
 *
 * Provider set-up, chosen to show every connection state honestly:
 *   Hermes  → protocol stub (live HTTP path; the stub labels itself)
 *   Roxy    → stub that rejects the key (connection error)
 *   Zeus    → not configured (simulated)
 *   Gemini  → not configured (simulated reviewer)
 *
 * Screenshots go to docs/evidence/.
 */
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { startStub, STUB_HERMES_KEY } from './stub-provider.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE = path.join(ROOT, 'docs', 'evidence');
const DB = process.env.AGENTOS_E2E_DATABASE_URL;
const PORT = 3123;
const STUB_PORT = 4010;
const BASE = `http://localhost:${PORT}`;
if (!DB) {
  console.error('AGENTOS_E2E_DATABASE_URL (a disposable database) is required.');
  process.exit(1);
}

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// 1. Fresh schema via the real migration runner.
const admin = new pg.Client({ connectionString: DB });
await admin.connect();
await admin.query('drop schema if exists public cascade; create schema public;');
await admin.end();
execFileSync('node', ['scripts/migrate.mjs'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: DB }, stdio: 'inherit' });

// 2. Owner credentials generated for this run only.
const password = randomBytes(12).toString('base64url');
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const passwordHash = `scrypt$32768$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;

// A server already on the port would answer for us with whatever build it
// was started from. Refuse rather than test the wrong code.
try {
  await fetch(`${BASE}/api/health`);
  console.error(`Port ${PORT} is already serving. Stop that process first.`);
  process.exit(1);
} catch {}

const stub = await startStub(STUB_PORT);
// Started directly and in its own process group, so stopping it also stops
// the next-server child (killing an `npx` wrapper leaves that child running).
const server = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', String(PORT)], {
  cwd: ROOT,
  detached: true,
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'production',
    DATABASE_URL: DB,
    AGENTOS_OWNER_PASSWORD_HASH: passwordHash,
    AGENTOS_SESSION_SECRET: randomBytes(32).toString('hex'),
    // Production refuses simulation unless explicitly allowed. Allowed here
    // because two agents are deliberately unconfigured.
    AGENTOS_ALLOW_MOCK: 'true',
    HERMES_BASE_URL: `http://127.0.0.1:${STUB_PORT}/hermes`,
    HERMES_API_KEY: STUB_HERMES_KEY,
    OPENAI_BASE_URL: `http://127.0.0.1:${STUB_PORT}/openai/v1`,
    OPENAI_API_KEY: 'sk-e2e-WRONGKEYWRONGKEYWRONG',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start:\n${serverLog}`);
}

let browser;
try {
  await waitForServer();
  mkdirSync(EVIDENCE, { recursive: true });

  // --- Access control, without a browser session -------------------------
  const anon = await fetch(`${BASE}/`, { redirect: 'manual' });
  check('Unauthenticated page request is redirected to sign-in', anon.status === 307 && anon.headers.get('location')?.endsWith('/login'), `status ${anon.status}`);
  const anonApi = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: '{}' });
  check('Unauthenticated API request is refused', anonApi.status === 401, `status ${anonApi.status}`);
  const headers = (await fetch(`${BASE}/login`)).headers;
  check('Security headers are served', headers.get('x-frame-options') === 'DENY' && headers.get('x-robots-tag')?.includes('noindex'));

  // --- Founder on a Pixel 7 ----------------------------------------------
  browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  const vw = page.viewportSize();
  check('Viewport is Android-sized', vw.width <= 420, `${vw.width}×${vw.height}`);

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#password', 'not-the-password');
  await page.click('button[type=submit]');
  // Next renders its own role=alert route announcer; target the form's error.
  await page.waitForSelector('[data-testid=login-error]');
  const loginAlert = await page.textContent('[data-testid=login-error]');
  check('Wrong password is rejected', loginAlert.includes('INCORRECT PASSWORD'), loginAlert);
  await page.fill('#password', password);
  await page.click('button[type=submit]:not([disabled])');
  await page.waitForURL(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  check('Owner signs in', true);

  // Cross-origin write with a valid session is refused.
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === 'agentos_session');
  check('Session cookie is HttpOnly, Secure and SameSite=Strict', session?.httpOnly && session?.secure && session?.sameSite === 'Strict');
  const csrf = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example', cookie: `agentos_session=${session.value}` }, body: '{}' });
  check('Cross-origin write with a valid session is refused', csrf.status === 403, `status ${csrf.status}`);

  const status = async (id) => (await page.textContent(`[data-testid=status-${id}]`)).trim();
  check('Roxy: configured, not yet verified', (await status('roxy')) === 'Configured · not verified');
  check('Zeus: honestly not connected', (await status('zeus')) === 'Not connected');
  check('Hermes: configured, not yet verified', (await status('hermes')) === 'Configured · not verified');
  check('Gemini: honestly not connected', (await status('gemini')) === 'Not connected');
  await page.screenshot({ path: path.join(EVIDENCE, '01-dashboard-initial.jpg'), fullPage: true, type: 'jpeg', quality: 70 });

  await page.click('[data-testid=probe-hermes]');
  await page.waitForFunction(() => document.querySelector('[data-testid=status-hermes]')?.textContent?.includes('verified') && !document.querySelector('[data-testid=status-hermes]')?.textContent?.includes('not'));
  check('Hermes connection check succeeds over HTTP (protocol stub)', (await status('hermes')) === 'Connected · verified');
  await page.click('[data-testid=probe-roxy]');
  await page.waitForFunction(() => document.querySelector('[data-testid=status-roxy]')?.textContent === 'Connection error');
  check('Roxy connection check fails and is shown as an error', (await status('roxy')) === 'Connection error');
  const roxyCard = await page.textContent('[data-testid=agent-roxy]');
  check('Rejected API key is redacted from the displayed error', !roxyCard.includes('WRONGKEY') && roxyCard.includes('[redacted]'));
  await page.screenshot({ path: path.join(EVIDENCE, '02-dashboard-after-checks.jpg'), fullPage: true, type: 'jpeg', quality: 70 });

  // --- Mission Control: create, assign, run, review, approve --------------
  await page.click('[data-testid=nav-new-task]');
  await page.waitForURL(`${BASE}/tasks/new`);
  await page.waitForLoadState('networkidle');
  await page.fill('#title', 'Lunch-hour revenue research for Leverock’s');
  await page.fill('#objective', 'Research why weekday lunch revenue is flat for a 60-seat seafood restaurant and list three testable fixes with how to measure each.');
  await page.click('[data-testid=assign-hermes]');
  await page.selectOption('#risk', 'medium');
  await page.screenshot({ path: path.join(EVIDENCE, '03-new-task-form.jpg'), fullPage: true, type: 'jpeg', quality: 70 });
  await page.click('[data-testid=create-task]');
  await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
  await page.waitForLoadState('networkidle');
  check('Task created and assigned to Hermes', (await page.textContent('[data-testid=task-status]')).trim() === 'Queued');

  await page.click('[data-testid=run-task]');
  await page.waitForSelector('[data-testid=approval-panel]', { timeout: 60_000 });
  const primary = await page.textContent('[data-testid=primary-output]');
  check('Primary result came over the live HTTP path and is labelled Live', primary.includes('PROTOCOL STUB') && primary.includes('Live'));
  check('Evidence saved: provider response id and token counts', /resp_stub_\d+/.test(primary) && primary.includes('42 / 17'));
  const review = await page.textContent('[data-testid=review-output]');
  check('Independent review by a different agent (Gemini) is shown', review.includes('Independent review · Gemini'));
  check('Simulated review is labelled and does not pass', review.includes('Simulated') && (await page.textContent('[data-testid=review-verdict]')).trim() === 'Concerns');
  check('Task awaits founder approval', (await page.textContent('[data-testid=task-status]')).trim() === 'Awaiting approval');
  check('Approval warning names exactly what was simulated (the review, not the result)', (await page.textContent('[data-testid=simulation-warning]')).includes('The independent review is simulated'));
  await page.screenshot({ path: path.join(EVIDENCE, '04-task-awaiting-approval.jpg'), fullPage: true, type: 'jpeg', quality: 70 });

  await page.fill('#note', 'Approved for internal planning only.');
  await page.click('[data-testid=approve]');
  await page.waitForSelector('[data-testid=decision-record]');
  check('Founder approval recorded with attribution', (await page.textContent('[data-testid=decision-record]')).includes('by owner'));
  check('Task is Approved', (await page.textContent('[data-testid=task-status]')).trim() === 'Approved');
  const auditText = await page.textContent('body');
  check('Audit trail lists creation, run and approval', ['task.created', 'task.claimed', 'task.ready_for_approval', 'approval.approved'].every((a) => auditText.includes(a)));
  await page.screenshot({ path: path.join(EVIDENCE, '05-task-approved.jpg'), fullPage: true, type: 'jpeg', quality: 70 });

  // --- Fault path: a task whose agent rejects its key ---------------------
  await page.goto(`${BASE}/tasks/new`, { waitUntil: 'networkidle' });
  await page.fill('#title', 'Q1 strategy memo');
  await page.fill('#objective', 'Write a one-page strategy memo on pricing AI front-desk services for independent restaurants.');
  await page.click('[data-testid=assign-roxy]');
  await page.selectOption('#risk', 'low');
  await page.click('[data-testid=create-task]');
  await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
  await page.waitForLoadState('networkidle');
  await page.click('[data-testid=run-task]');
  await page.waitForSelector('[data-testid=task-error]', { timeout: 60_000 });
  check('Auth failure is not retried and the task is marked Failed', (await page.textContent('[data-testid=task-status]')).trim() === 'Failed' && (await page.textContent('body')).includes('Run history (1 attempts)'));
  await page.screenshot({ path: path.join(EVIDENCE, '06-task-failed-honestly.jpg'), fullPage: true, type: 'jpeg', quality: 70 });
} catch (error) {
  check('Acceptance run completed without crashing', false, String(error?.stack ?? error));
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {}
  stub.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} acceptance checks passed`);
process.exit(failed.length ? 1 : 0);
