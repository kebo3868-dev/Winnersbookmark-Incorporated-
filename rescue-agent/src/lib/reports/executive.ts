import { scoreBand } from '@/lib/scoring/rescueScore';
import { CATEGORY_LABELS } from '@/lib/reports/owner';
import { COMPANY, type Contact } from '@/lib/config';
import { buildScenario, scenarioKindFor, type RevenueScenario } from '@/lib/reports/scenarios';

export type { RevenueScenario } from '@/lib/reports/scenarios';

/**
 * EXECUTIVE AUDIT REPORT — presentation layer.
 *
 * Pure derivation from already-stored audit data. This module never runs the
 * pipeline, never calls an AI provider, never mutates scores, and performs no
 * writes. The deterministic audit engine remains the factual source of truth;
 * everything here is a documented, deterministic translation of stored values
 * into owner-facing commercial language.
 */

// ── Owner-facing label mappings (documented, deterministic) ─────────────────
// Internal numeric scores are preserved in the DTO; these labels are the
// client-facing translation.
//   Impact / Urgency:      0–39 Low · 40–69 Moderate · 70–100 High
//   Evidence confidence:   0–59 Preliminary · 60–79 Moderate · 80–100 Strong
//   Automation (AI fit):   0–39 Limited · 40–69 Moderate · 70–100 Strong
//   Priority (rescue priority score): ≥80 Critical · 65–79 High · 50–64 Moderate · <50 Monitor
export const levelLabel = (n: number): 'Low' | 'Moderate' | 'High' => (n >= 70 ? 'High' : n >= 40 ? 'Moderate' : 'Low');
export const confidenceLabel = (n: number): 'Preliminary' | 'Moderate' | 'Strong' => (n >= 80 ? 'Strong' : n >= 60 ? 'Moderate' : 'Preliminary');
export const automationLabel = (n: number): 'Limited' | 'Moderate' | 'Strong' => (n >= 70 ? 'Strong' : n >= 40 ? 'Moderate' : 'Limited');
export const priorityLabel = (n: number): 'Critical' | 'High' | 'Moderate' | 'Monitor' => (n >= 80 ? 'Critical' : n >= 65 ? 'High' : n >= 50 ? 'Moderate' : 'Monitor');

export type EvidenceClassification = 'VERIFIED FINDING' | 'INFERRED OPPORTUNITY' | 'MANUAL VALIDATION REQUIRED' | 'INSUFFICIENT DATA';

/**
 * Classification preserves the engine's own uncertainty flags — it can only
 * ever be as confident as the stored finding, never more:
 * manualValidationRequired always wins; confidence ≥80 with no manual flag is
 * VERIFIED; anything else is an INFERRED OPPORTUNITY.
 */
export function classifyFinding(opp: { manualValidationRequired: boolean; confidenceScore: number }): EvidenceClassification {
  if (opp.manualValidationRequired) return 'MANUAL VALIDATION REQUIRED';
  return opp.confidenceScore >= 80 ? 'VERIFIED FINDING' : 'INFERRED OPPORTUNITY';
}

// "What we do not yet know" — deterministic per finding category. These
// sentences state exactly which internal data the public audit cannot see.
const UNKNOWNS_BY_CATEGORY: [RegExp, string][] = [
  [/PHONE-DEPENDENT/i, 'Actual call volume, missed-call counts, and the share of calls that are repetitive questions require phone records.'],
  [/RETENTION/i, 'Whether an internal guest database already exists in the POS or reservation system — and how large it is — requires owner data.'],
  [/CATERING|PRIVATE/i, 'Current inquiry volume and response times for catering and private-event leads require internal records.'],
  [/MENU/i, 'How many visitors give up after failing to view the menu comfortably requires website analytics.'],
  [/ORDERING FAILURE|BROKEN/i, 'How long the pathway has been failing and how many customers hit it requires website analytics.'],
  [/THIRD-PARTY/i, 'The actual order mix between direct and third-party channels, and what commissions cost monthly, requires sales records.'],
  [/CONTACT/i, 'Which questions guests actually call about, and how often, requires phone records or staff input.'],
  [/CTA/i, 'Actual click-through and conversion behavior on the website requires analytics data.'],
  [/TECHNICAL/i, 'The share of visitors affected on mobile devices requires analytics data.'],
];

function unknownsFor(category: string): string {
  for (const [pattern, text] of UNKNOWNS_BY_CATEGORY) {
    if (pattern.test(category)) return text;
  }
  return 'The operational and financial impact has not been directly measured and should be validated against internal data.';
}

