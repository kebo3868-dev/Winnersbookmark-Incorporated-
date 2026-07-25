import { prisma } from '@/lib/db';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { rankOpportunities } from '@/lib/scoring/priority';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { generateOwnerReport } from '@/lib/reports/owner';
import { generateSalesBrief } from '@/lib/reports/sales';
import type { EvidenceInput } from '@/types/audit';

export const DEMO_RESTAURANT_NAME = 'The Golden Anchor Seafood House (FICTIONAL DEMO)';
export const DEMO_WEBSITE_URL = 'https://demo.invalid/golden-anchor-fictional';

/**
 * Demo Mode: a clearly labeled FICTIONAL restaurant run through the REAL
 * analysis pipeline (journey, leak detection, scoring, reports). The only
 * synthetic element is the evidence set — every record is marked as
 * demonstration data and the audit is flagged demoMode=true.
 */
const DEMO_EVIDENCE: EvidenceInput[] = [
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'BUSINESS_IDENTITY', fact: 'Homepage title: "The Golden Anchor Seafood House — Fresh Catch Daily". [DEMONSTRATION DATA]', supportingContext: 'Synthetic demo evidence — not a real restaurant.', confidence: 95 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'PHONE_VISIBILITY', fact: 'A phone number is publicly displayed ((555) 013-7788). [DEMONSTRATION DATA]', supportingContext: 'Displayed on the homepage.', confidence: 95 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'CLICK_TO_CALL', fact: 'No click-to-call (tel:) links detected; mobile visitors must dial manually. [DEMONSTRATION DATA]', supportingContext: 'Based on 6 analyzed page(s).', confidence: 80 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'HOURS_VISIBILITY', fact: 'Business hours are published on the website. [DEMONSTRATION DATA]', supportingContext: 'Detected hours text: "Tue–Sun 11:00am – 10:00pm"', confidence: 90 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'ADDRESS_VISIBILITY', fact: 'A street address is published on the website. [DEMONSTRATION DATA]', supportingContext: 'Detected address text: "742 Harborline Drive"', confidence: 90 },
  { sourceUrl: `${DEMO_WEBSITE_URL}/menu.pdf`, evidenceType: 'MENU_ACCESS', fact: 'The only detected menu links point to PDF files, which create friction on mobile devices. [DEMONSTRATION DATA]', supportingContext: `${DEMO_WEBSITE_URL}/menu.pdf`, confidence: 85 },
  { sourceUrl: `${DEMO_WEBSITE_URL}/reserve`, evidenceType: 'RESERVATION_PATH', fact: 'A reservation pathway is publicly linked to an external platform (1 link(s) found). [DEMONSTRATION DATA]', supportingContext: 'Example link text: "Book a Table"', confidence: 90 },
  { sourceUrl: `${DEMO_WEBSITE_URL}/order`, evidenceType: 'BROKEN_LINK', fact: 'The linked ordering destination failed when tested (HTTP 404). [DEMONSTRATION DATA]', supportingContext: `${DEMO_WEBSITE_URL}/order`, confidence: 95 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'ORDERING_PATH', fact: 'An online ordering pathway is publicly linked (1 link(s) found). [DEMONSTRATION DATA]', supportingContext: 'Example link text: "Order Online"', confidence: 90 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'CONTACT_PATH', fact: 'A contact pathway is publicly linked (1 link(s) found). [DEMONSTRATION DATA]', supportingContext: 'Example link text: "Contact Us"', confidence: 90 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'CATERING_PATH', fact: 'A catering pathway is publicly linked (1 link(s) found). [DEMONSTRATION DATA]', supportingContext: 'Example link text: "Catering & Events"', confidence: 90 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'PRIVATE_DINING_PATH', fact: 'A private dining pathway is publicly linked (1 link(s) found). [DEMONSTRATION DATA]', supportingContext: 'Example link text: "Private Dining"', confidence: 90 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'FAQ_SIGNAL', fact: 'No public FAQ pathway was detected on the analyzed website pages. [DEMONSTRATION DATA]', supportingContext: 'Based on 6 analyzed page(s).', confidence: 70 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'LOYALTY_SIGNAL', fact: 'No public loyalty or rewards pathway was detected on the analyzed website pages. [DEMONSTRATION DATA]', supportingContext: 'Based on 6 analyzed page(s).', confidence: 70 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'EMAIL_CAPTURE', fact: 'No public email capture mechanism was detected on the analyzed pages. [DEMONSTRATION DATA]', supportingContext: 'Based on 6 analyzed page(s).', confidence: 70 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'GIFT_CARD_SIGNAL', fact: 'A gift card pathway is publicly linked (1 link(s) found). [DEMONSTRATION DATA]', supportingContext: 'Example link text: "Gift Cards"', confidence: 90 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'SOCIAL_LINK', fact: '2 social profile link(s) detected. [DEMONSTRATION DATA]', supportingContext: 'facebook.example, instagram.example', confidence: 90 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'CTA_SIGNAL', fact: 'Homepage presents 4 action-oriented CTA(s). [DEMONSTRATION DATA]', supportingContext: 'Examples: Book a Table | Order Online | View Menu | Gift Cards', confidence: 80 },
  { sourceUrl: DEMO_WEBSITE_URL, evidenceType: 'MOBILE_SIGNAL', fact: 'Homepage declares a mobile viewport meta tag (basic mobile configuration present). [DEMONSTRATION DATA]', supportingContext: null, confidence: 85 },
  { sourceUrl: 'https://maps.google.example/golden-anchor', evidenceType: 'REVIEW_SIGNAL', fact: 'Owner-reported public rating: 4.2★ across 318 review(s). [DEMONSTRATION DATA]', supportingContext: 'Provided by the restaurant at intake; not independently verified against the review platform.', confidence: 55 },
];

