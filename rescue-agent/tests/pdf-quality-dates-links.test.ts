/**
 * EXECUTIVE PDF QUALITY: PAGE BREAKS, AUDIT DATE AND LINKS (Leverock's PDF review).
 *
 * 1. Page breaks. A short finding card is kept whole; a taller one may break
 *    only between units that each hold a real share of it (never a title and
 *    one paragraph at the foot of a page), under a continuation label. The
 *    estimate behind this must never fall short — an unbreakable block taller
 *    than the page runs off its bottom edge, which react-pdf reports as "can't
 *    wrap between pages and it's bigger than available page height". The
 *    methodology list never carries a single bullet over on its own.
 * 2. Audit date. The date printed is the calendar date in America/New_York, not
 *    in UTC: an audit completed on a Florida evening is not dated the next day.
 *    The stored timestamp is read, never changed, and the web report and the
 *    PDF print the same date.
 * 3. Links. The consultant's telephone number, the restaurant's website and
 *    every evidence source in the appendix are clickable, each to the address
 *    exactly as recorded; appendix addresses are printed in full.
 *
 * Driven through the real loader, web report page and PDF route over the stored
 * Leverock's audit (tests/fixtures/leverocks-stored-audit.json).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import zlib from 'node:zlib';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import storedFixture from './fixtures/leverocks-stored-audit.json';
import { REPORT_TIME_ZONE, reportCalendarDate } from '@/lib/reports/reportDate';
import {
  ExecutivePdf,
  METHODOLOGY_TAIL,
  PAGE_CONTENT_HEIGHT,
  MIN_PART,
  SHORT_CARD,
  estimatedFindingHeight,
  estimatedFindingParts,
  findingLayout,
  findingMaySpanPages,
  methodologyGroups,
  pdfDrawableDeep,
  webHref,
} from '@/lib/pdf/ExecutivePdf';
import type { ExecutiveReportDTO } from '@/lib/reports/executive';

(globalThis as { React?: typeof React }).React = React;

type Stored = typeof storedFixture;
const AUDIT_ID = 'cmvpdfquality000000000001';
/** 9:15 pm Eastern Standard Time on Saturday 7 November 2026 — already 8 November in UTC. */
const FLORIDA_EVENING = new Date('2026-11-08T02:15:00.000Z');

let completedAt: Date | null = FLORIDA_EVENING;
let edit: (s: Stored) => void = () => {};
function storedAudit() {
  const s: Stored = structuredClone(storedFixture);
  edit(s);
  return {
    id: AUDIT_ID, restaurantId: 'cmvrestaurantleverocks001', status: 'COMPLETED', demoMode: false,
    createdAt: new Date('2026-11-08T02:05:00.000Z'), completedAt,
    avgTicketInput: null, overallScore: s.overallScore, coverageScore: s.coverageScore,
    orderingUrlInput: null, reservationUrlInput: null, socialUrlInput: null, googleBusinessUrl: null,
    restaurant: { name: "Leverock's Great Seafood", websiteUrl: 'https://www.leverocks.example/', city: 'St. Petersburg', state: 'FL' },
    sources: s.sources, evidence: s.evidence, opportunities: s.opportunities, journeyStages: s.journeyStages, scores: s.scores,
    reports: [{ content: { executiveSummary: 'Stored summary.', aiNarrativeUsed: false, recommendation: { tier: 'AI DISCOVERY AUDIT', rationale: 'x' } } }],
  };
}
const writes: string[] = [];
vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findUnique: async () => storedAudit(), update: async () => { writes.push('audit.update'); throw new Error('write'); } },
    report: { update: async () => { writes.push('report.update'); throw new Error('write'); } },
    opportunity: { update: async () => { writes.push('opportunity.update'); throw new Error('write'); } },
    evidence: { update: async () => { writes.push('evidence.update'); throw new Error('write'); } },
  },
  resolveDatabaseUrl: () => 'postgresql://localhost:5432/test',
  resolveDatabaseUrlSource: () => 'DATABASE_URL',
  RUNTIME_URL_SOURCES: ['DATABASE_URL'],
}));
const AUTH = `Basic ${Buffer.from('operator:operator-password-for-tests-0001').toString('base64')}`;
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name.toLowerCase() === 'authorization' ? AUTH : null) }),
  cookies: async () => ({ get: () => undefined }),
}));
const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, BASIC_AUTH_USER: 'operator', BASIC_AUTH_PASSWORD: 'operator-password-for-tests-0001' };
  completedAt = FLORIDA_EVENING;
  edit = () => {};
  writes.length = 0;
});
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

