import { scoreBand } from '@/lib/scoring/rescueScore';
import { CATEGORY_LABELS } from '@/lib/reports/owner';
import { COMPANY, type Contact } from '@/lib/config';
import { prefillFromAverageTicket, scenarioKindFor, SCENARIO_SPECS, type ScenarioKind } from '@/lib/reports/scenarios';
import { STATE_LABEL, stateForOpportunity, type EvidenceState } from '@/lib/audit/evidenceState';
import { safeDisplayName } from '@/lib/audit/restaurantName';
import {
  CONFIDENCE_BANDS,
  CONFIDENCE_EXPLANATION,
  scoringMethodology,
  type MethodologySection,
} from '@/lib/scoring/methodology';

export type { RevenueScenario, ScenarioKind } from '@/lib/reports/scenarios';

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

export type EvidenceClassification =
  | 'VERIFIED FINDING'
  | 'STRONG EVIDENCE'
  | 'INFERRED OPPORTUNITY'
  | 'MANUAL VALIDATION REQUIRED'
  | 'INSUFFICIENT DATA';

/**
 * Classification preserves the engine's own uncertainty flags — it can only ever
 * be as confident as the stored finding, never more.
 *
 * The rule now lives in one place for the whole system (`stateForOpportunity`),
 * so the Executive Report, the PDF and the Internal Sales Brief cannot drift
 * into three slightly different opinions about the same finding. These strings
 * are the client-facing rendering of that single state; the state itself is
 * what every layer reasons about.
 */
export function classifyFinding(opp: { manualValidationRequired: boolean; confidenceScore: number }): EvidenceClassification {
  return STATE_LABEL[stateForOpportunity(opp)] as EvidenceClassification;
}

export interface ReportHeadlines {
  /** Title of the at-a-glance section. */
  snapshot: string;
  /** Title of the ranked findings section. */
  findings: string;
}

/**
 * HEADLINES FOLLOW THE EVIDENCE.
 *
 * "Top Revenue Leaks" over a list in which nothing was verified told the reader
 * money was leaking when the audit had only found places to look. The title
 * now says what the list is: verified leaks only when every finding in it is
 * verified, priority opportunities to validate when none is, and both words
 * when the list is mixed. A verified finding is never relabelled — each card
 * still carries its own classification badge.
 *
 * One function for the web report, the PDF and the internal audit page, so the
 * three cannot title the same list differently.
 */
export function reportHeadlines(classifications: EvidenceClassification[]): ReportHeadlines {
  const verified = classifications.filter((c) => c === 'VERIFIED FINDING').length;
  if (classifications.length > 0 && verified === classifications.length) {
    return { snapshot: 'Executive Revenue Snapshot', findings: 'Top Revenue Leaks' };
  }
  if (verified > 0) {
    return { snapshot: 'Executive Snapshot', findings: 'Revenue Leaks and Opportunities to Validate' };
  }
  return { snapshot: 'Executive Snapshot', findings: 'Priority Opportunities to Validate' };
}

/** The canonical evidence state behind a report classification, for callers that need to reason about it. */
export function evidenceStateForFinding(opp: { manualValidationRequired: boolean; confidenceScore: number }): EvidenceState {
  return stateForOpportunity(opp);
}

// "What we do not yet know" — deterministic per finding category. These
// sentences state exactly which internal data the public audit cannot see.
const UNKNOWNS_BY_CATEGORY: [RegExp, string][] = [
  [/PHONE-DEPENDENT/i, 'Actual call volume, missed-call counts, and the share of calls that are repetitive questions require phone records.'],
  [/RETENTION/i, 'Whether an internal guest database already exists in the POS or reservation system — and how large it is — requires owner data.'],
  [/CATERING|PRIVATE/i, 'How these inquiries are actually handled requires your records: acknowledgment records, response times and booking records for recent catering and private-event inquiries.'],
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
  avgTicket: number | null;
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
  /**
   * The optional calculator this finding's pathway can use, or null. A pointer
   * only — no figures. See `scenarioCalculators`.
   */
  scenarioKind: ScenarioKind | null;
}

