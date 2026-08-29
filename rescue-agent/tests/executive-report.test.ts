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

const TEST_CONTACT = {
  company: 'Winners Bookmark Incorporated',
  consultantName: 'Keith Warren',
  phone: '727-291-5965',
  email: null,
  bookingUrl: null,
  fallbackText: 'Contact Keith Warren at 727-291-5965 to schedule your Restaurant Rescue Review.',
};

function baseInput(overrides: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput {
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
    // The invariant this test exists for: below 80 is NOT verified. Since the
    // canonical evidence ladder was centralised, 65–79 lands in its own STRONG
    // EVIDENCE band rather than being flattened in with a 40 — a distinction the
    // report can now show, and one that still licenses no definitive language.
    expect(classifyFinding({ manualValidationRequired: false, confidenceScore: 79 })).toBe('STRONG EVIDENCE');
    expect(classifyFinding({ manualValidationRequired: false, confidenceScore: 79 })).not.toBe('VERIFIED FINDING');
    expect(classifyFinding({ manualValidationRequired: false, confidenceScore: 40 })).toBe('INFERRED OPPORTUNITY');
  });
});

/**
 * REGRESSION CASE: Leverock's, second audit.
 *
 * Section 02 read "22 EVIDENCE ITEMS · 0 VERIFIED FINDINGS", which invites the
 * reader to conclude that none of the 22 evidence items were verified. The
 * counts were never about evidence: they classify the revenue-leak findings in
 * Section 04, and an audit can hold entirely solid evidence while every leak it
 * describes still needs owner data to confirm.
 *
 * The counts themselves are correct and must not move — the fix is that the
 * report now publishes the denominator they belong to.
 */
describe('finding counters state what they count', () => {
  it('publishes the finding total the three classifications divide up', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.score.findingsCount).toBe(dto.findings.length);
    expect(dto.score.verifiedCount + dto.score.inferredCount + dto.score.manualValidationCount).toBe(dto.score.findingsCount);
  });

  it('counts findings, not evidence items — 22 verified-looking items, one unconfirmed leak', () => {
    const dto = buildExecutiveReport(
      baseInput({
        evidence: Array.from({ length: 22 }, (_, i) => ({
          id: `e${i + 1}`,
          evidenceType: 'CTA_SIGNAL',
          fact: `Evidence item ${i + 1}.`,
          supportingContext: null,
          confidence: 95,
          sourceUrl: 'https://testgrill.example',
        })),
        opportunities: [
          {
            category: 'PHONE-DEPENDENT CUSTOMER JOURNEY',
            title: 'Phone-dependent journey',
            problem: 'Common questions are not answered online.',
            businessImpact: 'Unanswered rings are potential lost bookings.',
            customerJourneyStage: 'PHONE',
            evidenceIds: ['e1'],
            impactScore: 75, urgencyScore: 65, confidenceScore: 72, aiFitScore: 95, rescuePriorityScore: 75,
            recommendedSolution: 'AI Front Desk after call-volume discovery.',
            manualValidationRequired: true,
          },
        ],
      }),
    );
    expect(dto.score.evidenceCount).toBe(22);
    // Zero verified findings alongside 22 evidence items is the honest answer,
    // and the finding total is what makes it legible.
    expect(dto.score.verifiedCount).toBe(0);
    expect(dto.score.inferredCount).toBe(0);
    expect(dto.score.manualValidationCount).toBe(1);
    expect(dto.score.findingsCount).toBe(1);
  });

  it('renders RESOLVED_UNVERIFIED as MANUAL VALIDATION, never blank or HEALTHY', () => {
    // The status was added so a reachable-but-unverified reservation could stop
    // being reported as HEALTHY. A client-facing report showing a blank or
    // mislabelled status would be a worse failure than the bug it fixes, so the
    // mapping onto the report's existing vocabulary is asserted here.
    const dto = buildExecutiveReport(
      baseInput({
        journey: [
          { stage: 'RESERVATION', status: 'RESOLVED_UNVERIFIED', finding: 'Reachable, booking availability not verified.', manualValidationRequired: true },
        ],
      }),
    );
    const reservation = dto.journeyMap.find((s) => s.stage === 'RESERVATION');
    expect(reservation?.status).toBe('MANUAL VALIDATION');
    expect(reservation?.status).not.toBe('HEALTHY');
    expect(reservation?.status).toBeTruthy();
  });

  it('does not inflate the counts when evidence is plentiful', () => {
    const dto = buildExecutiveReport(baseInput({ opportunities: [] }));
    expect(dto.score.findingsCount).toBe(0);
    expect(dto.score.verifiedCount).toBe(0);
    expect(dto.score.inferredCount).toBe(0);
    expect(dto.score.manualValidationCount).toBe(0);
    expect(dto.score.evidenceCount).toBeGreaterThan(0);
  });

  it('caps the total at the number of findings the report actually prints', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      category: 'CTA CLARITY',
      title: `Finding ${i + 1}`,
      problem: 'Problem.',
      businessImpact: 'Impact.',
      customerJourneyStage: 'WEBSITE',
      evidenceIds: [],
      impactScore: 50, urgencyScore: 50, confidenceScore: 90, aiFitScore: 30, rescuePriorityScore: 90 - i,
      recommendedSolution: 'Fix it.',
      manualValidationRequired: false,
    }));
    const dto = buildExecutiveReport(baseInput({ opportunities: many }));
    expect(dto.score.findingsCount).toBe(dto.findings.length);
    expect(dto.score.findingsCount).toBeLessThan(many.length);
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