async function loadDto(): Promise<ExecutiveReportDTO> {
  const { checkOperator } = await import('@/lib/operatorAuth');
  const { loadExecutiveReport } = await import('@/lib/reports/executiveData');
  const check = checkOperator(AUTH);
  if (!check.ok) throw new Error('operator refused');
  const result = await loadExecutiveReport(check.operator, AUDIT_ID);
  if (result.status !== 'ok') throw new Error(result.status);
  return result.dto;
}
async function webText(): Promise<string> {
  const Page = (await import('@/app/audits/[auditId]/report/page')).default;
  return renderToStaticMarkup((await Page({ params: Promise.resolve({ auditId: AUDIT_ID }) })) as React.ReactElement)
    .replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}
async function routePdf(): Promise<Buffer> {
  const { GET } = await import('@/app/api/audits/[auditId]/report/pdf/route');
  const response = await GET(new Request(`https://x.invalid/api/audits/${AUDIT_ID}/report/pdf`, { headers: { authorization: AUTH } }), {
    params: Promise.resolve({ auditId: AUDIT_ID }),
  });
  expect(response.status).toBe(200);
  return Buffer.from(await response.arrayBuffer());
}

/** Renders a DTO, returning the PDF and every layout warning react-pdf raised. */
async function render(dto: ExecutiveReportDTO): Promise<{ pdf: Buffer; overflows: string[] }> {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const overflows: string[] = [];
  const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    const message = args.map(String).join(' ');
    if (/bigger than available page height/i.test(message)) overflows.push(message);
  });
  try {
    const pdf = await renderToBuffer(React.createElement(ExecutivePdf, { dto }) as never);
    return { pdf: Buffer.from(pdf), overflows };
  } finally {
    spy.mockRestore();
  }
}

/** Text drawn in the PDF (both the one-byte and the two-byte font runs), in content-stream order. */
function drawnText(pdf: Buffer): string {
  const latin = pdf.toString('latin1');
  const runs: string[] = [];
  for (const match of latin.matchAll(/stream\r?\n/g)) {
    const start = match.index! + match[0].length;
    let data = pdf.subarray(start, latin.indexOf('endstream', start));
    try { data = zlib.inflateSync(data); } catch { continue; }
    for (const run of data.toString('latin1').matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const hex = [...run[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => h[1]).join('');
      const step = hex.length > 0 && /^(00[0-9a-fA-F]{2})+$/.test(hex) ? 4 : 2;
      let text = '';
      for (let i = 0; i < hex.length; i += step) text += String.fromCharCode(parseInt(hex.slice(i, i + step), 16));
      runs.push(text);
    }
  }
  return runs.join(' ');
}
/** Link targets of the PDF's link annotations. */
function linkTargets(pdf: Buffer): string[] {
  return [...pdf.toString('latin1').matchAll(/\/URI \(((?:\\.|[^\\)])*)\)/g)].map((m) => m[1].replace(/\\(.)/g, '$1'));
}
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// ── 2. Audit date ──────────────────────────────────────────────────────────

