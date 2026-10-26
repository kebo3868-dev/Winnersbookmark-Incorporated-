import { isUnverifiedSignup } from '@/lib/audit/emailCaptureState';
import { readMenuAvailability } from '@/lib/audit/menuAvailability';
import type { EvidenceRecordLike, JourneyStageResult, OpportunityInput } from '@/types/audit';

const MAX_OPPORTUNITIES = 10;
const MANUAL_VALIDATION_CONFIDENCE_FLOOR = 60;

interface RuleContext {
  evidence: EvidenceRecordLike[];
  journey: JourneyStageResult[];
}

/**
 * True when a fact states that something was NOT found.
 *
 * Mirrors `positive` in journey.ts deliberately: a rule that wants "this signal
 * is absent" should ask that question, not match the sentence that happened to
 * express it when the rule was written. Only the opening clause is examined,
 * because a positive fact can mention what it is *not* further along ("… it is
 * not a newsletter signup, which is recorded separately").
 */
const statesAbsence = (e: EvidenceRecordLike) => /\bno\b|\bnot\b|lacks|without/i.test(e.fact.slice(0, 60));

type Rule = (ctx: RuleContext) => OpportunityInput | null;

const byType = (ctx: RuleContext, type: string, predicate?: (e: EvidenceRecordLike) => boolean) =>
  ctx.evidence.filter((e) => e.evidenceType === type && (predicate ? predicate(e) : true));

const conf = (items: EvidenceRecordLike[], cap = 95) =>
  items.length === 0 ? 0 : Math.min(cap, Math.round(items.reduce((s, e) => s + e.confidence, 0) / items.length));

/**
 * The common visit questions a restaurant website is expected to answer, and
 * whether THIS site answers each one.
 *
 * A missing FAQ page was being read as "customers cannot get answers online" —
 * while the same evidence chain recorded published hours, a published address
 * and a reachable menu two entries above. Those ARE the questions people ring
 * to ask. An audit that holds the answers and still reports the questions
 * unanswered is contradicting itself, and the owner knows it first.
 */
function answeredVisitQuestions(ctx: RuleContext): {
  answered: string[];
  unanswered: string[];
  /** Every linked menu destination failed when tested or has no menu yet. */
  menuFailed: boolean;
  /** No menu destination is verified working, and at least one is unverified. */
  menuUnverified: boolean;
  /** A menu link failed alongside a menu that works or is unverified — reported, not decisive. */
  spareMenuFailed: boolean;
} {
  const positive = (type: string, pattern: RegExp) =>
    byType(ctx, type, (e) => pattern.test(e.fact)).length > 0;
  // A MENU IS AN ANSWER ONLY WHEN A DESTINATION IS KNOWN TO WORK.
  //
  // "A menu pathway is publicly linked" was credited on its own, so a site
  // whose only menu link returned 404 was told the menu "is answerable online
  // without calling". The repair then over-corrected: any failure anywhere
  // cancelled the answer, so a verified /menu next to a broken /old-menu was
  // told "the menu cannot be read online".
  //
  // MENU_AVAILABILITY carries the conclusion drawn from every destination
  // judged on its own (evidence.ts). Hand-built or legacy evidence without it
  // falls back to the records themselves, where a success anywhere — each one
  // is a single destination that worked — still outweighs a failure.
  const availability = byType(ctx, 'MENU_AVAILABILITY')[0]?.fact;
  const menuLinked = positive('MENU_ACCESS', /pathway is publicly (linked|reachable)/i);
  let menuState: 'VERIFIED' | 'FAILED' | 'UNVERIFIED' | 'MISSING';
  let spareMenuFailed: boolean;
  if (availability) {
    ({ state: menuState, spareFailed: spareMenuFailed } = readMenuAvailability(availability));
  } else {
    const succeeded = positive('MENU_ACCESS', /responded successfully when tested|fetched successfully during this audit/i);
    const failed =
      byType(ctx, 'BROKEN_LINK', (e) => /menu/i.test(e.fact)).length > 0 ||
      positive('MENU_ACCESS', /has no menu published on it yet/i);
    menuState = succeeded ? 'VERIFIED' : failed ? 'FAILED' : menuLinked ? 'UNVERIFIED' : 'MISSING';
    spareMenuFailed = succeeded && failed;
  }
  const checks: [string, boolean][] = [
    ['opening hours', positive('HOURS_VISIBILITY', /hours are published/i)],
    ['the address', positive('ADDRESS_VISIBILITY', /address is published/i)],
    [
      'how to get in touch',
      positive('CONTACT_PATH', /publicly (linked|available)/i) ||
        positive('CONTACT_EMAIL', /is published/i) ||
        positive('CONTACT_FORM', /is published/i),
    ],
  ];
  const answered = checks.filter(([, ok]) => ok).map(([label]) => label);
  const unanswered = checks.filter(([, ok]) => !ok).map(([label]) => label);
  if (menuState === 'VERIFIED') answered.splice(1, 0, 'the menu');
  else if (menuState === 'MISSING') unanswered.splice(1, 0, 'the menu');
  return {
    answered,
    unanswered,
    menuFailed: menuState === 'FAILED',
    menuUnverified: menuState === 'UNVERIFIED',
    spareMenuFailed,
  };
}