// Winners Bookmark solution category per finding category (evidence-driven —
// only findings with Strong automation fit surface as AI opportunities).
const SOLUTION_CATEGORY: [RegExp, string][] = [
  [/PHONE-DEPENDENT/i, 'AI Front Desk & Missed-Call Text Back'],
  [/CATERING|PRIVATE/i, 'Lead Capture & Inquiry Automation'],
  [/RETENTION/i, 'Customer Reactivation & Follow-Up Automation'],
  [/THIRD-PARTY|ORDERING/i, 'Digital Ordering Journey Improvement'],
  [/CONTACT/i, 'AI FAQ Assistant'],
];

function solutionCategoryFor(category: string): string {
  for (const [pattern, text] of SOLUTION_CATEGORY) {
    if (pattern.test(category)) return text;
  }
  return 'Custom Automation Assessment';
}

// ── Input shape (plain data, no Prisma types — builder is DB-agnostic) ──────

export interface ExecutiveReportInput {
  auditId: string;
  restaurantName: string;
  websiteUrl: string;
  location: string | null;
  auditDate: string; // ISO date
  auditStatus: string;
  demoMode: boolean;
  contact: Contact;
  bookingQrDataUrl: string | null;
  overallScore: number | null;
  coverageScore: number | null;
  sourcesCollected: number;
  sourcesFailed: number;
  evidence: { id: string; evidenceType: string; fact: string; supportingContext: string | null; confidence: number; sourceUrl: string | null }[];
  opportunities: {
    category: string;
    title: string;
    problem: string;
    businessImpact: string;
    customerJourneyStage: string;
    evidenceIds: string[];
    impactScore: number;
    urgencyScore: number;
    confidenceScore: number;
    aiFitScore: number;
    rescuePriorityScore: number;
    recommendedSolution: string;
    manualValidationRequired: boolean;
  }[];
  journey: { stage: string; status: string; finding: string; manualValidationRequired: boolean }[];
  categoryScores: { category: string; score: number | null; insufficientData: boolean; explanation: string }[];
  storedSummary: string | null;
  storedSummaryWasAiEnhanced: boolean;
  storedRecommendation: { tier: string; rationale: string } | null;
}

// ── DTO ─────────────────────────────────────────────────────────────────────

export interface ExecutiveFinding {
  number: number;
  title: string;
  category: string;
  classification: EvidenceClassification;
  problem: string;
  whyItMatters: string;
  commercialEffect: string;
  whatWeKnow: string[];
  whatWeDoNotKnow: string;
  potentialEffect: string;
  recommendedAction: string;
  automationOpportunity: string;
  validationRequired: string;
  journeyStage: string;
  labels: { businessImpact: string; urgency: string; evidenceConfidence: string; automationOpportunity: string; priority: string };
  internalScores: { impact: number; urgency: number; confidence: number; aiFit: number; rescuePriority: number };
  evidenceSnapshot: { fact: string; sourceUrl: string | null }[];
  scenario: RevenueScenario | null;
}

export interface SnapshotPriority {
  rank: number;
  title: string;
  priorityLabel: string;
  summary: string;
  validationRequired: string;
}

export interface ExecutiveSnapshot {
  priorities: SnapshotPriority[];
  rescueScore: number | null;
  band: string | null;
  coverage: number | null;
  topRecommendedAutomation: string | null;
  primaryValidationRequirement: string;
  recommendedNextStep: string;
}

export interface JourneyMapStage {
  stage: string;
  label: string;
  status: 'HEALTHY' | 'FRICTION' | 'INSUFFICIENT DATA' | 'UNKNOWN' | 'MANUAL VALIDATION';
  note: string;
}

export interface RankedAiOpportunity {
  rank: number;
  solutionCategory: string;
  fit: 'STRONG' | 'MODERATE' | 'LIMITED';
  problemAddressed: string;
  whyItFits: string;
  capabilities: string[];
  validationBeforeImplementation: string;
  implementationComplexity: 'Low' | 'Moderate' | 'High';
  measurement: string[];
}

export interface DecisionBox {
  doNothing: { heading: string; detail: string; risk: string };
  validate: { heading: string; detail: string; cost: string; benefit: string };
  implement: { heading: string; detail: string; benefit: string };
}

export interface Prescription {
  diagnosis: string;
  validation: string;
  prescription: string;
  expectedOperationalRole: string[];
}

