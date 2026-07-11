import type { CategoryScoreInput, EvidenceRecordLike, JourneyStageResult } from '@/types/audit';
import { scoreBand } from '@/lib/scoring/rescueScore';

export interface RankedOpportunity {
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
}

export interface OwnerReportContent {
  header: {
    restaurantName: string;
    websiteUrl: string;
    location: string | null;
    auditDate: string;
    rescueScore: number | null;
    scoreBand: string | null;
    coverageScore: number;
    scoreExplanation: string;
    demoMode: boolean;
    auditStatus: string;
  };
  executiveSummary: string;
  biggestOpportunity: string;
  scorecard: { category: string; label: string; weight: number; score: number | null; insufficientData: boolean; explanation: string }[];
  topLeaks: {
    rank: number;
    title: string;
    problem: string;
    evidence: string[];
    whyItMatters: string;
    recommendedAction: string;
    rescuePriorityScore: number;
    manualValidationRequired: boolean;
  }[];
  journey: { stage: string; status: string; finding: string; manualValidationRequired: boolean }[];
  aiOpportunities: { title: string; currentFriction: string; automationOpportunity: string; expectedBenefit: string; implementationComplexity: string }[];
  rescuePlan: { phase: string; actions: string[] }[];
  assumptionsAndLimitations: string[];
  recommendation: { tier: string; rationale: string };
  nextStep: { cta: string; company: string; founder: string; footer: string };
  aiNarrativeUsed: boolean;
}

export const CATEGORY_LABELS: Record<string, string> = {
  DIGITAL_CUSTOMER_JOURNEY: 'Digital Customer Journey',
  WEBSITE_CONVERSION: 'Website Conversion',
  PHONE_RESPONSE_READINESS: 'Phone & Response Readiness',
  RESERVATION_EXPERIENCE: 'Reservation Experience',
  ONLINE_ORDERING_EXPERIENCE: 'Online Ordering Experience',
  REVIEW_REPUTATION_SYSTEM: 'Review & Reputation System',
  LOCAL_DIGITAL_PRESENCE: 'Local Digital Presence',
  CUSTOMER_RETENTION: 'Customer Retention',
  AI_AUTOMATION_READINESS: 'AI Automation Readiness',
};

/** Fields that must never appear in owner-facing report content. Used by tests and a runtime guard. */
export const INTERNAL_ONLY_MARKERS = [
  'leadQualityScore',
  'salesOpportunityScore',
  'painLevel',
  'buyerPersona',
  'bestSalesAngle',
  'objectionStrategy',
  'emailOpener',
  'callOpener',
  'talkTrack',
  'INTERNAL SALES',
];

export function generateOwnerReport(input: {
  restaurantName: string;
  websiteUrl: string;
  location: string | null;
  auditStatus: string;
  demoMode: boolean;
  overallScore: number | null;
  coverageScore: number;
  scoreExplanation: string;
  categories: CategoryScoreInput[];
  journey: JourneyStageResult[];
  topLeaks: RankedOpportunity[];
  evidence: EvidenceRecordLike[];
  aiNarrative?: { executiveSummary: string } | null;
}): OwnerReportContent {
  const evidenceById = new Map(input.evidence.map((e) => [e.id, e]));
  const topLeak = input.topLeaks[0] ?? null;

  const biggestOpportunity = topLeak
    ? `The biggest opportunity we identified is: ${topLeak.title.toLowerCase().replace(/\.$/, '')} — ${topLeak.recommendedSolution.split('.')[0]}.`
    : 'The biggest opportunity we identified is: no high-priority revenue leaks were confirmed from public evidence — the strongest next step is validating internal operations (calls, follow-up, retention) that public analysis cannot see.';

  const executiveSummary =
    input.aiNarrative?.executiveSummary ??
    buildDeterministicSummary(input.restaurantName, input.overallScore, input.coverageScore, input.topLeaks);

  const aiOpportunities = input.topLeaks
    .filter((l) => l.aiFitScore >= 70)
    .map((l) => ({
      title: l.title,
      currentFriction: l.problem,
      automationOpportunity: l.recommendedSolution,
      expectedBenefit: l.businessImpact,
      implementationComplexity: l.aiFitScore >= 90 ? 'Moderate — configured system, no custom build' : 'Moderate to high — requires discovery',
    }));

  const rescuePlan = buildRescuePlan(input.topLeaks);

  const assumptions = [
    'This audit analyzed publicly accessible website pages only. No private operating, financial, or customer data was used unless provided.',
    `Audit coverage: ${input.coverageScore}% of intended audit categories had sufficient public evidence. ${input.scoreExplanation}`,
    ...input.categories.filter((c) => c.insufficientData).map((c) => `${CATEGORY_LABELS[c.category] ?? c.category}: ${c.explanation}`),
    ...input.topLeaks.filter((l) => l.manualValidationRequired).map((l) => `"${l.title}" requires manual validation before being treated as confirmed.`),
    'No revenue figures are stated in this audit. Where impact is discussed, it describes exposure and opportunity, not verified losses.',
  ];

  return {
    header: {
      restaurantName: input.restaurantName,
      websiteUrl: input.websiteUrl,
      location: input.location,
      auditDate: new Date().toISOString().slice(0, 10),
      rescueScore: input.overallScore,
      scoreBand: input.overallScore === null ? null : scoreBand(input.overallScore),
      coverageScore: input.coverageScore,
      scoreExplanation: input.scoreExplanation,
      demoMode: input.demoMode,
      auditStatus: input.auditStatus,
    },
    executiveSummary,
    biggestOpportunity,
    scorecard: input.categories.map((c) => ({
      category: c.category,
      label: CATEGORY_LABELS[c.category] ?? c.category,
      weight: c.weight,
      score: c.insufficientData ? null : c.score,
      insufficientData: c.insufficientData,
      explanation: c.explanation,
    })),
    topLeaks: input.topLeaks.map((l, i) => ({
      rank: i + 1,
      title: l.title,
      problem: l.problem,
      evidence: l.evidenceIds
        .map((id) => evidenceById.get(id))
        .filter((e): e is EvidenceRecordLike => Boolean(e))
        .slice(0, 4)
        .map((e) => e.fact),
      whyItMatters: l.businessImpact,
      recommendedAction: l.recommendedSolution,
      rescuePriorityScore: l.rescuePriorityScore,
      manualValidationRequired: l.manualValidationRequired,
    })),
    journey: input.journey.map((s) => ({
      stage: s.stage,
      status: s.status,
      finding: s.finding,
      manualValidationRequired: s.manualValidationRequired,
    })),
    aiOpportunities,
    rescuePlan,
    assumptionsAndLimitations: assumptions,
    recommendation: recommendTier(input.topLeaks),
    nextStep: {
      cta: 'BOOK A 15-MINUTE RESTAURANT RESCUE REVIEW',
      company: 'Winners Bookmark Incorporated',
      founder: 'Keith Warren',
      footer: 'Designed by Winnersbookmark Incorporated',
    },
    aiNarrativeUsed: Boolean(input.aiNarrative),
  };
}