/**
 * An optional scenario calculator offered to the reader — inputs, never values.
 *
 * The report used to attach a finished dollar scenario to every eligible
 * finding, computed from invented counts. It now offers the calculator and
 * leaves every quantity to the reader; `prefill` carries only figures the user
 * already entered themselves (the average ticket given when the audit was
 * requested).
 */
export interface ScenarioCalculatorOffer {
  kind: ScenarioKind;
  pathwayTitle: string;
  findingTitle: string;
  observedFriction: string;
  prefill: Record<string, number>;
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
  /** True when the top automation rests on an open question rather than a verified finding. */
  topAutomationRequiresValidation: boolean;
  primaryValidationRequirement: string;
  recommendedNextStep: string;
}

export interface JourneyMapStage {
  stage: string;
  label: string;
  status: JourneyStatusLabel;
  note: string;
  /**
   * What the stage could NOT see, when the stage says so.
   *
   * The map kept only the first sentence of a stage's finding, which was fine
   * while findings were one sentence. They are now written as "Observed: … Not
   * assessed: …", so truncating dropped the half that keeps an observation from
   * reading as a conclusion — on the very surface a client scans fastest. Null
   * when the stage states no limitation.
   */
  limitation: string | null;
}

export interface RankedAiOpportunity {
  rank: number;
  solutionCategory: string;
  fit: 'STRONG' | 'MODERATE' | 'LIMITED';
  problemAddressed: string;
  /**
   * What the recommendation rests on, in one sentence. An automation matched to
   * an open question is a potential improvement to validate, never a fix for a
   * measured problem — this says which one the reader is looking at.
   */
  basis: string;
  requiresValidation: boolean;
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
  headlines: ReportHeadlines;
  snapshot: ExecutiveSnapshot;
  scenarioCalculators: ScenarioCalculatorOffer[];
  journeyMap: JourneyMapStage[];
  /** What each status word on the journey map means — only the words the map uses. */
  journeyLegend: [JourneyStatusLabel, string][];
  rankedAiOpportunities: RankedAiOpportunity[];
  /** One sentence introducing Section 06 on screen and in the PDF, from one source. */
  aiOpportunitiesIntro: string;
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
    /**
     * Denominator for the three classification counts below.
     *
     * verified + inferred + manualValidation classify the revenue-leak findings
     * reported in Section 04 — NOT the evidence items. An audit can hold 22
     * verified evidence items and still report zero VERIFIED FINDINGS, because
     * a finding is only verified when the leak it describes was established
     * without needing owner data. Publishing the total alongside them is what
     * makes the three numbers add up in the reader's head instead of reading as
     * a verdict on the evidence.
     */
    findingsCount: number;
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
  /**
   * One sentence explaining what the per-item confidence numbers mean.
   *
   * The appendix printed "confidence 90%" against every item with nothing
   * anywhere saying what the number was a confidence IN, or what counted as
   * high. A percentage a reader cannot interpret is not evidence of rigour; it
   * reads as false precision, which is the opposite of what it is for.
   */
  confidenceLegend: string;
  /**
   * The same rubric, kept structured.
   *
   * The flat string renders as a nine-line run-on paragraph on a 360px phone —
   * readable, but not scannable: the reader has to parse prose to find out what
   * their own badge means. The interface and the PDF lay these out as a
   * definition list; the string remains for anything that needs one sentence.
   */
  confidenceBands: [string, string][];
  /**
   * How the Rescue Score, coverage and confidence are calculated, in the words
   * the client reads.
   *
   * The report printed a 0–100 score under the words "Rescue Score" and never
   * said what it measured, which direction it ran, how the categories were
   * weighted, what coverage divided by, or that an unknown stage is dropped
   * from the average rather than scored zero. Quoted from
   * `@/lib/scoring/methodology` so the interface and the PDF cannot describe
   * the arithmetic differently.
   */
  scoringMethodology: MethodologySection[];
  appendix: {
    evidenceType: string;
    fact: string;
    supportingContext: string | null;
    sourceUrl: string | null;
    confidence: number;
    /** Derived here so the report and the PDF can never disagree about a band. */
    confidenceLabel: ReturnType<typeof confidenceLabel>;
  }[];
}

