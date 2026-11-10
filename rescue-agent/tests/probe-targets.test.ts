/**
 * PROBE-TARGET SELECTION — pinned before it moved out of runAudit.
 *
 * Which URLs an audit tests, in what order, and with what provenance and
 * exposure, used to be inline in `runAudit`, which needs a database, so it was
 * only "tested" by matching the orchestrator's source text (issue #86, L3).
 * It is now the pure `buildProbeTargets`, and these tests pin its existing
 * behaviour: supplied URLs first, exact-address de-duplication, at most two
 * targets per category, collected pages skipped, and exposure only for a
 * visible anchor. Behaviour specific to #84 is in supplied-visible-link.test.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { buildProbeTargets } from '@/lib/audit/probeTargets';

const SITE = 'https://harborgrill.example/';
const FILLER = `<footer><p>${'Wood-fired seafood on the harbor since 1987, open daily. '.repeat(14)}</p></footer>`;
const page = (body: string, url = SITE) => extractPage(url, url, 200, 'text/html', `<html><body><h1>Harbor Grill</h1>${body}${FILLER}</body></html>`);
const ORDER = 'https://harborgrill.example/order-online';
const BOOK = 'https://www.opentable.com/r/harbor-grill';
const S_ORDER = 'https://order.supplied.example/hg';
const S_BOOK = 'https://book.supplied.example/hg';
const pick = (t: ReturnType<typeof buildProbeTargets>) => t.map((x) => [x.url, x.category, x.exposed, x.supplied]);

describe('buildProbeTargets — existing selection behaviour', () => {
  it('supplied URLs come first (reservation, then ordering), marked supplied and not exposed when the page does not show them', () => {
    const targets = buildProbeTargets({ pages: [page('<p>Visit us.</p>')], reservationUrl: S_BOOK, orderingUrl: S_ORDER, collectedUrls: new Set() });
    expect(pick(targets)).toEqual([
      [S_BOOK, 'reservation', false, true],
      [S_ORDER, 'ordering', false, true],
    ]);
  });

  it('page links follow in reservation, ordering, menu order; a visible anchor is exposed, an embed is not', () => {
    const body = `<a href="${BOOK}">Book a Table</a><a href="${ORDER}">Order Online</a><iframe src="https://order.toasttab.com/online/hg" title="Order online"></iframe><a href="/menu">Menu</a>`;
    const targets = buildProbeTargets({ pages: [page(body)], reservationUrl: null, orderingUrl: null, collectedUrls: new Set() });
    expect(pick(targets)).toEqual([
      [BOOK, 'reservation', true, false],
      [ORDER, 'ordering', true, false],
      ['https://order.toasttab.com/online/hg', 'ordering', false, false],
      ['https://harborgrill.example/menu', 'menu', true, false],
    ]);
  });

  it('an address is tested once: a page link equal to a supplied URL is not queued again', () => {
    const targets = buildProbeTargets({ pages: [page(`<a href="${ORDER}">Order Online</a>`)], reservationUrl: null, orderingUrl: ORDER, collectedUrls: new Set() });
    expect(targets.map((t) => t.url)).toEqual([ORDER]);
    expect(targets[0].supplied).toBe(true);
  });

  it('at most two targets per category, counting supplied ones', () => {
    const links = ['a', 'b', 'c'].map((s) => `<a href="https://harborgrill.example/order-${s}">Order Online ${s}</a>`).join('');
    const withSupplied = buildProbeTargets({ pages: [page(links)], reservationUrl: null, orderingUrl: S_ORDER, collectedUrls: new Set() });
    expect(withSupplied.filter((t) => t.category === 'ordering').map((t) => t.url)).toEqual([S_ORDER, 'https://harborgrill.example/order-a']);
    const without = buildProbeTargets({ pages: [page(links)], reservationUrl: null, orderingUrl: null, collectedUrls: new Set() });
    expect(without.map((t) => t.url)).toEqual(['https://harborgrill.example/order-a', 'https://harborgrill.example/order-b']);
  });

  it('a link to a page the audit already collected is not probed', () => {
    const targets = buildProbeTargets({ pages: [page('<a href="/menu">Menu</a>')], reservationUrl: null, orderingUrl: null, collectedUrls: new Set(['https://harborgrill.example/menu']) });
    expect(targets).toEqual([]);
  });

  it('links are read from every collected page, in page order', () => {
    const pages = [page('<p>Home.</p>'), page(`<a href="${ORDER}">Order Online</a>`, 'https://harborgrill.example/about')];
    expect(buildProbeTargets({ pages, reservationUrl: null, orderingUrl: null, collectedUrls: new Set() }).map((t) => t.url)).toEqual([ORDER]);
  });

  it('empty or missing supplied inputs add nothing', () => {
    expect(buildProbeTargets({ pages: [page('<p>Home.</p>')], reservationUrl: '', orderingUrl: undefined, collectedUrls: new Set() })).toEqual([]);
  });
});

describe('the orchestrator uses buildProbeTargets', () => {
  // Replaces the source-text regexes in supplied-url-provenance.test.ts for the
  // selection logic itself; this only checks the wiring, which has no logic.
  const src = fs.readFileSync(path.resolve(__dirname, '../src/lib/audit/orchestrator.ts'), 'utf8');
  it('runAudit builds its probe targets with buildProbeTargets and forwards supplied and exposed', () => {
    expect(src).toMatch(/buildProbeTargets\(\{/);
    expect(src).toMatch(/exposedInCustomerJourney: target\.exposed/);
    expect(src).toMatch(/suppliedForAudit: target\.supplied/);
    expect(src).not.toMatch(/probeTargets\.push\(/);
  });
});