function buildDeterministicSummary(name: string, score: number | null, coverage: number, leaks: RankedOpportunity[]): string {
  const scorePart =
    score === null
      ? 'Public evidence was insufficient to produce an overall Restaurant Rescue Score.'
      : `${name} scored ${score}/100 (${scoreBand(score)}) on the Restaurant Rescue Score, calculated from categories with sufficient public evidence (audit coverage ${coverage}%).`;
  if (leaks.length === 0) {
    return `${scorePart} No high-priority revenue leaks were confirmed from public website evidence. The remaining risk sits in areas public analysis cannot see — call handling, follow-up, and retention — which we recommend validating directly.`;
  }
  const titles = leaks.map((l) => l.title.toLowerCase()).join('; ');
  return `${scorePart} The audit identified ${leaks.length} priority ${leaks.length === 1 ? 'opportunity' : 'opportunities'}: ${titles}. Each finding below is tied to specific public evidence, and items that need verification are clearly marked.`;
}

function buildRescuePlan(leaks: RankedOpportunity[]): { phase: string; actions: string[] }[] {
  const quickFixes = leaks.filter((l) => l.aiFitScore < 40).map((l) => l.recommendedSolution);
  const systems = leaks.filter((l) => l.aiFitScore >= 40 && l.aiFitScore < 70).map((l) => l.recommendedSolution);
  const automation = leaks.filter((l) => l.aiFitScore >= 70).map((l) => l.recommendedSolution);
  return [
    {
      phase: '0–30 DAYS — Immediate fixes',
      actions: quickFixes.length > 0 ? quickFixes : ['Verify the manual-validation items in this audit (call handling, retention systems, review response process).'],
    },
    {
      phase: '31–60 DAYS — System improvements',
      actions: systems.length > 0 ? systems : ['Strengthen the primary conversion path (menu, reservation, ordering) and publish answers to the questions customers currently call about.'],
    },
    {
      phase: '61–90 DAYS — Automation and optimization',
      actions: automation.length > 0 ? automation : ['Once foundations are verified, evaluate automation for lead capture and customer follow-up.'],
    },
  ];
}

function recommendTier(leaks: RankedOpportunity[]): { tier: string; rationale: string } {
  if (leaks.length === 0) {
    return {
      tier: 'AI DISCOVERY AUDIT',
      rationale:
        'Public analysis found no confirmed high-priority leaks, but the highest-risk areas (call volume, follow-up, retention) are invisible from outside. A discovery audit verifies them with internal data before recommending any system.',
    };
  }
  const needsValidation = leaks.filter((l) => l.manualValidationRequired).length;
  const highAiFit = leaks.filter((l) => l.aiFitScore >= 70);
  const simpleFixes = leaks.filter((l) => l.aiFitScore < 40);

  if (simpleFixes.length === leaks.length) {
    return {
      tier: 'BASIC OPTIMIZATION',
      rationale: 'Every priority finding is a direct website or content fix. No AI system is justified by current evidence — fix the fundamentals first.',
    };
  }
  if (needsValidation >= 2) {
    return {
      tier: 'AI DISCOVERY AUDIT',
      rationale: 'Multiple priority findings require internal validation (call volume, response times, customer database) before a system recommendation is honest. Discovery confirms the numbers first.',
    };
  }
  const frontDesk = highAiFit.some((l) => /PHONE|CATERING|LEAD/i.test(l.category));
  const reactivation = highAiFit.some((l) => /RETENTION/i.test(l.category));
  if (frontDesk) {
    return {
      tier: 'AI FRONT DESK SYSTEM',
      rationale: 'The evidence shows a phone-dependent journey with lead-capture gaps — exactly the friction the AI Front Desk System (voice receptionist, missed-call text-back, FAQ automation, lead capture) is built to absorb.',
    };
  }
  if (reactivation) {
    return {
      tier: 'AI REACTIVATION CAMPAIGN',
      rationale: 'The dominant gap is customer retention and follow-up. A reactivation campaign converts the existing customer base into repeat visits.',
    };
  }
  return {
    tier: 'BASIC OPTIMIZATION',
    rationale: 'The priority findings are best solved with focused website and conversion fixes before any automation investment.',
  };
}
