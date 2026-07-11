import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';

// Allow the fixture server on loopback for this test run (dev/test only).
process.env.RESCUE_AGENT_ALLOW_PRIVATE_TARGETS = '1';

const SITE: Record<string, string | null> = {
  '/': `
    <html><head><title>Copper Kettle Tavern</title>
    <meta name="description" content="Neighborhood tavern."></head><body>
    <nav>
      <a href="/menu">Menu</a><a href="/contact">Contact</a>
      <a href="/order">Order Online</a>
      <a href="https://reservations.fixture-external.invalid/kettle">Reserve a Table</a>
    </nav>
    <p>Call us at (555) 234-9876. 88 Copper Lane, Kettleton. Open Mon-Sat 11:00am - 9:00pm</p>
    </body></html>`,
  '/menu': `<html><head><title>Menu — Copper Kettle</title></head><body><h1>Menu</h1><a href="/menu.pdf">PDF Menu</a></body></html>`,
  '/contact': `<html><head><title>Contact</title></head><body><p>Email kettle@fixture.invalid — (555) 234-9876</p></body></html>`,
  '/order': null, // 404 — the revenue leak the audit must catch
};

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/huge') {
      // ~8MB chunked HTML page — must not be fully buffered by the collector.
      res.writeHead(200, { 'content-type': 'text/html' });
      res.write('<html><head><title>Huge Page</title></head><body>');
      const chunk = '<p>' + 'x'.repeat(65_000) + '</p>';
      for (let i = 0; i < 128; i++) res.write(chunk);
      res.end('</body></html>');
      return;
    }
    if (url === '/redirect-broken') {
      res.writeHead(302, { location: '/order' });
      res.end();
      return;
    }
    if (url === '/redirect-loop') {
      res.writeHead(302, { location: '/redirect-loop' });
      res.end();
      return;
    }
    const body = SITE[url];
    if (body === undefined || body === null) {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<html><body>Not found</body></html>');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address === 'object' && address) baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('collection engine against a live fixture site', () => {
  it('collects, discovers, probes, and detects the broken ordering link end-to-end', async () => {
    const { fetchPage, probeLink } = await import('@/lib/web/collector');
    const { discoverRelevantPages } = await import('@/lib/web/discovery');
    const { normalizeEvidence } = await import('@/lib/audit/evidence');
    const { analyzeJourney } = await import('@/lib/audit/journey');
    const { detectRevenueLeaks } = await import('@/lib/audit/leaks');
    const { rankOpportunities } = await import('@/lib/scoring/priority');

    const home = await fetchPage(`${baseUrl}/`);
    expect(home.status).toBe('COLLECTED');
    if (home.status !== 'COLLECTED') return;
    expect(home.page.title).toBe('Copper Kettle Tavern');
    expect(home.page.phones[0]).toMatch(/234-9876/);

    const targets = discoverRelevantPages(home.page);
    const pages = [home.page];
    const failures: { url: string; sourceType: string; status: string; note: string }[] = [];
    for (const target of targets) {
      const outcome = await fetchPage(target.url);
      if (outcome.status === 'COLLECTED') pages.push(outcome.page);
      else failures.push({ url: target.url, sourceType: target.sourceType, status: outcome.status, note: outcome.note });
    }
    // /order 404s during collection
    expect(failures.some((f) => f.url.includes('/order'))).toBe(true);

    const orderProbe = await probeLink(`${baseUrl}/order`);
    expect(orderProbe.ok).toBe(false);
    expect(orderProbe.httpStatus).toBe(404);

    const evidenceInputs = normalizeEvidence({
      pages,
      failures,
      probes: [{ url: `${baseUrl}/order`, category: 'ordering', ...orderProbe }],
    });
    const evidence = evidenceInputs.map((e, i) => ({ id: `ev_${i}`, ...e }));
    expect(evidence.some((e) => e.evidenceType === 'BROKEN_LINK')).toBe(true);
    expect(evidence.some((e) => e.evidenceType === 'PHONE_VISIBILITY' && /publicly displayed/.test(e.fact))).toBe(true);

    const journey = analyzeJourney(evidence);
    const ordering = journey.find((s) => s.stage === 'ORDERING');
    expect(ordering!.status).toBe('RISK');

    const leaks = rankOpportunities(detectRevenueLeaks({ evidence, journey }));
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks[0].category).toMatch(/ORDERING FAILURE|BROKEN/i);
    // every leak traces back to real evidence ids
    const evidenceIds = new Set(evidence.map((e) => e.id));
    for (const leak of leaks) {
      expect(leak.evidenceIds.every((id) => evidenceIds.has(id))).toBe(true);
    }
  }, 30_000);

  it('records TIMEOUT/UNAVAILABLE honestly for an unreachable site', async () => {
    const { fetchPage } = await import('@/lib/web/collector');
    const outcome = await fetchPage('http://127.0.0.1:59999/');
    expect(outcome.status).not.toBe('COLLECTED');
    expect(['UNAVAILABLE', 'TIMEOUT', 'ERROR']).toContain(outcome.status);
  }, 30_000);

  it('caps body size for huge chunked responses instead of buffering them fully', async () => {
    const { fetchPage } = await import('@/lib/web/collector');
    const outcome = await fetchPage(`${baseUrl}/huge`);
    expect(outcome.status).toBe('COLLECTED');
    if (outcome.status !== 'COLLECTED') return;
    expect(outcome.page.title).toBe('Huge Page');
    // 2.5MB cap: raw text sample bounded, page still usable.
    expect(outcome.page.textSample.length).toBeLessThanOrEqual(4000);
  }, 30_000);

  it('follows probe redirects manually and reports the final broken destination', async () => {
    const { probeLink } = await import('@/lib/web/collector');
    const probe = await probeLink(`${baseUrl}/redirect-broken`);
    expect(probe.ok).toBe(false);
    expect(probe.httpStatus).toBe(404);
  }, 30_000);

  it('aborts redirect loops at the hop limit', async () => {
    const { probeLink } = await import('@/lib/web/collector');
    const probe = await probeLink(`${baseUrl}/redirect-loop`);
    expect(probe.ok).toBe(false);
    expect(probe.note).toMatch(/redirects/i);
  }, 30_000);
});
