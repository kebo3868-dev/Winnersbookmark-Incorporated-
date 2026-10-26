/**
 * PRESENTATION REPAIRS — the report has to be readable to be credible.
 *
 * Mobile overflow and PDF pagination are verified in a real browser and a real
 * render; those results are in the review notes. What is pinned here is the
 * STRUCTURE that makes those results hold, so a later edit that reintroduces a
 * duplicated scenario block or a cent-precise model figure fails here.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import zlib from 'node:zlib';
import type { ExecutivePdf as ExecutivePdfType } from '@/lib/pdf/ExecutivePdf';
import { calculateScenario, formatApproxUSD, SCENARIO_DISCLAIMER } from '@/lib/reports/scenarios';
import { buildExecutiveReport, CONFIDENCE_LEGEND, type ExecutiveReportInput } from '@/lib/reports/executive';
import { findingMaySpanPages } from '@/lib/pdf/ExecutivePdf';
import { CONFIDENCE_BANDS } from '@/lib/scoring/methodology';
import { analyzeJourney } from '@/lib/audit/journey';
import type { EvidenceRecordLike } from '@/types/audit';

const evidence: EvidenceRecordLike[] = [
  { id: 'e1', evidenceType: 'PHONE_VISIBILITY', fact: 'A phone number is publicly displayed ((555) 111-2222).', supportingContext: null, confidence: 95 },
  { id: 'e2', evidenceType: 'CLICK_TO_CALL', fact: 'No click-to-call (tel:) links detected; mobile visitors must dial manually.', supportingContext: null, confidence: 80 },
  { id: 'e3', evidenceType: 'FAQ_SIGNAL', fact: 'No public FAQ pathway was detected on the analyzed website pages.', supportingContext: null, confidence: 65 },
];

const reportInput = (overrides: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput => ({
  auditId: 'c1',
  restaurantName: 'Test Grill',
  websiteUrl: 'https://testgrill.example',
  location: null,
  auditDate: '2026-10-25',
  auditStatus: 'COMPLETED',
  demoMode: false,
  contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
  bookingQrDataUrl: null,
  avgTicket: null,
  overallScore: 68,
  coverageScore: 80,
  sourcesCollected: 7,
  sourcesFailed: 0,
  evidence: evidence.map((e) => ({ ...e, sourceUrl: 'https://testgrill.example' })),
  opportunities: [
    {
      category: 'PHONE-DEPENDENT CUSTOMER JOURNEY',
      title: 'Phone demand is unmeasured',
      problem: 'OBSERVED: no dedicated FAQ page was found. REQUIRES YOUR DATA: how many calls arrive.',
      businessImpact: 'Unmeasured.',
      customerJourneyStage: 'PHONE',
      evidenceIds: ['e3'],
      impactScore: 40,
      urgencyScore: 30,
      confidenceScore: 55,
      aiFitScore: 95,
      rescuePriorityScore: 52,
      recommendedSolution: 'Pull 30 days of call records.',
      manualValidationRequired: true,
    },
  ],
  journey: analyzeJourney(evidence),
  categoryScores: [],
  storedSummary: null,
  storedSummaryWasAiEnhanced: false,
  storedRecommendation: null,
  ...overrides,
});

// Explicit, user-entered figures: the module has no defaults to fall back on.
const ENTERED = {
  phone: { missedCallsPerDay: 5, commercialIntentPercent: 30, averageTransaction: 45, operatingDays: 365 },
  reservation: { lostBookingsPerWeek: 3, partySize: 2, perGuestValue: 40, operatingWeeks: 52 },
  ordering: { abandonedOrdersPerDay: 2, averageOrder: 35, operatingDays: 365 },
  lead: { unansweredInquiriesPerMonth: 2, closePercent: 50, eventValue: 500, operatingMonths: 12 },
  reactivation: { guestsReengagedPerMonth: 20, visitsPerGuest: 2, averageTicket: 40, operatingMonths: 12 },
  website: { lostConversionsPerDay: 3, valuePerConversion: 40, operatingDays: 365 },
} as const;

describe('user-entered scenarios are stated as what-ifs, not measurements', () => {
  it('no scenario output is printed to the cent', () => {
    for (const kind of Object.keys(ENTERED) as (keyof typeof ENTERED)[]) {
      const sc = calculateScenario(kind, ENTERED[kind])!;
      expect(sc.annualExposure, kind).not.toMatch(/\.\d{2}/);
      expect(sc.monthlyExposure, kind).not.toMatch(/\.\d{2}/);
      expect(sc.annualExposure, kind).toMatch(/^about \$/);
    }
  });

  it('the exact arithmetic is still available, so precision was moved and not lost', () => {
    const sc = calculateScenario('phone', ENTERED.phone, 'friction')!;
    expect(sc.annualExposureCents).toBe(2_463_750);
    expect(sc.monthlyExposureCents).toBe(205_313);
  });

  it('rounds to two significant figures', () => {
    expect(formatApproxUSD(2_463_750)).toBe('about $25,000');
    expect(formatApproxUSD(205_313)).toBe('about $2,100');
    expect(formatApproxUSD(99_900)).toBe('about $1,000');
    expect(formatApproxUSD(0)).toBe('$0');
  });

  it('the disclaimer rules out every misreading the numbers invite', () => {
    // Not a measured loss, not a forecast, not a guaranteed recovery, and not
    // additive — the same guest appears in more than one scenario.
    expect(SCENARIO_DISCLAIMER).toMatch(/only the figures you enter/i);
    expect(SCENARIO_DISCLAIMER).toMatch(/not a measured loss/i);
    expect(SCENARIO_DISCLAIMER).toMatch(/not a forecast/i);
    expect(SCENARIO_DISCLAIMER).toMatch(/not a guaranteed recovery/i);
    expect(SCENARIO_DISCLAIMER).toMatch(/do not add them together/i);
  });

  it('every scenario still shows every assumption it used, as the user\'s own', () => {
    for (const kind of Object.keys(ENTERED) as (keyof typeof ENTERED)[]) {
      const sc = calculateScenario(kind, ENTERED[kind])!;
      expect(sc.assumptions.length, kind).toBe(Object.keys(ENTERED[kind]).length);
      for (const a of sc.assumptions) expect(a.qualifier, kind).toBe('your assumption');
    }
  });
});

/**
 * Every string the PDF element tree would draw.
 *
 * Walking the tree rather than the rendered bytes: react-pdf compresses its
 * content streams and encodes glyphs per font, so searching the buffer for a
 * figure finds nothing whether it is there once, twice or not at all — which
 * is how a duplicated block survived in the first place.
 */