export interface ReportCta {
  headline: string;
  subtext: string;
  company: string;
  consultantName: string;
  phone: string;
  email: string | null;
  bookingUrl: string | null;
  qrDataUrl: string | null;
  fallbackText: string;
}

export interface ValueSignals {
  auditId: string;
  auditDate: string;
  preparedFor: string;
  preparedBy: string;
  pagesAnalyzed: number;
  evidenceItems: number;
  coverage: number | null;
  confidentialityNote: string;
}

export interface ExecutiveReportDTO {
  cover: {
    company: string;
    productName: string;
    subtitle: string;
    restaurantName: string;
    websiteUrl: string;
    location: string | null;
    auditDate: string;
    preparedBy: string;
    footer: string;
    demoMode: boolean;
    auditStatus: string;
  };
  snapshot: ExecutiveSnapshot;
  scenarios: RevenueScenario[];
  journeyMap: JourneyMapStage[];
  rankedAiOpportunities: RankedAiOpportunity[];
  prescription: Prescription;
  decisionBox: DecisionBox;
  cta: ReportCta;
  valueSignals: ValueSignals;
  executiveSummary: string;
  summaryWasAiEnhanced: boolean;
  score: {
    rescueScore: number | null;
    band: string | null;
    interpretation: string;
    coverage: number | null;
    evidenceCount: number;
    sourcesAnalyzed: number;
    sourcesFailed: number;
    verifiedCount: number;
    inferredCount: number;
    manualValidationCount: number;
  };
  findings: ExecutiveFinding[];
  journeyScorecard: { stage: string; label: string; status: string; explanation: string }[];
  aiOpportunities: {
    opportunity: string;
    solutionCategory: string;
    problemAddressed: string;
    whyItFits: string;
    expectedBenefit: string;
    validationRequired: string;
    complexity: 'Low' | 'Moderate' | 'High';
  }[];
  thirtyDayPlan: { phase: string; heading: string; actions: string[] }[];
  recommendation: { headline: string; body: string; nextStep: string; company: string; contactName: string; contactPhone: string };
  methodologyAndLimitations: string[];
  appendix: { evidenceType: string; fact: string; supportingContext: string | null; sourceUrl: string | null; confidence: number }[];
}

const JOURNEY_LABELS: Record<string, string> = {
  DISCOVERY: 'Discovery',
  WEBSITE: 'Website',
  PHONE: 'Phone',
  MENU: 'Menu',
  RESERVATION: 'Reservation',
  ORDERING: 'Ordering',
  CONTACT: 'Contact',
  FOLLOW_UP: 'Follow-Up',
  REVIEW: 'Review & Reputation',
  RETURN: 'Return & Retention',
};

const MAX_REPORT_FINDINGS = 5;

