import { ORDER_BUTTON_CATEGORY } from '@/lib/audit/orderButtonFinding';
import { isExploratoryOpportunity, presentOpportunitySolution, presentRecommendedSolution } from './automationWording';

/**
 * EVERY RECOMMENDATION A CLIENT READS IS AN AUDITED TEMPLATE.
 *
 * Fail-closed release design. Screening free text for safety kept leaking —
 * every review found another phrasing — so for this release no
 * recommendation is shown because a screen judged it safe:
 *
 * - A finding's recommended solution is shown only when its stored text is,
 *   word for word, one of the engine strings audited here for that category
 *   (current or historical), in its audited presented form. Anything else —
 *   an unknown historical variant, edited text, anything — is replaced with
 *   the category's audited fallback. The stored record is not changed.
 * - Copy the report computes at render time from the finding's own evidence
 *   (the order-button finding) is deterministic and used as computed.
 * - Exploratory opportunities (catering) always get the exploratory template.
 * - The package recommendation (tier and rationale) is shown only for a known
 *   tier with an audited rationale; an unknown rationale gets the tier's
 *   audited default, and an unknown tier is shown as the validation step.
 *
 * tests/recommendation-templates.test.ts checks that every recommendation the
 * current engine produces is in this list, so engine changes cannot silently
 * fall back.
 */

/** Whitespace, and the old two-word brand spelling some stored records carry, normalised. */
const ws = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/^Winners ?[Bb]ookmark\b/, 'Winnersbookmark');

const BROKEN_LINK = 'Fix the broken link(s) immediately. This is a direct website repair, not an AI project.';
const PHONE_CURRENT =
  'Before any system: pull 30 days of call records — total calls, unanswered calls, and the most common reasons. ' +
  'If that shows high repetitive volume, the Winnersbookmark AI Front Desk (voice answering, missed-call text-back, ' +
  'FAQ automation, after-hours capture) is the matched fix. If it does not, this is not a problem worth solving.';
const RETENTION_CURRENT =
  'First check whether a list already exists in your POS or reservation system — if it does, this is a publishing gap, not a data gap. ' +
  'If it does not, a visible email/SMS capture offer is the starting point, and an AI Reactivation Campaign only becomes worth discussing once there is a list to reactivate.';
const cateringCurrent = (noun: string) =>
  `Before recommending any automation, collect acknowledgment records, response times and booking records for recent ${noun} inquiries. ` +
  'If they show slow or missed responses, AI-assisted intake (instant acknowledgment, structured intake, human handoff) is the matched fix; if they do not, no automation is needed here.';
const MENU_PDF = 'Publish the menu as a mobile-friendly HTML page (keep the PDF as secondary). Basic optimization — no AI required.';
const MENU_MISSING = 'Add a prominent menu page and navigation link. Verify manually that no menu exists behind an undetected pathway.';
const CTA_MISSING = 'Add a clear primary action above the fold on the homepage. Basic optimization.';
const CTA_UNCLEAR =
  'Open the homepage on a phone and name the single action you want a first-time visitor to take. If it is not ' +
  'obvious within a second, demote the rest. Confirm against analytics before treating this as a conversion problem.';
const TECHNICAL = 'Fix hosting/SSL and mobile viewport configuration. Direct web work — no AI required.';
const CONTACT =
  'Publish hours and address in the site header/footer as text (not images). Verify manually — this information may exist in a format collection could not read.';
const THIRD_PARTY = 'Establish one primary direct-order path and demote third-party links. Quantify commission exposure in discovery.';
const ORDER_BUTTON_GENERIC =
  "Decide which experience is intended. If online ordering should be offered, point the button at the restaurant's online ordering page. " +
  'If orders are taken by phone, relabel the section — for example "Order by Phone" — so the button does what it says. ' +
  'After the change, tap the button on a phone to confirm it behaves as intended. A direct website fix, not an AI project.';
const MENU_GENERIC =
  'Make the menu easy to reach and read on a phone: a menu page linked from the main navigation, published as a mobile-friendly ' +
  'page. Verify manually which version guests see.';
const GENERIC = "Review this finding with the owner against the restaurant's own records before making any change.";

