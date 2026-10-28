import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const basic = `Basic ${Buffer.from('operator:fixture-password').toString('base64')}`;
const cookie = `wbi_fd_session=${'f'.repeat(43)}`;

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('BASIC_AUTH_USER', 'operator');
  vi.stubEnv('BASIC_AUTH_PASSWORD', 'fixture-password');
  vi.stubEnv('FRONTDESK_PUBLIC_ENDPOINT_ENABLED', 'false');
});
afterEach(() => vi.unstubAllEnvs());

function request(path: string, method = 'GET', headers: Record<string, string> = {}) {
  return middleware(new NextRequest(`https://fixture.invalid${path}`, { method, headers }));
}

describe('Front Desk browser entry boundary', () => {
  it.each(['GET', 'HEAD'])('allows only the exact login document for %s', (method) => {
    const response = request('/frontdesk/login', method);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.has('www-authenticate')).toBe(false);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('does not exempt login %s', (method) => {
    expect(request('/frontdesk/login', method).status).toBe(401);
  });

  it.each(['/frontdesk', '/frontdesk/bistro', '/frontdesk/login/child', '/frontdesk/%6cogin'])('%s redirects without granting access', (path) => {
    const response = request(`${path}?next=https://attacker.invalid/`);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://fixture.invalid/frontdesk/login');
    expect(response.headers.has('www-authenticate')).toBe(false);
  });

  it('allows RSC and prefetch for the exact login document', () => {
    expect(request('/frontdesk/login?_rsc=fixture', 'GET', {
      rsc: '1', 'next-router-prefetch': '1', purpose: 'prefetch',
    }).headers.get('x-middleware-next')).toBe('1');
  });

  it('preserves operator navigation and defers plausible sessions to the surface', () => {
    expect(request('/frontdesk', 'GET', { authorization: basic }).headers.get('x-middleware-next')).toBe('1');
    expect(request('/frontdesk/bistro', 'GET', { cookie }).headers.get('x-middleware-next')).toBe('1');
    expect(request('/frontdesk/bistro', 'GET', { cookie: 'wbi_fd_session=malformed' }).status).toBe(307);
  });

  it.each(['/', '/audits', '/audits/id/report', '/audits/id/sales', '/api/audits/id/report/pdf', '/leads', '/frontdeskish', '/api/frontdesk/bistro/readiness', '/api/frontdesk/bistro/message'])('keeps %s behind its existing boundary', (path) => {
    expect(request(path).status).toBe(401);
    if (!path.startsWith('/api/frontdesk/')) expect(request(path, 'GET', { cookie }).status).toBe(401);
  });

  it('does not redirect API or write requests', () => {
    expect(request('/api/frontdesk/bistro/readiness').status).toBe(401);
    expect(request('/frontdesk/bistro', 'POST').status).toBe(401);
  });

  it('preserves the explicit public-message opt-in', () => {
    expect(request('/api/frontdesk/bistro/message', 'POST').status).toBe(401);
    vi.stubEnv('FRONTDESK_PUBLIC_ENDPOINT_ENABLED', 'true');
    expect(request('/api/frontdesk/bistro/message', 'POST').headers.get('x-middleware-next')).toBe('1');
    expect(request('/api/frontdesk/bistro/readiness').status).toBe(401);
  });

  it('login remains reachable with stale cookies and missing operator configuration, without a loop', () => {
    vi.stubEnv('BASIC_AUTH_USER', '');
    vi.stubEnv('BASIC_AUTH_PASSWORD', '');
    expect(request('/').status).toBe(503);
    expect(request('/frontdesk').headers.get('location')).toBe('https://fixture.invalid/frontdesk/login');
    expect(request('/frontdesk/login', 'GET', { cookie }).headers.get('x-middleware-next')).toBe('1');
  });
});