export function buildExecutiveReport(input: ExecutiveReportInput): ExecutiveReportDTO {
  const evidenceById = new Map(input.evidence.map((e) => [e.id, e]));
  const ranked = [...input.opportunities].sort((a, b) => b.rescuePriorityScore - a.rescuePriorityScore);
  const top = ranked.slice(0, MAX_REPORT_FINDINGS);

  const findings: ExecutiveFinding[] = top.map((opp, i) => {
    const attached = opp.evidenceIds.map((id) => evidenceById.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
    const classification = classifyFinding(opp);
    const kind = scenarioKindFor({ category: opp.category, classification });
    return {
      number: i + 1,
      title: opp.title,
      category: opp.category,
      classification,
      problem: opp.problem,
      whyItMatters: opp.businessImpact,
      commercialEffect: commercialEffectFor(opp.category, opp.businessImpact),
      whatWeKnow: attached.slice(0, 3).map((e) => e.fact),
      whatWeDoNotKnow: unknownsFor(opp.category),
      potentialEffect: opp.businessImpact,
      recommendedAction: opp.recommendedSolution,
      automationOpportunity: automationLabel(opp.aiFitScore),
      validationRequired: unknownsFor(opp.category),
      journeyStage: JOURNEY_LABELS[opp.customerJourneyStage] ?? opp.customerJourneyStage,
      labels: {
        businessImpact: levelLabel(opp.impactScore),
        urgency: levelLabel(opp.urgencyScore),
        evidenceConfidence: confidenceLabel(opp.confidenceScore),
        automationOpportunity: automationLabel(opp.aiFitScore),
        priority: priorityLabel(opp.rescuePriorityScore),
      },
      internalScores: {
        impact: opp.impactScore,
        urgency: opp.urgencyScore,
        confidence: opp.confidenceScore,
        aiFit: opp.aiFitScore,
        rescuePriority: opp.rescuePriorityScore,
      },
      evidenceSnapshot: attached.slice(0, 3).map((e) => ({ fact: e.fact, sourceUrl: e.sourceUrl })),
      scenario: kind ? buildScenario(kind, firstSentence(opp.problem)) : null,
    };
  });

  const verifiedCount = findings.filter((f) => f.classification === 'VERIFIED FINDING').length;
  const inferredCount = findings.filter((f) => f.classification === 'INFERRED OPPORTUNITY').length;
  const manualCount = findings.filter((f) => f.classification === 'MANUAL VALIDATION REQUIRED').length;

  const stageOrder = Object.keys(JOURNEY_LABELS);
  const journeyScorecard = [...input.journey]
    .sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage))
    .map((s) => ({
      stage: s.stage,
      label: JOURNEY_LABELS[s.stage] ?? s.stage,
      status: s.status === 'UNKNOWN' ? 'INSUFFICIENT DATA' : s.status,
      explanation: firstSentence(s.finding),
    }));

  const aiOpportunities = top
    .filter((opp) => opp.aiFitScore >= 70)
    .map((opp) => ({
      opportunity: opp.title,
      solutionCategory: solutionCategoryFor(opp.category),
      problemAddressed: firstSentence(opp.problem),
      whyItFits: opp.businessImpact,
      expectedBenefit: firstSentence(opp.recommendedSolution),
      validationRequired: unknownsFor(opp.category),
      complexity: (opp.aiFitScore >= 90 ? 'Moderate' : 'Moderate') as 'Low' | 'Moderate' | 'High',
    }));

  // Dedupe by scenario key: multiple findings can map to the same ScenarioKind
  // (e.g. ordering-failure and third-party-ordering both → 'ordering'), which
  // would otherwise render duplicate cards with identical dollars and duplicate
  // React keys. Findings are already ranked, so the first instance of each kind
  // is the highest-priority one and is the one we keep.
  const seenScenarioKeys = new Set<string>();
  const scenarios = findings
    .map((f) => f.scenario)
    .filter((sc): sc is RevenueScenario => Boolean(sc))
    .filter((sc) => {
      if (seenScenarioKeys.has(sc.key)) return false;
      seenScenarioKeys.add(sc.key);
      return true;
    })
    .slice(0, 3);
  const rankedAiOpportunities = buildRankedAiOpportunities(top);
  const snapshot = buildSnapshot(input, findings, rankedAiOpportunities);

  return {
    cover: {
      company: COMPANY.name,
      productName: COMPANY.productName,
      subtitle: COMPANY.reportSubtitle,
      restaurantName: input.restaurantName,
      websiteUrl: input.websiteUrl,
      location: input.location,
      auditDate: input.auditDate,
      preparedBy: `Prepared by ${COMPANY.name}`,
      footer: COMPANY.footer,
      demoMode: input.demoMode,
      auditStatus: input.auditStatus,
    },
    snapshot,
    scenarios,
    journeyMap: buildJourneyMap(input.journey),
    rankedAiOpportunities,
    prescription: buildPrescription(input, findings),
    decisionBox: buildDecisionBox(findings, rankedAiOpportunities),
    cta: {
      headline: COMPANY.ctaHeadline,
      subtext: COMPANY.ctaSubtext,
      company: input.contact.company,
      consultantName: input.contact.consultantName,
      phone: input.contact.phone,
      email: input.contact.email,
      bookingUrl: input.contact.bookingUrl,
      qrDataUrl: input.bookingQrDataUrl,
      fallbackText: input.contact.fallbackText,
    },
    valueSignals: {
      auditId: input.auditId,
      auditDate: input.auditDate,
      preparedFor: input.restaurantName,
      preparedBy: COMPANY.name,
      pagesAnalyzed: input.sourcesCollected,
      evidenceItems: input.evidence.length,
      coverage: input.coverageScore,
      confidentialityNote: 'Confidential — prepared for management review.',
    },
    executiveSummary: buildSummary(input, findings),
    summaryWasAiEnhanced: Boolean(input.storedSummaryWasAiEnhanced && input.storedSummary),
    score: {
      rescueScore: input.overallScore,
      band: input.overallScore === null ? null : scoreBand(input.overallScore),
      interpretation: interpretScore(input.overallScore),
      coverage: input.coverageScore,
      evidenceCount: input.evidence.length,
      sourcesAnalyzed: input.sourcesCollected,
      sourcesFailed: input.sourcesFailed,
      verifiedCount,
      inferredCount,
      manualValidationCount: manualCount,
    },
    findings,
    journeyScorecard,
    aiOpportunities,
    thirtyDayPlan: buildThirtyDayPlan(top, input),
    recommendation: {
      headline: 'OUR RECOMMENDATION',
      body: input.storedRecommendation
        ? `Based on the public evidence reviewed, ${COMPANY.shortName} recommends: ${input.storedRecommendation.tier}. ${input.storedRecommendation.rationale}`
        : `Based on the public evidence reviewed, ${COMPANY.shortName} recommends validating the highest-priority findings against internal operating data before committing to any system.`,
      nextStep: COMPANY.nextStepCta,
      company: COMPANY.name,
      contactName: input.contact.consultantName,
      contactPhone: input.contact.phone,
    },
    methodologyAndLimitations: METHODOLOGY,
    appendix: input.evidence.map((e) => ({
      evidenceType: e.evidenceType,
      fact: e.fact,
      supportingContext: e.supportingContext,
      sourceUrl: e.sourceUrl,
      confidence: e.confidence,
    })),
  };
}

