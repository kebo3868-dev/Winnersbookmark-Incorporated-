import { prisma } from '@/lib/db';
import { validateUrlTarget, normalizeUrl } from '@/lib/validation/url';
import { fetchPage, probeLink, type PageExtract } from '@/lib/web/collector';
import { discoverRelevantPages } from '@/lib/web/discovery';
import { normalizeEvidence, type CollectionSet, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { rankOpportunities } from '@/lib/scoring/priority';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { generateOwnerReport, type RankedOpportunity } from '@/lib/reports/owner';
import { generateSalesBrief } from '@/lib/reports/sales';
import { getAiProvider } from '@/lib/ai/provider';
import { analyzeOwnerReviews, reviewEvidence, socialEvidence } from '@/lib/audit/reviews';
import type { AuditStage, AuditStatus } from '@prisma/client';
import { z } from 'zod';

export interface CreateAuditInput {
  websiteUrl: string;
  restaurantName?: string;
  city?: string;
  state?: string;
  knownConcern?: string;
  // Phase 3 — optional owner-supplied intake
  reservationUrl?: string;
  orderingUrl?: string;
  socialUrl?: string;
  googleBusinessUrl?: string;
  ownerRating?: number;
  ownerReviewCount?: number;
  avgTicket?: number;
  // Phase 3 — prospect / lead capture
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactConsent?: boolean;
}

const clean = (v?: string): string | null => v?.trim() || null;

/** Accept an optional owner-supplied http(s) URL; return normalized or null (never throws on bad input). */
function cleanOptionalUrl(v?: string): string | null {
  const t = v?.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

export async function createAudit(input: CreateAuditInput): Promise<{ auditId: string } | { error: string }> {
  const validation = await validateUrlTarget(input.websiteUrl);
  if (!validation.ok) return { error: validation.reason };
  const websiteUrl = normalizeUrl(validation.url);

  const restaurant = await prisma.restaurant.upsert({
    where: { websiteUrl },
    create: {
      websiteUrl,
      name: input.restaurantName?.trim() || validation.url.hostname.replace(/^www\./, ''),
      city: clean(input.city),
      state: clean(input.state),
    },
    update: {
      ...(input.restaurantName?.trim() ? { name: input.restaurantName.trim() } : {}),
      ...(input.city?.trim() ? { city: input.city.trim() } : {}),
      ...(input.state?.trim() ? { state: input.state.trim() } : {}),
    },
  });

  const rating = typeof input.ownerRating === 'number' && Number.isFinite(input.ownerRating)
    ? Math.max(0, Math.min(5, input.ownerRating))
    : null;
  const reviewCount = typeof input.ownerReviewCount === 'number' && Number.isFinite(input.ownerReviewCount) && input.ownerReviewCount >= 0
    ? Math.round(input.ownerReviewCount)
    : null;
  const avgTicket = typeof input.avgTicket === 'number' && Number.isFinite(input.avgTicket) && input.avgTicket > 0
    ? input.avgTicket
    : null;

  const audit = await prisma.audit.create({
    data: {
      restaurantId: restaurant.id,
      status: 'PENDING',
      knownConcern: clean(input.knownConcern),
      reservationUrlInput: cleanOptionalUrl(input.reservationUrl),
      orderingUrlInput: cleanOptionalUrl(input.orderingUrl),
      socialUrlInput: cleanOptionalUrl(input.socialUrl),
      googleBusinessUrl: cleanOptionalUrl(input.googleBusinessUrl),
      ownerRating: rating,
      ownerReviewCount: reviewCount,
      avgTicketInput: avgTicket,
      job: { create: { status: 'PENDING', currentStage: 'INITIALIZING' } },
    },
  });

  // Lead capture: only when the prospect actually gave contact details.
  const contactName = clean(input.contactName);
  const contactEmail = clean(input.contactEmail);
  const contactPhone = clean(input.contactPhone);
  if (contactName || contactEmail || contactPhone) {
    await prisma.auditLead.create({
      data: {
        auditId: audit.id,
        restaurantId: restaurant.id,
        contactName,
        email: contactEmail,
        phone: contactPhone,
        consent: Boolean(input.contactConsent),
      },
    });
  }

  return { auditId: audit.id };
}

async function setStage(auditId: string, stage: AuditStage, status: AuditStatus = 'RUNNING'): Promise<void> {
  await prisma.auditJob.update({ where: { auditId }, data: { currentStage: stage, status } });
}

async function log(auditId: string, level: 'INFO' | 'WARN' | 'ERROR', message: string, detail?: string): Promise<void> {
  await prisma.systemLog.create({ data: { auditId, level, message, detail: detail?.slice(0, 2000) } });
}

const aiSummarySchema = z.object({ executiveSummary: z.string().min(40).max(2000) });

/**
 * Runs the full audit pipeline. Designed to be awaited from a background task —
 * every stage transition is persisted so the UI can poll real progress.
 */
export async function runAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { restaurant: true } });
  const startedAt = new Date();
  await prisma.audit.update({ where: { id: auditId }, data: { status: 'RUNNING', startedAt } });

  try {
    // ---- VALIDATE ----
    await setStage(auditId, 'VALIDATING_WEBSITE');
    const validation = await validateUrlTarget(audit.restaurant.websiteUrl);
    if (!validation.ok) {
      await failAudit(auditId, `Website validation failed: ${validation.reason}`);
      return;
    }

    // ---- COLLECT HOMEPAGE ----
    await setStage(auditId, 'DISCOVERING_PAGES');
    const pages: PageExtract[] = [];
    const failures: CollectionSet['failures'] = [];
    const sourceIdByUrl = new Map<string, string>();

    const homeOutcome = await fetchPage(validation.url.toString());
    if (homeOutcome.status !== 'COLLECTED') {
      await prisma.auditSource.create({
        data: {
          auditId,
          url: audit.restaurant.websiteUrl,
          sourceType: 'HOMEPAGE',
          status: homeOutcome.status,
          httpStatus: 'httpStatus' in homeOutcome ? homeOutcome.httpStatus : null,
          note: homeOutcome.note,
        },
      });
      await failAudit(
        auditId,
        `Primary website could not be collected (${homeOutcome.status}): ${homeOutcome.note}. No analysis was performed — this audit contains no findings, not fabricated ones.`,
      );
      return;
    }
    const home = homeOutcome.page;
    pages.push(home);
    const homeSource = await prisma.auditSource.create({
      data: {
        auditId,
        url: home.finalUrl,
        pageTitle: home.title,
        sourceType: 'HOMEPAGE',
        status: 'COLLECTED',
        httpStatus: home.httpStatus,
        collectedAt: new Date(),
      },
    });
    sourceIdByUrl.set(home.finalUrl, homeSource.id);

    // ---- COLLECT RELEVANT PAGES (bounded) ----
    await setStage(auditId, 'COLLECTING_EVIDENCE');
    const targets = discoverRelevantPages(home);
    for (const target of targets) {
      const outcome = await fetchPage(target.url);
      if (outcome.status === 'COLLECTED') {
        pages.push(outcome.page);
        const src = await prisma.auditSource.create({
          data: {
            auditId,
            url: outcome.page.finalUrl,
            pageTitle: outcome.page.title,
            sourceType: target.sourceType,
            status: 'COLLECTED',
            httpStatus: outcome.page.httpStatus,
            collectedAt: new Date(),
          },
        });
        sourceIdByUrl.set(outcome.page.finalUrl, src.id);
        sourceIdByUrl.set(target.url, src.id);
      } else {
        failures.push({ url: target.url, sourceType: target.sourceType, status: outcome.status, note: outcome.note });
        await prisma.auditSource.create({
          data: {
            auditId,
            url: target.url,
            sourceType: target.sourceType,
            status: outcome.status,
            httpStatus: 'httpStatus' in outcome ? outcome.httpStatus : null,
            note: outcome.note,
          },
        });
      }
    }

    // ---- PROBE KEY TRANSACTIONAL LINKS ----
    const probes: ProbeResult[] = [];
    const probeTargets: { url: string; category: ProbeResult['category'] }[] = [];
    const seenProbe = new Set<string>();
    // Owner-supplied pathway URLs are probed first so they are never dropped.
    for (const [url, category] of [
      [audit.reservationUrlInput, 'reservation'],
      [audit.orderingUrlInput, 'ordering'],
    ] as const) {
      if (url && !seenProbe.has(url)) {
        seenProbe.add(url);
        probeTargets.push({ url, category });
      }
    }
    for (const [category, key] of [
      ['reservation', 'reservation'],
      ['ordering', 'ordering'],
      ['menu', 'menu'],
    ] as const) {
      for (const page of pages) {
        for (const link of page.categorizedLinks[key] ?? []) {
          if (probeTargets.filter((p) => p.category === category).length >= 2) break;
          if (seenProbe.has(link.href) || sourceIdByUrl.has(link.href)) continue;
          seenProbe.add(link.href);
          probeTargets.push({ url: link.href, category });
        }
      }
    }
    for (const target of probeTargets.slice(0, 8)) {
      const result = await probeLink(target.url);
      probes.push({ url: target.url, category: target.category, ...result });
    }

    // ---- NORMALIZE EVIDENCE ----
    const evidenceInputs = normalizeEvidence({ pages, failures, probes });
    // Owner-reported review data → evidence (labeled owner-reported; never scraped).
    const reviewInput = { rating: audit.ownerRating, reviewCount: audit.ownerReviewCount, googleBusinessUrl: audit.googleBusinessUrl };
    const reviewSignal = analyzeOwnerReviews(reviewInput);
    evidenceInputs.push(...reviewEvidence(reviewInput, reviewSignal));
    // Owner-supplied social profile → evidence (was previously stored but unused).
    evidenceInputs.push(...socialEvidence(audit.socialUrlInput));

    // Register owner-provided external reference URLs (review profile, social)
    // as audit sources so their evidence attributes to the real URL in the
    // report — not the homepage fallback. Marked owner-provided (not fetched).
    for (const url of [audit.googleBusinessUrl, audit.socialUrlInput]) {
      if (url && !sourceIdByUrl.has(url)) {
        const src = await prisma.auditSource.create({
          data: {
            auditId,
            url,
            sourceType: 'OWNER_PROVIDED',
            status: 'COLLECTED',
            note: 'Owner-provided reference; not fetched by the crawler.',
          },
        });
        sourceIdByUrl.set(url, src.id);
      }
    }

    const evidenceRecords = [];
    for (const item of evidenceInputs) {
      const record = await prisma.evidence.create({
        data: {
          auditId,
          auditSourceId: item.sourceUrl ? sourceIdByUrl.get(item.sourceUrl) ?? homeSource.id : null,
          evidenceType: item.evidenceType,
          fact: item.fact,
          supportingContext: item.supportingContext,
          confidence: item.confidence,
        },
      });
      evidenceRecords.push({ ...record, sourceUrl: item.sourceUrl });
    }

    // ---- JOURNEY ANALYSIS ----
    await setStage(auditId, 'ANALYZING_CUSTOMER_JOURNEY');
    const journey = analyzeJourney(evidenceRecords);
    for (const stageResult of journey) {
      await prisma.journeyStage.create({
        data: {
          auditId,
          stage: stageResult.stage,
          status: stageResult.status,
          finding: stageResult.finding,
          confidence: stageResult.confidence,
          manualValidationRequired: stageResult.manualValidationRequired,
          evidenceIds: stageResult.evidenceIds,
        },
      });
    }

    // ---- REVENUE LEAKS ----
    await setStage(auditId, 'DETECTING_REVENUE_LEAKS');
    const opportunities = detectRevenueLeaks({ evidence: evidenceRecords, journey });

    await setStage(auditId, 'SCORING_OPPORTUNITIES');
    const ranked = rankOpportunities(opportunities);
    for (const opp of ranked) {
      await prisma.opportunity.create({
        data: {
          auditId,
          category: opp.category,
          title: opp.title,
          problem: opp.problem,
          businessImpact: opp.businessImpact,
          customerJourneyStage: opp.customerJourneyStage,
          evidenceIds: opp.evidenceIds,
          impactScore: opp.impactScore,
          urgencyScore: opp.urgencyScore,
          confidenceScore: opp.confidenceScore,
          aiFitScore: opp.aiFitScore,
          rescuePriorityScore: opp.rescuePriorityScore,
          recommendedSolution: opp.recommendedSolution,
          manualValidationRequired: opp.manualValidationRequired,
        },
      });
    }
    const topLeaks: RankedOpportunity[] = ranked.slice(0, 3);

    // ---- RESCUE SCORE ----
    await setStage(auditId, 'CALCULATING_RESCUE_SCORE');
    const categories = calculateCategoryScores(journey, evidenceRecords);
    for (const cat of categories) {
      await prisma.auditScore.create({
        data: {
          auditId,
          category: cat.category,
          weight: cat.weight,
          score: cat.insufficientData ? null : cat.score,
          confidence: cat.confidence,
          insufficientData: cat.insufficientData,
          explanation: cat.explanation,
        },
      });
    }
    const overall = calculateOverallScore(categories);

    // ---- OPTIONAL AI NARRATIVE (never fabricates; enhancement only) ----
    const provider = getAiProvider();
    let aiNarrative: { executiveSummary: string } | null = null;
    let aiFailed = false;
    if (provider) {
      try {
        aiNarrative = await provider.analyzeStructured({
          systemPrompt:
            'You are writing the executive summary of a restaurant digital audit for the restaurant owner. You may ONLY use facts present in the supplied evidence and findings. Never introduce numbers, revenue estimates, or facts not present in the input. Professional, direct, respectful tone. Return JSON: {"executiveSummary": string}.',
          userPrompt: JSON.stringify({
            restaurant: audit.restaurant.name,
            overallScore: overall.overallScore,
            coverageScore: overall.coverageScore,
            topLeaks: topLeaks.map((l) => ({ title: l.title, problem: l.problem, recommendation: l.recommendedSolution })),
            journey: journey.map((j) => ({ stage: j.stage, status: j.status })),
          }),
          schema: aiSummarySchema,
        });
      } catch (error) {
        aiFailed = true;
        await log(auditId, 'WARN', 'AI narrative generation failed; deterministic summary used.', String(error));
      }
    }

    // ---- OWNER REPORT ----
    await setStage(auditId, 'GENERATING_OWNER_REPORT');
    const location = [audit.restaurant.city, audit.restaurant.state].filter(Boolean).join(', ') || null;
    const partial = failures.length > 0;
    const finalStatus: AuditStatus = partial ? 'PARTIALLY_COMPLETED' : 'COMPLETED';
    const ownerReport = generateOwnerReport({
      restaurantName: audit.restaurant.name,
      websiteUrl: audit.restaurant.websiteUrl,
      location,
      auditStatus: finalStatus,
      demoMode: audit.demoMode,
      overallScore: overall.overallScore,
      coverageScore: overall.coverageScore,
      scoreExplanation: overall.explanation,
      categories,
      journey,
      topLeaks,
      evidence: evidenceRecords,
      aiNarrative,
    });
    await prisma.report.upsert({
      where: { auditId_reportType: { auditId, reportType: 'OWNER_AUDIT' } },
      create: { auditId, reportType: 'OWNER_AUDIT', content: ownerReport as object },
      update: { content: ownerReport as object },
    });

    // ---- INTERNAL SALES BRIEF ----
    await setStage(auditId, 'GENERATING_SALES_BRIEF');
    const brief = generateSalesBrief({
      restaurantName: audit.restaurant.name,
      overallScore: overall.overallScore,
      coverageScore: overall.coverageScore,
      topLeaks,
      journey,
      evidence: evidenceRecords,
      recommendedTier: ownerReport.recommendation.tier,
    });
    await prisma.salesIntelligence.upsert({
      where: { auditId },
      create: { auditId, ...brief },
      update: { ...brief },
    });

    // ---- COMPLETE ----
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: finalStatus,
        aiEnabled: Boolean(provider) && !aiFailed,
        overallScore: overall.overallScore,
        coverageScore: overall.coverageScore,
        confidenceLevel: overall.coverageScore >= 80 ? 'HIGH' : overall.coverageScore >= 50 ? 'MODERATE' : 'LOW',
        completedAt: new Date(),
        failureReason: partial ? `${failures.length} page(s) could not be collected; see sources for details.` : null,
      },
    });
    await setStage(auditId, 'COMPLETED', finalStatus);
    await log(auditId, 'INFO', `Audit ${finalStatus.toLowerCase()} with ${evidenceRecords.length} evidence records, ${ranked.length} opportunities.`);
  } catch (error) {
    await log(auditId, 'ERROR', 'Audit pipeline error', String(error instanceof Error ? error.stack ?? error.message : error));
    await failAudit(auditId, 'AUDIT COULD NOT START OR COMPLETE due to an internal error. Collected evidence, if any, has been preserved.');
  }
}

async function failAudit(auditId: string, reason: string): Promise<void> {
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: 'FAILED', failureReason: reason, completedAt: new Date() },
  });
  await prisma.auditJob.update({ where: { auditId }, data: { currentStage: 'FAILED', status: 'FAILED', errorMessage: reason } });
}