/** Per category: the audited stored strings, and the fallback for anything else. */
const CATEGORY_TEMPLATES: { category: RegExp; audited: string[]; fallback: string }[] = [
  { category: /^(BROKEN CUSTOMER PATHWAY|ONLINE ORDERING FAILURE RISK)$/, audited: [BROKEN_LINK], fallback: BROKEN_LINK },
  {
    category: new RegExp(`^${ORDER_BUTTON_CATEGORY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    audited: [
      // orderButtonFinding.ts, with each of its three address steps.
      ...['', ', and complete or remove the unfinished ordering address in the page code', ', and check the unlinked ordering address in the page code'].map(
        (addressStep) =>
          `Decide which experience is intended. If online ordering should be offered, point the button at the restaurant's online ordering page — setting one up first if none exists${addressStep}. ` +
          'If orders are taken by phone, relabel the section — for example "Order by Phone" — so the button does what it says. ' +
          'After the change, tap the button on a phone to confirm it behaves as intended. A direct website fix, not an AI project.',
      ),
      // Earlier wording, with and without the declared-page note.
      ...['', ' (the markup already declares one, which needs checking)'].map(
        (declared) =>
          `Decide which experience is intended. If online ordering should be offered, finish setting up the online ordering page${declared}` +
          ' and point the button at it. If orders are taken by phone, relabel the section — for example "Order by Phone" — so' +
          ' the button does what it says. Then tap the button on a phone to confirm. A direct website fix, not an AI project.',
      ),
    ],
    fallback: ORDER_BUTTON_GENERIC,
  },
  {
    category: /PHONE-DEPENDENT/,
    audited: [
      PHONE_CURRENT,
      'Winnersbookmark AI Front Desk System: AI voice receptionist, missed-call text-back, FAQ automation, and after-hours lead capture. Validate call volume in a discovery call first.',
    ],
    fallback: PHONE_CURRENT,
  },
  {
    category: /RETENTION/,
    audited: [
      RETENTION_CURRENT,
      'Add a visible email/SMS capture offer, then run an AI Reactivation Campaign once a list exists. Verify in discovery whether an internal POS database already exists.',
    ],
    fallback: RETENTION_CURRENT,
  },
  {
    category: /CATERING|PRIVATE/,
    audited: [
      ...['catering and private-event', 'catering', 'private-event', 'event'].map(cateringCurrent),
      'AI-assisted lead capture and qualification for event inquiries (instant acknowledgment, structured intake, human handoff). Validate current response times in discovery.',
    ],
    fallback: cateringCurrent('private-event'),
  },
  { category: /^MENU ACCESS FRICTION$/, audited: [MENU_PDF, MENU_MISSING], fallback: MENU_GENERIC },
  {
    category: /^CONFUSING CTA HIERARCHY$/,
    audited: [CTA_MISSING, CTA_UNCLEAR, 'Restructure homepage CTA hierarchy: one primary action above the fold, secondary actions demoted. Basic optimization.'],
    fallback: CTA_UNCLEAR,
  },
  { category: /^WEBSITE TECHNICAL FOUNDATION$/, audited: [TECHNICAL], fallback: TECHNICAL },
  { category: /^CONTACT PATH FRICTION$/, audited: [CONTACT], fallback: CONTACT },
  { category: /^THIRD-PARTY ORDERING DEPENDENCY$/, audited: [THIRD_PARTY], fallback: THIRD_PARTY },
];

/** Every audited stored string, for the drift test. */
export function auditedSolutionsFor(category: string): string[] {
  return CATEGORY_TEMPLATES.find((t) => t.category.test(category))?.audited ?? [];
}

/**
 * The recommendation a finding card shows. `computedFromEvidence` is true when
 * the report itself just computed the text from the finding's evidence
 * (deterministic code, not stored text).
 */
export function presentFindingRecommendation(
  opp: { category: string; aiFitScore: number; recommendedSolution: string },
  computedFromEvidence = false,
): string {
  if (isExploratoryOpportunity(opp)) return presentOpportunitySolution(opp);
  if (computedFromEvidence) return presentRecommendedSolution(opp.category, opp.recommendedSolution);
  const template = CATEGORY_TEMPLATES.find((t) => t.category.test(opp.category));
  if (!template) return GENERIC;
  const stored = ws(opp.recommendedSolution);
  const audited = template.audited.find((a) => ws(a) === stored);
  return presentRecommendedSolution(opp.category, audited ?? template.fallback);
}

