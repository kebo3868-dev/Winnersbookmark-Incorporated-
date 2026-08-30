import { mayClaimVerifiedBroken, type ProbeFailureKind } from './destination';
import type { EvidenceState } from './evidenceState';

/**
 * ORDERING CHANNEL CLASSIFICATION
 *
 * "Does this restaurant take orders?" and "can a customer order online?" are
 * different questions, and the audit was answering the first while reporting
 * the second. A restaurant whose ORDER button dials the phone takes orders
 * perfectly well — it has no online ordering. A restaurant with three delivery
 * apps has online ordering it does not own. Neither is "ordering is broken",
 * and neither is "ordering works".
 *
 * ── WHY A DISCOVERED 404 IS NOT A FINDING ───────────────────────────────────
 *
 * Vendor URLs turn up in widget configuration, in analytics payloads and in
 * dead markup left behind by a site redesign. A URL that appears in the HTML is
 * not automatically something a customer can click. Marking ordering broken
 * because a URL nobody is offered returned 404 reports a defect the restaurant
 * does not have — and it is the kind of error that gets noticed in the room,
 * during the sales call, by the owner.
 *
 * So a VERIFIED ordering failure requires all four of:
 *
 *   1. the destination is customer-facing (not an API, not an asset);
 *   2. the destination is actually exposed in the customer journey — found in
 *      the page markup a visitor receives, not merely supplied as a hint;
 *   3. the destination is intended for ordering;
 *   4. the user-facing destination demonstrably fails.
 *
 * Anything short of all four is downgraded, never asserted.
 */

export type OrderingChannelState =
  /** A customer can place an order online and that was positively verified. */
  | 'ONLINE_ORDERING_WORKING'
  /** Ordering is offered, by telephone. A real pathway — just not an online one. */
  | 'PHONE_ORDERING_ONLY'
  /** A customer-facing online ordering destination demonstrably fails. */
  | 'ONLINE_ORDERING_BROKEN_CONFIRMED'
  /** Ordering runs through third-party marketplaces. */
  | 'THIRD_PARTY_ORDERING'
  /** Something was seen, or nothing was; either way it is not resolved. */
  | 'ORDERING_PATH_UNCLEAR';

/** One ordering destination found on the site, with how it was found. */
export interface OrderingDestination {
  url: string;
  /**
   * True when the destination came from the served markup a visitor receives —
   * an anchor, an iframe, or a widget configuration the page itself carries.
   * False for an owner-supplied hint, which proves nothing about what a
   * customer is offered. This is requirement 2 above, made a data field so it
   * cannot be forgotten at a call site.
   */
  exposedInCustomerJourney: boolean;
  /** Named third-party platform operating the destination, when recognised. */
  platform: string | null;
  /** Host, used to count how many distinct platforms compete for order intent. */
  host: string;
  /**
   * Anchor text of the visible call-to-action that leads here, or null when the
   * destination was only read out of the page markup.
   *
   * This is the first link in the provenance chain a high-severity transaction
   * finding must carry: VISIBLE CTA → exact URL → HTTP test → outcome. A finding
   * that cannot name the CTA cannot claim a customer ever met the URL.
   */
  ctaText?: string | null;
  /** How the destination was found. Only VISIBLE_LINK proves customer exposure. */
  discoveredVia?: 'VISIBLE_LINK' | 'PAGE_MARKUP';
}

/** The result of testing one ordering destination. */
export interface OrderingProbe {
  url: string;
  finalUrl?: string;
  ok: boolean;
  httpStatus?: number;
  failureKind?: ProbeFailureKind;
  /** The destination's own page says ordering is switched off. */
  disabledSignal?: string;
  exposedInCustomerJourney: boolean;
}

export interface OrderingChannelInput {
  /** Anchor text of `tel:` links whose wording offers to take an order. */
  phoneOrderCtas: string[];
  destinations: OrderingDestination[];
  probes: OrderingProbe[];
  /** A vendor widget was detected but resolved no destination. */
  widgetVendor: string | null;
  /**
   * Set only when a future verification step actually completes an order flow.
   * Nothing in the current collector can set this, and that is deliberate: the
   * audit has no way to place a test order, so ONLINE_ORDERING_WORKING is
   * unreachable rather than guessed. Reachability is not functionality.
   */
  orderPlacementVerified?: boolean;
}

