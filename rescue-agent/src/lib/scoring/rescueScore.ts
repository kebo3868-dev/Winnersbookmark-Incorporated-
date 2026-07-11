import type { CategoryScoreInput, EvidenceRecordLike, JourneyStageResult, ScoreCategory } from '@/types/audit';
import { SCORE_WEIGHTS } from '@/types/audit';

export interface OverallScoreResult {
  overallScore: number | null;
  coverageScore: number;
  usedWeightPercent: number;
  explanation: string;
}

/**
 * Weighted overall Restaurant Rescue Score over categories with sufficient data.
 * Weights are re-normalized across available categories; missing data never
 * silently scores zero. Coverage measures how much of the intended audit ran.
 */
export function calculateOverallScore(categories: CategoryScoreInput[]): OverallScoreResult {
  const usable = categories.filter((c) => !c.insufficientData && c.score !== null);
  const usedWeight = usable.reduce((s, c) => s + c.weight, 0);
  const totalWeight = categories.reduce((s, c) => s + c.weight, 0);

  const coverageScore = totalWeight === 0 ? 0 : Math.round((usedWeight / totalWeight) * 100);

  if (usedWeight === 0) {
    return {
      overallScore: null,
      coverageScore: 0,
      usedWeightPercent: 0,
      explanation: 'No category had sufficient public evidence to score. Audit could not produce an overall score.',
    };
  }

  const weighted = usable.reduce((s, c) => s + (c.score as number) * (c.weight / usedWeight), 0);
  return {
    overallScore: Math.round(weighted),
    coverageScore,
    usedWeightPercent: usedWeight,
    explanation:
      usedWeight === totalWeight
        ? 'Overall score calculated from all audit categories.'
        : `Overall score calculated from categories with sufficient public evidence (${usedWeight}% of intended weighting).`,
  };
}

export function scoreBand(score: number): string {
  if (score >= 90) return 'ELITE DIGITAL OPERATOR';
  if (score >= 80) return 'STRONG WITH OPTIMIZATION OPPORTUNITIES';
  if (score >= 70) return 'MODERATE REVENUE LEAKAGE';
  if (score >= 60) return 'SIGNIFICANT CUSTOMER JOURNEY FRICTION';
  return 'RESTAURANT RESCUE PRIORITY';
}

const stageStatusScore: Record<string, number> = { HEALTHY: 90, FRICTION: 60, RISK: 30 };

/**
 * Deterministic category scores derived from journey stage statuses and evidence.
 * Categories the MVP cannot observe (reviews, off-site local presence) are marked
 * insufficientData rather than guessed.
 */
export function calculateCategoryScores(
  journey: JourneyStageResult[],
  evidence: EvidenceRecordLike[],
): CategoryScoreInput[] {
  const stage = (name: string) => journey.find((s) => s.stage === name);
  const scores: CategoryScoreInput[] = [];

  const fromStages = (category: ScoreCategory, stageNames: string[], label: string) => {
    const stages = stageNames.map(stage).filter((s): s is JourneyStageResult => Boolean(s));
    const known = stages.filter((s) => s.status !== 'UNKNOWN');
    if (known.length === 0) {
      scores.push({
        category,
        weight: SCORE_WEIGHTS[category],
        score: null,
        confidence: 0,
        insufficientData: true,
        explanation: `${label}: insufficient public evidence to score.`,
      });
      return;
    }
    const avg = Math.round(known.reduce((s, st) => s + stageStatusScore[st.status], 0) / known.length);
    const confidence = Math.round(known.reduce((s, st) => s + st.confidence, 0) / known.length);
    scores.push({
      category,
      weight: SCORE_WEIGHTS[category],
      score: avg,
      confidence,
      insufficientData: false,
      explanation: `${label}: derived from ${known.length} analyzed journey stage(s): ${known.map((s) => `${s.stage}=${s.status}`).join(', ')}.`,
    });
  };

  fromStages('DIGITAL_CUSTOMER_JOURNEY', ['DISCOVERY', 'WEBSITE', 'MENU', 'CONTACT'], 'Digital customer journey');
  fromStages('WEBSITE_CONVERSION', ['WEBSITE', 'MENU'], 'Website conversion');
  fromStages('PHONE_RESPONSE_READINESS', ['PHONE'], 'Phone and response readiness');
  fromStages('RESERVATION_EXPERIENCE', ['RESERVATION'], 'Reservation experience');
  fromStages('ONLINE_ORDERING_EXPERIENCE', ['ORDERING'], 'Online ordering experience');
  fromStages('CUSTOMER_RETENTION', ['FOLLOW_UP', 'RETURN'], 'Customer retention');

  // Review/reputation: not collected in MVP scope.
  scores.push({
    category: 'REVIEW_REPUTATION_SYSTEM',
    weight: SCORE_WEIGHTS.REVIEW_REPUTATION_SYSTEM,
    score: null,
    confidence: 0,
    insufficientData: true,
    explanation: 'Public review platform data is not collected in this audit scope; manual review recommended.',
  });

  // Local digital presence: partial signal from on-site NAP visibility only.
  const nap = evidence.filter((e) => ['HOURS_VISIBILITY', 'ADDRESS_VISIBILITY', 'PHONE_VISIBILITY'].includes(e.evidenceType));
  const napPositive = nap.filter((e) => !/not detected|no phone/i.test(e.fact));
  if (nap.length === 0) {
    scores.push({
      category: 'LOCAL_DIGITAL_PRESENCE',
      weight: SCORE_WEIGHTS.LOCAL_DIGITAL_PRESENCE,
      score: null,
      confidence: 0,
      insufficientData: true,
      explanation: 'No name/address/phone signals available to assess.',
    });
  } else {
    scores.push({
      category: 'LOCAL_DIGITAL_PRESENCE',
      weight: SCORE_WEIGHTS.LOCAL_DIGITAL_PRESENCE,
      score: Math.round((napPositive.length / nap.length) * 100),
      confidence: 55,
      insufficientData: false,
      explanation: `On-site name/address/phone/hours visibility only (${napPositive.length}/${nap.length} signals present). Off-site listing consistency requires manual validation.`,
    });
  }

  // AI automation readiness: presence of structured info that automation can build on.
  const readinessSignals = evidence.filter((e) =>
    ['FAQ_SIGNAL', 'HOURS_VISIBILITY', 'MENU_ACCESS', 'RESERVATION_PATH', 'ORDERING_PATH'].includes(e.evidenceType),
  );
  const readinessPositive = readinessSignals.filter((e) => !/no public|not detected/i.test(e.fact));
  if (readinessSignals.length === 0) {
    scores.push({
      category: 'AI_AUTOMATION_READINESS',
      weight: SCORE_WEIGHTS.AI_AUTOMATION_READINESS,
      score: null,
      confidence: 0,
      insufficientData: true,
      explanation: 'Insufficient signals to assess automation readiness.',
    });
  } else {
    scores.push({
      category: 'AI_AUTOMATION_READINESS',
      weight: SCORE_WEIGHTS.AI_AUTOMATION_READINESS,
      score: Math.round((readinessPositive.length / readinessSignals.length) * 100),
      confidence: 60,
      insufficientData: false,
      explanation: `Based on availability of structured public information (${readinessPositive.length}/${readinessSignals.length} signals) that automation systems can be grounded on.`,
    });
  }

  return scores;
}
