import { COMPANY } from '@/lib/config';
import { assessNarrative, sentencesOf } from './narrativePolicy';

/**
 * NO SALES REPRESENTATIVE IS TOLD TO RECOMMEND AN AUTOMATION UNCONDITIONALLY.
 *
 * The internal Sales Brief closed every talk track with "Next step: recommend
 * ${tier} and explain exactly why the evidence points there", listed the tier
 * as the "Recommended WBI Offer", and answered the busy-owner objection with
 * "being too busy is exactly the problem the system is built for" — so for a
 * product tier (AI Front Desk System, AI Reactivation Campaign) the rep was
 * told to recommend the product outright. An automation may be proposed only as
 * a limited, monitored pilot, and only after the restaurant's own records
 * document measurable demand, the system has completed its readiness and
 * safety validation for this restaurant, and the owner has explicitly approved
 * the pilot.
 *
 * Briefs are written that way (sales.ts), and a stored brief's text is never
 * shown: salesData.ts regenerates every narrative field from the stored audit
 * data when the brief is opened, then checks it against the shared narrative
 * policy (narrativePolicy.ts). Stored records are never rewritten.
 */

/** A product tier, not a validation step ("AI DISCOVERY AUDIT"). */
export const PRODUCT_TIER = /^AI (?!DISCOVERY)/i;

/** The conditions, as one clause completing "… a limited, monitored pilot …". */
export const SALES_AUTOMATION_GATE =
  "only after the restaurant's own records document measurable demand, the system has completed its readiness and safety " +
  'validation for this restaurant, and the owner has explicitly approved the pilot';

/** The "Recommended WBI Offer" row. A product tier is never shown as a plain recommendation. */
export function salesOfferFor(tier: string): string {
  if (!PRODUCT_TIER.test(tier)) return tier;
  return `${tier} — conditional, not a recommendation. It may be proposed only as a limited, monitored pilot, ${SALES_AUTOMATION_GATE}.`;
}

/** The talk track's closing instruction, after its agenda label ("Minute 16–20 — "). */
export function salesNextStepFor(tier: string): string {
  if (!PRODUCT_TIER.test(tier)) {
    return `Next step: recommend ${tier} and explain exactly why the evidence points there. If their answers changed the picture, say that instead. Book the follow-up before hanging up.`;
  }
  return `Next step: do not recommend the ${tier} on this call. It may be proposed only as a limited, monitored pilot, ` +
    `${SALES_AUTOMATION_GATE}. Until all of that is documented, recommend the ${COMPANY.reviewMinutes}-minute review to collect ` +
    'those records instead. Book the follow-up before hanging up.';
}

/** The busy-owner objection, when an automation is in the picture. No invented share of calls, no "exactly the problem". */
export function salesAutomationObjectionStrategy(): string {
  return 'Agree that their time is short. Explain what the system is designed to handle — the repetitive questions (hours, ' +
    'directions, FAQs, after-hours inquiries) — so staff keep the conversations that need a person, and that their own call ' +
    'records would show how much of the load that is. Nothing is proposed unless those records document measurable demand, ' +
    'the system completes its readiness and safety validation for this restaurant, and the owner explicitly approves a ' +
    `limited, monitored pilot. Offer the ${COMPANY.reviewMinutes}-minute review as zero-commitment proof, walking through ` +
    'their own audit evidence.';
}

/** Shown in place of a stored field that recommends an automation without its conditions. */
export const SALES_WITHHELD_NOTICE =
  'Withheld: this text recommended an automation without its required conditions. Do not recommend any automation. ' +
  `An automation may be proposed only as a limited, monitored pilot, ${SALES_AUTOMATION_GATE}.`;

/** The owner's objection the brief quotes when an automation is in the picture — their words, not an instruction. */
export const SALES_AUTOMATION_OBJECTION =
  '"We\'re too busy to set up new systems, and AI sounds complicated / impersonal for a restaurant."';

const PRODUCT_TIERS = ['AI FRONT DESK SYSTEM', 'AI REACTIVATION CAMPAIGN'];

/**
 * Sentences the brief itself writes about automation, approved by exact
 * wording: every one carries the conditions, withholds the recommendation, or
 * quotes the owner. Nothing is authorised by containing the right keywords.
 */
function approvedSentences(): Set<string> {
  const texts = [
    SALES_WITHHELD_NOTICE,
    SALES_AUTOMATION_OBJECTION,
    salesAutomationObjectionStrategy(),
    ...PRODUCT_TIERS.flatMap((tier) => [salesOfferFor(tier), salesNextStepFor(tier)]),
  ];
  return new Set(texts.flatMap(sentencesOf).map((t) => t.replace(/\s+/g, ' ').trim()));
}

/**
 * The sentences of one Sales Brief field that break the shared narrative
 * policy, read in context across the whole field ("The AI Front Desk is
 * available. It should be installed." fails on its second sentence). Empty
 * means the field may be shown.
 */
export function unauthorisedSalesSentences(text: string): string[] {
  return assessNarrative(text, { approved: approvedSentences() }).violations.map((v) => v.sentence);
}

/** One Sales Brief field as a rep may read it: as written, or withheld whole. */
export function presentSalesField(value: string): string {
  return unauthorisedSalesSentences(value).length > 0 ? SALES_WITHHELD_NOTICE : value;
}