describe('the audit date is the calendar date in America/New_York', () => {
  const cases: Array<[string, string, string]> = [
    // Eastern Standard Time (UTC-5): midnight UTC is 7 pm the evening before.
    ['2026-11-08T00:00:00Z', '2026-11-07', 'UTC midnight, EST'],
    ['2026-11-08T02:15:00Z', '2026-11-07', 'Florida evening, already the next day in UTC'],
    ['2026-11-08T04:59:59Z', '2026-11-07', 'one second before Eastern midnight, EST'],
    ['2026-11-08T05:00:00Z', '2026-11-08', 'Eastern midnight, EST'],
    // Eastern Daylight Time (UTC-4).
    ['2026-07-01T03:59:59Z', '2026-06-30', 'one second before Eastern midnight, EDT'],
    ['2026-07-01T04:00:00Z', '2026-07-01', 'Eastern midnight, EDT'],
    // Spring forward, 8 March 2026: 2 am EST becomes 3 am EDT.
    ['2026-03-08T04:59:59Z', '2026-03-07', 'the evening before spring forward'],
    ['2026-03-08T05:00:00Z', '2026-03-08', 'midnight on the spring-forward day (still EST)'],
    ['2026-03-08T07:30:00Z', '2026-03-08', '3:30 am EDT, just after the clocks went forward'],
    ['2026-03-09T03:59:59Z', '2026-03-08', 'the evening after spring forward (now EDT)'],
    // Fall back, 1 November 2026: 2 am EDT becomes 1 am EST.
    ['2026-11-01T03:59:59Z', '2026-10-31', 'the evening before fall back (EDT)'],
    ['2026-11-01T04:00:00Z', '2026-11-01', 'midnight on the fall-back day (still EDT)'],
    ['2026-11-01T05:30:00Z', '2026-11-01', '1:30 am EDT, the first of the repeated hour'],
    ['2026-11-01T06:30:00Z', '2026-11-01', '1:30 am EST, the second of the repeated hour'],
    ['2026-11-02T04:59:59Z', '2026-11-01', 'the evening after fall back (now EST)'],
  ];
  for (const [at, expected, label] of cases) {
    it(`${label}: ${at} -> ${expected}`, () => {
      expect(reportCalendarDate(new Date(at))).toBe(expected);
    });
  }

  it('the display zone is America/New_York, and another zone can be given', () => {
    expect(REPORT_TIME_ZONE).toBe('America/New_York');
    expect(reportCalendarDate(new Date('2026-11-08T02:15:00Z'), 'UTC')).toBe('2026-11-08');
    expect(reportCalendarDate(new Date('2026-11-08T02:15:00Z'), 'America/Chicago')).toBe('2026-11-07');
  });

  it('the loader, the web report and the PDF all print 7 November for a Florida-evening audit; the timestamp is unchanged', async () => {
    const before = FLORIDA_EVENING.toISOString();
    const dto = await loadDto();
    expect(dto.cover.auditDate).toBe('2026-11-07');
    expect(dto.valueSignals.auditDate).toBe('2026-11-07');
    const web = await webText();
    expect(web).toContain('Audit date: 2026-11-07');
    expect(web).not.toContain('2026-11-08');
    const text = squash(drawnText(await routePdf()));
    expect(text).toContain(squash('Audit date: 2026-11-07'));
    expect(text).not.toContain('20261108');
    expect(FLORIDA_EVENING.toISOString()).toBe(before);
    expect(writes).toEqual([]);
  }, 60_000);

  it('an audit with no completion time is dated by its creation time, in the same zone', async () => {
    completedAt = null;
    expect((await loadDto()).cover.auditDate).toBe('2026-11-07');
  });

  it('a morning audit keeps its own date', async () => {
    completedAt = new Date('2026-11-07T14:00:00Z');
    expect((await loadDto()).cover.auditDate).toBe('2026-11-07');
  });
});

// ── 3. Links ───────────────────────────────────────────────────────────────