function pdfStrings(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || node === false) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) pdfStrings(child, out);
    return out;
  }
  const element = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof element.type === 'function') {
    // A component: render it and walk what it returns.
    const rendered = (element.type as (p: unknown) => unknown)(element.props ?? {});
    return pdfStrings(rendered, out);
  }
  if (element.props && 'children' in element.props) pdfStrings(element.props.children, out);
  return out;
}

describe('the PDF prints no scenario figures', () => {
  it('the export offers the optional calculator, with no dollar amount anywhere', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const dto = buildExecutiveReport(reportInput({ avgTicket: 60 }));
    expect(dto.findings[0].scenarioKind, 'fixture must produce a scenario-eligible finding').toBe('phone');
    expect(dto.scenarioCalculators.map((c) => c.kind)).toEqual(['phone']);

    const text = pdfStrings(React.createElement(ExecutivePdf, { dto })).join('\u0000');
    expect(text).toContain('Optional Scenario Calculator');
    expect(text).not.toMatch(/about \$[\d,]+/);
    expect(text).not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/What This Could Be Costing You/i);
    // The finding points to the calculator and says what it is not.
    expect(text).toContain('An optional calculator for this pathway is described in Section 03');
    expect(text).toContain('not a measured loss, a forecast or a guaranteed recovery');
  }, 60_000);

  it('the calculator section carries the full disclaimer', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const dto = buildExecutiveReport(reportInput());
    const text = pdfStrings(React.createElement(ExecutivePdf, { dto })).join('\u0000');
    expect(text).toContain(SCENARIO_DISCLAIMER);
  }, 60_000);
});

describe('finding pagination', () => {
  it('a card that fits a page is never labelled continued — because it never splits', () => {
    const short = buildExecutiveReport(reportInput()).findings[0];
    expect(findingMaySpanPages(short)).toBe(false);

    const long = buildExecutiveReport(
      reportInput({
        opportunities: [
          {
            ...reportInput().opportunities[0],
            problem: 'A long problem statement that runs on and on. '.repeat(60),
          },
        ],
      }),
    ).findings[0];
    expect(findingMaySpanPages(long)).toBe(true);
  });
});

describe('the confidence rubric is available structurally, not only as prose', () => {
  it('the DTO carries the bands as label/definition pairs', () => {
    const dto = buildExecutiveReport(reportInput());
    expect(dto.confidenceBands).toEqual(CONFIDENCE_BANDS);
    expect(dto.confidenceBands.map(([label]) => label)).toEqual(['Strong', 'Moderate', 'Preliminary']);
  });

  it('the flat legend still contains every band, for anything that needs one string', () => {
    for (const [label] of CONFIDENCE_BANDS) expect(CONFIDENCE_LEGEND, label).toContain(label);
  });
});

