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
  for (const [url, category] of [
    [input.reservationUrl, 'reservation'],
    [input.orderingUrl, 'ordering'],
  ] as const) {
    if (url && !seen.has(url)) {
      seen.add(url);
      targets.push({ url, category, exposed: false, supplied: true });
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