export type JourneyStatusLabel = 'HEALTHY' | 'FRICTION' | 'RISK' | 'MANUAL VALIDATION' | 'INSUFFICIENT DATA';

/**
 * The one client-facing word for a journey stage's status.
 *
 * Every surface — the web report, the PDF and the internal audit page — calls
 * this, so a stage cannot read FRICTION on one screen and MANUAL VALIDATION on
 * another. The words keep distinct meanings:
 *
 *   FRICTION           something a customer meets on the public site was
 *                      observed (no tap-to-call, a dead menu link, no opt-in
 *                      route at all). It stays FRICTION even when the stage
 *                      also needs owner data to size it: the friction itself
 *                      was seen.
 *   MANUAL VALIDATION  the mechanism is present and nothing was seen to
 *                      obstruct it, but whether it works or performs is
 *                      unmeasured (RESOLVED_UNVERIFIED).
 *   INSUFFICIENT DATA  public evidence could not establish the stage at all.
 *
 * It used to promote any FRICTION stage carrying a manual-validation flag to
 * MANUAL VALIDATION on the client report while the internal page still printed
 * FRICTION, which is the inconsistency this replaces.
 */
export function journeyStatusLabel(status: string): JourneyStatusLabel {
  if (status === 'RESOLVED_UNVERIFIED') return 'MANUAL VALIDATION';
  if (status === 'HEALTHY' || status === 'FRICTION' || status === 'RISK') return status;
  return 'INSUFFICIENT DATA';
}

