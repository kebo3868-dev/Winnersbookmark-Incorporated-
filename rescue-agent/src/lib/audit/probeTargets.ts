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
  /** The target already queued for each address. */
  const queued = new Map<string, ProbeTarget>();
  for (const [url, category] of [
    [input.reservationUrl, 'reservation'],
    [input.orderingUrl, 'ordering'],
  ] as const) {
    if (url && !queued.has(url)) {
      // Issue #84. Each address is tested once, so a supplied URL that the page
      // ALSO links visibly was the only test of that link. Queued as "not
      // offered to customers", a real 404 there became "could not be verified"
      // while the channel still called the link "linked and reachable". When
      // the collected pages show this exact address as a visible link in the
      // SAME category as the field it was typed into, customers are offered it
      // for that purpose: it is tested as customer-facing, and stays supplied.
      // A visible link in another category (the menu link typed as the ordering
      // URL, an ordering link typed into the reservation field) does not make
      // the supplied test customer-facing: that would report a failure in a
      // category only the form field asserts. See the page loop below.
      const target: ProbeTarget = { url, category, exposed: visibleIn(input.pages, category, url), supplied: true };
      queued.set(url, target);
      targets.push(target);
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
        if (input.collectedUrls.has(link.href)) continue;
        const earlier = queued.get(link.href);
        // Each address once — except a visible page link whose address was only
        // queued as a supplied URL in a different category and not as
        // customer-facing. That test says nothing about this link as the page
        // offers it, so the link is tested here, under its own category, exactly
        // as it would be had the URL not been supplied (#84 review).
        if (earlier && !(earlier.supplied && !earlier.exposed && earlier.category !== category && link.source === 'anchor')) continue;
        const target: ProbeTarget = { url: link.href, category, exposed: link.source === 'anchor', supplied: false };
        // Only a visible anchor proves a customer is offered this destination.
        // An `embed` source was read out of markup or widget config, which is
        // not the same thing — see the exposure note in evidence.ts.
        queued.set(link.href, target);
        targets.push(target);
      }
    }
  }
  return targets;
}

/** Whether the collected pages show this exact address as a visible link (an anchor) in this category. */
function visibleIn(pages: PageExtract[], category: ProbeTarget['category'], url: string): boolean {
  return pages.some((page) => (page.categorizedLinks[category] ?? []).some((link) => link.source === 'anchor' && link.href === url));
}