export async function createDemoAudit(): Promise<{ auditId: string }> {
  const restaurant = await prisma.restaurant.upsert({
    where: { websiteUrl: DEMO_WEBSITE_URL },
    create: { websiteUrl: DEMO_WEBSITE_URL, name: DEMO_RESTAURANT_NAME, city: 'Harborville', state: 'Demo' },
    update: {},
  });
  const audit = await prisma.audit.create({
    data: {
      restaurantId: restaurant.id,
      status: 'RUNNING',
      demoMode: true,
      startedAt: new Date(),
      // Phase 3 demo: owner-reported reviews + real average ticket showcase.
      ownerRating: 4.2,
      ownerReviewCount: 318,
      googleBusinessUrl: 'https://maps.google.example/golden-anchor',
      avgTicketInput: 38,
      job: { create: { status: 'RUNNING', currentStage: 'COLLECTING_EVIDENCE' } },
      lead: {
        create: {
          restaurantId: restaurant.id,
          contactName: 'Sample Prospect (DEMO)',
          email: 'owner@golden-anchor.demo',
          phone: '(555) 013-7788',
          consent: true,
          notes: 'DEMONSTRATION DATA — fictional lead.',
        },
      },
    },
  });

  const source = await prisma.auditSource.create({
    data: {
      auditId: audit.id,
      url: DEMO_WEBSITE_URL,
      pageTitle: 'The Golden Anchor Seafood House (FICTIONAL DEMO)',
      sourceType: 'DEMO_SYNTHETIC',
      status: 'COLLECTED',
      note: 'DEMONSTRATION DATA — synthetic fictional restaurant, not a real business.',
      collectedAt: new Date(),
    },
  });

  const evidenceRecords = [];
  for (const item of DEMO_EVIDENCE) {
    const record = await prisma.evidence.create({
      data: {
        auditId: audit.id,
        auditSourceId: source.id,
        evidenceType: item.evidenceType,
        fact: item.fact,
        supportingContext: item.supportingContext,
        confidence: item.confidence,
      },
    });
    evidenceRecords.push({ ...record, sourceUrl: item.sourceUrl });
  }

  // Real pipeline from here down.
  const journey = analyzeJourney(evidenceRecords);
  for (const s of journey) {
    await prisma.journeyStage.create({
      data: { auditId: audit.id, stage: s.stage, status: s.status, finding: s.finding, confidence: s.confidence, manualValidationRequired: s.manualValidationRequired, evidenceIds: s.evidenceIds },
    });
  }
  const ranked = rankOpportunities(detectRevenueLeaks({ evidence: evidenceRecords, journey }));
  for (const opp of ranked) {
    await prisma.opportunity.create({
      data: {
        auditId: audit.id,
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
  const topLeaks = ranked.slice(0, 3);
  const categories = calculateCategoryScores(journey, evidenceRecords);
  for (const cat of categories) {
    await prisma.auditScore.create({
      data: { auditId: audit.id, category: cat.category, weight: cat.weight, score: cat.insufficientData ? null : cat.score, confidence: cat.confidence, insufficientData: cat.insufficientData, explanation: cat.explanation },
    });
  }
  const overall = calculateOverallScore(categories);

  const ownerReport = generateOwnerReport({
    restaurantName: DEMO_RESTAURANT_NAME,
    websiteUrl: DEMO_WEBSITE_URL,
    location: 'Harborville, Demo',
    auditStatus: 'COMPLETED',
    demoMode: true,
    overallScore: overall.overallScore,
    coverageScore: overall.coverageScore,
    scoreExplanation: overall.explanation,
    categories,
    journey,
    topLeaks,
    evidence: evidenceRecords,
  });
  await prisma.report.create({ data: { auditId: audit.id, reportType: 'OWNER_AUDIT', content: ownerReport as object } });

  const brief = generateSalesBrief({
    restaurantName: DEMO_RESTAURANT_NAME,
    overallScore: overall.overallScore,
    coverageScore: overall.coverageScore,
    topLeaks,
    journey,
    evidence: evidenceRecords,
    recommendedTier: ownerReport.recommendation.tier,
  });
  await prisma.salesIntelligence.create({ data: { auditId: audit.id, ...brief } });

  await prisma.audit.update({
    where: { id: audit.id },
    data: {
      status: 'COMPLETED',
      overallScore: overall.overallScore,
      coverageScore: overall.coverageScore,
      confidenceLevel: 'DEMO',
      completedAt: new Date(),
    },
  });
  await prisma.auditJob.update({ where: { auditId: audit.id }, data: { currentStage: 'COMPLETED', status: 'COMPLETED' } });

  return { auditId: audit.id };
}
