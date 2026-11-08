import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { PrismaClient, type FdRole } from '@prisma/client';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { spawnSync } from 'node:child_process';
import { demoTenantConfig } from '../src/lib/frontdesk/demo/tenant';

// This suite writes fixtures. Refuse everything except a dedicated local DB
// and server, even if the caller accidentally inherits production settings.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const dbURL = process.env.DATABASE_URL || '';
if (process.env.E2E_FRONTDESK_ISOLATED !== '1'
  || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)
  || !dbURL || !['localhost', '127.0.0.1'].includes(new URL(dbURL).hostname)
  || new URL(dbURL).pathname !== '/wbi_frontdesk_fixture'
  || ['RESCUE_DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL', 'PRISMA_DATABASE_URL'].some((key) => process.env[key])) {
  throw new Error('Front Desk E2E requires explicit isolated local server/database settings.');
}
// Explicit empty credentials prevent inheriting E2E_USER/E2E_PASS when this
// suite runs alongside the operator E2E. `undefined` resets to config defaults.
test.use({ httpCredentials: { username: '', password: '' } });
test.describe.configure({ mode: 'serial' });
const db = new PrismaClient({ datasourceUrl: dbURL });
const password = 'isolated-fixture-password';
const email = 'member@fixture.invalid';
const basic = `Basic ${Buffer.from('fixture-operator:fixture-operator-password').toString('base64')}`;
const roles: FdRole[] = ['RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'RESTAURANT_STAFF', 'READ_ONLY'];
const tokens: Record<string, string> = {};
let ownsFixtures = false;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

function raw(path: string, method = 'GET', headers: Record<string, string> = {}) {
  return new Promise<{ status: number; location?: string; body: string }>((resolve, reject) => {
    const url = new URL(baseURL);
    const req = httpRequest({ hostname: url.hostname, port: url.port, path, method, headers }, (res) => {
      let body = '';
      res.on('data', (data) => { body += data; });
      res.on('end', () => resolve({ status: res.statusCode!, location: res.headers.location, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function signIn(request: APIRequestContext, role: FdRole = 'RESTAURANT_OWNER') {
  const response = await request.post('/api/frontdesk/auth/login', {
    data: { tenantSlug: 'fixture-a', email: `${role.toLowerCase()}@fixture.invalid`, password },
  });
  expect(response.status()).toBe(200);
  return response;
}

async function setSession(context: BrowserContext, token: string) {
  await context.addCookies([{ name: 'wbi_fd_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}

test.beforeAll(async () => {
  // A disposable empty database is required; never erase existing records.
  expect(await db.fdTenant.count(), 'use a fresh fixture database').toBe(0);
  ownsFixtures = true;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32).toString('base64url');
  const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${hash}`;
  for (const suffix of ['a', 'b']) {
    await db.fdTenant.create({ data: {
      id: `fixture-${suffix}`, slug: `fixture-${suffix}`, name: `Isolated Restaurant ${suffix.toUpperCase()}`,
      config: { ...demoTenantConfig, restaurantName: `Isolated Restaurant ${suffix.toUpperCase()}` } as never,
    } });
    await db.fdUser.create({ data: { id: `member-${suffix}`, tenantId: `fixture-${suffix}`, email, passwordHash, role: 'RESTAURANT_OWNER' } });
  }
  for (const role of roles) {
    await db.fdUser.create({ data: {
      id: role, tenantId: 'fixture-a', email: `${role.toLowerCase()}@fixture.invalid`, passwordHash, role,
    } });
  }
  await db.fdUser.create({ data: { id: 'suspended', tenantId: 'fixture-a', email: 'suspended@fixture.invalid', passwordHash, role: 'RESTAURANT_OWNER', status: 'SUSPENDED' } });
  await db.fdUser.create({ data: { id: 'malformed', tenantId: null, email: 'malformed@fixture.invalid', passwordHash, role: 'RESTAURANT_OWNER' } });
  for (const state of ['expired', 'revoked', 'suspended', 'malformed']) {
    tokens[state] = randomBytes(32).toString('base64url');
    await db.fdSession.create({ data: {
      userId: ['suspended', 'malformed'].includes(state) ? state : 'RESTAURANT_OWNER',
      tokenHash: digest(tokens[state]),
      expiresAt: new Date(Date.now() + (state === 'expired' ? -3600000 : 3600000)),
      revokedAt: state === 'revoked' ? new Date() : null,
    } });
  }
});
test.afterAll(async () => {
  if (ownsFixtures) {
    await db.fdTenant.deleteMany({ where: { id: { in: ['fixture-a', 'fixture-b'] } } });
    await db.fdUser.deleteMany({ where: { id: 'malformed', tenantId: null } });
  }
  await db.$disconnect();
});

test('fresh browser reaches login and its assets/layout without operator challenges', async ({ page }) => {
  const challenges: string[] = [];
  page.on('response', (res) => { if (res.status() === 401) challenges.push(res.url()); });
  await page.goto('/frontdesk/fixture-a');
  await expect(page).toHaveURL(/\/frontdesk\/login$/);
  await expect(page.getByRole('heading', { name: 'Restaurant sign in' })).toBeVisible();
  await expect(page.getByLabel('Restaurant slug')).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/frontdesk-login.png', fullPage: true });
  expect(challenges).toEqual([]);
});

test('login failure is generic, leaves no session, and the same form can succeed', async ({ page, context }) => {
  await page.goto('/frontdesk/login?next=https://attacker.invalid/');
  await page.getByLabel('Restaurant slug').fill('fixture-a');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('form [role="alert"]')).toContainText('Unable to sign in');
  expect((await context.cookies()).some((cookie) => cookie.name === 'wbi_fd_session')).toBe(false);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/frontdesk$/);
  await expect(page.getByRole('link', { name: /Isolated Restaurant A/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Isolated Restaurant B/ })).toHaveCount(0);
  const session = (await context.cookies()).find((cookie) => cookie.name === 'wbi_fd_session')!;
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
  expect(await db.fdSession.findUnique({ where: { tokenHash: digest(session.value) } })).not.toBeNull();
  await page.getByRole('link', { name: /Isolated Restaurant A/ }).click();
  await expect(page.getByRole('heading', { name: 'Isolated Restaurant A', exact: true })).toBeVisible();
  const other = await page.goto('/frontdesk/fixture-b');
  expect(other?.status()).toBe(404);
  await expect(page.locator('body')).not.toContainText('Isolated Restaurant B');
});

test('wrong slug, unknown email and wrong password share a failure; suspended user cannot sign in', async ({ request }) => {
  const before = await db.fdSession.count();
  const failures = [];
  for (const data of [
    { tenantSlug: 'missing', email, password },
    { tenantSlug: 'fixture-a', email: 'unknown@fixture.invalid', password },
    { tenantSlug: 'fixture-a', email, password: 'wrong' },
    { tenantSlug: 'fixture-a', email: 'suspended@fixture.invalid', password },
  ]) {
    const res = await request.post('/api/frontdesk/auth/login', { data });
    expect(res.status()).toBe(401);
    expect(res.headers()['set-cookie']).toBeUndefined();
    failures.push(await res.json());
  }
  expect(failures.every((failure) => JSON.stringify(failure) === JSON.stringify(failures[0]))).toBe(true);
  expect(await db.fdSession.count()).toBe(before);
});

for (const state of ['expired', 'revoked', 'suspended', 'malformed', 'forged', 'bad-shape']) {
  test(`${state} session reveals no data and ends at login without a redirect loop`, async ({ context, page }) => {
    await setSession(context, tokens[state] ?? (state === 'bad-shape' ? 'bad' : 'f'.repeat(43)));
    for (const path of ['/frontdesk', '/frontdesk/fixture-a', '/frontdesk/missing']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/frontdesk\/login$/);
      await expect(page.getByRole('heading', { name: 'Restaurant sign in' })).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Isolated Restaurant A');
    }
    expect((await context.request.get('/api/frontdesk/fixture-a/keys')).status()).toBe(401);
  });
}

test('logout revokes the copied token on the server', async ({ context, request, page }) => {
  await signIn(request);
  const token = (await request.storageState()).cookies.find((cookie) => cookie.name === 'wbi_fd_session')!.value;
  expect((await request.post('/api/frontdesk/auth/logout')).status()).toBe(200);
  const session = await db.fdSession.findUnique({ where: { tokenHash: digest(token) } });
  expect(session?.revokedAt).not.toBeNull();
  await setSession(context, token);
  await page.goto('/frontdesk/fixture-a');
  await expect(page).toHaveURL(/\/frontdesk\/login$/);
});

for (const role of roles) {
  test(`${role} keeps its own permissions and tenant boundary`, async ({ request }) => {
    await signIn(request, role);
    const own = await request.get('/frontdesk/fixture-a');
    expect(own.status()).toBe(200);
    expect(await own.text()).toContain('Isolated Restaurant A');
    expect((await request.get('/frontdesk/fixture-b')).status()).toBe(404);
    const rsc = await request.get('/frontdesk/fixture-b?_rsc=fixture', { headers: { rsc: '1' } });
    // Streaming RSC may commit a 200 before notFound is serialized. Assert
    // the actual denial in that stream as well as the absence of tenant data.
    expect([200, 404]).toContain(rsc.status());
    const rscBody = await rsc.text();
    expect(rscBody).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(rscBody).not.toContain('Isolated Restaurant B');
    // Dynamic-route prefetch returns an empty shell; it must contain no
    // restaurant content, and full navigation above must still deny access.
    const prefetch = await request.get('/frontdesk/fixture-b?_rsc=prefetch', { headers: { rsc: '1', 'next-router-prefetch': '1' } });
    expect(await prefetch.text()).not.toContain('Isolated Restaurant B');
    expect((await request.get('/api/frontdesk/fixture-b/keys')).status()).toBe(403);
    expect((await request.get('/api/frontdesk/fixture-a/keys')).status()).toBe(role === 'RESTAURANT_OWNER' ? 200 : 403);
    expect((await request.patch('/api/frontdesk/fixture-a/leads/nonexistent', { data: { status: 'CONTACTED' } })).status()).toBe(role === 'READ_ONLY' ? 403 : 404);
    expect((await request.post('/api/frontdesk/tenants', { data: {} })).status()).toBe(403);
    // A tenant session must win over a cached operator credential.
    expect((await request.get('/api/frontdesk/fixture-b/keys', { headers: { authorization: basic } })).status()).toBe(403);
  });
}

test('actual Next routing: exact login GET/HEAD, RSC, prefetch, slashes and encoded paths', async () => {
  for (const method of ['GET', 'HEAD']) expect((await raw('/frontdesk/login', method)).status).toBe(200);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) expect((await raw('/frontdesk/login', method)).status).toBe(401);
  const rsc = await raw('/frontdesk/login?_rsc=fixture', 'GET', { rsc: '1', 'next-router-prefetch': '1', purpose: 'prefetch' });
  expect(rsc.status).toBe(200);
  expect(rsc.body).toContain('Restaurant sign in');
  for (const path of ['/frontdesk', '/frontdesk/fixture-a', '/frontdesk/login/child', '/frontdesk/%6cogin']) {
    const res = await raw(path);
    expect(res.status, path).toBe(307);
    expect(new URL(res.location!, baseURL).pathname).toBe('/frontdesk/login');
  }
  for (const path of ['/frontdesk/login/', '/frontdesk//login']) {
    const res = await raw(path);
    expect(res.status, path).toBe(308);
    expect(new URL(res.location!, baseURL).pathname).toBe('/frontdesk/login');
  }
});

test('operator surfaces reject tenant/forged sessions, RSC, prefetch, path and middleware bypass attempts', async ({ request }) => {
  await signIn(request);
  const state = await request.storageState();
  const token = state.cookies.find((cookie) => cookie.name === 'wbi_fd_session')!.value;
  const operatorPaths = ['/', '/audits', '/audits/missing', '/audits/missing/report', '/audits/missing/sales', '/api/audits/missing/report/pdf', '/api/audits/missing/status', '/api/audits', '/leads'];
  for (const path of operatorPaths) {
    for (const headers of [
      {}, { cookie: `wbi_fd_session=${token}` }, { cookie: `wbi_fd_session=${'f'.repeat(43)}` },
      { rsc: '1', 'next-router-prefetch': '1', purpose: 'prefetch' },
      { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' },
      { 'x-middleware-subrequest': 'src/middleware:src/middleware:src/middleware:src/middleware:src/middleware' },
      { 'x-middleware-subrequest': 'middleware', 'x-matched-path': '/frontdesk/login' },
    ]) {
      const res = await raw(path, 'GET', headers as Record<string, string>);
      expect(res.status, `${path} ${JSON.stringify(headers)}`).toBe(401);
    }
    expect((await raw(path, 'HEAD')).status).toBe(401);
    expect((await raw(path, 'POST', { 'next-action': 'fixture' })).status).toBe(401);
  }
  for (const path of ['/audits/missing/sales/', '/audits//missing/sales', '/%61udits/missing/sales', '/AUDITS/missing/sales', '/frontdesk/../audits/missing/sales', '/frontdesk/%2e%2e/audits/missing/sales', '/frontdesk/login/../../audits/missing/sales', '/frontdesk%2faudits/missing/sales']) {
    const res = await raw(path, 'GET', { cookie: `wbi_fd_session=${token}` });
    expect([401, 308], path).toContain(res.status);
    if (res.status === 308) expect((await raw(new URL(res.location!, baseURL).pathname)).status).toBe(401);
  }
});

test('operator access is preserved and login slug is reserved at tenant creation', async ({ request }) => {
  const headers = { authorization: basic };
  expect((await request.get('/', { headers })).status()).toBe(200);
  const index = await request.get('/frontdesk', { headers });
  expect(index.status()).toBe(200);
  expect(await index.text()).toContain('Isolated Restaurant B');
  expect((await request.get('/frontdesk/fixture-a', { headers })).status()).toBe(200);
  const reserved = await request.post('/api/frontdesk/tenants', { headers, data: { slug: 'login', name: 'collision', config: demoTenantConfig } });
  expect(reserved.status()).toBe(400);
  expect(await db.fdTenant.findUnique({ where: { slug: 'login' } })).toBeNull();
});

test('read-only collision preflight blocks even a suspended tenant with invalid config', async () => {
  const run = () => spawnSync(process.execPath, ['scripts/check-frontdesk-login-slug.mjs'], { encoding: 'utf8', timeout: 10000 });
  expect(run().status).toBe(0);
  const collision = await db.fdTenant.create({ data: { slug: 'login', name: 'Collision fixture', status: 'SUSPENDED', config: {} } });
  try {
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('BLOCKED: an existing tenant uses slug login');
  } finally {
    await db.fdTenant.delete({ where: { id: collision.id } });
  }
});
