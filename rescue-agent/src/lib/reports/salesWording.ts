import { COMPANY } from '@/lib/config';
import { DIRECTIVE, ENDORSEMENT, IMPERATIVE_START, RECOMMENDS, mentionsAutomation, withoutSelfDescription } from './automationWording';

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
 * New briefs are written that way (sales.ts). Briefs already stored are
 * presented that way when loaded (salesData.ts): known historical wording is
 * replaced with the current wording, and any remaining field that still tells
 * the rep to recommend an automation without those conditions is withheld and
 * replaced with the rule. Stored records are never rewritten.
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
  'Withheld: this stored text recommended an automation without its required conditions. Do not recommend any automation. ' +
  `An automation may be proposed only as a limited, monitored pilot, ${SALES_AUTOMATION_GATE}.`;

const PRODUCT_TIERS = ['AI FRONT DESK SYSTEM', 'AI REACTIVATION CAMPAIGN'];

const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();
const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map(normalise).filter(Boolean);
/** "Minute 16–20 — Next step: …" → "Next step: …"; "• …" → "…". */
const stripLabel = (s: string) => s.replace(/^•\s*/, '').replace(/^[^—\n]{1,30}\s—\s(?=[A-Z])/, '');

/**
 * Sentences the brief itself writes about automation, approved by exact
 * wording: every one of them carries the conditions or withholds the
 * recommendation. A stored sentence is authorised by being one of these, never
 * by containing the right keywords.
 */
function approvedSentences(): Set<string> {
  const texts = [
    SALES_WITHHELD_NOTICE,
    salesAutomationObjectionStrategy(),
    ...PRODUCT_TIERS.flatMap((tier) => [salesOfferFor(tier), salesNextStepFor(tier)]),
  ];
  return new Set(texts.flatMap(sentencesOf));
}

/** Pitching, selling or proposing — the sales verbs a report screen does not need. */
const SALES_PUSH = /\b(pitch\w*|sell\w*|clos(e|es|ing) (on|with)|position\w*|push\w*|propos\w*|offer\w*|lead with|upsell\w*)\b/i;
/**
 * The product, in the brief's own words: a tier name, or "the system" — in a
 * Sales Brief that always means the product being sold.
 */
const TIER_NAME = /\bAI (FRONT DESK|REACTIVATION)\b|\bthe (system|product|tool|platform|solution)\b/i;
/** Endorsing the product to the owner without a recommending verb. */
const SALES_ENDORSEMENT = /\bexactly (the|what)\b|\b(is )?built (for|to absorb)\b|\babsorbs?\b|\bsolves?\b|\bthe answer\b/i;

/**
 * The sentences of a Sales Brief field that tell a rep to recommend, pitch or
 * endorse an automation without being one of the approved, conditional
 * sentences. Empty means the field is safe to show.
 */
export function unauthorisedSalesSentences(text: string): string[] {
  const approved = approvedSentences();
  return sentencesOf(text).filter((sentence) => {
    if (approved.has(stripLabel(sentence))) return false;
    const s = withoutSelfDescription(stripLabel(sentence));
    if (!(mentionsAutomation(s) || TIER_NAME.test(s))) return false;
    return RECOMMENDS.test(s) || DIRECTIVE.test(s) || IMPERATIVE_START.test(s) || ENDORSEMENT.test(s) || SALES_PUSH.test(s) ||
      SALES_ENDORSEMENT.test(s);
  });
}

/** Known stored wording, current only until this change, mapped to what is shown now. */
const HISTORICAL: [RegExp, (...groups: string[]) => string][] = [
  [
    /Next step: recommend (AI (?!DISCOVERY)[A-Z ]+?) and explain exactly why the evidence points there\. If their answers changed the picture, say that instead\. Book the follow-up before hanging up\./g,
    (_m, tier) => salesNextStepFor(tier),
  ],
  [
    /^Agree — being too busy is exactly the problem the system (?:absorbs|is built for)\. Reframe: [\s\S]*?Offer the \d+-minute review as zero-commitment proof, walking through their own audit evidence\.$/,
    () => salesAutomationObjectionStrategy(),
  ],
];

/** Fields a rep acts on. "likelyObjection" is the owner's own words, quoted, and is shown as stored. */
const SCREENED_FIELDS = new Set([
  'bestSalesAngle', 'topDiscoveryQuestion', 'discoveryQuestions', 'objectionStrategy', 'recommendedOffer',
  'outreachAngle', 'emailOpener', 'callOpener', 'talkTrack', 'followUpAngle',
]);

/**
 * One stored Sales Brief field, as a rep reads it: historical wording replaced,
 * a product tier offer made conditional, and anything still unconditional
 * withheld. Values of other fields are returned unchanged.
 */
export function presentSalesField(field: string, value: string): string {
  if (!SCREENED_FIELDS.has(field)) return value;
  let shown = value;
  if (field === 'recommendedOffer' && PRODUCT_TIER.test(shown.trim()) && !/— conditional, not a recommendation\./.test(shown)) {
    shown = salesOfferFor(shown.trim());
  }
  for (const [stored, current] of HISTORICAL) shown = shown.replace(stored, current as (...a: string[]) => string);
  if (field === 'talkTrack') {
    // Withhold line by line, so the rest of the agenda stays usable.
    return shown.split('\n').map((line) => (unauthorisedSalesSentences(line).length > 0 ? SALES_WITHHELD_NOTICE : line)).join('\n');
  }
  return unauthorisedSalesSentences(shown).length > 0 ? SALES_WITHHELD_NOTICE : shown;
}