/** Printed beside the journey map on screen and in the PDF, from one source. */
export const JOURNEY_STATUS_LEGEND: [JourneyStatusLabel, string][] = [
  ['HEALTHY', 'the pathway is publicly present and nothing observed obstructs it.'],
  ['FRICTION', 'something a customer meets on the public site was observed to get in the way.'],
  ['RISK', 'a core pathway is missing or failing.'],
  ['MANUAL VALIDATION', 'the mechanism is present; how well it works or performs is unmeasured and needs your records.'],
  ['INSUFFICIENT DATA', 'public evidence could not establish this stage.'],
];

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
    const scenarioKind = scenarioKindFor({ category: opp.category, classification });
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
      scenarioKind,
    };
  });

  // Three published counters, and they must still sum to the number of findings
  // printed — a reader who cannot make the numbers add up stops trusting all of
  // them.
  //
  // STRONG EVIDENCE is counted with the inferred findings, not the verified
  // ones. The buckets are "may be stated as fact" / "an opportunity, not a
  // confirmed defect" / "needs a human", and strong-but-not-completed evidence
  // belongs to the second. Each finding still carries its own STRONG EVIDENCE
  // badge, so nothing is hidden by the grouping — only the promotion is refused.
  const verifiedCount = findings.filter((f) => f.classification === 'VERIFIED FINDING').length;
  const inferredCount = findings.filter(
    (f) => f.classification === 'INFERRED OPPORTUNITY' || f.classification === 'STRONG EVIDENCE',
  ).length;
  const manualCount = findings.filter((f) => f.classification === 'MANUAL VALIDATION REQUIRED').length;

  const stageOrder = Object.keys(JOURNEY_LABELS);
  const journeyScorecard = [...input.journey]
    .sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage))
    .map((s) => ({
      stage: s.stage,
      label: JOURNEY_LABELS[s.stage] ?? s.stage,
      status: journeyStatusLabel(s.status),
      explanation: firstSentence(s.finding),
    }));

  const aiOpportunities = top
    .filter((opp) => opp.aiFitScore >= 70)
    .map((opp) => ({
      opportunity: opp.title,
      solutionCategory: solutionCategoryFor(opp.category),
      problemAddressed: problemAddressedBy(opp),
      whyItFits: opp.businessImpact,
      expectedBenefit: firstSentence(opp.recommendedSolution),
      validationRequired: unknownsFor(opp.category),
      complexity: (opp.aiFitScore >= 90 ? 'Moderate' : 'Moderate') as 'Low' | 'Moderate' | 'High',
    }));

  // One calculator per scenario kind: several findings can map to the same
  // kind (e.g. ordering-failure and third-party-ordering both → 'ordering').
  // Findings are already ranked, so the first instance of each kind is the
  // highest-priority one and is the one offered.
  const seenScenarioKinds = new Set<ScenarioKind>();
  const scenarioCalculators: ScenarioCalculatorOffer[] = [];
  for (const f of findings) {
    if (!f.scenarioKind || seenScenarioKinds.has(f.scenarioKind) || scenarioCalculators.length >= 3) continue;
    seenScenarioKinds.add(f.scenarioKind);
    scenarioCalculators.push({
      kind: f.scenarioKind,
      pathwayTitle: SCENARIO_SPECS[f.scenarioKind].pathwayTitle,
      findingTitle: f.title,
      // An open question is not observed friction; only a verified finding's
      // observation may be carried under that name.
      observedFriction: f.classification === 'VERIFIED FINDING' ? firstSentence(f.problem) : `Open question: ${f.title.replace(/\.$/, '')}.`,
      prefill: prefillFromAverageTicket(f.scenarioKind, input.avgTicket),
    });
  }
  const rankedAiOpportunities = buildRankedAiOpportunities(top);
  const journeyMap = buildJourneyMap(input.journey);
  const usedStatuses = new Set(journeyMap.map((s) => s.status));
  const snapshot = buildSnapshot(input, findings, rankedAiOpportunities);

  return {
    cover: {
      company: COMPANY.name,
      productName: COMPANY.productName,
      subtitle: COMPANY.reportSubtitle,
      // Never renders a null, empty or serialised-junk name to a client. The
      // resolver runs at audit time; this report may be built from a row written
      // by an older build, so the guard lives here too.
      restaurantName: safeDisplayName(input.restaurantName, input.websiteUrl),
      websiteUrl: input.websiteUrl,
      location: input.location,
      auditDate: input.auditDate,
      preparedBy: `Prepared by ${COMPANY.name}`,
      footer: COMPANY.footer,
      demoMode: input.demoMode,
      auditStatus: input.auditStatus,
    },
    headlines: reportHeadlines(findings.map((f) => f.classification)),
    snapshot,
    scenarioCalculators,
    journeyMap,
    journeyLegend: JOURNEY_STATUS_LEGEND.filter(([label]) => usedStatuses.has(label)),
    rankedAiOpportunities,
    aiOpportunitiesIntro: AI_OPPORTUNITIES_INTRO,
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
      findingsCount: findings.length,
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
    confidenceLegend: CONFIDENCE_LEGEND,
    confidenceBands: CONFIDENCE_BANDS,
    scoringMethodology: scoringMethodology(),
    appendix: input.evidence.map((e) => ({
      evidenceType: e.evidenceType,
      fact: e.fact,
      supportingContext: e.supportingContext,
      sourceUrl: e.sourceUrl,
      confidence: e.confidence,
      confidenceLabel: confidenceLabel(e.confidence),
    })),
  };
}

/**
 * Assembled from the rubric itself, so the legend cannot describe bands the
 * labels do not follow.
 *
 * It no longer quotes percentage ranges, because the percentages are no longer
 * shown. They were hand-assigned constants per observation type: a reader
 * cannot act on the difference between 85% and 90%, and a printed percentage
 * invites them to read it as a probability the audit never calculated. The
 * bands are defined by HOW the fact was obtained, which has a checkable answer.
 */
export const CONFIDENCE_LEGEND =
  `${CONFIDENCE_EXPLANATION} ` + CONFIDENCE_BANDS.map(([label, definition]) => `${label}: ${definition}`).join(' ');

// ── Section builders (all deterministic, evidence-derived) ──────────────────

type OppInput = ExecutiveReportInput['opportunities'][number];