// ── Section builders (all deterministic, evidence-derived) ──────────────────

type OppInput = ExecutiveReportInput['opportunities'][number];

function commercialEffectFor(category: string, businessImpact: string): string {
  if (/PHONE-DEPENDENT/i.test(category))
    return 'When guest demand depends on a live phone answer, customer intent competes directly with staff attention during peak service, and inquiries that arrive at the wrong moment may go unanswered.';
  if (/CATERING|PRIVATE|LEAD/i.test(category))
    return 'High-value event inquiries reward speed-to-response; when they depend on manual handling, intent that arrives after hours or during a rush may cool before anyone replies.';
  if (/RETENTION|REACTIVATION/i.test(category))
    return 'Without an owned channel to invite guests back, repeat visits depend on memory and paid reach rather than a repeatable, measurable workflow.';
  if (/ORDERING|THIRD-PARTY/i.test(category))
    return 'Friction or fragmentation in the ordering path can split guest intent across channels and shift margin toward third-party platforms.';
  if (/CTA|CONVERSION/i.test(category))
    return 'When the primary guest action is not obvious, ready-to-act visitors may hesitate, and intent that could convert can dissipate.';
  if (/MENU/i.test(category))
    return 'The menu is the most-requested piece of restaurant information; friction here can turn a ready visitor into a comparison shopper before they ever see a dish.';
  if (/TECHNICAL|HTTPS|MOBILE/i.test(category))
    return 'Most restaurant traffic is mobile; a technical barrier can cost the visit before the guest reaches any content.';
  if (/CONTACT|HOURS|ADDRESS/i.test(category))
    return 'When basic visit information is hard to find, guests may call, hesitate, or choose a competitor whose details are one tap away.';
  // Distinct from "why it matters" (which restates business impact) so the two
  // fields never render identical text.
  return 'This friction sits on a path guests actually use, so any exposure compounds quietly across every visit until it is measured and addressed.';
}

function buildSnapshot(
  input: ExecutiveReportInput,
  findings: ExecutiveFinding[],
  ranked: RankedAiOpportunity[],
): ExecutiveSnapshot {
  const priorities: SnapshotPriority[] = findings.slice(0, 3).map((f) => ({
    rank: f.number,
    title: f.title,
    priorityLabel: `${f.labels.priority.toUpperCase()} PRIORITY`,
    summary: firstSentence(f.problem),
    validationRequired: f.whatWeDoNotKnow,
  }));
  const primaryValidation = findings.find((f) => f.classification === 'MANUAL VALIDATION REQUIRED')?.whatWeDoNotKnow
    ?? findings[0]?.whatWeDoNotKnow
    ?? 'Validate the highest-priority findings against internal operating data.';
  return {
    priorities,
    rescueScore: input.overallScore,
    band: input.overallScore === null ? null : scoreBand(input.overallScore),
    coverage: input.coverageScore,
    topRecommendedAutomation: ranked[0]?.solutionCategory ?? null,
    primaryValidationRequirement: primaryValidation,
    recommendedNextStep: COMPANY.nextStepCta,
  };
}

const JOURNEY_MAP_ORDER = ['DISCOVERY', 'WEBSITE', 'MENU', 'PHONE', 'RESERVATION', 'ORDERING', 'CONTACT', 'FOLLOW_UP', 'REVIEW', 'RETURN'];

