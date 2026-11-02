import { prisma } from '@/lib/db';
import { assertOperator, type OperatorAuthorization } from '@/lib/operatorAuth';
import { presentOrderingText } from '@/lib/audit/orderingChannel';
import { safeDisplayName } from '@/lib/audit/restaurantName';
import type { JourneyStageResult } from '@/types/audit';
import { generateSalesBrief, type SalesBriefContent } from './sales';
import type { OwnerReportContent, RankedOpportunity } from './owner';
import { presentSalesField } from './salesWording';
import { AUDITED_ENGINE_OBSERVATION_SENTENCES, auditedTier } from './recommendationTemplates';
import { safeNarrative } from './narrativePolicy';

/** The brief's narrative fields: every one is regenerated, never read from storage. */
const NARRATIVE_FIELDS = [
  'buyerPersona', 'bestSalesAngle', 'topDiscoveryQuestion', 'discoveryQuestions', 'likelyObjection', 'objectionStrategy',
  'recommendedOffer', 'outreachAngle', 'emailOpener', 'callOpener', 'talkTrack', 'followUpAngle',
] as const satisfies readonly (keyof SalesBriefContent)[];

/**
 * The internal Sales Brief, for the operator only.
 *
 * The one reader of the SalesIntelligence table (the orchestrator and the demo
 * seeder write it; the Command Center reads only the priority badge). It takes
 * an OperatorAuthorization, so no page or route can show a brief without
 * having passed the operator check — enforced by the type here, at runtime by
 * `assertOperator`, and by tests/operator-surface-structure.test.ts, which
 * fails if any other module touches the table.
 *
 * STORED BRIEF TEXT IS NEVER SHOWN. A stored brief was written by whichever
 * engine version ran the audit, and its free text cannot be proven safe — it
 * may tell a rep to recommend an automation outright. So every narrative field
 * is regenerated here from the stored audit data (the findings, journey,
 * evidence, scores and package tier) by the current, audited generator
 * (sales.ts), then checked against the shared narrative policy; a field that
 * fails is withheld with the rule. The stored record is not changed. Stored
 * numbers (lead quality, sales opportunity, pain level, priority) are shown
 * as stored.
 */
export async function loadSalesBrief(operator: OperatorAuthorization, auditId: string) {
  assertOperator(operator);
  const brief = await prisma.salesIntelligence.findUnique({
    where: { auditId },
    include: {
      audit: {
        include: {
          restaurant: true,
          // Created in rank order by the orchestrator, so creation order is rank order.
          opportunities: { orderBy: { createdAt: 'asc' } },
          journeyStages: true,
          evidence: { orderBy: { createdAt: 'asc' } },
          reports: { where: { reportType: 'OWNER_AUDIT' }, select: { content: true } },
        },
      },
    },
  });
  if (!brief) return brief;

  const audit = brief.audit;
  const observation = (text: string, fallback: string) =>
    safeNarrative(presentOrderingText(text), fallback, { approved: AUDITED_ENGINE_OBSERVATION_SENTENCES });
  const topLeaks: RankedOpportunity[] = (audit.opportunities ?? []).slice(0, 3).map((o) => ({
    category: o.category,
    title: observation(o.title, o.category.charAt(0) + o.category.slice(1).toLowerCase()),
    problem: observation(o.problem, 'See the audit evidence for this finding.'),
    businessImpact: observation(o.businessImpact, 'Not measured.'),
    customerJourneyStage: o.customerJourneyStage,
    evidenceIds: o.evidenceIds,
    impactScore: o.impactScore,
    urgencyScore: o.urgencyScore,
    confidenceScore: o.confidenceScore,
    aiFitScore: o.aiFitScore,
    rescuePriorityScore: o.rescuePriorityScore,
    recommendedSolution: '',
    manualValidationRequired: o.manualValidationRequired,
  }));
  const journey: JourneyStageResult[] = (audit.journeyStages ?? []).map((j) => ({
    stage: j.stage as JourneyStageResult['stage'],
    status: j.status as JourneyStageResult['status'],
    finding: observation(j.finding, 'See the audit evidence for this stage.'),
    confidence: j.confidence,
    manualValidationRequired: j.manualValidationRequired,
    evidenceIds: j.evidenceIds,
  }));
  const evidence = (audit.evidence ?? []).map((e) => ({
    id: e.id,
    evidenceType: e.evidenceType,
    fact: observation(e.fact, 'Evidence text withheld; it remains in the audit record.'),
    supportingContext: e.supportingContext,
    confidence: e.confidence,
  }));
  const owner = (audit.reports?.[0]?.content ?? null) as unknown as OwnerReportContent | null;

  const regenerated = generateSalesBrief({
    restaurantName: safeDisplayName(audit.restaurant.name, audit.restaurant.websiteUrl),
    overallScore: audit.overallScore,
    coverageScore: audit.coverageScore ?? 0,
    topLeaks,
    journey,
    evidence,
    recommendedTier: auditedTier(owner?.recommendation?.tier),
  });

  const shown: Record<string, unknown> = { ...brief };
  for (const field of NARRATIVE_FIELDS) {
    const value = regenerated[field];
    shown[field] = Array.isArray(value) ? value.map((v) => presentSalesField(v)) : presentSalesField(value);
  }
  return shown as typeof brief;
}
