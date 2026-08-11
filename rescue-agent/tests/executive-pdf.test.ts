import { describe, expect, it } from 'vitest';
import React from 'react';
import zlib from 'node:zlib';
import { buildExecutiveReport, type ExecutiveReportInput } from '@/lib/reports/executive';

const input: ExecutiveReportInput = {
  auditId: 'clweirdaudit001',
  restaurantName: 'Ünïcøde & "Weird" <Name>',
  websiteUrl: 'https://weird.example',
  location: null,
  auditDate: '2026-07-12',
  auditStatus: 'COMPLETED',
  demoMode: true,
  contact: {
    company: 'Winners Bookmark Incorporated',
    consultantName: 'Keith Warren',
    phone: '727-291-5965',
    email: null,
    bookingUrl: 'https://book.example/keith',
    fallbackText: 'Contact Keith Warren at 727-291-5965 to schedule your Restaurant Rescue Review.',
  },
  bookingQrDataUrl: null,
  avgTicket: null,
  overallScore: 70,
  coverageScore: 90,
  sourcesCollected: 5,
  sourcesFailed: 0,
  evidence: [
    { id: 'e1', evidenceType: 'CTA_SIGNAL', fact: 'Homepage presents 4 action-oriented CTA(s).', supportingContext: null, confidence: 80, sourceUrl: 'https://weird.example' },
  ],
  opportunities: [
    {
      category: 'PHONE-DEPENDENT CUSTOMER JOURNEY',
      title: 'Phone-dependent journey',
      problem: 'Long problem text. '.repeat(80),
      businessImpact: 'Impact text.',
      customerJourneyStage: 'PHONE',
      evidenceIds: ['e1'],
      impactScore: 75, urgencyScore: 65, confidenceScore: 72, aiFitScore: 95, rescuePriorityScore: 75,
      recommendedSolution: 'Validate then automate.',
      manualValidationRequired: true,
    },
  ],
  journey: [
    { stage: 'PHONE', status: 'FRICTION', finding: 'Phone friction.', manualValidationRequired: true },
    { stage: 'REVIEW', status: 'UNKNOWN', finding: 'Not in scope.', manualValidationRequired: true },
  ],
  categoryScores: [],
  storedSummary: null,
  storedSummaryWasAiEnhanced: false,
  storedRecommendation: null,
};

/**
 * Glyphs drawn on each page, read straight out of the PDF's content streams.
 *
 * There is one content stream per page; text is emitted as hex-encoded glyph
 * runs inside TJ arrays. Counting the glyphs needs no font tables and no PDF
 * library — it answers exactly one question: did this page get any ink? A page
 * carrying only the running footer sits near 30; a page with real content sits
 * in the hundreds.
 */
function glyphsPerPage(pdf: Buffer): number[] {
  const latin = pdf.toString('latin1');
  const pages: number[] = [];
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
    let data = pdf.subarray(start, close);
    try {
      data = zlib.inflateSync(data);
    } catch {
      /* stream is not deflate-compressed — read it as-is */
    }
    const text = data.toString('latin1');
    if (/\bBT\b/.test(text)) {
      pages.push([...text.matchAll(/<([0-9a-fA-F]+)>/g)].reduce((n, m) => n + m[1].length / 4, 0));
    }
    cursor = close + 9;
  }
  return pages;
}

/**
 * REGRESSION CASE: Leverock's, second audit.
 *
 * The generated PDF contained a page holding the "Top Revenue Leaks" heading
 * and nothing else, with the findings starting on the page after it. Cause: the
 * finding cards carried `minPresenceAhead`, and when react-pdf honours that
 * prop on a wrappable block it advances the page without placing the block —
 * so the block lands a page late and the page in between is emitted empty.
 *
 * These two inputs are the layout permutations that reproduced it: two
 * findings, with an executive summary long enough to push Section 04's heading
 * to the foot of a page.
 */
