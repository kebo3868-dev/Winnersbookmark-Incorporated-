/**
 * THE RESTAURANT NAME ON A CLIENT REPORT MAKES NO CLAIM.
 *
 * The name printed on the cover, in the summary and in "Prepared for" is
 * usually read from the audited website itself (schema.org name, og:site_name,
 * the page title — see audit/restaurantName.ts), and it outranks the name the
 * operator typed. That made it the one piece of client-facing text the site
 * under audit controlled and nothing screened: a site naming itself
 * "Guaranteed $40,000 Lost Revenue Recovered" had that printed three times on
 * its own report (independent review of PR #79).
 *
 * A name is publishable only when it carries no money, percentage or
 * performance claim, no automation, and passes the same narrative checks as
 * every other quoted value. Otherwise the report uses the website's domain.
 * Real names with words like "Lost", "Best" or "Golden" are unaffected.
 */
import { safeDisplayName } from '@/lib/audit/restaurantName';
import { isClaimFree } from './narrativePolicy';
import { mentionsAutomation } from './automationWording';

const MONEY_OR_RATE = /[$€£¥%]|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s*(?:k|m|million|billion|percent|x)\b/i;
const PERFORMANCE_CLAIM =
  /\bguarantee[ds]?\b|\brevenue\b|\broi\b|\bprofit(?:s|able|ability)?\b|\brecover(?:ed|s)?\b|\bleak(?:s|ing|age)?\b|\b(?:lost|missed)\s+(?:sales|orders|customers|guests|bookings|revenue|calls)\b|\b(?:increase|boost|grow|double|triple|maximi[sz]e)[ds]?\s+(?:your\s+)?(?:sales|orders|revenue|bookings|customers|profits?)\b|\b(?:click|call|book|order)\s+now\b|\bfree\s+(?:audit|trial|consultation)\b/i;
/** Ratings, awards, offers and promises: a name states who the restaurant is, never how good or cheap it is. */
const PROMOTION =
  /#\s*\d|\bno\.?\s*1\b|\b\d(?:\.\d)?\s*-?\s*stars?\b|\b(?:top|best|highest)[\s-]+rated\b|\brated\b|\baward(?:s|-winning|\s+winning)?\b|\bnever\s+miss(?:es)?\b|\bproven\b|\bfree\s+(?:delivery|shipping|meal|food|drink|gift)\b|\border\s+online\b|\bcall\s+(?:us|today)\b|\b(?:dollars?|usd|refunds?|money|cash|savings?|discounts?|coupons?|deals?)\b|\bcosts?\s+you\b|\boff\b\s*$|\blimited\s+time\b|\b(?:best|lowest)\s+prices?\b/i;
/** A phone number, or a long run of digits (an amount written without separators). */
const NUMBER_CLAIM = /\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}|\d{5,}/;
/** Characters that do not display as themselves: zero-width, bidirectional controls, private use, unassigned. */
const HIDDEN = /[\p{Cf}\p{Co}\p{Cn}\p{Cc}]/u;
/**
 * A letter outside the ordinary Latin alphabet: other scripts (Cyrillic "е"
 * posing as "e") and unusual Latin forms (small capital "ʀ"). Basic Latin and
 * the accented letters of Latin-1 and Latin Extended-A/B are allowed.
 */
const NON_LATIN_LETTER = /(?![A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F])\p{L}/u;
/** A combining mark left after NFC (a joiner or variation selector riding on a letter). */
const COMBINING_MARK = /\p{M}/u;
/** Letters spelled out with spaces ("R e v e n u e"). */
const SPACED_LETTERS = /(?:^|\s)(?:\p{L}\s+){3,}\p{L}(?=\s|$)/u;
/** A slogan speaks to or for someone; a name does not. */
const PERSONAL = /\b(?:we|our|ours|us|you|your|yours)\b/i;
/** Losses, gains and frequencies ("Losing Thousands Every Month", "40 Grand", "30 More Tables Nightly"). */
const LOSS_OR_GAIN =
  /\b(?:los(?:e|es|ing)|thousands|millions)\b|\d+\s*(?:grand|thousand|million|k)\b|\d+\s+more\b|\b(?:every|per|a)\s+(?:day|night|week|month|year)\b|\b(?:nightly|monthly|weekly)\b/i;
/** Title-style separators: "Joe's - #1 rated", "Order Online | Joe's". */
const SEPARATOR = /\s+[|•·–—-]\s+|\s*\|\s*|\s*[•·]\s*|:\s+/;
const MAX_LENGTH = 80;

export function isPublishableRestaurantName(name: string | null | undefined): boolean {
  if (typeof name !== 'string') return false;
  const n = name.trim();
  if (!n || n.length > MAX_LENGTH) return false;
  // Lookalike and invisible characters are refused, not cleaned: a name that
  // needs them is not a name to print (independent review of PR #79).
  const nfc = n.normalize('NFC');
  if (HIDDEN.test(nfc) || COMBINING_MARK.test(nfc) || NON_LATIN_LETTER.test(nfc) || n.normalize('NFKC') !== nfc) return false;
  if (SEPARATOR.test(nfc) || SPACED_LETTERS.test(nfc)) return false;
  // Claim words are matched with accents removed: "Guarantéed" is "Guaranteed".
  const folded = nfc.normalize('NFD').replace(/\p{M}/gu, '');
  for (const pattern of [MONEY_OR_RATE, PERFORMANCE_CLAIM, PROMOTION, NUMBER_CLAIM, PERSONAL, LOSS_OR_GAIN]) {
    if (pattern.test(folded)) return false;
  }
  if (mentionsAutomation(folded)) return false;
  return isClaimFree(folded);
}

/**
 * The name to print on anything the restaurant or a prospect will read. A
 * title-style name ("Joe's Diner - Top Rated") keeps its first part when that
 * part passes on its own; otherwise the website's domain is shown.
 */
export function clientRestaurantName(name: string | null | undefined, websiteUrl?: string | null): string {
  const display = safeDisplayName(name, websiteUrl);
  if (isPublishableRestaurantName(display)) return display;
  const first = display.split(SEPARATOR)[0]?.trim();
  if (first && first !== display && isPublishableRestaurantName(first)) return first;
  return safeDisplayName(null, websiteUrl);
}