function buildJourneyMap(journey: ExecutiveReportInput['journey']): JourneyMapStage[] {
  const byStage = new Map(journey.map((s) => [s.stage, s]));
  return JOURNEY_MAP_ORDER.filter((stage) => byStage.has(stage)).map((stage) => {
    const s = byStage.get(stage)!;
    let status: JourneyMapStage['status'];
    if (s.status === 'UNKNOWN') status = 'INSUFFICIENT DATA';
    else if (s.manualValidationRequired && s.status !== 'HEALTHY') status = 'MANUAL VALIDATION';
    else status = s.status as JourneyMapStage['status'];
    return { stage, label: JOURNEY_LABELS[stage] ?? stage, status, note: firstSentence(s.finding) };
  });
}

const AI_CAPABILITIES: [RegExp, { capabilities: string[]; measurement: string[] }][] = [
  [/PHONE-DEPENDENT|MISSED-CALL|FRONT DESK/i, {
    capabilities: ['AI voice receptionist', 'Missed-call text-back', 'FAQ automation', 'Lead capture', 'After-hours response'],
    measurement: ['Missed calls', 'Answered inquiries', 'Commercial inquiry rate', 'Booking or ordering action after response'],
  }],
  [/CATERING|PRIVATE|LEAD/i, {
    capabilities: ['Instant inquiry acknowledgment', 'Structured event intake', 'Lead qualification', 'Human handoff', 'After-hours capture'],
    measurement: ['Event inquiries received', 'Response time', 'Inquiries qualified', 'Inquiries converted'],
  }],
  [/RETENTION|REACTIVATION/i, {
    capabilities: ['Email/SMS list building', 'Lapsed-guest campaigns', 'Birthday & occasion automation', 'Offer follow-up'],
    measurement: ['Contacts captured per week', 'Reactivation response rate', 'Repeat-visit rate', 'Campaign revenue'],
  }],
  [/ORDERING|THIRD-PARTY/i, {
    capabilities: ['Direct-order path consolidation', 'Order-status automation', 'Channel guidance'],
    measurement: ['Online order clicks', 'Direct-order share', 'Third-party commission exposure'],
  }],
  [/CTA|CONVERSION/i, {
    capabilities: ['Primary-action clarity', 'Conversion-path simplification'],
    measurement: ['Website conversion actions per hundred visits', 'Primary CTA click rate'],
  }],
];

function buildRankedAiOpportunities(top: OppInput[]): RankedAiOpportunity[] {
  return top
    .filter((opp) => opp.aiFitScore >= 70)
    .sort((a, b) => b.aiFitScore - a.aiFitScore || b.rescuePriorityScore - a.rescuePriorityScore)
    .slice(0, 3)
    .map((opp, i) => {
      const caps = AI_CAPABILITIES.find(([re]) => re.test(opp.category) || re.test(solutionCategoryFor(opp.category)))?.[1]
        ?? { capabilities: ['Configured automation matched to the finding'], measurement: ['Response volume', 'Conversion action after response'] };
      const fit = automationLabel(opp.aiFitScore) === 'Strong' ? 'STRONG' : automationLabel(opp.aiFitScore) === 'Moderate' ? 'MODERATE' : 'LIMITED';
      return {
        rank: i + 1,
        solutionCategory: solutionCategoryFor(opp.category),
        fit,
        problemAddressed: firstSentence(opp.problem),
        whyItFits: opp.businessImpact,
        capabilities: caps.capabilities,
        validationBeforeImplementation: unknownsFor(opp.category),
        implementationComplexity: 'Moderate',
        measurement: caps.measurement,
      };
    });
}

function buildPrescription(input: ExecutiveReportInput, findings: ExecutiveFinding[]): Prescription {
  const primary = findings[0];
  const tier = input.storedRecommendation?.tier ?? 'AI DISCOVERY AUDIT';
  const frictionStages = input.journey.filter((s) => s.status === 'FRICTION' || s.status === 'RISK').map((s) => JOURNEY_LABELS[s.stage] ?? s.stage);
  const diagnosis = frictionStages.length > 0
    ? `The public digital journey shows friction concentrated in: ${frictionStages.join(', ')}. ${primary ? firstSentence(primary.problem) : ''}`.trim()
    : 'The public digital journey is broadly healthy; the open questions sit in areas a public audit cannot observe.';
  const validation = primary?.whatWeDoNotKnow
    ?? 'Review 30 days of phone activity, missed-call counts, guest-question categories, and average ticket data.';
  const prescription = input.storedRecommendation
    ? `If the validation data confirms the observed friction, ${COMPANY.shortName} recommends ${tier}${primary && primary.internalScores.aiFit >= 70 ? ', beginning with the highest-fit automation identified above,' : ''} as the next step. ${input.storedRecommendation.rationale}`
    : `${COMPANY.shortName} recommends validating the highest-priority findings against internal operating data before committing to any system.`;
  return {
    diagnosis,
    validation,
    prescription,
    expectedOperationalRole: [
      'Answer repetitive guest questions',
      'Capture missed-call and after-hours demand',
      'Route booking and ordering intent',
      'Capture leads for follow-up',
      'Report on response and conversion activity',
    ],
  };
}

