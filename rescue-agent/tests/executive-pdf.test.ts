import { describe, expect, it } from 'vitest';
import React from 'react';
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