describe('the PDF only uses characters its fonts can draw', () => {
  // U+2248 "≈" rendered as a tofu box sitting on the dollar sign of every
  // scenario figure — the number a client looks at hardest. The PDF uses the
  // standard Times and Helvetica families, whose coverage is narrow, so any
  // character outside this set has to be checked by eye before it ships.
  const DRAWABLE = /^[\x20-\x7E -ÿ–—‘’“”•·…★×\n\t]*$/;

  it('no string in the rendered tree carries an undrawable character', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const dto = buildExecutiveReport(reportInput());
    const offenders = pdfStrings(React.createElement(ExecutivePdf, { dto }))
      .filter((s) => !DRAWABLE.test(s))
      .map((s) => {
        const bad = [...s].filter((c) => !DRAWABLE.test(c)).map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
        return `${[...new Set(bad)].join(',')} in "${s.slice(0, 60)}"`;
      });
    expect(offenders, `undrawable characters: ${offenders.join(' | ')}`).toEqual([]);
  }, 60_000);

  it('approximate figures read as words, not symbols', () => {
    // The export no longer prints scenario figures; the calculator that does
    // still writes its approximations as words, in case one is ever printed.
    expect(formatApproxUSD(2_463_750)).toBe('about $25,000');
    expect(formatApproxUSD(2_463_750)).not.toContain('≈');
  });
});

/**
 * Text drawn in the one-byte font runs of a rendered PDF.
 *
 * The continuation label cannot be found by walking the element tree: it is a
 * `render` prop, so it has no static children and only materialises during
 * layout, when the page number is known. It is set in Helvetica, which react-pdf
 * encodes one byte per glyph, so it reads back cleanly from the content streams.
 */
async function renderedAsciiText(dto: Parameters<typeof ExecutivePdfType>[0]['dto']): Promise<string> {
  const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
  const { renderToBuffer } = await import('@react-pdf/renderer');
  type PdfElement = Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(React.createElement(ExecutivePdf, { dto }) as unknown as PdfElement);
  const latin = buffer.toString('latin1');
  let out = '';
  let cursor = 0;
  for (;;) {
    const open = latin.indexOf('stream', cursor);
    if (open === -1) break;
    if (latin.slice(open - 3, open) === 'end') {
      cursor = open + 6;
      continue;
    }
    let start = open + 6;
    if (latin[start] === '\r') start++;
    if (latin[start] === '\n') start++;
    const close = latin.indexOf('endstream', start);
    if (close === -1) break;
    let data = buffer.subarray(start, close);
    try {
      data = zlib.inflateSync(data);
    } catch {
      /* not deflate-compressed */
    }
    const text = data.toString('latin1');
    if (/\bBT\b/.test(text)) {
      out += [...text.matchAll(/<([0-9a-fA-F]{1,2})>/g)].map((m) => String.fromCharCode(parseInt(m[1], 16))).join('');
    }
    cursor = close + 9;
  }
  return out;
}

describe('layout and continuation labels agree', () => {

  // The first attempt decided the label from length alone, and a short card
  // wrapped anyway because it started near the foot of a page: the continuation
  // arrived under a bare "THE BUSINESS PROBLEM" heading with nothing saying
  // which finding it belonged to. The card's wrap setting and its labels are
  // now both derived from findingMaySpanPages, so the two cannot disagree.
  it('a card that may span pages carries the finding name on its later blocks', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const long = reportInput({
      opportunities: [
        {
          ...reportInput().opportunities[0],
          problem: 'A long problem statement that runs on and on and on. '.repeat(40),
        },
      ],
    });
    const dto = buildExecutiveReport(long);
    expect(findingMaySpanPages(dto.findings[0])).toBe(true);
    // Rendered, not walked: the label is a render prop that only exists once
    // the page number is known.
    const drawn = await renderedAsciiText(dto);
    expect(drawn.toUpperCase()).toContain('CONTINUED');
  }, 60_000);

  it('a card that fits one page carries no continuation label at all', async () => {
    const dto = buildExecutiveReport(reportInput());
    expect(findingMaySpanPages(dto.findings[0])).toBe(false);
    const drawn = await renderedAsciiText(dto);
    expect(drawn.toUpperCase()).not.toContain('CONTINUED');
  }, 60_000);
});

describe('continuation bookkeeping is per render, not global', () => {
  // Module-scope state is a bug whenever two reports render at once in the
  // same process: react-pdf's layout is async, so a second document starting
  // would clear the first one's recorded pages mid-layout. Each document now
  // creates its own ledger.
  it('two documents rendered concurrently each label their own continuation', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const longInput = reportInput({
      opportunities: [
        {
          ...reportInput().opportunities[0],
          problem: 'A long problem statement that runs on and on and on. '.repeat(40),
        },
      ],
    });
    const dto = buildExecutiveReport(longInput);
    const [a, b] = await Promise.all([renderedAsciiText(dto), renderedAsciiText(dto)]);
    expect(a.toUpperCase(), 'first concurrent render').toContain('CONTINUED');
    expect(b.toUpperCase(), 'second concurrent render').toContain('CONTINUED');
  }, 120_000);

  it('the module exports no mutable continuation state to reset', async () => {
    const mod = await import('@/lib/pdf/ExecutivePdf');
    expect(Object.keys(mod)).not.toContain('resetContinuationState');
  });
});