describe('deriveEvidenceSourceUrl (evidence chain cites the tested URL, not the homepage fallback)', () => {
  it('prefers a URL-only supporting context (probe evidence) over the source record URL', async () => {
    const { deriveEvidenceSourceUrl } = await import('@/lib/reports/executiveData');
    expect(deriveEvidenceSourceUrl('https://restaurant.example/order', 'https://restaurant.example')).toBe('https://restaurant.example/order');
    expect(deriveEvidenceSourceUrl('  https://order.platform.example/r/slug?x=1 ', 'https://restaurant.example')).toBe('https://order.platform.example/r/slug?x=1');
  });

  it('keeps the source record URL for sentence-style contexts and missing context', async () => {
    const { deriveEvidenceSourceUrl } = await import('@/lib/reports/executiveData');
    expect(deriveEvidenceSourceUrl('Based on 7 analyzed page(s).', 'https://restaurant.example/menu')).toBe('https://restaurant.example/menu');
    expect(deriveEvidenceSourceUrl('Example link text: "Reserve" → https://resy.example/x', 'https://restaurant.example')).toBe('https://restaurant.example');
    expect(deriveEvidenceSourceUrl(null, 'https://restaurant.example')).toBe('https://restaurant.example');
    expect(deriveEvidenceSourceUrl('https://bad url with spaces', 'https://restaurant.example')).toBe('https://restaurant.example');
    expect(deriveEvidenceSourceUrl(null, null)).toBeNull();
  });
});

