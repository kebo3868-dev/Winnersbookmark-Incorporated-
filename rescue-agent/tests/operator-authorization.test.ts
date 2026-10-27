/**
 * OPERATOR AUTHORIZATION, BEHIND THE MIDDLEWARE (#72).
 *
 * Each operator page and API route is driven directly, as if the middleware
 * had been bypassed, with no credential, a wrong credential, a forged Front
 * Desk session and a production deployment with no credential configured.
 * Every one must refuse, and must refuse BEFORE reading anything: the database
 * double records every call and the refused requests must leave it empty.
 * With the operator credential the same handlers get past the check.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import React from 'react';

// Pages are rendered by calling them; the test transform needs React in scope for their JSX.
(globalThis as { React?: typeof React }).React = React;

const calls: string[] = [];

/** Every model and method; safe empty answers, and a record of each call. */
const prismaDouble = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_t, method: string) =>
            async (..._args: unknown[]) => {
              calls.push(`${model}.${method}`);
              if (method === 'findMany' || method === 'groupBy') return [];
              if (method === 'count') return 0;
              if (method === 'aggregate') return { _avg: { overallScore: null } };
              if (method === 'deleteMany' || method === 'updateMany') return { count: 0 };
              if (method === 'findUnique' || method === 'findFirst') return null;
              return {};
            },
        },
      ),
  },
);

const requestContext = { headers: new Map<string, string>(), cookies: new Map<string, string>() };

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => requestContext.headers.get(name.toLowerCase()) ?? null }),
  cookies: async () => ({
    get: (name: string) => {
      const value = requestContext.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaDouble,
  resolveDatabaseUrl: () => 'postgresql://localhost:5432/test',
  resolveDatabaseUrlSource: () => 'DATABASE_URL',
  RUNTIME_URL_SOURCES: ['DATABASE_URL'],
}));

const USER = 'operator';
const PASSWORD = 'operator-password-for-tests-0001';
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
const FORGED_SESSION = `wbi_fd_session=${'A'.repeat(44)}`;
const AUDIT_ID = 'cmvq00000000000000000000a';

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  calls.length = 0;
  requestContext.headers.clear();
  requestContext.cookies.clear();
  process.env = { ...ORIGINAL_ENV, BASIC_AUTH_USER: USER, BASIC_AUTH_PASSWORD: PASSWORD, NODE_ENV: 'production' };
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

type Handler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Every operator API handler, with a request that would otherwise do something. */
const ROUTES: { name: string; load: () => Promise<Handler>; method: string; url: string; params: Record<string, string>; body?: string }[] = [
  { name: 'POST /api/audits', load: async () => (await import('@/app/api/audits/route')).POST as unknown as unknown as Handler, method: 'POST', url: '/api/audits', params: {}, body: '{"websiteUrl":"https://example.com"}' },
  { name: 'GET /api/audits/[id]/report/pdf', load: async () => (await import('@/app/api/audits/[auditId]/report/pdf/route')).GET as unknown as unknown as Handler, method: 'GET', url: `/api/audits/${AUDIT_ID}/report/pdf`, params: { auditId: AUDIT_ID } },
  { name: 'GET /api/audits/[id]/status', load: async () => (await import('@/app/api/audits/[auditId]/status/route')).GET as unknown as unknown as Handler, method: 'GET', url: `/api/audits/${AUDIT_ID}/status`, params: { auditId: AUDIT_ID } },
  { name: 'POST /api/audits/demo', load: async () => (await import('@/app/api/audits/demo/route')).POST as unknown as unknown as Handler, method: 'POST', url: '/api/audits/demo', params: {} },
  { name: 'POST /api/demo/purge', load: async () => (await import('@/app/api/demo/purge/route')).POST as unknown as unknown as Handler, method: 'POST', url: '/api/demo/purge', params: {} },
  { name: 'PATCH /api/leads/[id]', load: async () => (await import('@/app/api/leads/[leadId]/route')).PATCH as unknown as unknown as Handler, method: 'PATCH', url: '/api/leads/lead1', params: { leadId: 'lead1' }, body: '{"status":"CONTACTED"}' },
  { name: 'DELETE /api/leads/[id]', load: async () => (await import('@/app/api/leads/[leadId]/route')).DELETE as unknown as unknown as Handler, method: 'DELETE', url: '/api/leads/lead1', params: { leadId: 'lead1' } },
];