export interface OrderingChannelResult {
  state: OrderingChannelState;
  /** Claim strength this state licenses everywhere downstream. */
  evidenceState: EvidenceState;
  /**
   * Whether a real ordering destination was resolved from the page.
   *
   * Separates the two very different situations that both land in
   * ORDERING_PATH_UNCLEAR: a destination exists and could not be verified, or
   * no destination was found at all. The first is a reachable-but-unverified
   * pathway; the second is an absence, and scoring them alike would penalise a
   * dine-in restaurant for a pathway it never claimed to have.
   */
  destinationResolved: boolean;
  /** One sentence, already qualified to the evidence state. */
  summary: string;
  /** The reasoning, including the raw signals, for the evidence chain. */
  detail: string;
  /** Destinations that demonstrably failed, if any. Empty unless CONFIRMED. */
  failingUrls: string[];
}

/** Marker written into the evidence fact so downstream layers parse a token, not prose. */
export const ORDERING_CHANNEL_PREFIX = 'ORDERING CHANNEL:';

/** The parsed marker: everything a downstream layer needs, with no prose matching. */
export interface OrderingChannelMarker {
  state: OrderingChannelState;
  destinationResolved: boolean;
}

/**
 * Render the machine-readable marker that leads the evidence fact.
 *
 * Downstream layers parse this rather than the sentence after it, so report
 * copy can be rewritten without silently changing what the journey concludes.
 */
export function formatOrderingChannelFact(result: OrderingChannelResult): string {
  const resolved = result.destinationResolved ? ' [DESTINATION_RESOLVED]' : '';
  return `${ORDERING_CHANNEL_PREFIX} ${result.state}${resolved} — ${result.summary}`;
}

/** Read the channel marker back out of a stored evidence fact. Null when absent. */
export function parseOrderingChannelFact(fact: string): OrderingChannelMarker | null {
  const match = fact.match(/^ORDERING CHANNEL:\s*([A-Z_]+)(\s*\[DESTINATION_RESOLVED\])?/);
  if (!match) return null;
  const token = match[1] as OrderingChannelState;
  if (!ORDERING_CHANNEL_STATES.includes(token)) return null;
  return { state: token, destinationResolved: Boolean(match[2]) };
}

const ORDERING_CHANNEL_STATES: OrderingChannelState[] = [
  'ONLINE_ORDERING_WORKING',
  'PHONE_ORDERING_ONLY',
  'ONLINE_ORDERING_BROKEN_CONFIRMED',
  'THIRD_PARTY_ORDERING',
  'ORDERING_PATH_UNCLEAR',
];

/**
 * Marketplaces that take a commission and own the customer relationship.
 *
 * The distinction from a white-label ordering vendor is commercial, not
 * technical, and it decides whether the report may talk about commission
 * exposure at all. SpotHopper, Toast, Olo, Square, Clover and Menufy build the
 * restaurant's OWN ordering page — orders placed there are direct orders. Only
 * the marketplaces below sit between the restaurant and its customer, so only
 * they justify THIRD_PARTY_ORDERING.
 *
 * Calling a restaurant's own white-label ordering page "third-party ordering"
 * would put a commission conversation into a sales call about a restaurant that
 * pays no commission — a fabricated finding, arrived at by mislabelling.
 */
const MARKETPLACE_PLATFORMS = new Set([
  'DoorDash',
  'Uber Eats',
  'Grubhub',
  'Postmates',
  'Slice',
]);

/** True when a named platform is a marketplace rather than the restaurant's own stack. */
export function isMarketplacePlatform(platform: string | null): boolean {
  return platform !== null && MARKETPLACE_PLATFORMS.has(platform);
}

/**
 * Decide the ordering channel.
 *
 * Order of the branches is the priority order, and it is deliberate:
 *
 *   1. A demonstrated customer-facing failure outranks everything. It is the
 *      only finding here that costs the restaurant money right now.
 *   2. A destination whose own page says ordering is off is the same class of
 *      finding, reached a different way.
 *   3. Phone ordering outranks a resolved online destination, because what the
 *      customer is OFFERED outranks what the markup declares.
 *   4. Third-party marketplaces.
 *   5. Everything else is unclear, and says which kind of unclear it is.
 */