describe('Phase 2.5 — executive snapshot, scenarios, journey map, prescription, decision, cta', () => {
  it('builds an executive snapshot from ranked findings (≤3 priorities) with score and validation', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.snapshot.priorities.length).toBeGreaterThan(0);
    expect(dto.snapshot.priorities.length).toBeLessThanOrEqual(3);
    expect(dto.snapshot.priorities[0].title).toContain('transaction link');
    expect(dto.snapshot.rescueScore).toBe(68);
    expect(dto.snapshot.primaryValidationRequirement.length).toBeGreaterThan(10);
  });

  it('attaches an illustrative scenario to eligible findings and shows all assumptions', () => {
    const dto = buildExecutiveReport(baseInput());
    const phone = dto.findings.find((f) => f.category.includes('PHONE'))!;
    expect(phone.scenario).not.toBeNull();
    expect(phone.scenario!.classification).toBe('ILLUSTRATIVE SCENARIO');
    expect(phone.scenario!.assumptions.length).toBeGreaterThan(0);
    // ordering finding is a broken-link category — NOT scenario-eligible under ordering-failure? it IS eligible (ordering)
    const ordering = dto.findings.find((f) => f.category.includes('ORDERING'))!;
    expect(ordering.scenario).not.toBeNull();
  });

  it('collects up to 3 top-level scenarios for "What This Could Be Costing You"', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.scenarios.length).toBeGreaterThan(0);
    expect(dto.scenarios.length).toBeLessThanOrEqual(3);
    for (const sc of dto.scenarios) expect(sc.classification).toBe('ILLUSTRATIVE SCENARIO');
  });

  it('never attaches a scenario to a technical/insufficient finding', () => {
    const dto = buildExecutiveReport(baseInput({
      opportunities: [{
        category: 'WEBSITE TECHNICAL FOUNDATION', title: 'HTTPS missing', problem: 'No HTTPS.', businessImpact: 'Trust.',
        customerJourneyStage: 'WEBSITE', evidenceIds: [], impactScore: 75, urgencyScore: 70, confidenceScore: 90,
        aiFitScore: 10, rescuePriorityScore: 72, recommendedSolution: 'Fix SSL.', manualValidationRequired: false,
      }],
    }));
    expect(dto.findings[0].scenario).toBeNull();
    expect(dto.scenarios).toHaveLength(0);
  });

  it('orders the visual journey map and maps UNKNOWN → INSUFFICIENT DATA', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.journeyMap.map((s) => s.stage)).toEqual(['WEBSITE', 'PHONE', 'REVIEW']);
    expect(dto.journeyMap.find((s) => s.stage === 'REVIEW')!.status).toBe('INSUFFICIENT DATA');
    expect(dto.journeyMap.find((s) => s.stage === 'PHONE')!.status).toBe('MANUAL VALIDATION');
  });

  it('ranks AI opportunities with capabilities and measurement, best-fit first', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.rankedAiOpportunities.length).toBeGreaterThan(0);
    expect(dto.rankedAiOpportunities[0].fit).toBe('STRONG');
    expect(dto.rankedAiOpportunities[0].capabilities.length).toBeGreaterThan(0);
    expect(dto.rankedAiOpportunities[0].measurement.length).toBeGreaterThan(0);
  });

  it('builds a diagnosis/validation/prescription block and an operational role list', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.prescription.diagnosis.length).toBeGreaterThan(10);
    expect(dto.prescription.validation.length).toBeGreaterThan(10);
    expect(dto.prescription.prescription.length).toBeGreaterThan(10);
    expect(dto.prescription.expectedOperationalRole.length).toBeGreaterThan(2);
  });

  it('builds the three-option decision box', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.decisionBox.doNothing.heading).toBe('DO NOTHING');
    expect(dto.decisionBox.validate.heading).toBe('VALIDATE');
    expect(dto.decisionBox.implement.heading).toBe('IMPLEMENT');
  });

  it('CTA falls back to phone text when no booking URL/QR is configured', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.cta.headline).toMatch(/BOOK YOUR 20-MINUTE/);
    expect(dto.cta.phone).toBe('727-291-5965');
    expect(dto.cta.bookingUrl).toBeNull();
    expect(dto.cta.qrDataUrl).toBeNull();
    expect(dto.cta.fallbackText).toMatch(/727-291-5965/);
  });

  it('CTA surfaces a configured booking URL and QR when present', () => {
    const dto = buildExecutiveReport(baseInput({
      contact: { ...TEST_CONTACT, bookingUrl: 'https://book.example/keith' },
      bookingQrDataUrl: 'data:image/png;base64,AAAA',
    }));
    expect(dto.cta.bookingUrl).toBe('https://book.example/keith');
    expect(dto.cta.qrDataUrl).toBe('data:image/png;base64,AAAA');
  });

  it('exposes value signals including audit id, and never mutates the score', () => {
    const input = baseInput();
    const dto = buildExecutiveReport(input);
    expect(dto.valueSignals.auditId).toBe('cltestaudit0001');
    expect(dto.valueSignals.preparedFor).toBe('Test Grill');
    expect(dto.score.rescueScore).toBe(68);
    expect(input.overallScore).toBe(68);
  });

  it('scenarios and snapshot never state a confirmed dollar loss', () => {
    const dto = buildExecutiveReport(baseInput());
    const serialized = JSON.stringify({ scenarios: dto.scenarios, snapshot: dto.snapshot, findings: dto.findings });
    // every scenario carries the not-a-confirmed-loss qualifier
    for (const sc of dto.scenarios) expect(sc.confidenceStatement.toLowerCase()).toContain('not a confirmed loss');
    expect(serialized.toLowerCase()).not.toContain('confirmed loss of');
    expect(serialized.toLowerCase()).not.toContain('you are losing');
  });
});

describe('Phase 2.5 — scenario dedupe (review #18)', () => {
  it('collapses multiple same-kind findings into a single top-level scenario card (unique keys)', () => {
    const dto = buildExecutiveReport(baseInput({
      opportunities: [
        {
          category: 'ONLINE ORDERING FAILURE RISK', title: 'Ordering link failing', problem: 'Order link 404s.', businessImpact: 'Dead end.',
          customerJourneyStage: 'ORDERING', evidenceIds: [], impactScore: 90, urgencyScore: 90, confidenceScore: 95,
          aiFitScore: 50, rescuePriorityScore: 90, recommendedSolution: 'Fix it.', manualValidationRequired: false,
        },
        {
          category: 'THIRD-PARTY ORDERING DEPENDENCY', title: 'Third-party ordering split', problem: 'Fragmented ordering.', businessImpact: 'Margin.',
          customerJourneyStage: 'ORDERING', evidenceIds: [], impactScore: 65, urgencyScore: 50, confidenceScore: 75,
          aiFitScore: 50, rescuePriorityScore: 60, recommendedSolution: 'Consolidate.', manualValidationRequired: false,
        },
      ],
    }));
    const orderingScenarios = dto.scenarios.filter((s) => s.key === 'ordering');
    expect(orderingScenarios).toHaveLength(1);
    const keys = dto.scenarios.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length); // all keys unique
    // both findings still keep their own inline scenario
    expect(dto.findings.filter((f) => f.scenario?.key === 'ordering')).toHaveLength(2);
  });
});
