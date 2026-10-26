/**
 * ACCESS-RESTRICTED IS REACHABLE, NOT VERIFIED.
 *
 * probeLink reports HTTP 401, 403 and 429 as ok — the destination exists and
 * answered — with the note "treated as reachable, not verified". The menu
 * bookkeeping read `ok` as success, so a shared "View Menu and Order" link
 * that answered 403 produced "A working menu was verified", a HEALTHY MENU
 * stage and the phone finding cut to 40/30 — on a page the audit never saw
 * (Codex P2 on 05637a1).
 *
 * These tests drive the REAL probeLink against a local server, then the real
 * normalisation, journey and leak rules, and check all three together.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { extractPage, probeLink } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';

let server: http.Server;
let base = '';
const previousAllow = process.env.RESCUE_AGENT_ALLOW_PRIVATE_TARGETS;

beforeAll(async () => {
  // The SSRF guard refuses loopback unless this is set outside production.
  process.env.RESCUE_AGENT_ALLOW_PRIVATE_TARGETS = '1';
  server = http.createServer((req, res) => {
    // /online/<name>-<status> answers with <status> and a real menu page.
    const status = Number((req.url ?? '').split('-').pop()) || 200;
    res.writeHead(status, { 'content-type': 'text/html' });
    res.end('<html><body><h1>Menu</h1><p>Grouper sandwich $18</p></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (previousAllow === undefined) delete process.env.RESCUE_AGENT_ALLOW_PRIVATE_TARGETS;
  else process.env.RESCUE_AGENT_ALLOW_PRIVATE_TARGETS = previousAllow;
});

const HOME = 'https://probe-grill.test/';
const FACTS =
  '<h1>Probe Grill</h1><a href="tel:+17275550000">Call (727) 555-0000</a>' +
  '<p>Hours: Mon-Sun 11am-10pm</p><p>123 Gulf Blvd, Treasure Island, FL 33706</p>';

/** Probe each URL for real, as the orchestrator does, and run the whole pipeline. */
const audit = async (links: { url: string; text: string; category: ProbeResult['category'] }[]) => {
  const probes: ProbeResult[] = [];
  for (const l of links) probes.push({ url: l.url, category: l.category, exposedInCustomerJourney: true, ...(await probeLink(l.url, { timeoutMs: 5000 })) });
  const body = links.map((l) => `<a href="${l.url}">${l.text}</a>`).join('');
  const page = extractPage(HOME, HOME, 200, 'text/html', `<html><head><title>Probe Grill</title></head><body>${FACTS}${body}</body></html>`);
  const ev = normalizeEvidence({ pages: [page], failures: [], probes }).map((e, i) => ({
    id: `a${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    supportingContext: e.supportingContext ?? null,
    confidence: e.confidence,
  }));
  const journey = analyzeJourney(ev);
  return {
    page,
    probes,
    ev,
    availability: ev.find((e) => e.evidenceType === 'MENU_AVAILABILITY')!,
    menu: journey.find((s) => s.stage === 'MENU')!,
    phone: detectRevenueLeaks({ evidence: ev, journey }).find((l) => /PHONE-DEPENDENT/.test(l.category))!,
  };
};
const shared = (status: number) => ({ url: `${base}/online/probe-grill-${status}`, text: 'View Menu and Order', category: 'ordering' as const });
const menuOnly = (status: number) => ({ url: `${base}/menu/probe-grill-${status}`, text: 'Menu', category: 'menu' as const });

const expectUnverified = (r: Awaited<ReturnType<typeof audit>>) => {
  expect(r.availability.fact).toMatch(/^Menu availability was not verified/);
  expect(r.availability.fact).not.toMatch(/working menu was verified/i);
  expect(r.menu.status).toBe('UNKNOWN');
  expect(r.menu.manualValidationRequired).toBe(true);
  expect(r.phone.problem).not.toMatch(/does publish[^.]*the menu/i);
  expect(r.phone.problem).toMatch(/whether it opens a working menu was not verified/i);
  expect([r.phone.impactScore, r.phone.urgencyScore]).toEqual([65, 55]);
  // Not presented as a failure either.
  expect(r.ev.some((e) => e.evidenceType === 'BROKEN_LINK')).toBe(false);
  expect(r.phone.problem).not.toMatch(/cannot be read online/i);
};

describe('access-restricted menu destinations stay unverified', () => {
  it.each([401, 403, 429])('probeLink reports HTTP %i as reachable-not-verified (the premise)', async (status) => {
    const result = await probeLink(`${base}/online/probe-grill-${status}`, { timeoutMs: 5000 });
    expect(result.ok).toBe(true);
    expect(result.httpStatus).toBe(status);
    expect(result.note).toMatch(/treated as reachable, not verified/i);
  });

  it.each([401, 403, 429])('shared menu/ordering link probed as ordering, HTTP %i (codex): unverified everywhere', async (status) => {
    const r = await audit([shared(status)]);
    expect(r.page.categorizedLinks.menu?.length).toBe(1);
    expect(r.page.categorizedLinks.ordering?.length).toBe(1);
    expect(r.availability.supportingContext).toContain('— not verified (Access-restricted destination');
    expectUnverified(r);
    // The ordering claim stays bounded: reachable, order not verified.
    const ordering = r.ev.filter((e) => e.evidenceType === 'ORDERING_PATH').map((e) => e.fact).join(' ');
    expect(ordering).toMatch(/whether a customer can place an order was not verified/i);
  });

  it.each([401, 403, 429])('menu link probed as menu, HTTP %i: unverified, and its own record says so', async (status) => {
    const r = await audit([menuOnly(status)]);
    expectUnverified(r);
    const menuRecords = r.ev.filter((e) => e.evidenceType === 'MENU_ACCESS').map((e) => e.fact);
    expect(menuRecords.join(' ')).toMatch(new RegExp(`could not be verified when tested \\(HTTP ${status}, access restricted\\)`));
    expect(menuRecords.join(' ')).not.toMatch(/responded successfully/i);
  });

  it('an accessible menu (HTTP 200) is still verified, on a shared link and a menu link', async () => {
    for (const link of [shared(200), menuOnly(200)]) {
      const r = await audit([link]);
      expect(r.availability.fact).toBe(`A working menu was verified at ${link.url}.`);
      expect(r.menu.status).toBe('HEALTHY');
      expect(r.phone.problem).toMatch(/does publish[^.]*the menu/i);
      expect([r.phone.impactScore, r.phone.urgencyScore]).toEqual([40, 30]);
    }
  });

  it('a genuinely broken destination (HTTP 404) is still a failure', async () => {
    const r = await audit([shared(404)]);
    expect(r.availability.fact).toMatch(/^No readable menu was found/);
    expect(r.menu.status).toBe('RISK');
    expect(r.phone.problem).toMatch(/cannot be read online/i);
  });

  it('a restricted shared link beside an accessible menu: the accessible menu decides, the restricted one is unverified', async () => {
    const r = await audit([shared(403), menuOnly(200)]);
    expect(r.availability.fact).toBe(`A working menu was verified at ${menuOnly(200).url}; 1 other menu link(s) were not verified.`);
    expect(r.menu.status).toBe('HEALTHY');
    expect([r.phone.impactScore, r.phone.urgencyScore]).toEqual([40, 30]);
  });
});