describe('PDF links open the recorded addresses', () => {
  it('webHref links only absolute http(s) addresses, exactly as recorded', () => {
    expect(webHref('https://www.leverocks.example/')).toBe('https://www.leverocks.example/');
    expect(webHref('http://legacy.example/menu')).toBe('http://legacy.example/menu');
    for (const bad of [null, undefined, '', 'javascript:alert(1)', 'data:text/html,x', 'ftp://x.example/', '/relative/path', 'www.example.com', 'https://a.example/ b', 'tel:+17272915965']) {
      expect(webHref(bad), String(bad)).toBeNull();
    }
  });

  it('the telephone number, the website and every appendix source are clickable', async () => {
    const dto = await loadDto();
    const pdf = await routePdf();
    const targets = linkTargets(pdf);
    expect(dto.cta.phoneHref).toMatch(/^tel:\+1\d{10}$/);
    expect(targets).toContain(dto.cta.phoneHref);
    expect(targets).toContain('https://www.leverocks.example/');
    const sources = [...new Set(dto.appendix.map((e) => e.sourceUrl).filter((u): u is string => Boolean(u)))];
    expect(sources.length).toBeGreaterThan(0);
    for (const url of sources) expect(targets, url).toContain(url);
    // Nothing but the recorded addresses and the telephone number is linked.
    for (const target of targets) expect([dto.cta.phoneHref, 'https://www.leverocks.example/', ...sources], target).toContain(target);
  }, 60_000);

  it('a long appendix address is printed in full (no ellipsis) and linked unchanged', async () => {
    const long = 'https://www.leverocks.example/party?source=pop_up&spot_id=78550&destination=private_parties&promotion=holiday_party';
    expect(long.length).toBeGreaterThan(90);
    const dto = await loadDto();
    const row = dto.appendix.find((e) => e.sourceUrl);
    if (!row) throw new Error('no appendix source');
    row.sourceUrl = long;
    const { pdf, overflows } = await render(dto);
    expect(overflows).toEqual([]);
    expect(linkTargets(pdf)).toContain(long);
    expect(squash(drawnText(pdf))).toContain(squash(long));
  }, 60_000);

  it('a recorded value that is not an http(s) address is printed, never linked', async () => {
    const dto = await loadDto();
    dto.appendix[0].sourceUrl = 'javascript:alert(1)';
    dto.cover.websiteUrl = 'javascript:alert(2)';
    const targets = linkTargets((await render(dto)).pdf);
    expect(targets.some((t) => /^javascript:/i.test(t))).toBe(false);
  }, 60_000);
});

describe('characters the PDF fonts cannot draw', () => {
  it('the arrow in example-link evidence prints as "->" in the PDF; the report data keeps the arrow', async () => {
    const dto = await loadDto();
    dto.appendix[0].supportingContext = 'Example link text: "Book your party" → https://www.leverocks.example/party';
    const drawable = pdfDrawableDeep(dto);
    expect(drawable.appendix[0].supportingContext).toBe('Example link text: "Book your party" -> https://www.leverocks.example/party');
    expect(dto.appendix[0].supportingContext).toContain('→');
    const text = drawnText((await render(dto)).pdf);
    expect(text).toContain('"Book your party" ->');
    expect(text).not.toContain(String.fromCharCode(0x2192));
  }, 60_000);
});

// ── 1. Page breaks ─────────────────────────────────────────────────────────