function paginationInput(summaryRepeats: number, problemRepeats: number): ExecutiveReportInput {
  const finding = (n: number, category: string, stage: string, aiFit: number, priority: number, manual: boolean) => ({
    category,
    title: `Finding number ${n} with a reasonably long descriptive title`,
    problem: 'The business problem is described here at some length. '.repeat(problemRepeats),
    businessImpact: 'This matters because guest intent is lost at this point in the journey. '.repeat(3),
    customerJourneyStage: stage,
    evidenceIds: ['e1', 'e2', 'e3'],
    impactScore: 75, urgencyScore: 65, confidenceScore: manual ? 60 : 85, aiFitScore: aiFit, rescuePriorityScore: priority,
    recommendedSolution: 'Validate against internal data, then deploy the matched automation. '.repeat(3),
    manualValidationRequired: manual,
  });
  return {
    ...input,
    demoMode: false,
    restaurantName: 'Pagination Test House',
    overallScore: 78,
    coverageScore: 80,
    sourcesCollected: 7,
    evidence: Array.from({ length: 22 }, (_, i) => ({
      id: `e${i + 1}`,
      evidenceType: 'CTA_SIGNAL',
      fact: `Evidence item ${i + 1}: something factual observed on the analyzed pages.`,
      supportingContext: null,
      confidence: 80,
      sourceUrl: 'https://weird.example',
    })),
    opportunities: [
      finding(1, 'PHONE-DEPENDENT CUSTOMER JOURNEY', 'PHONE', 95, 82, true),
      finding(2, 'THIRD-PARTY ORDERING DEPENDENCY', 'ORDERING', 80, 74, false),
    ],
    journey: [
      { stage: 'DISCOVERY', status: 'HEALTHY', finding: 'Core identity signals present.', manualValidationRequired: false },
      { stage: 'WEBSITE', status: 'HEALTHY', finding: 'The website loaded successfully.', manualValidationRequired: false },
      { stage: 'MENU', status: 'HEALTHY', finding: 'A menu pathway is publicly linked.', manualValidationRequired: false },
      { stage: 'PHONE', status: 'FRICTION', finding: 'Phone-dependent journey.', manualValidationRequired: true },
      { stage: 'RESERVATION', status: 'UNKNOWN', finding: 'Not resolved.', manualValidationRequired: true },
      { stage: 'ORDERING', status: 'UNKNOWN', finding: 'Not resolved.', manualValidationRequired: true },
      { stage: 'CONTACT', status: 'HEALTHY', finding: 'Contact details are visible.', manualValidationRequired: false },
      { stage: 'FOLLOW_UP', status: 'RISK', finding: 'No retention mechanism detected.', manualValidationRequired: true },
      { stage: 'REVIEW', status: 'UNKNOWN', finding: 'Not in scope.', manualValidationRequired: true },
      { stage: 'RETURN', status: 'RISK', finding: 'No repeat-visit mechanism detected.', manualValidationRequired: true },
    ],
    storedSummary: 'Summary sentence that pads the executive summary section. '.repeat(summaryRepeats),
    storedSummaryWasAiEnhanced: true,
  };
}

describe('Executive PDF pagination', () => {
  // Every one of these summary lengths produced a page carrying nothing but the
  // running footer (26 glyphs) or the footer and the Section 04 heading (34.5)
  // before the fix; each renders at two problem-text lengths.
  it.each([
    ['short executive summary', 0],
    ['medium executive summary', 12],
    ['long executive summary', 16],
  ])('never emits a near-blank page (%s)', async (_label, summaryRepeats) => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const { renderToBuffer } = await import('@react-pdf/renderer');
    type PdfElement = Parameters<typeof renderToBuffer>[0];
    for (const problemRepeats of [2, 6]) {
      const dto = buildExecutiveReport(paginationInput(summaryRepeats, problemRepeats));
      const buffer = await renderToBuffer(React.createElement(ExecutivePdf, { dto }) as unknown as PdfElement);
      const pages = glyphsPerPage(buffer);
      expect(pages.length).toBeGreaterThan(3);
      // The failing renders produced pages of 26 and 39.5 glyphs — footer only,
      // or footer plus a section heading. Every real page clears 120.
      expect(Math.min(...pages), `summary×${summaryRepeats} problem×${problemRepeats}: ${pages.join(', ')}`).toBeGreaterThan(120);
    }
  }, 60_000);
});

describe('Executive PDF generation', () => {
  it('renders a valid multi-page PDF buffer from a DTO with special characters and long text', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const dto = buildExecutiveReport(input);
    type PdfElement = Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(React.createElement(ExecutivePdf, { dto }) as unknown as PdfElement);
    expect(buffer.length).toBeGreaterThan(5000);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const tail = buffer.subarray(-1024).toString('latin1');
    expect(tail).toContain('%%EOF');
  }, 30_000);

  it('PDF content does not contain secrets or internal markers', async () => {
    process.env.FAKE_PDF_SECRET = 'pdf-secret-marker-999';
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const dto = buildExecutiveReport(input);
    type PdfElement = Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(React.createElement(ExecutivePdf, { dto }) as unknown as PdfElement);
    const raw = buffer.toString('latin1');
    for (const marker of ['pdf-secret-marker-999', 'DATABASE_URL', 'BASIC_AUTH', 'leadQualityScore']) {
      expect(raw, `PDF leaked: ${marker}`).not.toContain(marker);
    }
    delete process.env.FAKE_PDF_SECRET;
  }, 30_000);
});
