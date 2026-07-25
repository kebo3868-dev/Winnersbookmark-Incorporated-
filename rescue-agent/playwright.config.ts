import { defineConfig } from '@playwright/test';

/**
 * Browser E2E config. @playwright/test is intentionally NOT a committed
 * dependency (its install downloads Chromium, which broke the Vercel build).
 * Install it on demand to run the E2E:  npm i -D @playwright/test
 *
 * Run with `npm run test:e2e` against a running server:
 *   DATABASE_URL=... BASIC_AUTH_USER=... BASIC_AUTH_PASSWORD=... npm run build && npm start
 * then in another shell: E2E_BASE_URL=http://localhost:3000 E2E_USER=.. E2E_PASS=.. npm run test:e2e
 *
 * Kept OUT of the default `npm test` (vitest) so the unit suite stays hermetic
 * (no browser, no server, no DB). Uses the preinstalled Chromium.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    httpCredentials: process.env.E2E_USER && process.env.E2E_PASS ? { username: process.env.E2E_USER, password: process.env.E2E_PASS } : undefined,
    launchOptions: { executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium/chrome-linux/chrome' },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
