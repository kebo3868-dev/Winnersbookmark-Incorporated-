import { prisma } from '@/lib/db';
import { buildExecutiveReport, type ExecutiveReportDTO, type ExecutiveReportInput } from './executive';
import type { OwnerReportContent } from './owner';

export type ExecutiveReportResult =
  | { status: 'ok'; dto: ExecutiveReportDTO }
  | { status: 'not_found' }
  | { status: 'not_ready'; auditStatus: string };

const AUDIT_ID_PATTERN = /^[a-z0-9]{10,40}$/i;

/**
 * Load a completed audit and derive the Executive Report DTO. Read-only,
 * explicit field picking throughout — nothing outside these fields (no env,
 * no internal sales intelligence, no infrastructure detail) can reach the DTO.
 */
export async function loadExecutiveReport(auditId: string): Promise<ExecutiveReportResult> {
  if (!AUDIT_ID_PATTERN.test(auditId)) return { status: 'not_found' };

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      restaurant: { select: { name: true, websiteUrl: true, city: true, state: true } },
      sources: { select: { status: true, url: true, id: true } },
      evidence: {
        select: { id: true, evidenceType: true, fact: true, supportingContext: true, confidence: true, auditSourceId: true },
        orderBy: { createdAt: 'asc' },
      },
      opportunities: {
        select: {
          category: true, title: true, problem: true, businessImpact: true, customerJourneyStage: true,
          evidenceIds: true, impactScore: true, urgencyScore: true, confidenceScore: true, aiFitScore: true,
          rescuePriorityScore: true, recommendedSolution: true, manualValidationRequired: true,
        },
        orderBy: { rescuePriorityScore: 'desc' },
      },
      journeyStages: { select: { stage: true, status: true, finding: true, manualValidationRequired: true } },
      scores: { select: { category: true, score: true, insufficientData: true, explanation: true } },
      reports: { where: { reportType: 'OWNER_AUDIT' }, select: { content: true } },
    },
  });
  if (!audit) return { status: 'not_found' };
  if (audit.status !== 'COMPLETED' && audit.status !== 'PARTIALLY_COMPLETED') {
    return { status: 'not_ready', auditStatus: audit.status };
  }

  const sourceUrlById = new Map(audit.sources.map((s) => [s.id, s.url]));
  const owner = (audit.reports[0]?.content ?? null) as unknown as OwnerReportContent | null;

  const input: ExecutiveReportInput = {
    restaurantName: audit.restaurant.name,
    websiteUrl: audit.restaurant.websiteUrl,
    location: [audit.restaurant.city, audit.restaurant.state].filter(Boolean).join(', ') || null,
    auditDate: (audit.completedAt ?? audit.createdAt).toISOString().slice(0, 10),
    auditStatus: audit.status,
    demoMode: audit.demoMode,
    overallScore: audit.overallScore,
    coverageScore: audit.coverageScore,
    sourcesCollected: audit.sources.filter((s) => s.status === 'COLLECTED').length,
    sourcesFailed: audit.sources.filter((s) => s.status !== 'COLLECTED').length,
    evidence: audit.evidence.map((e) => ({
      id: e.id,
      evidenceType: e.evidenceType,
      fact: e.fact,
      supportingContext: e.supportingContext,
      confidence: e.confidence,
      sourceUrl: e.auditSourceId ? sourceUrlById.get(e.auditSourceId) ?? null : null,
    })),
    opportunities: audit.opportunities,
    journey: audit.journeyStages,
    categoryScores: audit.scores,
    storedSummary: owner?.executiveSummary ?? null,
    storedSummaryWasAiEnhanced: Boolean(owner?.aiNarrativeUsed),
    storedRecommendation: owner?.recommendation ?? null,
  };
  return { status: 'ok', dto: buildExecutiveReport(input) };
}
