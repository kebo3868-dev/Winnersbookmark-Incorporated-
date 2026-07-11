import type { EvidenceRecordLike, JourneyStageResult, OpportunityInput } from '@/types/audit';

const MAX_OPPORTUNITIES = 10;
const MANUAL_VALIDATION_CONFIDENCE_FLOOR = 60;

interface RuleContext {
  evidence: EvidenceRecordLike[];
  journey: JourneyStageResult[];
}

type Rule = (ctx: RuleContext) => OpportunityInput | null;

const byType = (ctx: RuleContext, type: string, predicate?: (e: EvidenceRecordLike) => boolean) =>
  ctx.evidence.filter((e) => e.evidenceType === type && (predicate ? predicate(e) : true));

const conf = (items: EvidenceRecordLike[], cap = 95) =>
  items.length === 0 ? 0 : Math.min(cap, Math.round(items.reduce((s, e) => s + e.confidence, 0) / items.length));

/**
 * Deterministic revenue leak detection. Every opportunity is backed by evidence IDs;
 * a rule that finds no supporting evidence emits nothing. Zero opportunities is a
 * legitimate outcome. Confidence below 60 forces manualValidationRequired.
 */
export function detectRevenueLeaks(ctx: RuleContext): OpportunityInput[] {
  const opportunities: OpportunityInput[] = [];
  for (const rule of RULES) {
    if (opportunities.length >= MAX_OPPORTUNITIES) break;
    const result = rule(ctx);
    if (result) {
      const manualValidationRequired =
        result.manualValidationRequired || result.confidenceScore < MANUAL_VALIDATION_CONFIDENCE_FLOOR;
      opportunities.push({ ...result, manualValidationRequired });
    }
  }
  return opportunities;
}

