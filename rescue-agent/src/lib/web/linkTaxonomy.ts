/**
 * LINK ROLE TAXONOMY
 *
 * Every link on a restaurant's site is there for someone. Most are for the
 * customer; a few are for the restaurant's suppliers, its lawyers, or the
 * agency that built the page. Counting the second group as customer pathways is
 * how an audit ends up reporting a healthy Contact experience for a site whose
 * only "contact" link is the footer credit of the company that built it.
 *
 * ── THE CASE THIS WAS WRITTEN FOR ───────────────────────────────────────────
 *
 * A footer carried `Website design` → `spothopperapp.com/...`. That is the
 * builder's marketing page. It answers no customer's question, takes no
 * booking, and reaches nobody at the restaurant — and it was raising the
 * restaurant's Contact-path health, which then raised its Rescue Score.
 *
 * The previous guard required the anchor text to contain the word "by"
 * ("powered by", "website by"), so `Website design` and `Marketing` slipped
 * straight through. Text alone was never going to be enough.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 * VENDOR_CREDIT and DEVELOPER_PLATFORM links can never contribute to any
 * customer pathway — not contact, not reservations, not ordering. A link to a
 * known platform host is only ever a customer pathway when the URL itself
 * declares a customer action (an `/order-online/…` or `/reservations/…` path);
 * the platform's own homepage or marketing page never is.
 */

export type LinkRole =
  /** Reaches a human at the restaurant, or answers a visit question. */
  | 'CUSTOMER_CONTACT'
  /** "Powered by", "Website design" — credits the builder, serves no customer. */
  | 'VENDOR_CREDIT'
  /** A social profile. */
  | 'SOCIAL'
  /** Privacy policy, terms, accessibility statement, cookie notice. */
  | 'LEGAL'
  /** A platform/agency/developer property that is not a customer action. */
  | 'DEVELOPER_PLATFORM'
  /** Ordinary movement around the restaurant's own site. */
  | 'NAVIGATION'
  /** Booking, ordering, gift cards — a customer spending money. */
  | 'TRANSACTIONAL'
  | 'UNKNOWN';

export interface LinkRoleResult {
  role: LinkRole;
  reason: string;
}

/**
 * Roles that must never count toward a customer pathway.
 *
 * Exported because it is the actual rule the collector and the evidence layer
 * both enforce; duplicating the membership test in two places is how the two
 * would eventually disagree.
 */
export const NON_CUSTOMER_ROLES: ReadonlySet<LinkRole> = new Set<LinkRole>([
  'VENDOR_CREDIT',
  'DEVELOPER_PLATFORM',
  'LEGAL',
]);

/** True when a link may contribute to a customer pathway of any kind. */
export function contributesToCustomerPathway(role: LinkRole): boolean {
  return !NON_CUSTOMER_ROLES.has(role);
}

/**
 * Anchor text that credits whoever built or markets the site.
 *
 * Broader than the previous pattern in two ways that matter: the trailing "by"
 * is now optional ("Website design", "Marketing"), and design/marketing/SEO
 * agency vocabulary is included. Breadth is safe here ONLY because a credit
 * also has to point off-site — see `classifyLinkRole`.
 */
const VENDOR_CREDIT_TEXT =
  /powered by|website by|web(site)?\s*design(ed)?(\s*by)?|built by|created by|made by|site by|designed by|developed by|development by|marketing by|marketing\s*(&|and)\s*design|restaurant marketing|digital marketing|seo\s*by|hosted by|a\s+\w+\s+website/i;

/**
 * Hosts that belong to site builders, restaurant-tech platforms and agencies.
 *
 * Presence here does NOT by itself demote a link. A `toasttab.com/…` ordering
 * page is a genuine customer destination; `toasttab.com/` on its own is the
 * vendor's front door. The distinction is made by whether the URL declares a
 * customer action, not by the hostname.
 */
const PLATFORM_HOSTS =
  /spothopperapp\.|spothopper\.|spotapps\.|bentobox|popmenu|squarespace|wix\.com|wixsite|godaddy|wordpress\.(com|org)|webflow|duda\.co|weebly|shopify|toasttab\.|toastweb|opentable\.|resy\.|sevenrooms|chownow|olo\.com|menufy|slicelife|clover\.com|squareup\.|godaddysites|sitejet|zenreach|tripleseat/i;

/**
 * Legal / policy destinations. Real, required, and not a customer pathway.
 *
 * `\bada\b` is bounded on BOTH sides deliberately: a one-sided boundary also
 * matches the tail of "Nevada", which would file a location page as a legal
 * notice.
 */
const LEGAL_TEXT_OR_PATH =
  /privacy|terms(\s*(of|&)\s*(use|service|sale))?|cookie|accessibility|\bada\b|disclaimer|legal|sitemap|do[- ]not[- ]sell/i;

/**
 * Vendor-property paths: the platform's own marketing, account and corporate
 * pages.
 *
 * Matched against the FIRST PATH SEGMENT ONLY, which is where a vendor's product
 * pages live (`/pricing`, `/restaurant-online-ordering/`) and where a customer
 * destination does not (`/order-online/<slug>`, `/reservations/<slug>`,
 * `/r/<slug>`). Matching the whole path would demote a real ordering page for a
 * restaurant called Design Bar; matching the first segment cannot.
 *
 * `restaurant-` prefixed slugs are the giveaway for this vendor's marketing
 * pages: `restaurant-online-ordering` is a page ABOUT online ordering sold to
 * restaurant owners, not a page a diner ever orders from. Those slugs name a
 * customer capability, so without this rule they were categorized as the
 * restaurant's own ordering and reservation pathways.
 *
 * `spothopperapp.com/spots/12345-leverocks` still stays a candidate pathway:
 * demoting an unrecognised restaurant-specific URL would throw away real
 * destinations to catch footer credits — the wrong trade in the wrong direction.
 */