export function resolveOrderingChannel(input: OrderingChannelInput): OrderingChannelResult {
  const { phoneOrderCtas, destinations, probes, widgetVendor } = input;
  const destinationResolved = destinations.some((d) => d.exposedInCustomerJourney);

  // 1 — a demonstrated customer-facing failure. All four conditions, enforced.
  const confirmedFailures = probes.filter((probe) => {
    if (!probe.exposedInCustomerJourney) return false; // condition 2
    return mayClaimVerifiedBroken(probe).allowed; // conditions 1 and 4
  });
  if (confirmedFailures.length > 0) {
    // PROVENANCE CHAIN. Each failing destination is reported as
    // visible CTA → exact URL → HTTP test → outcome, so a reader can retrace
    // every step of a high-severity claim without leaving the report.
    const chain = confirmedFailures
      .map((probe) => {
        const destination = destinations.find((d) => d.url === probe.url);
        const cta = destination?.ctaText ? `visible link "${destination.ctaText}"` : 'visible ordering link';
        const resolved = probe.finalUrl && probe.finalUrl !== probe.url ? ` → resolves to ${probe.finalUrl}` : '';
        const test = typeof probe.httpStatus === 'number' ? `HTTP GET returned ${probe.httpStatus}` : 'HTTP GET could not connect';
        return `${cta} → ${probe.url}${resolved} → ${test} → ${mayClaimVerifiedBroken(probe).reason}`;
      })
      .join('; ');
    return {
      state: 'ONLINE_ORDERING_BROKEN_CONFIRMED',
      evidenceState: 'VERIFIED',
      destinationResolved: true,
      // Ends without a dead-end clause on purpose: the journey layer adds the
      // customer consequence, and having both produced the same sentence twice
      // in one card.
      summary: 'An online ordering destination that customers are offered on the website fails when opened.',
      detail:
        `${chain}. Verified against all four conditions: the destination is customer-facing, it is exposed in the ` +
        'customer journey through a visible link, it is intended for ordering, and it failed when opened.',
      failingUrls: confirmedFailures.map((p) => p.url),
    };
  }

  // 2 — reachable, but the destination itself says ordering is switched off.
  const switchedOff = probes.filter((p) => p.exposedInCustomerJourney && p.disabledSignal);
  if (switchedOff.length > 0) {
    return {
      state: 'ONLINE_ORDERING_BROKEN_CONFIRMED',
      evidenceState: 'VERIFIED',
      destinationResolved: true,
      summary: 'The online ordering destination loads but states that ordering is not available.',
      detail:
        switchedOff.map((p) => `${p.url} — ${p.disabledSignal}`).join('; ') +
        '. The page a customer arrives at says so itself, which is a customer-visible failure rather than an inference.',
      failingUrls: switchedOff.map((p) => p.url),
    };
  }

  // Positive verification. No current collector can set this; see the field doc.
  if (input.orderPlacementVerified === true) {
    return {
      state: 'ONLINE_ORDERING_WORKING',
      evidenceState: 'VERIFIED',
      destinationResolved: true,
      summary: 'A customer can place an order online; the ordering flow was completed end to end.',
      detail: 'Order placement was positively verified, not merely reached.',
      failingUrls: [],
    };
  }

  const exposed = destinations.filter((d) => d.exposedInCustomerJourney);

  // 3 — telephone precedence. What the customer is offered outranks markup.
  if (phoneOrderCtas.length > 0) {
    const ctas = phoneOrderCtas.slice(0, 3).map((t) => `"${t}"`).join(', ');
    return {
      state: 'PHONE_ORDERING_ONLY',
      evidenceState: 'VERIFIED',
      destinationResolved,
      summary:
        'Ordering is by telephone only: the ordering call-to-action places a phone call rather than opening an ' +
        'online ordering page. Telephone ordering is a legitimate ordering pathway, and it is not online ordering.',
      detail:
        `Call-to-action text ${ctas} linked to a telephone number. ` +
        (exposed.length > 0
          ? `An ordering destination is also declared in the page markup (${exposed[0].url}), but the action a customer ` +
            'is actually offered is the phone call, so the destination is recorded as context. Whether it is reachable ' +
            'for customers requires manual validation.'
          : 'No browser-based ordering destination was found alongside it.'),
      failingUrls: [],
    };
  }

  // 4 — third-party marketplaces carrying the order.
  // Only MARKETPLACES count. A white-label vendor builds the restaurant's own
  // ordering page, so orders placed there are direct orders — see
  // MARKETPLACE_PLATFORMS.
  const thirdParty = exposed.filter((d) => isMarketplacePlatform(d.platform));
  const distinctHosts = new Set(thirdParty.map((d) => d.host));
  if (thirdParty.length > 0) {
    const platforms = Array.from(new Set(thirdParty.map((d) => d.platform as string)));
    return {
      state: 'THIRD_PARTY_ORDERING',
      evidenceState: 'STRONG_EVIDENCE',
      destinationResolved: true,
      summary:
        distinctHosts.size >= 2
          ? `Online ordering runs through ${distinctHosts.size} third-party platforms, splitting order intent.`
          : `Online ordering runs through a third-party platform (${platforms[0]}).`,
      detail:
        `Platforms detected: ${platforms.join(', ')}. Hosts: ${Array.from(distinctHosts).slice(0, 5).join(', ')}. ` +
        'The links are present in the page markup; whether an order can be completed on them was not verified, so ' +
        'this describes who carries the order, not that ordering works.',
      failingUrls: [],
    };
  }

  // 5 — unclear, and specific about which kind.
  if (exposed.length > 0) {
    return {
      state: 'ORDERING_PATH_UNCLEAR',
      evidenceState: 'MANUAL_VALIDATION_REQUIRED',
      destinationResolved: true,
      summary: 'An online ordering destination is linked and reachable, but order placement was not verified.',
      detail:
        `Destination: ${exposed[0].url}. An ordering page with ordering switched off responds identically to a working ` +
        'one, so reaching it proves the page exists and nothing about whether an order can be placed.',
      failingUrls: [],
    };
  }
  // A destination WAS read out of the markup — an iframe, a data attribute, an
  // inline widget config. Checked BEFORE the widget-vendor branch, because
  // "here is the URL, exposure unproven" is strictly more useful than "a widget
  // is present and we could not resolve it" — and saying it could not be
  // resolved when it plainly was is simply untrue.
  const fromMarkup = destinations.filter((d) => d.discoveredVia === 'PAGE_MARKUP');
  if (fromMarkup.length > 0) {
    return {
      state: 'ORDERING_PATH_UNCLEAR',
      evidenceState: 'MANUAL_VALIDATION_REQUIRED',
      destinationResolved: false,
      summary:
        'An ordering destination is written into the page markup, but no visible link or button was found pointing ' +
        'customers to it, so whether anyone is offered it is unverified.',
      detail:
        `Destination declared in the markup: ${fromMarkup[0].url}. It was read out of an embedded widget, a data ` +
        'attribute or an inline script — none of which proves a customer is shown it. A stale URL left behind by a ' +
        'site redesign looks identical from the outside. Open the site in a browser and confirm whether an ordering ' +
        'button leads here before treating it as a customer pathway.',
      failingUrls: [],
    };
  }
  if (widgetVendor) {
    return {
      state: 'ORDERING_PATH_UNCLEAR',
      evidenceState: 'MANUAL_VALIDATION_REQUIRED',
      destinationResolved: false,
      summary: `A ${widgetVendor} ordering widget is present, but its destination is rendered in the browser and could not be resolved.`,
      detail:
        `${widgetVendor} assets are loaded by the site, so an ordering option may be presented to customers by a ` +
        'script this audit does not execute. This is not evidence that a working pathway exists, and not evidence that ' +
        'one is missing.',
      failingUrls: [],
    };
  }
  const unexposed = destinations.filter((d) => !d.exposedInCustomerJourney);
  return {
    state: 'ORDERING_PATH_UNCLEAR',
    evidenceState: unexposed.length > 0 ? 'MANUAL_VALIDATION_REQUIRED' : 'INSUFFICIENT_DATA',
    destinationResolved: false,
    summary:
      unexposed.length > 0
        ? 'An ordering destination was supplied but was not found anywhere in the website markup a customer receives.'
        : 'No online ordering pathway was detected on the analyzed website pages.',
    detail:
      unexposed.length > 0
        ? `Supplied destination: ${unexposed[0].url}. Because it is not exposed in the customer journey, its behaviour ` +
          'says nothing about what customers experience.'
        : 'The restaurant may be dine-in focused, or may take orders through a channel the public pages do not link to.',
    failingUrls: [],
  };
}