const RULES: Rule[] = [
  // Broken transactional links — highest-confidence leak when present.
  (ctx) => {
    const broken = byType(ctx, 'BROKEN_LINK');
    if (broken.length === 0) return null;
    const categories = broken.map((e) => e.fact).join(' ');
    const transactional = /reservation|ordering/i.test(categories);
    return {
      category: transactional ? 'ONLINE ORDERING FAILURE RISK' : 'BROKEN CUSTOMER PATHWAY',
      title: transactional ? 'A transaction link on the website is failing' : 'A linked customer pathway is failing',
      problem: `${broken.length} linked destination(s) failed when tested. Customers who click these links reach a dead end at the exact moment they are trying to spend money or get information.`,
      businessImpact:
        'Every failed click at a transactional step is a customer intent the restaurant paid to attract (via search, social, or word of mouth) and then lost at the final step.',
      customerJourneyStage: transactional ? 'ORDERING' : 'WEBSITE',
      evidenceIds: broken.map((e) => e.id),
      impactScore: transactional ? 90 : 70,
      urgencyScore: 90,
      confidenceScore: conf(broken),
      aiFitScore: 20,
      recommendedSolution: 'Fix the broken link(s) immediately. This is a direct website repair, not an AI project.',
      manualValidationRequired: false,
    };
  },
  // Phone-dependent journey.
  (ctx) => {
    const phoneStage = ctx.journey.find((s) => s.stage === 'PHONE');
    if (!phoneStage || phoneStage.status === 'HEALTHY' || phoneStage.evidenceIds.length === 0) return null;
    const c2cMissing = byType(ctx, 'CLICK_TO_CALL', (e) => /no click-to-call/i.test(e.fact));
    const faqMissing = byType(ctx, 'FAQ_SIGNAL', (e) => /no public faq/i.test(e.fact));
    const supporting = [...c2cMissing, ...faqMissing];
    if (supporting.length === 0 && phoneStage.status !== 'RISK') return null;
    return {
      category: 'PHONE-DEPENDENT CUSTOMER JOURNEY',
      title: 'The phone line is carrying load the website could absorb',
      problem:
        'Common customer questions (hours, menu, booking, directions) are not fully answered online' +
        (faqMissing.length > 0 ? ' — no FAQ was detected —' : '') +
        (c2cMissing.length > 0 ? ' and mobile visitors cannot tap to call' : '') +
        '. During service rushes, this creates potential missed-call exposure. Actual missed-call volume is unverified and requires call data.',
      businessImpact:
        'Phone-dependent journeys concentrate customer intent into the busiest moments of service. Each unanswered ring is a potential lost booking, order, or catering lead.',
      customerJourneyStage: 'PHONE',
      evidenceIds: [...phoneStage.evidenceIds],
      impactScore: 75,
      urgencyScore: 65,
      confidenceScore: Math.min(conf(supporting, 80), phoneStage.confidence || 70),
      aiFitScore: 95,
      recommendedSolution:
        'Winners Bookmark AI Front Desk System: AI voice receptionist, missed-call text-back, FAQ automation, and after-hours lead capture. Validate call volume in a discovery call first.',
      manualValidationRequired: true,
    };
  },
  // Weak retention signals.
  (ctx) => {
    const emailMissing = byType(ctx, 'EMAIL_CAPTURE', (e) => /no public email capture/i.test(e.fact));
    const loyaltyMissing = byType(ctx, 'LOYALTY_SIGNAL', (e) => /no public loyalty/i.test(e.fact));
    if (emailMissing.length === 0 || loyaltyMissing.length === 0) return null;
    const supporting = [...emailMissing, ...loyaltyMissing];
    return {
      category: 'WEAK PUBLIC RETENTION SIGNALS',
      title: 'The website is not visibly building a customer database',
      problem:
        'No email capture, SMS club, or loyalty pathway was detected on the analyzed pages. Every guest who leaves without joining a list is a repeat visit left to chance. This does not prove no internal database exists — it proves the public website is not feeding one.',
      businessImpact:
        'Repeat customers are the highest-margin revenue a restaurant has. Without an owned contact channel, reactivation depends entirely on paid ads and memory.',
      customerJourneyStage: 'FOLLOW_UP',
      evidenceIds: supporting.map((e) => e.id),
      impactScore: 70,
      urgencyScore: 50,
      confidenceScore: conf(supporting, 75),
      aiFitScore: 85,
      recommendedSolution:
        'Add a visible email/SMS capture offer, then run an AI Reactivation Campaign once a list exists. Verify in discovery whether an internal POS database already exists.',
      manualValidationRequired: true,
    };
  },
  // Menu friction.
  (ctx) => {
    const pdfOnly = byType(ctx, 'MENU_ACCESS', (e) => /only detected menu links point to pdf/i.test(e.fact));
    const missing = byType(ctx, 'MENU_ACCESS', (e) => /no public menu/i.test(e.fact));
    const supporting = pdfOnly.length > 0 ? pdfOnly : missing;
    if (supporting.length === 0) return null;
    const isPdf = pdfOnly.length > 0;
    return {
      category: 'MENU ACCESS FRICTION',
      title: isPdf ? 'The menu is trapped in PDF files' : 'The menu is not obviously reachable',
      problem: isPdf
        ? 'All detected menu links point to PDF downloads. On a phone, a PDF menu means pinch-zooming, slow loads, and abandoned sessions — for the single most-requested piece of restaurant information.'
        : 'No public menu pathway was detected on the analyzed pages. Menu lookup is the most common visitor intent; if it is genuinely absent, most sessions end unresolved.',
      businessImpact: 'Diners overwhelmingly check the menu before choosing a restaurant. Menu friction suppresses both visits and average ticket.',
      customerJourneyStage: 'MENU',
      evidenceIds: supporting.map((e) => e.id),
      impactScore: isPdf ? 65 : 75,
      urgencyScore: isPdf ? 55 : 70,
      confidenceScore: conf(supporting, isPdf ? 80 : 65),
      aiFitScore: 30,
      recommendedSolution: isPdf
        ? 'Publish the menu as a mobile-friendly HTML page (keep the PDF as secondary). Basic optimization — no AI required.'
        : 'Add a prominent menu page and navigation link. Verify manually that no menu exists behind an undetected pathway.',
      manualValidationRequired: !isPdf,
    };
  },
  // CTA problems.
  (ctx) => {
    const noCtas = byType(ctx, 'CTA_SIGNAL', (e) => /no clear action-oriented ctas/i.test(e.fact));
    const tooMany = byType(ctx, 'CTA_SIGNAL', (e) => /competing ctas/i.test(e.fact));
    const supporting = noCtas.length > 0 ? noCtas : tooMany;
    if (supporting.length === 0) return null;
    const isMissing = noCtas.length > 0;
    return {
      category: 'CONFUSING CTA HIERARCHY',
      title: isMissing ? 'The homepage gives visitors no clear next action' : 'Too many competing calls-to-action dilute the next step',
      problem: isMissing
        ? 'No order/reserve/call/menu CTAs were detected on the homepage. Visitors with buying intent must hunt for the path to act.'
        : 'The homepage presents many competing CTAs. When everything shouts, nothing converts; the primary action (reserve or order) should visually dominate.',
      businessImpact: 'CTA clarity is the difference between a visit and a transaction. Unclear next actions leak ready-to-buy customers.',
      customerJourneyStage: 'WEBSITE',
      evidenceIds: supporting.map((e) => e.id),
      impactScore: 60,
      urgencyScore: 55,
      confidenceScore: conf(supporting, 70),
      aiFitScore: 25,
      recommendedSolution: 'Restructure homepage CTA hierarchy: one primary action above the fold, secondary actions demoted. Basic optimization.',
      manualValidationRequired: false,
    };
  },
  // Catering / private dining lead capture.
  (ctx) => {
    const catering = byType(ctx, 'CATERING_PATH', (e) => !/no public/i.test(e.fact));
    const privateDining = byType(ctx, 'PRIVATE_DINING_PATH', (e) => !/no public/i.test(e.fact));
    const faqMissing = byType(ctx, 'FAQ_SIGNAL', (e) => /no public faq/i.test(e.fact));
    const present = [...catering, ...privateDining];
    if (present.length === 0) return null;
    return {
      category: 'CATERING LEAD CAPTURE OPPORTUNITY',
      title: 'High-ticket inquiries (catering / private dining) depend on manual response',
      problem:
        'The restaurant advertises catering and/or private dining, but the visible inquiry path appears to rely on manual handling. High-ticket leads that arrive after hours or during a rush risk slow responses, and speed-to-lead usually decides who wins the booking.',
      businessImpact: 'Catering and private events are among the highest-margin orders a restaurant takes. A single lost event can outweigh dozens of covers.',
      customerJourneyStage: 'CONTACT',
      evidenceIds: [...present, ...faqMissing].map((e) => e.id),
      impactScore: 70,
      urgencyScore: 55,
      confidenceScore: Math.min(conf(present, 75), 65),
      aiFitScore: 90,
      recommendedSolution:
        'AI-assisted lead capture and qualification for event inquiries (instant acknowledgment, structured intake, human handoff). Validate current response times in discovery.',
      manualValidationRequired: true,
    };
  },
  // Technical foundation (HTTPS / viewport).
  (ctx) => {
    const insecure = byType(ctx, 'TECHNICAL_SIGNAL', (e) => /HTTPS/i.test(e.fact));
    const noViewport = byType(ctx, 'MOBILE_SIGNAL', (e) => /lacks a mobile viewport/i.test(e.fact));
    const supporting = [...insecure, ...noViewport];
    if (supporting.length === 0) return null;
    return {
      category: 'WEBSITE TECHNICAL FOUNDATION',
      title: 'Foundational technical problems undermine mobile customers and trust',
      problem: [
        insecure.length > 0 ? 'The site is served without HTTPS, so browsers mark it "not secure".' : '',
        noViewport.length > 0 ? 'The homepage lacks a mobile viewport tag, so phones render a desktop layout.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      businessImpact: 'Most restaurant traffic is mobile. A broken mobile experience or a security warning turns away customers before they see the menu.',
      customerJourneyStage: 'WEBSITE',
      evidenceIds: supporting.map((e) => e.id),
      impactScore: 75,
      urgencyScore: 70,
      confidenceScore: conf(supporting, 90),
      aiFitScore: 10,
      recommendedSolution: 'Fix hosting/SSL and mobile viewport configuration. Direct web work — no AI required.',
      manualValidationRequired: false,
    };
  },
  // Contact information gaps.
  (ctx) => {
    const hoursMissing = byType(ctx, 'HOURS_VISIBILITY', (e) => /not detected/i.test(e.fact));
    const addressMissing = byType(ctx, 'ADDRESS_VISIBILITY', (e) => /not detected/i.test(e.fact));
    const supporting = [...hoursMissing, ...addressMissing];
    if (supporting.length === 0) return null;
    return {
      category: 'CONTACT PATH FRICTION',
      title: 'Core visit information is hard to find',
      problem:
        [
          hoursMissing.length > 0 ? 'Business hours were not detected in the analyzed page text.' : '',
          addressMissing.length > 0 ? 'A street address was not detected in the analyzed page text.' : '',
        ]
          .filter(Boolean)
          .join(' ') + ' Customers who cannot instantly confirm hours and location call the restaurant — or pick a competitor.',
      businessImpact: 'Hours and address questions are the highest-volume customer intents. Every unanswered one becomes a phone call or a lost visit.',
      customerJourneyStage: 'CONTACT',
      evidenceIds: supporting.map((e) => e.id),
      impactScore: 55,
      urgencyScore: 60,
      confidenceScore: conf(supporting, 60),
      aiFitScore: 40,
      recommendedSolution: 'Publish hours and address in the site header/footer as text (not images). Verify manually — this information may exist in a format collection could not read.',
      manualValidationRequired: true,
    };
  },
  // Third-party ordering dependency.
  (ctx) => {
    const competing = byType(ctx, 'ORDERING_PATH', (e) => /competing ordering destinations/i.test(e.fact));
    if (competing.length === 0) return null;
    return {
      category: 'THIRD-PARTY ORDERING DEPENDENCY',
      title: 'Ordering traffic is split across multiple third-party platforms',
      problem:
        'Several external ordering platforms are linked with no single clear primary path. This splits order intent, confuses customers, and creates potential margin exposure due to third-party ordering dependency. Exact commission impact is unverified without restaurant data.',
      businessImpact: 'Third-party platforms typically take a significant commission and own the customer relationship. Direct-order conversion protects margin and data.',
      customerJourneyStage: 'ORDERING',
      evidenceIds: competing.map((e) => e.id),
      impactScore: 65,
      urgencyScore: 50,
      confidenceScore: conf(competing, 75),
      aiFitScore: 50,
      recommendedSolution: 'Establish one primary direct-order path and demote third-party links. Quantify commission exposure in discovery.',
      manualValidationRequired: true,
    };
  },
];