const VENDOR_PROPERTY_SEGMENT =
  /^$|^restaurant-|^web-?site|^web-?design|^design$|^marketing|^seo$|^pricing|^features|^demo|^sign-?up|^signup|^login|^log-?in|^about|^contact|^blog|^careers|^partners|^press|^support|^help|^solutions|^products|^software|^platform|^why-|^for-restaurants/i;

/** The first path segment, which is what the vendor-property rule reads. */
function firstSegment(pathname: string): string {
  return pathname.split('/').filter(Boolean)[0] ?? '';
}

/** Ways a customer reaches a human at the restaurant, or resolves a visit question. */
const CUSTOMER_CONTACT_TEXT_OR_PATH =
  /contact|get[- ]in[- ]touch|reach[- ]us|email[- ]us|call[- ]us|\bhours\b|location|directions|find[- ]us|visit[- ]us/i;

/**
 * Social profile hosts, anchored to a HOST BOUNDARY.
 *
 * The unanchored form matched any hostname merely CONTAINING one of these —
 * `x\.com` matches `bentobox.com`, so a restaurant-tech vendor was filed as a
 * social profile and dropped out of every pathway check. A host pattern has to
 * be anchored or it is a substring search wearing a domain's clothes.
 */
const SOCIAL_HOSTS =
  /(^|\.)(?:facebook|instagram|twitter|x|tiktok|youtube|linkedin|pinterest)\.com$|(^|\.)threads\.net$|(^|\.)yelp\.[a-z]{2,4}$/i;

/** Link categories that mean a customer is transacting. */
const TRANSACTIONAL_CATEGORIES = new Set(['reservation', 'ordering', 'gift_card']);

/**
 * Classify one link by who it serves.
 *
 * `selfCategories` is what the URL declares about itself — the collector's own
 * categorizer run with EMPTY anchor text, so a button label can never talk a
 * vendor homepage into looking like an ordering page. Passing it in (rather
 * than computing it here) keeps this module free of a dependency cycle with the
 * collector.
 *
 * Never throws; an unparseable href is UNKNOWN.
 */
export function classifyLinkRole(input: {
  href: string;
  text: string;
  siteHost: string;
  selfCategories?: readonly string[];
}): LinkRoleResult {
  const { text, siteHost } = input;
  let url: URL;
  try {
    url = new URL(input.href);
  } catch {
    return { role: 'UNKNOWN', reason: 'link target could not be parsed' };
  }

  const host = url.hostname.toLowerCase();
  const offSite = host !== siteHost.toLowerCase() && host !== `www.${siteHost.toLowerCase()}`;
  const path = `${url.pathname} ${url.search}`;
  const declaresCustomerAction = (input.selfCategories ?? []).some((c) => TRANSACTIONAL_CATEGORIES.has(c));

  if (SOCIAL_HOSTS.test(host)) {
    return { role: 'SOCIAL', reason: 'points at a social platform profile' };
  }

  // A credit is credit-like wording pointing OFF-SITE. Restaurant prose that
  // happens to say "made by hand" links within the restaurant's own site, so
  // the off-site requirement separates the two without guessing at wording.
  if (offSite && VENDOR_CREDIT_TEXT.test(text)) {
    return { role: 'VENDOR_CREDIT', reason: `anchor text "${text.slice(0, 60)}" credits an off-site builder or agency` };
  }

  // A platform host whose first path segment is the vendor's own marketing or
  // account area is the vendor's front door however the link is labelled.
  //
  // This is checked BEFORE `declaresCustomerAction` on purpose. A page called
  // `/restaurant-online-ordering/` declares "ordering" perfectly well — it is a
  // sales page about ordering, aimed at the owner. Letting the declared action
  // win here is exactly how a vendor's marketing page became a restaurant's
  // ordering pathway.
  if (offSite && PLATFORM_HOSTS.test(host) && VENDOR_PROPERTY_SEGMENT.test(firstSegment(url.pathname))) {
    return {
      role: 'DEVELOPER_PLATFORM',
      reason: `points at the vendor's own property on ${host} rather than a customer destination`,
    };
  }

  if (declaresCustomerAction) {
    return { role: 'TRANSACTIONAL', reason: 'the URL itself declares a booking, ordering or gift-card action' };
  }

  if (LEGAL_TEXT_OR_PATH.test(text) || LEGAL_TEXT_OR_PATH.test(path)) {
    return { role: 'LEGAL', reason: 'policy or legal destination' };
  }

  if (CUSTOMER_CONTACT_TEXT_OR_PATH.test(text) || CUSTOMER_CONTACT_TEXT_OR_PATH.test(path)) {
    // "Contact" on a PLATFORM's domain reaches the platform, which is exactly
    // the mistake this taxonomy exists to stop. An off-site contact link on an
    // unrecognised domain is left alone: a restaurant group routinely puts its
    // contact page on a sister domain, and demoting that would trade one false
    // reading for another.
    if (offSite && PLATFORM_HOSTS.test(host)) {
      return { role: 'DEVELOPER_PLATFORM', reason: `contact wording pointing at the platform host ${host}; it does not reach the restaurant` };
    }
    return { role: 'CUSTOMER_CONTACT', reason: 'contact, hours or location destination' };
  }

  if (!offSite) return { role: 'NAVIGATION', reason: 'ordinary navigation within the restaurant site' };
  return { role: 'UNKNOWN', reason: 'off-site link with no recognised role' };
}
