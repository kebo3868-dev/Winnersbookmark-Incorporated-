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
const MAX_LENGTH = 80;

export function isPublishableRestaurantName(name: string | null | undefined): boolean {
  if (typeof name !== 'string') return false;
  const n = name.trim();
  if (!n || n.length > MAX_LENGTH) return false;
  if (MONEY_OR_RATE.test(n) || PERFORMANCE_CLAIM.test(n)) return false;
  if (mentionsAutomation(n)) return false;
  return isClaimFree(n);
}

/** The name to print on anything the restaurant or a prospect will read. */
export function clientRestaurantName(name: string | null | undefined, websiteUrl?: string | null): string {
  const display = safeDisplayName(name, websiteUrl);
  return isPublishableRestaurantName(display) ? display : safeDisplayName(null, websiteUrl);
}
