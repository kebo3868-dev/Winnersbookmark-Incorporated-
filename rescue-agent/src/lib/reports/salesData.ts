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

/** The Sales Brief as the page may show it: the stored scores, regenerated narrative fields, and of the audit only its demo flag and display name. */
export type SalesBriefView = Omit<NonNullable<Awaited<ReturnType<typeof findBrief>>>, 'audit'> & {
  audit: { demoMode: boolean; restaurant: { name: string } };
};

const findBrief = (auditId: string) =>
  prisma.salesIntelligence.findUnique({
    where: { auditId },
    include: {
      audit: {
        include: {
          restaurant: true,
          // Created in rank order by the orchestrator, so creation order is rank order.
          opportunities: { orderBy: { createdAt: 'asc' } },
          journeyStages: true,
          evidence: { orderBy: { createdAt: 'asc' } },
          sources: { select: { id: true, url: true, pageTitle: true, sourceType: true } },
          reports: { where: { reportType: 'OWNER_AUDIT' }, select: { content: true } },
        },
      },
    },
  });

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
export async function loadSalesBrief(operator: OperatorAuthorization, auditId: string): Promise<SalesBriefView | null> {
  assertOperator(operator);
  const brief = await findBrief(auditId);
  if (!brief) return null;

  const audit = brief.audit;
  // The same publication as the client report: evidence traced to audited
  // engine templates, findings and journey regenerated from this audit's own
  // evidence (observationPublication.ts). Stored text is not read as written.
  const published = publishAuditObservations({
    evidence: (audit.evidence ?? []).map((e) => ({
      id: e.id, evidenceType: e.evidenceType, fact: e.fact, supportingContext: e.supportingContext, confidence: e.confidence,
      auditSourceId: e.auditSourceId, sourceUrl: null,
    })),
    journey: audit.journeyStages ?? [],
    opportunities: audit.opportunities ?? [],
    scores: [],
    context: {
      sources: audit.sources ?? [],
      restaurant: audit.restaurant,
      suppliedUrls: [audit.orderingUrlInput, audit.reservationUrlInput, audit.socialUrlInput, audit.googleBusinessUrl],
    },
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
  const evidence = published.evidence.map(({ provenance: _p, sourceUrl: _u, auditSourceId: _s, ...e }) => e);
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

  // Of the audit, the brief carries only what the page shows: whether it is
  // demonstration data and the restaurant's display name. No stored evidence,
  // finding, journey or report text travels with it, verified or not.
  const { audit: _audit, ...record } = brief;
  const shown: Record<string, unknown> = {
    ...record,
    audit: { demoMode: audit.demoMode, restaurant: { name: safeDisplayName(audit.restaurant.name, audit.restaurant.websiteUrl) } },
  };
  for (const field of NARRATIVE_FIELDS) {
    const value = regenerated[field];
    shown[field] = Array.isArray(value) ? value.map((v) => presentSalesField(v)) : presentSalesField(value);
  }
  return shown as SalesBriefView;
}