// ── The package recommendation ──────────────────────────────────────────────

const DISCOVERY_DEFAULT =
  "The findings above need validating against the restaurant's own records — calls, follow-up, guest lists — before any system " +
  'recommendation is honest. Discovery confirms the numbers first.';
const TIERS: Record<string, { audited: string[]; fallback: string }> = {
  'AI DISCOVERY AUDIT': {
    audited: [
      'Public analysis found no confirmed high-priority leaks, but the highest-risk areas (call volume, follow-up, retention) are invisible from outside. A discovery audit verifies them with internal data before recommending any system.',
      'Multiple priority findings require internal validation (call volume, response times, customer database) before a system recommendation is honest. Discovery confirms the numbers first.',
    ],
    fallback: DISCOVERY_DEFAULT,
  },
  'BASIC OPTIMIZATION': {
    audited: [
      'Every priority finding is a direct website or content fix. No AI system is justified by current evidence — fix the fundamentals first.',
      'The priority findings are best solved with focused website and conversion fixes before any automation investment.',
    ],
    fallback: 'The priority findings are best solved with focused website and conversion fixes before any automation investment.',
  },
  'AI FRONT DESK SYSTEM': {
    audited: [
      'The public evidence raises open questions about phone and inquiry demand that the AI Front Desk System (voice receptionist, missed-call text-back, FAQ automation, lead capture) is designed for. It is a potential improvement, not a fix for a measured problem: no missed calls or lost revenue have been measured, so call and inquiry records should confirm the demand before it is installed.',
      'The evidence shows a phone-dependent journey with lead-capture gaps — exactly the friction the AI Front Desk System (voice receptionist, missed-call text-back, FAQ automation, lead capture) is built to absorb.',
    ],
    fallback:
      'The public evidence raises open questions about phone and inquiry demand that the AI Front Desk System (voice receptionist, missed-call text-back, FAQ automation, lead capture) is designed for. It is a potential improvement, not a fix for a measured problem: no missed calls or lost revenue have been measured, so call and inquiry records should confirm the demand before it is installed.',
  },
  'AI REACTIVATION CAMPAIGN': {
    audited: ['The dominant gap is customer retention and follow-up. A reactivation campaign converts the existing customer base into repeat visits.'],
    fallback: 'The dominant gap is customer retention and follow-up. A reactivation campaign converts the existing customer base into repeat visits.',
  },
};

/** The known tiers. Anything else is shown as the validation step. */
export const KNOWN_TIERS = Object.keys(TIERS);

/**
 * The entry for a known tier, by own property only. A stored tier such as
 * "constructor", "toString" or "__proto__" would otherwise find an inherited
 * Object property, and the report and PDF would throw instead of taking the
 * validation-step fallback (Codex review of d7f5fd2, P2).
 */
function knownTier(tier: string): (typeof TIERS)[keyof typeof TIERS] | undefined {
  return Object.prototype.hasOwnProperty.call(TIERS, tier) ? TIERS[tier as keyof typeof TIERS] : undefined;
}

/**
 * The stored package recommendation, reduced to a known tier and an audited
 * rationale. The caller presents it (presentTierRecommendation) as before.
 */
export function auditedTierRecommendation(stored: { tier: string; rationale: string } | null): { tier: string; rationale: string } | null {
  if (!stored) return null;
  const known = knownTier(stored.tier.trim());
  if (!known) return { tier: 'AI DISCOVERY AUDIT', rationale: DISCOVERY_DEFAULT };
  const rationale = known.audited.find((a) => ws(a) === ws(stored.rationale)) ?? known.fallback;
  return { tier: stored.tier.trim(), rationale };
}

/** A stored tier, or the validation step when it is not one this release knows. */
export function auditedTier(tier: string | null | undefined): string {
  return tier && knownTier(tier.trim()) ? tier.trim() : 'AI DISCOVERY AUDIT';
}