function commercialEffectFor(category: string, businessImpact: string): string {
  // Conditional, because nothing about this restaurant's call volume is known:
  // the sentence describes what would follow IF demand is phone-heavy.
  if (/PHONE-DEPENDENT/i.test(category))
    return 'If a meaningful share of guest demand arrives by phone, it competes with staff attention during peak service, and calls that come at the wrong moment may go unanswered. Whether that happens here requires call records.';
  if (/CATERING|PRIVATE|LEAD/i.test(category))
    return 'Event inquiries tend to be high-value, so how quickly they are acknowledged matters. A public link shows the pathway exists; it does not show whether inquiries are answered quickly or slowly, by hand or automatically.';
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
    topAutomationRequiresValidation: ranked[0]?.requiresValidation ?? false,
    primaryValidationRequirement: primaryValidation,
    recommendedNextStep: COMPANY.nextStepCta,
  };
}

const JOURNEY_MAP_ORDER = ['DISCOVERY', 'WEBSITE', 'MENU', 'PHONE', 'RESERVATION', 'ORDERING', 'CONTACT', 'FOLLOW_UP', 'REVIEW', 'RETURN'];

function buildJourneyMap(journey: ExecutiveReportInput['journey']): JourneyMapStage[] {
  const byStage = new Map(journey.map((s) => [s.stage, s]));
  return JOURNEY_MAP_ORDER.filter((stage) => byStage.has(stage)).map((stage) => {
    const s = byStage.get(stage)!;
    return {
      stage,
      label: JOURNEY_LABELS[stage] ?? stage,
      status: journeyStatusLabel(s.status),
      note: firstSentence(s.finding),
      limitation: limitationSentence(s.finding),
    };
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

export const AI_OPPORTUNITIES_INTRO =
  'Potential improvements matched to the findings above. "Fit" describes how well an automation suits the kind of problem, not evidence that the problem exists here; ' +
  'none of these rests on measured missed calls or lost revenue, and each should follow validation against your own records.';

function buildRankedAiOpportunities(top: OppInput[]): RankedAiOpportunity[] {
  return top
    .filter((opp) => opp.aiFitScore >= 70)
    .sort((a, b) => b.aiFitScore - a.aiFitScore || b.rescuePriorityScore - a.rescuePriorityScore)
    .slice(0, 3)
    .map((opp, i) => {
      const caps = AI_CAPABILITIES.find(([re]) => re.test(opp.category) || re.test(solutionCategoryFor(opp.category)))?.[1]
        ?? { capabilities: ['Configured automation matched to the finding'], measurement: ['Response volume', 'Conversion action after response'] };
      const fit = automationLabel(opp.aiFitScore) === 'Strong' ? 'STRONG' : automationLabel(opp.aiFitScore) === 'Moderate' ? 'MODERATE' : 'LIMITED';
      const requiresValidation = classifyFinding(opp) !== 'VERIFIED FINDING';
      return {
        rank: i + 1,
        solutionCategory: solutionCategoryFor(opp.category),
        fit,
        problemAddressed: problemAddressedBy(opp),
        basis: requiresValidation
          ? 'Potential improvement — requires operational validation before any implementation. No missed calls or lost revenue have been measured; a public audit cannot see either.'
          : 'Addresses a verified public finding. Its effect on revenue has not been measured.',
        requiresValidation,
        whyItFits: opp.businessImpact,
        capabilities: caps.capabilities,
        validationBeforeImplementation: unknownsFor(opp.category),
        implementationComplexity: 'Moderate',
        measurement: caps.measurement,
      };
    });
}

/**
 * The problem an automation is matched to. For an open question that is the
 * question itself — quoting the finding's first observation ("no dedicated FAQ
 * page was found") presented the automation as the fix for that observation.
 */
function problemAddressedBy(opp: OppInput): string {
  return classifyFinding(opp) === 'VERIFIED FINDING' ? firstSentence(opp.problem) : `Open question: ${opp.title.replace(/\.$/, '')}.`;
}

function buildPrescription(input: ExecutiveReportInput, findings: ExecutiveFinding[]): Prescription {
  const primary = findings[0];
  const tier = input.storedRecommendation?.tier ?? 'AI DISCOVERY AUDIT';
  const frictionStages = input.journey.filter((s) => s.status === 'FRICTION' || s.status === 'RISK').map((s) => JOURNEY_LABELS[s.stage] ?? s.stage);
  // OBSERVED FRICTION AND OPEN QUESTIONS ARE SEPARATE SENTENCES.
  //
  // The diagnosis used to append the top finding's first observation straight
  // after the friction list — "friction concentrated in: Ordering. OBSERVED: no
  // dedicated FAQ page was found." — which read the observation as friction.
  // Friction names only stages a customer was seen to meet; the top finding is
  // named for what it is.
  const observed = frictionStages.length > 0
    ? `Observed friction in the public journey: ${frictionStages.join(', ')}.`
    : 'No customer-facing friction was observed in the public journey.';
  const lead = primary
    ? primary.classification === 'VERIFIED FINDING'
      ? ` Highest-priority verified finding: ${primary.title.replace(/\.$/, '')}.`
      : ` Highest-priority open question, to check against your own records: ${primary.title.replace(/\.$/, '')}.`
    : ' The open questions sit in areas a public audit cannot observe.';
  const diagnosis = `${observed}${lead}`;
  const validation = primary?.whatWeDoNotKnow
    ?? 'Review 30 days of phone activity, missed-call counts, guest-question categories, and average ticket data.';
  const prescription = input.storedRecommendation
    ? `${COMPANY.shortName} recommends ${tier} as the next step${primary && primary.internalScores.aiFit >= 70 ? ', considering the highest-fit automation identified above only once your operating records confirm the open questions it depends on' : ''}. ${input.storedRecommendation.rationale}`
    : `${COMPANY.shortName} recommends validating the highest-priority findings against internal operating data before committing to any system.`;
  return {
    diagnosis,
    validation,
    prescription,
    expectedOperationalRole: [
      'Answer repetitive guest questions',
      'Respond to calls staff cannot answer, and to after-hours inquiries — where records show they occur',
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
  // NO BAND MAY ASSERT A MEASURED LOSS.
  //
  // "measurable revenue leakage" told the reader money had been measured
  // leaving the business. Nothing in this audit measures money. Each band now
  // describes the state of the PUBLIC SIGNALS the score is computed from, and
  // says so.
  if (score >= 90) return 'The public signals this audit checks are close to complete; what remains are refinements rather than repairs.';
  if (score >= 80) return 'The public signals are strong, with specific gaps worth addressing. No financial loss is measured by this score.';
  if (score >= 70) return 'A workable public foundation with identified gaps in specific parts of the guest journey. Whether those gaps cost money is not measured here.';
  if (score >= 60) return 'Several parts of the public guest journey show friction or could not be verified; these are the places to look first.';
  return 'Multiple core pathways are missing, broken, or unverifiable from public pages. This is where a review should start.';
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim().slice(0, 240);
}

/**
 * The sentence in a journey finding that states what was NOT established.
 *
 * Recognised by the openings the engine actually writes — "Not assessed:",
 * "Not observed:", "Requires your data:" — plus a stage that names the records
 * it would need. Deliberately pattern-matched rather than taken as "everything
 * after the first sentence": a stage may carry several observed sentences, and
 * only the limitation belongs on the second line of the map.
 */
function limitationSentence(text: string): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const found = sentences.find((s) =>
    /^(not assessed|not observed|requires your data)\b/i.test(s.trim()) ||
    /\brequires (call records|your own data|owner data)\b/i.test(s) ||
    /\bnot assessed here\b/i.test(s),
  );
  return found ? found.trim().slice(0, 240) : null;
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
    // Only verified findings may be called revenue leaks; see reportHeadlines.
    const verified = findings.filter((f) => f.classification === 'VERIFIED FINDING').length;
    const lead =
      verified === findings.length
        ? 'The verified revenue leaks identified are'
        : verified > 0
          ? 'The priority findings, verified and to be validated, are'
          : 'No revenue loss was verified from public evidence. The priority opportunities to validate are';
    parts.push(`${lead}: ${findings.map((f) => f.title.toLowerCase()).join('; ')}.`);
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
  if (has(/CATERING|PRIVATE/i)) validate.push('Pull acknowledgment records, response times and booking records for recent catering and private-event inquiries before deciding whether any automation is needed.');
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
  'The report contains no estimated dollar or volume figures. The optional scenario calculator in the online report uses only figures you enter, and its result is not a measured loss, a forecast or a guaranteed recovery.',
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