describe('finding cards: short ones whole, taller ones never broken into a fragment', () => {
  it('the Leverock\'s findings render whole, without a continuation label', async () => {
    const dto = await loadDto();
    expect(dto.findings.length).toBeGreaterThanOrEqual(3);
    const { pdf, overflows } = await render(dto);
    expect(overflows).toEqual([]);
    const text = squash(drawnText(pdf));
    for (const f of dto.findings) expect(text).not.toContain(squash(`${f.number}. ${f.title} continued`));
  }, 60_000);

  it('the estimate grows with the text, and a card longer than a page is allowed to break', async () => {
    const dto = await loadDto();
    const f = dto.findings[1];
    const longer = { ...f, problem: `${f.problem} ${'More stored description of this finding. '.repeat(60)}` };
    expect(estimatedFindingHeight(longer)).toBeGreaterThan(estimatedFindingHeight(f));
    expect(estimatedFindingHeight(longer)).toBeGreaterThan(PAGE_CONTENT_HEIGHT);
    expect(findingMaySpanPages(longer)).toBe(true);
  });

  it('a short card is whole; a taller card opens and closes with at least MIN_PART of it', async () => {
    const dto = await loadDto();
    const short = { ...dto.findings[1], problem: 'Short.', whyItMatters: 'Short.', commercialEffect: '', whatWeKnow: [], whatWeDoNotKnow: 'Short.', recommendedAction: 'Short.', evidenceBasis: null, scenarioKind: null } as typeof dto.findings[1];
    expect(estimatedFindingHeight(short)).toBeLessThanOrEqual(SHORT_CARD);
    expect(findingLayout(short)).toEqual({ kind: 'whole' });
    for (const f of dto.findings) {
      const layout = findingLayout(f);
      const parts = estimatedFindingParts(f);
      if (layout.kind === 'whole') continue;
      expect(layout.groups.reduce((t, g) => t + g, 0)).toBe(parts.blocks.length);
      const card = estimatedFindingHeight(f);
      const first = parts.head + parts.blocks.slice(0, layout.groups[0]).reduce((t, b) => t + b.height, 0);
      const last = parts.blocks.slice(parts.blocks.length - layout.groups[layout.groups.length - 1]).reduce((t, b) => t + b.height, 0) + parts.foot;
      expect(first, f.title).toBeGreaterThanOrEqual(Math.min(card * MIN_PART, card - last));
      expect(last, f.title).toBeGreaterThanOrEqual(Math.min(card * MIN_PART, card - first));
    }
  });

  it('the estimate covers the blocks the card draws, in the order it draws them', async () => {
    const dto = await loadDto();
    for (const f of dto.findings) {
      const expected = [
        ...(f.evidenceBasis ? ['basis'] : []),
        'problem', 'why',
        ...(f.commercialEffect ? ['effect'] : []),
        ...(f.whatWeKnow.length > 0 ? ['known'] : []),
        'unknown', 'action',
      ];
      expect(estimatedFindingParts(f).blocks.map((b) => b.key), f.title).toEqual(expected);
    }
  });

  // The safety property: no unit held together runs off the page. Lengths
  // step through short, whole-page and longer-than-a-page cards in each field.
  it('no unbreakable unit runs off the page, across card lengths', async () => {
    const base = await loadDto();
    const filler = 'Observed on the public page, and requiring the restaurant\'s own records to confirm. ';
    const layouts = new Set<string>();
    for (const field of ['problem', 'recommendedAction', 'whatWeDoNotKnow'] as const) {
      for (let repeats = 0; repeats <= 40; repeats += 4) {
        const dto = structuredClone(base);
        dto.findings[1] = { ...dto.findings[1], [field]: `${dto.findings[1][field]} ${filler.repeat(repeats)}` };
        layouts.add(JSON.stringify(findingLayout(dto.findings[1])));
        const { overflows } = await render(dto);
        expect(overflows, `${field} +${repeats}`).toEqual([]);
      }
    }
    // Several different groupings were exercised, not one.
    expect(layouts.size).toBeGreaterThanOrEqual(3);
  }, 240_000);
});

describe('methodology bullets: never one carried over alone', () => {
  it('the last bullets always travel together', () => {
    for (let n = 0; n <= 12; n++) {
      const lines = Array.from({ length: n }, (_, i) => `bullet ${i}`);
      const groups = methodologyGroups(lines);
      expect(groups.flat()).toEqual(lines);
      if (n >= METHODOLOGY_TAIL) expect(groups[groups.length - 1]).toHaveLength(METHODOLOGY_TAIL);
      if (n > 0 && n < METHODOLOGY_TAIL) expect(groups).toEqual([lines]);
    }
  });

  it('the rendered Leverock\'s report labels a methodology continuation and an appendix continuation at most once per page', async () => {
    const { pdf, overflows } = await render(await loadDto());
    expect(overflows).toEqual([]);
    const text = squash(drawnText(pdf));
    expect(text.split('section10methodologylimitationscontinued').length - 1).toBeLessThanOrEqual(1);
    // The appendix runs over several pages; each later page names it.
    expect(text.split('appendixfullevidencechaincontinued').length - 1).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
