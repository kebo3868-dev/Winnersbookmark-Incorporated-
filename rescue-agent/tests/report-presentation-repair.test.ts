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
import { buildScenario, formatApproxUSD, SCENARIO_DISCLAIMER } from '@/lib/reports/scenarios';
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

describe('illustrative scenarios are stated as models, not measurements', () => {
  it('no scenario output is printed to the cent', () => {
    for (const kind of ['phone', 'reservation', 'ordering', 'lead', 'reactivation', 'website'] as const) {
      const sc = buildScenario(kind);
      expect(sc.annualExposure, kind).not.toMatch(/\.\d{2}/);
      expect(sc.monthlyExposure, kind).not.toMatch(/\.\d{2}/);
      expect(sc.annualExposure, kind).toMatch(/^about \$/);
    }
  });

  it('the exact arithmetic is still available, so precision was moved and not lost', () => {
    const sc = buildScenario('phone', 'friction');
    expect(sc.annualExposureCents).toBe(2_463_750);
    expect(sc.monthlyExposureCents).toBe(205_313);
  });

  it('rounds to two significant figures', () => {
    expect(formatApproxUSD(2_463_750)).toBe('about $25,000');
    expect(formatApproxUSD(205_313)).toBe('about $2,100');
    expect(formatApproxUSD(99_900)).toBe('about $1,000');
    expect(formatApproxUSD(0)).toBe('$0');
  });

  it('the section disclaimer rules out all three misreadings the numbers invite', () => {
    // "Not confirmed losses" alone left open: already lost, recoverable by
    // fixing the pathway, and addable into a total. The third is actively
    // wrong — the same guest appears in more than one scenario.
    expect(SCENARIO_DISCLAIMER).toMatch(/not confirmed losses/i);
    expect(SCENARIO_DISCLAIMER).toMatch(/not guaranteed recoveries/i);
    expect(SCENARIO_DISCLAIMER).toMatch(/not additive/i);
    expect(SCENARIO_DISCLAIMER).toMatch(/do not add them together/i);
    expect(SCENARIO_DISCLAIMER).toMatch(/no money has been measured leaving the business/i);
  });

  it('every scenario still shows every assumption it used', () => {
    for (const kind of ['phone', 'reservation', 'ordering', 'lead', 'reactivation', 'website'] as const) {
      const sc = buildScenario(kind);
      expect(sc.assumptions.length, kind).toBeGreaterThan(0);
      for (const a of sc.assumptions) expect(a.qualifier, kind).toBe('illustrative assumption');
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

describe('the PDF does not print the same scenario twice', () => {
  it('a finding card carries a pointer to Section 03, not a second copy of the figures', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const dto = buildExecutiveReport(reportInput());
    const scenario = dto.findings[0]?.scenario;
    expect(scenario, 'fixture must produce a finding with a scenario').toBeDefined();

    const text = pdfStrings(React.createElement(ExecutivePdf, { dto })).join('\u0000');
    const occurrences = text.split(scenario!.monthlyExposure).length - 1;
    // Once, in Section 03. It used to appear twice: Section 03 and again inside
    // the matching finding card, putting the same model figure in front of the
    // reader twice and blurring the line between a model and an evidenced
    // finding.
    expect(occurrences, `"${scenario!.monthlyExposure}" should appear exactly once`).toBe(1);
    expect(text).toContain('An optional illustrative scenario for this pathway is shown in Section 03');
    // And the pointer says what the scenario is not.
    expect(text).toContain('not a measured loss');
  }, 60_000);

  it('the scenario section still carries the full disclaimer', async () => {
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

  it('scenario figures read as words, not symbols', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const dto = buildExecutiveReport(reportInput());
    const text = pdfStrings(React.createElement(ExecutivePdf, { dto })).join('\u0000');
    expect(text).not.toContain('≈');
    expect(text).toMatch(/about \$[\d,]+/);
  }, 60_000);
});

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
    const text = pdfStrings(React.createElement(ExecutivePdf, { dto })).join('\u0000');
    expect(text).toContain(`${dto.findings[0].number}. ${dto.findings[0].title} — continued`);
  }, 60_000);

  it('a card that fits one page carries no continuation label at all', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const dto = buildExecutiveReport(reportInput());
    expect(findingMaySpanPages(dto.findings[0])).toBe(false);
    const text = pdfStrings(React.createElement(ExecutivePdf, { dto })).join('\u0000');
    expect(text).not.toContain('— continued');
  }, 60_000);
});
