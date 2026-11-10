import type { PageExtract } from '@/lib/web/collector';
import type { ProbeResult } from '@/lib/audit/evidence';

/** One URL the audit will test, with where it came from and whether customers are shown it. */
export interface ProbeTarget {
  url: string;
  category: ProbeResult['category'];
  /**
   * Whether a customer is actually OFFERED this destination in the served
   * markup. An owner-supplied hint is not: a URL nobody is shown cannot
   * demonstrate anything about the customer journey, and treating one as proof
   * is how a discovered 404 became a reported ordering failure.
   */
  exposed: boolean;
  /** The URL came from the audit form, not the website. Carried on the ProbeResult so provenance is stated, never inferred. */
  supplied: boolean;
}

export interface ProbeTargetInput {
  pages: PageExtract[];
  reservationUrl?: string | null;
  orderingUrl?: string | null;
  /** URLs of pages the audit already collected; a link to one is not probed. */
  collectedUrls: { has(url: string): boolean };
}

/** At most this many targets per category, supplied ones included. */
const PER_CATEGORY = 2;

/**
 * The reservation, ordering and menu destinations to test, in order.
 *
 * Owner-supplied pathway URLs come first so they are never dropped. Page links
 * follow, reservation then ordering then menu, each address once (exact match:
 * a trailing-slash variant is a different address).
 */
export function buildProbeTargets(input: ProbeTargetInput): ProbeTarget[] {
  const targets: ProbeTarget[] = [];
  const seen = new Set<string>();
  const visible = visibleLinkUrls(input.pages);
  for (const [url, category] of [
    [input.reservationUrl, 'reservation'],
    [input.orderingUrl, 'ordering'],
  ] as const) {
    if (url && !seen.has(url)) {
      seen.add(url);
      // Issue #84. Each address is tested once, so a supplied URL that the page
      // ALSO shows as a visible link is the only test of that link. Queued as
      // "not offered to customers", a real 404 there became "could not be
      // verified" while the channel still called the link "linked and
      // reachable". When the collected pages show this exact address as a
      // visible link, customers are offered it: it is tested as customer-facing,
      // and stays marked supplied. Exact address only, as everywhere else.
      targets.push({ url, category, exposed: visible.has(url), supplied: true });
    }
  }
  for (const [category, key] of [
    ['reservation', 'reservation'],
    ['ordering', 'ordering'],
    ['menu', 'menu'],
  ] as const) {
    for (const page of input.pages) {
      for (const link of page.categorizedLinks[key] ?? []) {
        if (targets.filter((p) => p.category === category).length >= PER_CATEGORY) break;
        if (seen.has(link.href) || input.collectedUrls.has(link.href)) continue;
        seen.add(link.href);
        // Only a visible anchor proves a customer is offered this destination.
        // An `embed` source was read out of markup or widget config, which is
        // not the same thing — see the exposure note in evidence.ts.
        targets.push({ url: link.href, category, exposed: link.source === 'anchor', supplied: false });
      }
    }
  }
  return targets;
}

/**
 * Every address the collected pages show as a visible link (an anchor), in any
 * link category: a customer can click it whatever the audit files it under.
 * Embeds are excluded — read out of markup or widget config, they do not show
 * that a customer is offered the destination.
 */
function visibleLinkUrls(pages: PageExtract[]): Set<string> {
  const urls = new Set<string>();
  for (const page of pages) {
    for (const links of Object.values(page.categorizedLinks)) {
      for (const link of links ?? []) if (link.source === 'anchor') urls.add(link.href);
    }
  }
  return urls;
}
