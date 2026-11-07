/** Copy of the baseInput fixture in executive-report.test.ts, for tests that need a complete report input. */
import type { ExecutiveReportInput } from '@/lib/reports/executive';

const TEST_CONTACT = {
  company: 'Winners Bookmark Incorporated',
  consultantName: 'Keith Warren',
  phone: '727-291-5965',
  email: null,
  bookingUrl: null,
  fallbackText: 'Contact Keith Warren at 727-291-5965 to schedule your Restaurant Rescue Review.',
};

export function baseInput(overrides: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput {
  return {
    auditId: 'cltestaudit0001',
    restaurantName: 'Test Grill',
    websiteUrl: 'https://testgrill.example',
    location: 'Tampa, FL',
    auditDate: '2026-07-12',
    auditStatus: 'COMPLETED',
    demoMode: false,
    contact: TEST_CONTACT,
    bookingQrDataUrl: null,
    avgTicket: null,
    overallScore: 68,
    coverageScore: 80,
    sourcesCollected: 7,
    sourcesFailed: 1,
    evidence: [
      { id: 'e1', evidenceType: 'FAQ_SIGNAL', fact: 'No public FAQ pathway was detected on the analyzed website pages.', supportingContext: null, confidence: 70, sourceUrl: 'https://testgrill.example' },
      { id: 'e2', evidenceType: 'CLICK_TO_CALL', fact: 'No click-to-call (tel:) links detected; mobile visitors must dial manually.', supportingContext: null, confidence: 80, sourceUrl: 'https://testgrill.example' },
      { id: 'e3', evidenceType: 'BROKEN_LINK', fact: 'The linked ordering destination failed when tested (HTTP 404).', supportingContext: null, confidence: 95, sourceUrl: 'https://testgrill.example/order' },
    ],
    opportunities: [
      {
        category: 'PHONE-DEPENDENT CUSTOMER JOURNEY',
        title: 'The phone line is carrying load the website could absorb',
        problem: 'Common questions are not answered online. Potential missed-call exposure.',
        businessImpact: 'Unanswered rings are potential lost bookings.',
        customerJourneyStage: 'PHONE',
        evidenceIds: ['e1', 'e2'],
        impactScore: 75, urgencyScore: 65, confidenceScore: 72, aiFitScore: 95, rescuePriorityScore: 75,
        recommendedSolution: 'AI Front Desk after call-volume discovery.',
        manualValidationRequired: true,
      },
      {
        category: 'ONLINE ORDERING FAILURE RISK',
        title: 'A transaction link on the website is failing',
        problem: 'The ordering link returns 404.',
        businessImpact: 'Order-intent customers hit a dead end.',
        customerJourneyStage: 'ORDERING',
        evidenceIds: ['e3'],
        impactScore: 90, urgencyScore: 90, confidenceScore: 95, aiFitScore: 20, rescuePriorityScore: 90,
        recommendedSolution: 'Fix the broken link immediately.',
        manualValidationRequired: false,
      },
    ],
    journey: [
      { stage: 'WEBSITE', status: 'HEALTHY', finding: 'The website loaded successfully. Extra detail here.', manualValidationRequired: false },
      { stage: 'PHONE', status: 'FRICTION', finding: 'Phone-dependent journey.', manualValidationRequired: true },
      { stage: 'REVIEW', status: 'UNKNOWN', finding: 'Review platform analysis is not in scope.', manualValidationRequired: true },
    ],
    categoryScores: [],
    storedSummary: null,
    storedSummaryWasAiEnhanced: false,
    storedRecommendation: { tier: 'AI DISCOVERY AUDIT', rationale: 'Multiple findings require internal validation.' },
    ...overrides,
  };
}
