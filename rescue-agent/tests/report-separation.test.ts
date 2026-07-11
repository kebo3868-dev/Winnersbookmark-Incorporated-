import { describe, expect, it } from 'vitest';
import { generateOwnerReport, INTERNAL_ONLY_MARKERS, type RankedOpportunity } from '@/lib/reports/owner';
import { generateSalesBrief } from '@/lib/reports/sales';
import { analyzeJourney } from '@/lib/audit/journey';
import type { CategoryScoreInput, EvidenceRecordLike } from '@/types/audit';

const evidence: EvidenceRecordLike[] = [
  { id: 'e1', evidenceType: 'CLICK_TO_CALL', fact: 'No click-to-call (tel:) links detected; mobile visitors must dial manually.', supportingContext: null, confidence: 80 },
  { id: 'e2', evidenceType: 'FAQ_SIGNAL', fact: 'No public FAQ pathway was detected on the analyzed website pages.', supportingContext: null, confidence: 70 },
  { id: 'e3', evidenceType: 'PHONE_VISIBILITY', fact: 'A phone number is publicly displayed ((555) 010-0000).', supportingContext: null, confidence: 95 },
];

const topLeaks: RankedOpportunity[] = [
  {
    category: 'PHONE-DEPENDENT CUSTOMER JOURNEY',
    title: 'The phone line is carrying load the website could absorb',
    problem: 'Common questions are not answered online; potential missed-call exposure.',
    businessImpact: 'Unanswered rings are potential lost bookings.',
    customerJourneyStage: 'PHONE',
    evidenceIds: ['e1', 'e2', 'e3'],
    impactScore: 75,
    urgencyScore: 65,
    confidenceScore: 72,
    aiFitScore: 95,
    rescuePriorityScore: 75,
    recommendedSolution: 'Winners Bookmark AI Front Desk System after call-volume discovery.',
    manualValidationRequired: true,
  },
];

const categories: CategoryScoreInput[] = [
  { category: 'PHONE_RESPONSE_READINESS', weight: 15, score: 45, confidence: 70, insufficientData: false, explanation: 'Phone journey friction.' },
  { category: 'REVIEW_REPUTATION_SYSTEM', weight: 10, score: null, confidence: 0, insufficientData: true, explanation: 'Not collected in scope.' },
];

const journey = analyzeJourney(evidence);

function buildBoth() {
  const owner = generateOwnerReport({
    restaurantName: 'Test Grill',
    websiteUrl: 'https://testgrill.example',
    location: 'Austin, TX',
    auditStatus: 'COMPLETED',
    demoMode: false,
    overallScore: 62,
    coverageScore: 70,
    scoreExplanation: 'Calculated from categories with sufficient public evidence (70% of intended weighting).',
    categories,
    journey,
    topLeaks,
    evidence,
  });
  const sales = generateSalesBrief({
    restaurantName: 'Test Grill',
    overallScore: 62,
    coverageScore: 70,
    topLeaks,
    journey,
    evidence,
    recommendedTier: owner.recommendation.tier,
  });
  return { owner, sales };
}

describe('report separation (owner vs internal sales)', () => {
  it('owner report never contains internal sales fields or markers', () => {
    const { owner } = buildBoth();
    const serialized = JSON.stringify(owner);
    for (const marker of INTERNAL_ONLY_MARKERS) {
      expect(serialized, `owner report leaked internal marker: ${marker}`).not.toContain(marker);
    }
  });

  it('sales brief contains its required internal fields', () => {
    const { sales } = buildBoth();
    expect(sales.leadQualityScore).toBeGreaterThanOrEqual(0);
    expect(sales.leadQualityScore).toBeLessThanOrEqual(100);
    expect(sales.discoveryQuestions).toHaveLength(5);
    expect(['HOT', 'WARM', 'NURTURE', 'LOW_PRIORITY']).toContain(sales.priority);
    expect(sales.talkTrack.length).toBeGreaterThan(100);
  });

  it('sales brief does not fabricate owner names, revenue, or staffing', () => {
    const { sales } = buildBoth();
    const serialized = JSON.stringify(sales);
    expect(serialized).not.toMatch(/\$\d{3,}/); // no invented dollar figures
    expect(sales.buyerPersona).toMatch(/no personal information about the actual owner was collected/i);
  });

  it('owner report marks insufficient data instead of scoring zero', () => {
    const { owner } = buildBoth();
    const review = owner.scorecard.find((s) => s.category === 'REVIEW_REPUTATION_SYSTEM');
    expect(review!.insufficientData).toBe(true);
    expect(review!.score).toBeNull();
  });

  it('owner report includes both Rescue Score and Coverage Score plus required sections', () => {
    const { owner } = buildBoth();
    expect(owner.header.rescueScore).toBe(62);
    expect(owner.header.coverageScore).toBe(70);
    expect(owner.biggestOpportunity).toMatch(/biggest opportunity/i);
    expect(owner.rescuePlan).toHaveLength(3);
    expect(owner.nextStep.cta).toBe('BOOK A 15-MINUTE RESTAURANT RESCUE REVIEW');
    expect(owner.nextStep.founder).toBe('Keith Warren');
    expect(owner.assumptionsAndLimitations.length).toBeGreaterThan(2);
  });
});