/** Joins a list as prose: "a and b", "a, b and c". */
const prose = (items: string[]) =>
  items.length <= 1 ? items[0] ?? '' : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

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
    // WHAT THE SITE ALREADY ANSWERS BOUNDS WHAT THIS FINDING MAY CLAIM.
    //
    // A missing FAQ page is an observation. "Questions go unanswered online"
    // and "the phone carries avoidable demand" are two further conclusions, and
    // neither follows: the first is contradicted by published hours, address
    // and menu, and the second cannot be reached at all without call records.
    const { answered, unanswered, menuFailed, menuUnverified, spareMenuFailed } = answeredVisitQuestions(ctx);
    // Impact and urgency are reduced only when every core question is KNOWN
    // to be answered online. An untested menu link earns no reduction, and
    // neither does it make the title claim a question goes unanswered.
    const coreQuestionsAnswered = unanswered.length === 0 && !menuFailed && !menuUnverified;
    const knownGap = unanswered.length > 0 || menuFailed;
    const observed = [
      faqMissing.length > 0 ? 'no dedicated FAQ page was found' : '',
      c2cMissing.length > 0 ? 'mobile visitors cannot tap to call' : '',
    ].filter(Boolean);
    return {
      category: 'PHONE-DEPENDENT CUSTOMER JOURNEY',
      title: knownGap
        ? 'Common visit questions are not answered on the website'
        : 'Phone demand is unmeasured, and the website cannot show whether it is avoidable',
      problem:
        `OBSERVED: ${prose(observed) || 'the phone is the primary published route in'}.` +
        (answered.length > 0
          ? ` The website does publish ${prose(answered)}, so those questions are answerable online without calling.`
          : '') +
        (unanswered.length > 0 ? ` Not found on the analyzed pages: ${prose(unanswered)}.` : '') +
        (menuFailed
          ? ' Every linked menu destination failed when tested or leads to a page with no menu yet, so the menu cannot be read online.'
          : '') +
        (menuUnverified
          ? ' A menu link is published, but whether it opens a working menu was not verified, so it is not counted as answered.'
          : '') +
        (spareMenuFailed
          ? menuUnverified
            ? ' Another menu link failed when tested; because a menu link remains unverified, this does not show that no readable menu exists.'
            : ' Another menu link failed when tested or leads to a page with no menu yet; it is reported separately and does not affect the working menu.'
          : '') +
        ' REQUIRES YOUR DATA: how many calls arrive, how many go unanswered, and what share are repeat questions' +
        ' cannot be observed from a public website. This audit does not claim the phone is overloaded or that calls are' +
        ' being missed — it cannot see either.',
      businessImpact: coreQuestionsAnswered
        ? 'If call volume turns out to be high and largely repetitive, answering those calls automatically is worth measuring. ' +
          'Whether that is the case here is an open question, not a finding.'
        : knownGap
          ? 'Questions a visitor cannot answer online tend to arrive by phone instead. How much demand that creates here is unmeasured.'
          : 'Whether visitors can answer these questions online was not fully verified, so whether the website reduces phone ' +
            'demand is not established. How much demand reaches the phone is unmeasured.',
      customerJourneyStage: 'PHONE',
      evidenceIds: [...phoneStage.evidenceIds],
      // An unmeasured question is not a high-impact confirmed problem. Impact
      // and urgency drop accordingly when the core questions ARE answered.
      impactScore: coreQuestionsAnswered ? 40 : 65,
      urgencyScore: coreQuestionsAnswered ? 30 : 55,
      // Capped below the manual-validation floor on purpose: the conclusion
      // this finding points at is unreachable from public evidence.
      confidenceScore: Math.min(conf(supporting, 55), phoneStage.confidence || 55),
      aiFitScore: 95,
      recommendedSolution:
        'Before any system: pull 30 days of call records — total calls, unanswered calls, and the most common reasons. ' +
        'If that shows high repetitive volume, the Winnersbookmark AI Front Desk (voice answering, missed-call text-back, ' +
        'FAQ automation, after-hours capture) is the matched fix. If it does not, this is not a problem worth solving.',
      manualValidationRequired: true,
    };
  },
  // Weak retention signals.
  (ctx) => {
    // MATCHED ON ABSENCE, NOT ON A SENTENCE.
    //
    // This rule read `/no public email capture/i` while evidence.ts emits "No
    // mechanism for collecting visitors' email addresses …". The two stopped
    // agreeing when that wording was rewritten, and the rule has been DEAD on
    // the live pipeline ever since: a fresh audit of a site with no signup and
    // no loyalty programme produced no retention finding at all. It passed its
    // own test because the test fed it hand-written evidence carrying the old
    // sentence — a test that asserted the wording instead of the behaviour.
    //
    // `statesAbsence` asks the question the rule actually means, the same way
    // journey.ts does, so a future rewording cannot silently switch it off.
    const emailMissing = byType(ctx, 'EMAIL_CAPTURE', (e) => statesAbsence(e) && !isUnverifiedSignup(e.fact));
    // A signup form of unverified purpose leaves the opt-in question open, so
    // "a guest has no public way to opt in" would turn uncertainty into an
    // absence.
    if (byType(ctx, 'EMAIL_CAPTURE', (e) => isUnverifiedSignup(e.fact)).length > 0) return null;
    const loyaltyMissing = byType(ctx, 'LOYALTY_SIGNAL', statesAbsence);
    // AN SMS CLUB IS AN OPT-IN ROUTE.
    //
    // The guard checked email capture and loyalty only, so a site offering
    // "Join our text club — text GRILL to 12345" was still told "a guest has no
    // public way to opt into hearing from you" — while the FOLLOW_UP stage of
    // the same audit said one opt-in route was detected. The finding's own
    // problem text names all three channels, so the guard has to as well.
    const smsPresent = byType(ctx, 'SMS_CAPTURE', (e) => !statesAbsence(e));
    if (smsPresent.length > 0) return null;
    if (emailMissing.length === 0 || loyaltyMissing.length === 0) return null;
    const supporting = [...emailMissing, ...loyaltyMissing];
    return {
      // THE CATEGORY IS A MACHINE KEY AS WELL AS A LABEL.
      //
      // Renaming this from "WEAK PUBLIC RETENTION SIGNALS" to drop the verdict
      // in "weak" also silently unhooked eight consumers that dispatch on
      // /RETENTION/: the reactivation scenario stopped being offered, and the
      // AI capabilities, validation steps and KPIs fell back to a generic
      // "Custom Automation Assessment". The stable token is kept in the
      // category so those keep matching, and the precise claim lives in the
      // title, which is what the client report actually prints.
      category: 'CUSTOMER RETENTION — NO PUBLIC OPT-IN ROUTE',
      title: 'A guest has no public way to opt into hearing from you',
      problem:
        'OBSERVED: no email capture, SMS club or loyalty pathway was detected on the analyzed pages, so a guest who wants to hear from you has nowhere on the site to say so. ' +
        'NOT OBSERVED: whether you already hold a guest list. A POS loyalty programme, a reservation system\'s contact records, or a till-side signup leaves no public trace, and this audit reads only public pages. ' +
        'REQUIRES YOUR DATA: how many contacts you hold today and whether anything is sent to them. ' +
        'This finding is about the public website, not about the quality of your follow-up — that is not something a public page can show.',
      businessImpact:
        'An owned contact channel is the cheapest way to reach a past guest, and the website is not currently feeding one. ' +
        'Whether that matters depends on what you already hold internally, which is the first thing to check.',
      customerJourneyStage: 'FOLLOW_UP',
      evidenceIds: supporting.map((e) => e.id),
      // Scoped to the observable gap rather than an assumed operational
      // failure: the old 70/50 ranked this alongside a broken ordering link on
      // the strength of two absent widgets.
      impactScore: 45,
      urgencyScore: 35,
      confidenceScore: conf(supporting, 65),
      aiFitScore: 85,
      recommendedSolution:
        'First check whether a list already exists in your POS or reservation system — if it does, this is a publishing gap, not a data gap. ' +
        'If it does not, a visible email/SMS capture offer is the starting point, and an AI Reactivation Campaign only becomes worth discussing once there is a list to reactivate.',
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
    const tooMany = byType(ctx, 'CTA_SIGNAL', (e) => /more than the 8 this audit treats/i.test(e.fact));
    const supporting = noCtas.length > 0 ? noCtas : tooMany;
    if (supporting.length === 0) return null;
    const isMissing = noCtas.length > 0;
    return {
      category: 'CONFUSING CTA HIERARCHY',
      title: isMissing
        ? 'The homepage gives visitors no clear next action'
        : 'The homepage offers many actions — worth checking which one leads',
      problem: isMissing
        ? 'No order/reserve/call/menu CTAs were detected on the homepage. Visitors with buying intent must hunt for the path to act.'
        : // The count is observed. Visual competition and lost conversions are not.
          'OBSERVED: the homepage presents more distinct action-oriented CTAs than the threshold this audit flags for review. ' +
          'NOT OBSERVED: whether they compete visually. This audit reads markup, not layout — it cannot see size, position or ' +
          'contrast, so a long list of actions in a clear hierarchy looks identical to a cluttered one. REQUIRES YOUR DATA: ' +
          'whether any conversion is actually lost needs website analytics.',
      businessImpact: isMissing
        ? 'CTA clarity is the difference between a visit and a transaction. Unclear next actions leak ready-to-buy customers.'
        : 'If the actions do compete, the cost is visitors who arrive ready to act and hesitate. Whether that is happening here is unmeasured.',
      customerJourneyStage: 'WEBSITE',
      evidenceIds: supporting.map((e) => e.id),
      // A count that triggers a question is not a confirmed usability defect.
      impactScore: isMissing ? 60 : 35,
      urgencyScore: isMissing ? 55 : 25,
      // Below the manual-validation floor for the count-only case: the claim
      // this finding points at cannot be reached from the markup.
      confidenceScore: isMissing ? conf(supporting, 70) : Math.min(conf(supporting, 50), 50),
      aiFitScore: 25,
      recommendedSolution: isMissing
        ? 'Add a clear primary action above the fold on the homepage. Basic optimization.'
        : 'Open the homepage on a phone and name the single action you want a first-time visitor to take. If it is not ' +
          'obvious within a second, demote the rest. Confirm against analytics before treating this as a conversion problem.',
      manualValidationRequired: !isMissing,
    };
  },
  // Catering / private dining lead capture.
  (ctx) => {
    const catering = byType(ctx, 'CATERING_PATH', (e) => !/no public/i.test(e.fact));
    const privateDining = byType(ctx, 'PRIVATE_DINING_PATH', (e) => !/no public/i.test(e.fact));
    const faqMissing = byType(ctx, 'FAQ_SIGNAL', (e) => /no public faq/i.test(e.fact));
    const present = [...catering, ...privateDining];
    if (present.length === 0) return null;
    // A LINK SHOWS A PATHWAY EXISTS, NOT HOW IT IS HANDLED.
    //
    // This finding said "the visible inquiry path appears to rely on manual
    // handling" — on Leverock's, from one "Book your party" link, in an audit
    // that also recorded "no public catering pathway". Nothing public shows
    // whether an inquiry is acknowledged by a person, a system, or not at all,
    // or how fast. So the finding now names only the pathway that was seen,
    // asks for the records that would settle it, and does not put automation
    // forward until they do: impact and urgency are not claimed, confidence
    // sits under the manual-validation floor, and the automation fit stays
    // below the bar for an AI recommendation.
    const subject =
      catering.length > 0 && privateDining.length > 0 ? 'Catering and private-event' : catering.length > 0 ? 'Catering' : 'Private-event';
    const seen = prose([
      ...(catering.length > 0 ? ['a catering pathway'] : []),
      ...(privateDining.length > 0 ? ['a private-event pathway'] : []),
    ]);
    const noun = subject.toLowerCase();
    return {
      // Machine key unchanged: report consumers dispatch on /CATERING/.
      category: 'CATERING LEAD CAPTURE OPPORTUNITY',
      title: `${subject} inquiry handling requires validation`,
      problem:
        `${subject} inquiry handling requires validation. OBSERVED: ${seen} is publicly linked. ` +
        'NOT OBSERVED: how those inquiries are received, acknowledged or answered — a link shows that a pathway exists, ' +
        'not whether handling is manual, automated, fast or slow. ' +
        `REQUIRES YOUR DATA: acknowledgment records, response times and booking records for recent ${noun} inquiries.`,
      businessImpact:
        `${subject} bookings are high-value, so how their inquiries are handled matters. Whether any are slowed or lost is unmeasured here.`,
      customerJourneyStage: 'CONTACT',
      evidenceIds: [...present, ...faqMissing].map((e) => e.id),
      impactScore: 50,
      urgencyScore: 35,
      confidenceScore: Math.min(conf(present, 75), 55),
      aiFitScore: 60,
      recommendedSolution:
        `Before recommending any automation, collect acknowledgment records, response times and booking records for recent ${noun} inquiries. ` +
        'If they show slow or missed responses, AI-assisted intake (instant acknowledgment, structured intake, human handoff) is the matched fix; if they do not, no automation is needed here.',
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