type Page = (props: { params: Promise<Record<string, string>> }) => Promise<unknown>;

/** Every operator page. */
const PAGES: { name: string; load: () => Promise<Page>; params: Record<string, string> }[] = [
  { name: '/ (Command Center)', load: async () => (await import('@/app/page')).default as unknown as unknown as Page, params: {} },
  { name: '/audits', load: async () => (await import('@/app/audits/page')).default as unknown as unknown as Page, params: {} },
  { name: '/audits/new', load: async () => (await import('@/app/audits/new/page')).default as unknown as unknown as Page, params: {} },
  { name: '/audits/[id]', load: async () => (await import('@/app/audits/[auditId]/page')).default as unknown as unknown as Page, params: { auditId: AUDIT_ID } },
  { name: '/audits/[id]/report', load: async () => (await import('@/app/audits/[auditId]/report/page')).default as unknown as unknown as Page, params: { auditId: AUDIT_ID } },
  { name: '/audits/[id]/sales', load: async () => (await import('@/app/audits/[auditId]/sales/page')).default as unknown as unknown as Page, params: { auditId: AUDIT_ID } },
  { name: '/leads', load: async () => (await import('@/app/leads/page')).default as unknown as unknown as Page, params: {} },
];

function request(route: (typeof ROUTES)[number], headers: Record<string, string>) {
  return new NextRequest(`https://rescue.example${route.url}`, {
    method: route.method,
    headers: { 'content-type': 'application/json', ...headers },
    body: route.body,
  });
}

const callRoute = async (route: (typeof ROUTES)[number], headers: Record<string, string> = {}) =>
  (await route.load())(request(route, headers), { params: Promise.resolve(route.params) });

/** notFound() throws a tagged error; that is the page's refusal. */
const isNotFound = (error: unknown) => /404|NOT_FOUND/.test(String((error as { digest?: string })?.digest ?? (error as Error)?.message));

async function renderPage(page: (typeof PAGES)[number], authorization?: string, cookie?: string): Promise<'refused' | 'rendered'> {
  if (authorization) requestContext.headers.set('authorization', authorization);
  if (cookie) requestContext.cookies.set('wbi_fd_session', cookie.split('=')[1]);
  try {
    await (await page.load())({ params: Promise.resolve(page.params) });
    return 'rendered';
  } catch (error) {
    if (isNotFound(error)) return 'refused';
    throw error;
  }
}

describe('checkOperator', () => {
  it('accepts only the operator credential when one is configured', async () => {
    const { checkOperator } = await import('@/lib/operatorAuth');
    const env = { BASIC_AUTH_USER: USER, BASIC_AUTH_PASSWORD: PASSWORD, NODE_ENV: 'production' };
    expect(checkOperator(basic(USER, PASSWORD), env).ok).toBe(true);
    for (const header of [null, basic(USER, 'wrong'), basic('someone', PASSWORD), `Bearer ${PASSWORD}`, 'Basic !!!', `Basic ${USER}:${PASSWORD}`]) {
      expect(checkOperator(header, env), String(header)).toEqual({ ok: false, status: 401 });
    }
  });

  it('fails closed in production without a configured credential, and stays open only in local development', async () => {
    const { checkOperator } = await import('@/lib/operatorAuth');
    expect(checkOperator(basic(USER, PASSWORD), { NODE_ENV: 'production' })).toEqual({ ok: false, status: 503 });
    expect(checkOperator(null, { NODE_ENV: 'development' }).ok).toBe(true);
  });
});

