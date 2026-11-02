import { prisma } from '@/lib/db';
import { assertOperator, type OperatorAuthorization } from '@/lib/operatorAuth';
import { presentOrderingText } from '@/lib/audit/orderingChannel';
import { safeDisplayName } from '@/lib/audit/restaurantName';
import type { JourneyStageResult } from '@/types/audit';
import { generateSalesBrief, type SalesBriefContent } from './sales';
import type { OwnerReportContent, RankedOpportunity } from './owner';
import { presentSalesField } from './salesWording';
import { auditedTier } from './recommendationTemplates';
import { publishAuditObservations } from './observationPublication';

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
 * is regenerated here by the current, audited generator (sales.ts) from the
 * audit's PUBLISHED observations — the same evidence-backed publication the
 * client report uses (observationPublication.ts) — and the package tier, then
 * checked against the shared narrative policy; a field that fails is withheld
 * with the rule. The stored record is not changed. Stored numbers (lead
 * quality, sales opportunity, pain level, priority) are shown as stored.
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
  // The same publication as the client report: evidence traced to audited
  // engine templates, findings and journey regenerated from this audit's own
  // evidence (observationPublication.ts). Stored text is not read as written.
  const published = publishAuditObservations({
    evidence: (audit.evidence ?? []).map((e) => ({
      id: e.id, evidenceType: e.evidenceType, fact: e.fact, supportingContext: e.supportingContext, confidence: e.confidence, sourceUrl: null,
    })),
    journey: audit.journeyStages ?? [],
    opportunities: audit.opportunities ?? [],
    scores: [],
  });
  const topLeaks: RankedOpportunity[] = published.opportunities.slice(0, 3).map((o) => ({
    category: o.category,
    title: presentOrderingText(o.title),
    problem: presentOrderingText(o.problem),
    businessImpact: o.businessImpact,
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
  const journey: JourneyStageResult[] = published.journey.map((j) => ({
    stage: j.stage as JourneyStageResult['stage'],
    status: j.status as JourneyStageResult['status'],
    finding: j.finding,
    confidence: j.confidence,
    manualValidationRequired: j.manualValidationRequired,
    evidenceIds: j.evidenceIds,
  }));
  const evidence = published.evidence.map(({ provenance: _p, sourceUrl: _u, ...e }) => e);
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

  // The audit travels with the brief only as published: the stored evidence,
  // journey and finding text it was regenerated from is not handed on.
  const shown: Record<string, unknown> = {
    ...brief,
    audit: {
      ...audit,
      evidence: evidence.map((e) => ({ ...audit.evidence.find((x) => x.id === e.id)!, fact: e.fact, supportingContext: e.supportingContext })),
      journeyStages: published.journey,
      opportunities: published.opportunities.map((o) => ({ ...o, recommendedSolution: '' })),
      reports: [],
    },
  };
  for (const field of NARRATIVE_FIELDS) {
    const value = regenerated[field];
    shown[field] = Array.isArray(value) ? value.map((v) => presentSalesField(v)) : presentSalesField(value);
  }
  return shown as typeof brief;
}
