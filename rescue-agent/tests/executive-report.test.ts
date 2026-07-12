import { describe, expect, it } from 'vitest';
import {
  buildExecutiveReport,
  classifyFinding,
  levelLabel,
  confidenceLabel,
  automationLabel,
  priorityLabel,
  sanitizeFilename,
  type ExecutiveReportInput,
} from '@/lib/reports/executive';

function baseInput(overrides: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput {
  return {
    restaurantName: 'Test Grill',
    websiteUrl: 'https://testgrill.example',
    location: 'Tampa, FL',
    auditDate: '2026-07-12',
    auditStatus: 'COMPLETED',
    demoMode: false,
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

describe('owner-facing label mappings (documented, deterministic)', () => {
  it('maps impact/urgency levels', () => {
    expect(levelLabel(0)).toBe('Low');
    expect(levelLabel(39)).toBe('Low');
    expect(levelLabel(40)).toBe('Moderate');
    expect(levelLabel(69)).toBe('Moderate');
    expect(levelLabel(70)).toBe('High');
    expect(levelLabel(100)).toBe('High');
  });

  it('maps evidence confidence', () => {
    expect(confidenceLabel(59)).toBe('Preliminary');
    expect(confidenceLabel(60)).toBe('Moderate');
    expect(confidenceLabel(79)).toBe('Moderate');
    expect(confidenceLabel(80)).toBe('Strong');
  });

  it('maps automation opportunity and priority', () => {
    expect(automationLabel(95)).toBe('Strong');
    expect(automationLabel(50)).toBe('Moderate');
    expect(automationLabel(20)).toBe('Limited');
    expect(priorityLabel(90)).toBe('Critical');
    expect(priorityLabel(75)).toBe('High');
    expect(priorityLabel(55)).toBe('Moderate');
    expect(priorityLabel(30)).toBe('Monitor');
  });
});

describe('evidence classification preservation', () => {
  it('manual validation always wins, regardless of confidence', () => {
    expect(classifyFinding({ manualValidationRequired: true, confidenceScore: 99 })).toBe('MANUAL VALIDATION REQUIRED');
  });

  it('verified requires >=80 confidence without a manual flag', () => {
    expect(classifyFinding({ manualValidationRequired: false, confidenceScore: 95 })).toBe('VERIFIED FINDING');
    expect(classifyFinding({ manualValidationRequired: false, confidenceScore: 79 })).toBe('INFERRED OPPORTUNITY');
  });
});

describe('buildExecutiveReport', () => {
  it('preserves the stored Rescue Score and never mutates it', () => {
    const input = baseInput();
    const dto = buildExecutiveReport(input);
    expect(dto.score.rescueScore).toBe(68);
    expect(input.overallScore).toBe(68);
  });

  it('ranks findings by rescue priority and preserves internal scores alongside labels', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.findings[0].title).toContain('transaction link');
    expect(dto.findings[0].classification).toBe('VERIFIED FINDING');
    expect(dto.findings[0].internalScores.rescuePriority).toBe(90);
    expect(dto.findings[0].labels.businessImpact).toBe('High');
    expect(dto.findings[1].classification).toBe('MANUAL VALIDATION REQUIRED');
    expect(dto.findings[1].labels.automationOpportunity).toBe('Strong');
  });

  it('every finding carries WHAT WE KNOW (real evidence facts) and WHAT WE DO NOT YET KNOW', () => {
    const dto = buildExecutiveReport(baseInput());
    const phone = dto.findings.find((f) => f.journeyStage === 'Phone')!;
    expect(phone.whatWeKnow).toContain('No public FAQ pathway was detected on the analyzed website pages.');
    expect(phone.whatWeDoNotKnow).toMatch(/call volume.*phone records/i);
  });

  it('journey UNKNOWN becomes INSUFFICIENT DATA — review never becomes a negative claim', () => {
    const dto = buildExecutiveReport(baseInput());
    const review = dto.journeyScorecard.find((r) => r.stage === 'REVIEW')!;
    expect(review.status).toBe('INSUFFICIENT DATA');
    expect(review.explanation).not.toMatch(/poor|bad|negative reviews/i);
  });

  it('AI opportunities only include strong-automation findings, each with validation requirements', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.aiOpportunities).toHaveLength(1);
    expect(dto.aiOpportunities[0].solutionCategory).toMatch(/AI Front Desk/);
    expect(dto.aiOpportunities[0].validationRequired.length).toBeGreaterThan(10);
  });

  it('builds a 4-phase 30-day plan with evidence-driven KPIs', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.thirtyDayPlan.map((p) => p.heading)).toEqual(['VALIDATE', 'FIX THE HIGHEST-FRICTION DIGITAL LEAK', 'AUTOMATE', 'MEASURE']);
    expect(dto.thirtyDayPlan[0].actions.join(' ')).toMatch(/phone records/i);
    expect(dto.thirtyDayPlan[3].actions.join(' ')).toMatch(/missed calls/i);
  });

  it('deterministic summary works with no stored/AI summary and states no invented figures', () => {
    const dto = buildExecutiveReport(baseInput({ storedSummary: null, storedSummaryWasAiEnhanced: false }));
    expect(dto.executiveSummary.length).toBeGreaterThan(100);
    expect(dto.summaryWasAiEnhanced).toBe(false);
    expect(dto.executiveSummary).not.toMatch(/\$\d/);
    expect(dto.executiveSummary).toMatch(/Our audit analyzed/);
  });

  it('prefers the audit-time AI-enhanced summary when one was stored', () => {
    const dto = buildExecutiveReport(baseInput({ storedSummary: 'Stored AI-enhanced summary generated at audit time from validated data.', storedSummaryWasAiEnhanced: true }));
    expect(dto.executiveSummary).toBe('Stored AI-enhanced summary generated at audit time from validated data.');
    expect(dto.summaryWasAiEnhanced).toBe(true);
  });

  it('handles zero opportunities without inventing findings', () => {
    const dto = buildExecutiveReport(baseInput({ opportunities: [] }));
    expect(dto.findings).toHaveLength(0);
    expect(dto.aiOpportunities).toHaveLength(0);
    expect(dto.executiveSummary).toMatch(/No high-priority revenue leaks were confirmed/);
  });

  it('handles missing score and long text without crashing', () => {
    const long = 'x'.repeat(5000);
    const dto = buildExecutiveReport(
      baseInput({
        overallScore: null,
        coverageScore: null,
        opportunities: [{ ...baseInput().opportunities[0], problem: long, title: long.slice(0, 200) }],
      }),
    );
    expect(dto.score.rescueScore).toBeNull();
    expect(dto.score.band).toBeNull();
    expect(dto.findings[0].problem.length).toBe(5000);
  });

  it('includes contact configuration and methodology', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.recommendation.contactName).toBe('Keith Warren');
    expect(dto.recommendation.contactPhone).toBe('727-291-5965');
    expect(dto.methodologyAndLimitations.join(' ')).toMatch(/publicly available/i);
    expect(dto.methodologyAndLimitations.join(' ')).toMatch(/missed-call volume/i);
  });

  it('never serializes secrets or internal sales fields into the DTO', () => {
    process.env.FAKE_SECRET_FOR_TEST = 'super-secret-value-xyz';
    const serialized = JSON.stringify(buildExecutiveReport(baseInput()));
    for (const marker of ['DATABASE_URL', 'BASIC_AUTH', 'ANTHROPIC', 'super-secret-value-xyz', 'leadQualityScore', 'callOpener', 'talkTrack', 'objectionStrategy', 'buyerPersona']) {
      expect(serialized, `DTO leaked: ${marker}`).not.toContain(marker);
    }
    delete process.env.FAKE_SECRET_FOR_TEST;
  });
});

describe('sanitizeFilename', () => {
  it('strips special characters and spaces', () => {
    expect(sanitizeFilename("Leverock's Seafood House")).toBe('Leverocks-Seafood-House');
    expect(sanitizeFilename('Café «Über» / Restaurant?')).toBe('Cafe-Uber-Restaurant');
  });

  it('falls back for empty/degenerate names and caps length', () => {
    expect(sanitizeFilename('///???')).toBe('restaurant');
    expect(sanitizeFilename('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});