describe('operator API routes refuse before reading anything', () => {
  it.each(ROUTES)('$name: no credential → 401, with a challenge, and no database access', async (route) => {
    const response = await callRoute(route);
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toMatch(/^Basic /);
    expect(calls).toEqual([]);
  });

  it.each(ROUTES)('$name: wrong credential → 401, no database access', async (route) => {
    expect((await callRoute(route, { authorization: basic(USER, 'not-the-password') })).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it.each(ROUTES)('$name: a Front Desk session cookie is not an operator → 401, no database access', async (route) => {
    expect((await callRoute(route, { cookie: FORGED_SESSION })).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it.each(ROUTES)('$name: the middleware-bypass header changes nothing → 401', async (route) => {
    expect((await callRoute(route, { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' })).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it.each(ROUTES)('$name: production with no credential configured → 503, no database access', async (route) => {
    delete process.env.BASIC_AUTH_USER;
    delete process.env.BASIC_AUTH_PASSWORD;
    expect((await callRoute(route, { authorization: basic(USER, PASSWORD) })).status).toBe(503);
    expect(calls).toEqual([]);
  });
});

describe('with the operator credential, the routes get past the check', () => {
  const ok = { authorization: basic(USER, PASSWORD) };

  it('the report PDF looks the audit up (and finds none in the double)', async () => {
    expect((await callRoute(ROUTES[1], ok)).status).toBe(404);
    expect(calls).toContain('audit.findUnique');
  });

  it('the status route looks the audit up', async () => {
    expect((await callRoute(ROUTES[2], ok)).status).toBe(404);
    expect(calls).toContain('audit.findUnique');
  });

  it('a lead update reaches validation and the database', async () => {
    const response = await callRoute(ROUTES[5], ok);
    expect(response.status).not.toBe(401);
    expect(calls).toContain('auditLead.update');
  });

  it('a new audit request reaches body validation', async () => {
    const route = { ...ROUTES[0], body: '{"websiteUrl":""}' };
    expect((await callRoute(route, ok)).status).toBe(400);
  });
});

describe('operator pages refuse before reading anything', () => {
  it.each(PAGES)('$name: no credential → not found, no database access', async (page) => {
    expect(await renderPage(page)).toBe('refused');
    expect(calls).toEqual([]);
  });

  it.each(PAGES)('$name: wrong credential → not found, no database access', async (page) => {
    expect(await renderPage(page, basic(USER, 'nope'))).toBe('refused');
    expect(calls).toEqual([]);
  });

  it.each(PAGES)('$name: a forged Front Desk session → not found, no database access', async (page) => {
    expect(await renderPage(page, undefined, FORGED_SESSION)).toBe('refused');
    expect(calls).toEqual([]);
  });

  it('with the operator credential, the pages get past the check', async () => {
    for (const page of PAGES.filter((p) => p.name === '/audits' || p.name === '/leads' || p.name === '/audits/new')) {
      calls.length = 0;
      expect(await renderPage(page, basic(USER, PASSWORD)), page.name).toBe('rendered');
    }
    for (const page of PAGES.filter((p) => p.name.startsWith('/audits/[id]'))) {
      calls.length = 0;
      // The double holds no audit, so these refuse for a different reason: after the check, on lookup.
      expect(await renderPage(page, basic(USER, PASSWORD)), page.name).toBe('refused');
      expect(calls.length, page.name).toBeGreaterThan(0);
    }
  });
});

describe('the most sensitive loaders demand a real authorization', () => {
  it('the client report and the Sales Brief cannot be loaded with a stand-in', async () => {
    const { loadExecutiveReport } = await import('@/lib/reports/executiveData');
    const { loadSalesBrief } = await import('@/lib/reports/salesData');
    const fake = { via: 'OPERATOR_CREDENTIAL' } as never;
    await expect(loadExecutiveReport(fake, AUDIT_ID)).rejects.toThrow(/Operator authorization required/);
    await expect(loadSalesBrief(fake, AUDIT_ID)).rejects.toThrow(/Operator authorization required/);
    expect(calls).toEqual([]);
  });
});

describe('the middleware is still the outer layer', () => {
  it.each(['/', '/audits', '/audits/new', `/audits/${AUDIT_ID}`, `/audits/${AUDIT_ID}/report`, `/audits/${AUDIT_ID}/sales`, '/leads', '/api/audits', `/api/audits/${AUDIT_ID}/report/pdf`, `/api/audits/${AUDIT_ID}/status`, '/api/audits/demo', '/api/demo/purge', '/api/leads/lead1'])(
    '%s → 401 without the credential',
    async (pathname) => {
      const { middleware } = await import('@/middleware');
      const response = middleware(new NextRequest(`https://rescue.example${pathname}`));
      expect(response.status).toBe(401);
    },
  );
});