function buildDecisionBox(findings: ExecutiveFinding[], ranked: RankedAiOpportunity[]): DecisionBox {
  const topAutomation = ranked[0]?.solutionCategory ?? 'the highest-fit automation';
  const frictionExists = findings.some((f) => f.classification !== 'INSUFFICIENT DATA');
  return {
    doNothing: {
      heading: 'DO NOTHING',
      detail: 'Continue relying on the current customer journey as-is.',
      risk: frictionExists
        ? 'Potential phone, conversion, and follow-up friction remains unmeasured, and any exposure continues without a workflow to capture it.'
        : 'Any friction in areas a public audit cannot see remains unmeasured.',
    },
    validate: {
      heading: 'VALIDATE',
      detail: 'Review 30 days of operating data (calls, bookings, orders, and average ticket).',
      cost: 'Low operational effort.',
      benefit: 'Turns public audit findings into measurable business evidence you own.',
    },
    implement: {
      heading: 'IMPLEMENT',
      detail: `Deploy ${topAutomation} after validation confirms the demand.`,
      benefit: 'Creates a measurable customer-response workflow with defined KPIs.',
    },
  };
}

function interpretScore(score: number | null): string {
  if (score === null) return 'Public evidence was insufficient to produce an overall score. See Methodology & Limitations.';
  if (score >= 90) return 'The public-facing digital operation is exceptionally strong; remaining opportunities are refinements, not repairs.';
  if (score >= 80) return 'A strong digital revenue foundation with specific, addressable optimization opportunities.';
  if (score >= 70) return 'A workable foundation with measurable revenue leakage in specific parts of the guest journey.';
  if (score >= 60) return 'Guests encounter meaningful friction at several points in the digital journey; prioritized fixes are warranted.';
  return 'The digital guest journey is a high-priority rescue opportunity; several fundamental pathways need attention.';
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim().slice(0, 240);
}

function buildSummary(input: ExecutiveReportInput, findings: ExecutiveFinding[]): string {
  // Prefer the audit-time summary when it was AI-enhanced (it was schema-
  // validated against the same stored data); otherwise compose deterministically.
  if (input.storedSummaryWasAiEnhanced && input.storedSummary) return input.storedSummary;

  const stageOrder = Object.keys(JOURNEY_LABELS);
  const ordered = [...input.journey].sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));
  const healthy = ordered.filter((s) => s.status === 'HEALTHY').map((s) => JOURNEY_LABELS[s.stage] ?? s.stage);
  const friction = ordered.filter((s) => s.status === 'FRICTION' || s.status === 'RISK').map((s) => JOURNEY_LABELS[s.stage] ?? s.stage);
  const parts: string[] = [];

  parts.push(
    `Our audit analyzed ${input.sourcesCollected} public page(s) of the ${input.restaurantName} digital presence and collected ${input.evidence.length} evidence items across the guest journey.`,
  );
  if (input.overallScore !== null) {
    parts.push(`The restaurant scored ${input.overallScore}/100 on the Restaurant Rescue Score${input.coverageScore !== null ? `, with ${input.coverageScore}% of the intended audit scope covered by sufficient public evidence` : ''}.`);
  } else {
    parts.push('Public evidence was insufficient to produce an overall score; coverage details appear below.');
  }
  if (healthy.length > 0) parts.push(`The strongest areas of the current digital operation are: ${healthy.join(', ')}.`);
  if (friction.length > 0) parts.push(`Public evidence suggests guest friction concentrated in: ${friction.join(', ')}.`);
  if (findings.length > 0) {
    parts.push(
      `The most important potential revenue opportunities identified are: ${findings.map((f) => f.title.toLowerCase()).join('; ')}.`,
    );
    const manual = findings.filter((f) => f.classification === 'MANUAL VALIDATION REQUIRED').length;
    if (manual > 0) parts.push(`${manual} of these should be validated against internal call, booking, or sales data before being treated as confirmed.`);
    parts.push(`Ownership should prioritize the first finding in this report; the 30-day plan sequences validation, fixes, and automation in order.`);
  } else {
    parts.push('No high-priority revenue leaks were confirmed from public evidence; the recommended next step is validating the areas public analysis cannot see — calls, follow-up, and repeat business.');
  }
  return parts.join(' ');
}

