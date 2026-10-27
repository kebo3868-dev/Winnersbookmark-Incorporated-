/**
 * Security headers on every response (#72 hardening). The served headers are
 * checked against a production build in the PR verification; this pins what
 * the configuration asks for, so a later edit cannot drop one silently.
 */
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config.mjs';
import { SECURITY_HEADERS } from '../src/lib/securityHeaders.mjs';

describe('security headers', () => {
  it('apply to every path, pages and API alike', async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: '/:path*', headers: SECURITY_HEADERS }]);
  });

  it('refuse framing, sniffing, referrers and indexing', () => {
    const byKey = Object.fromEntries(SECURITY_HEADERS.map((h: { key: string; value: string }) => [h.key, h.value]));
    expect(byKey['X-Frame-Options']).toBe('DENY');
    expect(byKey['Content-Security-Policy']).toMatch(/frame-ancestors 'none'/);
    expect(byKey['X-Content-Type-Options']).toBe('nosniff');
    expect(byKey['Referrer-Policy']).toBe('no-referrer');
    expect(byKey['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('set no script or style policy that would block the app without nonces', () => {
    const csp = SECURITY_HEADERS.find((h: { key: string }) => h.key === 'Content-Security-Policy')!.value;
    expect(csp).not.toMatch(/script-src|style-src|default-src/);
  });

  it('keep HSTS to this host only', () => {
    const hsts = SECURITY_HEADERS.find((h: { key: string }) => h.key === 'Strict-Transport-Security')!.value;
    expect(hsts).not.toMatch(/includeSubDomains|preload/);
  });
});