function buildThirtyDayPlan(
  top: ExecutiveReportInput['opportunities'],
  input: ExecutiveReportInput,
): { phase: string; heading: string; actions: string[] }[] {
  const has = (pattern: RegExp) => top.some((o) => pattern.test(o.category));

  const validate: string[] = [];
  if (has(/PHONE|CONTACT|CATERING/i)) validate.push('Pull 30 days of phone records: total calls, missed calls, and the most common call reasons.');
  if (has(/CATERING|PRIVATE/i)) validate.push('Review how catering and private-event inquiries arrive today and how quickly they get a response.');
  if (has(/ORDERING|THIRD-PARTY/i)) validate.push('Confirm the online ordering workflow end-to-end and the direct vs third-party order mix.');
  if (has(/RETENTION/i)) validate.push('Check whether the POS or reservation system already holds a guest contact database, and its size.');
  if (input.journey.some((s) => s.stage === 'RESERVATION' && s.status !== 'HEALTHY')) validate.push('Review reservation patterns: how bookings arrive and where requests are lost.');
  validate.push('Walk each finding marked "manual validation required" against your own operating data.');

  const highestDirect = top.filter((o) => o.aiFitScore < 70);
  const fix = (highestDirect.length > 0 ? highestDirect : top).slice(0, 3).map((o) => o.recommendedSolution);
  if (fix.length === 0) fix.push('No urgent digital repairs surfaced from public evidence; use this window to complete validation.');

  const automation = top.filter((o) => o.aiFitScore >= 70).slice(0, 2);
  const automate = automation.length > 0
    ? automation.map((o) => `${solutionCategoryFor(o.category)} — ${firstSentence(o.recommendedSolution)}`)
    : ['If validation confirms repetitive demand, select the automation with the strongest fit; otherwise reinvest in the fixes above.'];

  const kpis: string[] = [];
  if (has(/PHONE|CONTACT/i)) kpis.push('Missed calls per week and answered-inquiry rate');
  if (has(/CATERING|PRIVATE/i)) kpis.push('Event-inquiry response time and inquiries converted');
  if (has(/ORDERING|THIRD-PARTY|MENU/i)) kpis.push('Online order clicks and direct-order share');
  if (has(/RETENTION/i)) kpis.push('New guest contacts captured per week and reactivation response rate');
  if (has(/CTA|TECHNICAL/i)) kpis.push('Website conversion actions (calls, bookings, orders) per hundred visits');
  if (kpis.length === 0) kpis.push('Booking conversion, direct-order share, and repeat-guest rate');

  return [
    { phase: 'DAYS 1–7', heading: 'VALIDATE', actions: validate },
    { phase: 'DAYS 8–14', heading: 'FIX THE HIGHEST-FRICTION DIGITAL LEAK', actions: fix },
    { phase: 'DAYS 15–21', heading: 'AUTOMATE', actions: automate },
    { phase: 'DAYS 22–30', heading: 'MEASURE', actions: kpis.map((k) => `Track: ${k}.`) },
  ];
}

const METHODOLOGY: string[] = [
  'This audit analyzes publicly available digital evidence: the restaurant’s public website pages and the customer pathways they expose.',
  'The system does not have access to POS, reservation, or sales data unless separately provided by ownership.',
  'The system does not know true missed-call volume without phone records; phone-related findings describe exposure, not measured losses.',
  'The system does not know actual booking or order conversion without internal data.',
  'No financial losses are stated as confirmed facts anywhere in this report; where impact is discussed, it describes potential exposure.',
  'Findings marked "manual validation required" need owner data, staff input, or records unavailable to a public audit.',
  'Review and reputation platforms are not analyzed in this audit scope; a dedicated reputation analysis is recommended.',
  'Public websites can change after the audit date; evidence reflects what was publicly accessible when collected.',
];

// Re-export for the scorecard footnote.
export { CATEGORY_LABELS };

/** Sanitize a restaurant name into a safe PDF filename. */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return cleaned || 'restaurant';
}
