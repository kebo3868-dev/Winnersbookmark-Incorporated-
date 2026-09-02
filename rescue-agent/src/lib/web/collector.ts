import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { Response as UndiciResponse } from 'undici';
import { validateUrlTarget, normalizeUrl } from '@/lib/validation/url';
import { safeFetchHop, readBodyCapped } from '@/lib/web/safeFetch';
import { classifyLinkRole, contributesToCustomerPathway } from '@/lib/web/linkTaxonomy';
import { classifyDestination, isMethodSemanticsRefusal, type DestinationKind, type ProbeFailureKind } from '@/lib/audit/destination';

export type LinkCategory =
  | 'menu'
  | 'reservation'
  | 'ordering'
  | 'contact'
  | 'location'
  | 'hours'
  | 'catering'
  | 'private_dining'
  | 'events'
  | 'gift_card'
  | 'loyalty'
  | 'faq'
  | 'about'
  | 'careers';

/**
 * A categorized customer pathway link.
 *
 * `source` records how the destination was obtained: `anchor` is an ordinary
 * <a href>, `embed` is a destination declared by an embedded widget (iframe
 * src, data-* URL attribute, or inline open handler). Both are real, publicly
 * served destinations — but the distinction is carried into the evidence so a
 * report never implies a visible link where the site only embeds a widget.
 */
export interface CategorizedLink {
  href: string;
  text: string;
  source: 'anchor' | 'embed';
}

export interface PageExtract {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  hasViewportMeta: boolean;
  hasStructuredData: boolean;
  /**
   * `name` values from schema.org Restaurant / LocalBusiness / Organization
   * blocks, in document order. The business stating its own name in a field it
   * maintains deliberately — the most authoritative identity signal a public
   * page carries, and the reason the audit no longer has to trust whatever an
   * operator typed into the intake form.
   */
  structuredNames: string[];
  /** `og:site_name`, then `og:title` — the next-best identity statements. */
  ogSiteName: string | null;
  ogTitle: string | null;
  /** First `<h1>`, used only when metadata yields no usable name. */
  h1: string | null;
  https: boolean;
  headings: string[];
  ctas: string[];
  phones: string[];
  clickToCallLinks: number;
  emails: string[];
  internalLinks: { href: string; text: string }[];
  categorizedLinks: Partial<Record<LinkCategory, CategorizedLink[]>>;
  /**
   * Links that credit the site's builder/vendor ("Powered by X") rather than
   * offering the customer an action. Kept separately and deliberately EXCLUDED
   * from categorizedLinks: a footer credit pointing at a booking vendor is not
   * a booking pathway, and treating it as one would report a working
   * reservation path that no customer can use.
   */
  vendorCredits: { href: string; text: string }[];
  /**
   * Hosts of <script src> and <iframe src> assets, captured before scripts are
   * stripped. A booking/ordering widget rendered by JavaScript leaves no anchor
   * in the static HTML; this is the only trace it was ever there.
   */
  assetHosts: string[];
  /**
   * Anchor text of `tel:` links whose wording offers ORDERING — "Order",
   * "Order Now", "Call to order", "Takeout".
   *
   * Recorded because excluding `tel:` from pathway links, while correct for
   * classification, threw away the page's clearest statement about how ordering
   * works. A site whose Order button dials the phone was left with only a
   * widget-configuration URL to judge by, and the audit told the owner they had
   * functioning online ordering while customers got a dialler.
   *
   * A phone number under "Call us" is not ordering intent and is not collected;
   * only wording that offers to take an order.
   */
  phoneOrderCtas: string[];
  socialLinks: string[];
  pdfLinks: string[];
  hoursText: string | null;
  addressText: string | null;
  emailCaptureSignal: boolean;
  smsCaptureSignal: boolean;
  loyaltySignal: boolean;
  giftCardSignal: boolean;
  textSample: string;
}

export type FetchOutcome =
  | { status: 'COLLECTED'; page: PageExtract }
  | { status: 'UNAVAILABLE' | 'BLOCKED' | 'TIMEOUT' | 'ERROR'; httpStatus?: number; note: string };

const USER_AGENT =
  'WinnersBookmarkRescueAgent/0.1 (+restaurant digital audit; public pages only; contact: audits@winnersbookmark.example)';

const FETCH_TIMEOUT_MS = 15_000;
const PROBE_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 2_500_000;

const CATEGORY_PATTERNS: Record<LinkCategory, RegExp> = {
  menu: /\bmenu(s)?\b|\bfood\b|\bdrinks?\b|\bwine[- ]?list\b/i,
  // `\bbook\b` catches a bare "Book Now" / "Book" CTA, which the previous
  // pattern missed: it required "booking" or the literal word "table".
  //
  // SpotHopper is deliberately ABSENT here. It supplies both reservations and
  // ordering, so matching on the hostname alone would file one link under both
  // categories and report an ordering pathway on a site that only takes
  // bookings. The vendor is identified separately (PLATFORM_PATTERNS,
  // WIDGET_ASSET_HOSTS); capability must come from the path or CTA intent.
  reservation: /reserv|booking|\bbook\b|book[- ]?(a[- ]?)?table|opentable|resy|tock|yelp.*reservations|sevenrooms/i,
  ordering: /order|takeout|take[- ]?out|pickup|pick[- ]?up|delivery|doordash|ubereats|grubhub|postmates|toasttab|chownow|slicelife|online[- ]?order/i,
  contact: /contact|get[- ]?in[- ]?touch/i,
  location: /location|directions|find[- ]?us|visit/i,
  hours: /\bhours\b|open[- ]?times/i,
  catering: /catering|cater\b/i,
  private_dining: /private[- ]?(dining|event|room|part)|group[- ]?dining|banquet/i,
  events: /\bevents?\b|happenings|calendar/i,
  gift_card: /gift[- ]?card|giftcard|e-?gift/i,
  loyalty: /loyalty|rewards?|vip[- ]?club|perks/i,
  faq: /\bfaqs?\b|frequently[- ]?asked/i,
  about: /\babout\b|our[- ]?story|history/i,
  careers: /careers?|jobs?|join[- ]?(our[- ]?)?team|hiring/i,
};

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

/**
 * Query parameters whose value NAMES the destination the link opens.
 *
 * Site builders route every call-to-action through one path and state the real
 * purpose only here — `/-party?source=pop_up&spot_id=78550&destination=private_parties`
 * is a private-party enquiry, not a table booking, however the button is
 * labelled. Deliberately narrow: `view`, `page` and `type` are excluded because
 * they routinely carry pagination and display values that name no destination.
 */
const DESTINATION_PARAM_KEYS = ['destination', 'dest', 'goto', 'target', 'action', 'widget', 'modal'];

/**
 * Normalize a URL fragment for pattern matching.
 *
 * Percent-encoding and `_`/`+` separators hide intent from the category
 * patterns: `destination=private_parties` never matched `private[- ]?part`
 * because `_` is neither a hyphen nor a space, and — being a word character —
 * it also defeats the `\b` boundaries. Decoding and flattening separators makes
 * the URL read the way the pattern expects.
 */
function matchable(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    /* malformed escape sequence — match against the raw value */
  }
  return decoded.replace(/[_+]+/g, ' ');
}

const ALL_CATEGORIES = Object.keys(CATEGORY_PATTERNS) as LinkCategory[];

/**
 * The category a URL DECLARES about itself through a destination parameter, or
 * null when it declares nothing.
 *
 * Exported because this precedence is a reporting rule, not an implementation
 * detail: when a URL states its destination, that statement outranks whatever
 * the anchor text happens to say.
 */
export function declaredDestination(url: URL): LinkCategory | null {
  for (const key of DESTINATION_PARAM_KEYS) {
    const raw = url.searchParams.get(key);
    if (!raw) continue;
    const token = matchable(raw);
    for (const category of ALL_CATEGORIES) {
      if (CATEGORY_PATTERNS[category].test(token)) return category;
    }
  }
  return null;
}

/**
 * Categories for one link.
 *
 * Two tiers, and the order between them is the fix for a link being filed as a
 * reservation because its button said "Book Now" while its URL said
 * `destination=private_parties`:
 *
 *   1. A declared destination wins. The URL's own statement of purpose is
 *      combined only with what the path and host structurally show, and the
 *      anchor text is ignored — generic CTA wording cannot add a category the
 *      destination contradicts.
 *   2. With nothing declared, path, host and anchor text are matched together,
 *      exactly as before.
 */
export function categorizeLink(url: URL, text: string): LinkCategory[] {
  const structural = matchable(`${url.pathname} ${url.search} ${url.hostname}`);
  const declared = declaredDestination(url);
  const categories = new Set<LinkCategory>();
  if (declared) categories.add(declared);
  const haystack = declared ? structural : `${structural} ${matchable(text)}`;
  for (const category of ALL_CATEGORIES) {
    if (CATEGORY_PATTERNS[category].test(haystack)) categories.add(category);
  }
  return Array.from(categories);
}

/**
 * Attributes that carry a destination URL for an element a script will turn
 * into a button. A JavaScript-rendered ordering widget leaves no anchor, but it
 * routinely leaves its destination here in the served HTML — which is the
 * difference between naming where the Order button leads and reporting that it
 * could not be resolved.
 */
const URL_ATTRIBUTES = [
  'data-href',
  'data-url',
  'data-link',
  'data-destination',
  'data-target-url',
  'data-order-url',
  'data-ordering-url',
  'data-reservation-url',
  'data-booking-url',
  'data-widget-url',
];

/** Inline handlers that open a destination: onclick="window.open('…')" and friends. */
const INLINE_URL_REGEX = /(?:window\.open|location\.(?:href|assign|replace)|location)\s*(?:=|\(\s*)\s*['"]([^'"]{1,300})['"]/gi;

/** Bound on embedded destinations kept per page — untrusted HTML sets no limit of its own. */
const MAX_EMBED_TARGETS = 50;

/**
 * Paths that are assets rather than destinations. A vendor bundle proves a
 * widget loads; it is never somewhere a customer can be sent, so resolving a
 * pathway from one would be exactly the false claim this audit must not make.
 */
const STATIC_ASSET_PATH = /\.(?:js|mjs|cjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|mp4|webm|map|json|xml|txt)$/i;

/**
 * URLs inside inline script bodies. Bounded so backtracking stays linear on
 * untrusted input.
 *
 * The scheme is optional because widget configuration routinely omits it:
 * `//www.spothopperapp.com/order-online/<slug>` is a destination, and matching
 * only `https?://` would skip it. A bare `//` also begins a JavaScript comment,
 * so this over-matches by design — the host guard in addWidgetDestination
 * discards anything that is not a vendor or first-party host, which makes a
 * matched comment harmless rather than a false pathway.
 */
const SCRIPT_URL_REGEX = /(?:https?:)?\/\/[^\s'"<>()\\,]{2,300}/g;

/**
 * JSON escapes its forward slashes, so a destination embedded in a config blob
 * arrives as `https:\/\/host\/order-online\/slug` and matches no URL pattern at
 * all. Unescaping first is what lets the scan see it.
 */
const JSON_ESCAPED_SLASH = /\\\//g;

/** Bound on inline script text scanned per page for declared destinations. */
const MAX_SCRIPT_SCAN = 200_000;

/**
 * Anchor text on a `tel:` link that offers to take an ORDER.
 *
 * Deliberately narrow. "Call us", "Contact", a bare phone number and location
 * links are all `tel:` too, and none of them says anything about ordering —
 * treating them as an ordering signal would suppress a genuine online ordering
 * pathway elsewhere on the page.
 */
const PHONE_ORDER_INTENT = /\border\b|\bordering\b|carry\s?out|take\s?out|to[-\s]?go|pick\s?up/i;

/** Anchor text that marks a link as a builder/vendor credit rather than a customer action. */
/**
 * Anchor text that may mark a builder/vendor credit.
 *
 * Necessary but NOT sufficient — see isVendorCredit. Phrases like "made by" and
 * "built by" are ordinary restaurant copy ("Pizza made by hand"), and treating
 * them alone as a credit would drop a real /menu link from every category and
 * from page discovery, causing the audit to report no menu exists.
 */
const VENDOR_CREDIT_TEXT = /powered by|website by|web(site)? design(ed)? by|built by|created by|made by|site by/i;

/**
 * A credit is credit-like text pointing OFF-SITE. A genuine builder credit
 * links to the builder; restaurant prose that happens to say "made by" links
 * within the restaurant's own site, so the off-site requirement separates them
 * without needing to guess at wording.
 */
function isVendorCredit(text: string, target: URL, siteHost: string): boolean {
  return VENDOR_CREDIT_TEXT.test(text) && target.hostname.toLowerCase() !== siteHost.toLowerCase();
}

export type WidgetCapability = 'reservation' | 'ordering';

/**
 * Third-party hosts whose presence indicates a booking/ordering widget may be
 * JS-rendered, and WHICH capability each vendor actually provides.
 *
 * The capability list matters: an OpenTable script is not evidence that online
 * ordering might exist, and a Toast script is not evidence of reservations.
 * Claiming otherwise would attach a "widget detected" explanation to a pathway
 * the vendor does not even offer.
 */
export const WIDGET_ASSET_HOSTS: [RegExp, string, WidgetCapability[]][] = [
  [/spothopper|spotapps/i, 'SpotHopper', ['reservation', 'ordering']],
  [/opentable/i, 'OpenTable', ['reservation']],
  [/resy\./i, 'Resy', ['reservation']],
  [/sevenrooms/i, 'SevenRooms', ['reservation']],
  [/tockhq|exploretock/i, 'Tock', ['reservation']],
  [/toasttab|toastweb/i, 'Toast', ['ordering']],
  [/chownow/i, 'ChowNow', ['ordering']],
  [/olo\.com/i, 'Olo', ['ordering']],
  [/doordash/i, 'DoorDash', ['ordering']],
  [/ubereats/i, 'Uber Eats', ['ordering']],
];

/**
 * Vendor providing `capability` among these asset hosts, or null.
 *
 * Scans every host rather than stopping at the first recognised vendor, so a
 * site loading both an OpenTable and a Toast widget resolves each category to
 * the vendor that actually serves it.
 */
export function detectWidgetVendor(assetHosts: string[], capability: WidgetCapability): string | null {
  for (const host of assetHosts) {
    for (const [pattern, name, capabilities] of WIDGET_ASSET_HOSTS) {
      if (pattern.test(host) && capabilities.includes(capability)) return name;
    }
  }
  return null;
}

// The leading lookbehind stops a match starting mid-number. The optional `1`
// country-code prefix is otherwise happy to begin on the last digit of a
// preceding number, so "FL 33701 (727)-367-4588" matched "1 (727)-367-4588" —
// eleven digits, read as +1, and the replacement ate the ZIP code's final digit.
const PHONE_REGEX = /(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;

/**
 * Normalise every phone-shaped substring inside a block of quoted page text.
 *
 * `formatPhoneNumber` fixes the numbers the audit EXTRACTS. It does nothing for
 * the numbers the audit QUOTES — an address snippet, a call-to-action label —
 * because those are copied out of the page verbatim. That gap is how
 * `(727)-367-4588` kept reaching the report after the extraction path was
 * already correct.
 *
 * Only the phone substring is rewritten; the surrounding words are left exactly
 * as the page wrote them, because the quote is evidence and must stay faithful.
 */
export function normalizePhonesInText(text: string): string {
  return text.replace(new RegExp(PHONE_REGEX.source, 'g'), (match) => formatPhoneNumber(match));
}

/**
 * One display shape for every phone number the audit reports.
 *
 * Pages punctuate numbers however they like — `(727)-367-4588`, `727.367.4588`,
 * `+1 727 367 4588`. Interpolating the raw match into a sentence that already
 * wraps it in brackets produced `((727)-367-4588)` on a client report.
 *
 * Ten digits become `(727) 367-4588`; eleven with a leading 1 become
 * `+1 (727) 367-4588`. Anything else is returned untouched with its whitespace
 * tidied — a number this cannot parse is still the restaurant's number, and
 * dropping it would be worse than printing it oddly.
 */
export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw.replace(/\s+/g, ' ').trim();
}
// Quantifiers are bounded so backtracking stays linear even on pathological
// multi-megabyte unbroken text runs (extraction regexes run on untrusted HTML).
const EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9-]{1,63}(?:\.[a-zA-Z0-9-]{1,63}){1,4}/g;
// Entity extraction scans at most this much visible text; contact details on
// real restaurant pages appear far earlier, and this bounds regex work.
const MAX_SCAN_TEXT = 300_000;
const HOURS_REGEX =
  /((mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*(–|-|to|through|thru)?\s*(mon|tue|wed|thu|fri|sat|sun)?[a-z]*\.?[:\s]*\d{1,2}(:\d{2})?\s*(am|pm)\s*(–|-|to)\s*\d{1,2}(:\d{2})?\s*(am|pm))/i;
// The lookbehinds stop the house number matching mid-token. Without them,
// "Mon - Sun 11:30 AM - 10:00 PM. 4801 37th Street South" starts the address at
// the "00" of "10:00", and the report quotes a snippet beginning "00 PM.".
//
// The colon guard is deliberately narrow: it rejects a colon that FOLLOWS A
// DIGIT, which is what a clock time looks like ("10:"). Rejecting every colon
// also threw away legitimate addresses written straight after a label, as in
// "Address:4801 37th Street South", where the colon follows a letter.
const ADDRESS_REGEX = /(?<![\d.])(?<!\d:)\d{1,6}\s+[A-Za-z0-9.'\- ]{3,40}\s(street|st\.?|avenue|ave\.?|boulevard|blvd\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|way|highway|hwy\.?|parkway|pkwy\.?|court|ct\.?|place|pl\.?)\b[^\n]{0,60}/i;

/** Stop a matched address at the first complete US ZIP or ZIP+4. */
function terminateAddressAtZip(address: string): string {
  const postalCode = address.match(/\b\d{5}(?:-\d{4})?(?![\d-])/);
  if (postalCode?.index === undefined) return address;
  return address.slice(0, postalCode.index + postalCode[0].length);
}

/**
 * Read visible text without collapsing adjacent DOM text nodes into one token.
 * Cheerio's `.text()` concatenates siblings verbatim, so separate elements such
 * as `pin</span><a>About us` became `pinAbout us` before whitespace cleanup.
 */
function textWithNodeBoundaries(root: AnyNode | undefined): string {
  if (!root) return '';
  const chunks: string[] = [];
  const visit = (node: AnyNode): void => {
    if (node.type === 'text') {
      const value = node.data;
      if (!value) return;
      const previous = chunks.at(-1) ?? '';
      const needsSeparator =
        previous.length > 0 &&
        !/\s$/.test(previous) &&
        !/^\s/.test(value) &&
        // `@` and `:` bind the tokens on either side of them. Splitting an
        // address at the `@` is a routine anti-scraper trick, and a separator
        // there turned "info@leverocks.com" into "info@ leverocks.com", which
        // matches no email pattern. The same for a time broken after its colon:
        // "11:" + "30" became "11: 30" and the page's hours stopped being found.
        !/[([{/'"“‘@:-]$/.test(previous) &&
        !/^[,.;:!?)}\]'"”’@-]/.test(value) &&
        // Two digit runs meeting at a node boundary are one number, not two
        // words. Separating them let three adjacent numeric cells — a price
        // grid, a nutrition table — satisfy the 3-3-4 grouping of PHONE_REGEX,
        // so the audit reported a phone number that appears nowhere on the page.
        // Joining them preserves the pre-existing "1234567890" behaviour exactly.
        !(/\d$/.test(previous) && /^\d/.test(value));
      if (needsSeparator) chunks.push(' ');
      chunks.push(value);
      return;
    }
    if ('children' in node) {
      for (const child of node.children) visit(child);
    }
  };
  visit(root);
  return chunks.join('');
}

type HopResult =
  | { kind: 'response'; response: UndiciResponse; finalUrl: string }
  | { kind: 'failure'; status: 'UNAVAILABLE' | 'BLOCKED' | 'TIMEOUT' | 'ERROR'; httpStatus?: number; note: string };

function classifyFetchError(error: unknown, timeoutMs: number): HopResult {
  const chain: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    chain.push(`${(current as NodeJS.ErrnoException).code ?? ''} ${current.name} ${current.message}`);
    current = current.cause;
  }
  const joined = chain.join(' | ');
  if (/EUNSAFEDEST|UNSAFE URL DESTINATION/.test(joined)) {
    return { kind: 'failure', status: 'BLOCKED', note: 'Destination rejected by safety policy: UNSAFE URL DESTINATION' };
  }
  if (/TimeoutError|UND_ERR_CONNECT_TIMEOUT|timeout/i.test(joined)) {
    return { kind: 'failure', status: 'TIMEOUT', note: `Request timed out after ${timeoutMs / 1000}s` };
  }
  return { kind: 'failure', status: 'UNAVAILABLE', note: `Network failure: ${joined.slice(0, 200)}` };
}

/**
 * Follow redirects manually so EVERY hop — including redirect targets from
 * untrusted sites — is re-validated against the SSRF policy before being
 * fetched. The underlying transport additionally re-checks resolved addresses
 * at connection time (see safeFetch.ts), closing DNS-rebinding gaps.
 * Never bypasses auth, captchas, or bot protection — a 401/403/429 is
 * recorded as BLOCKED, not worked around.
 */
async function followRedirectsSafely(rawUrl: string, timeoutMs: number, deadline?: number): Promise<HopResult> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Each hop gets its own timeout, so without an absolute deadline a redirect
    // chain could spend timeoutMs × (MAX_REDIRECTS + 1). Clamp every hop to the
    // time actually left so the whole call stays inside the audit budget. This
    // is checked before URL validation, which performs a DNS lookup.
    let hopTimeout = timeoutMs;
    if (deadline !== undefined) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return { kind: 'failure', status: 'TIMEOUT', note: 'Audit time budget exhausted before this request completed' };
      }
      hopTimeout = Math.min(timeoutMs, remaining);
    }
    const validation = await validateUrlTarget(currentUrl);
    if (!validation.ok) {
      return { kind: 'failure', status: 'BLOCKED', note: `Destination rejected by safety policy: ${validation.reason}` };
    }
    const target = validation.url.toString();
    let response: UndiciResponse;
    try {
      response = await safeFetchHop(target, {
        timeoutMs: hopTimeout,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      });
    } catch (error) {
      return classifyFetchError(error, hopTimeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      if (!location) return { kind: 'failure', status: 'ERROR', httpStatus: response.status, note: 'Redirect without location header' };
      currentUrl = new URL(location, target).toString();
      continue;
    }
    return { kind: 'response', response, finalUrl: target };
  }
  return { kind: 'failure', status: 'ERROR', note: `Exceeded ${MAX_REDIRECTS} redirects` };
}

/**
 * @param options.timeoutMs per-hop timeout (defaults to FETCH_TIMEOUT_MS)
 * @param options.deadline  absolute epoch ms the whole call must stay inside
 */
export async function fetchPage(
  rawUrl: string,
  options: { timeoutMs?: number; deadline?: number } = {},
): Promise<FetchOutcome> {
  const hop = await followRedirectsSafely(rawUrl, options.timeoutMs ?? FETCH_TIMEOUT_MS, options.deadline);
  if (hop.kind === 'failure') {
    const { kind: _kind, ...failure } = hop;
    return failure;
  }
  const { response, finalUrl } = hop;
  if (response.status === 401 || response.status === 403 || response.status === 429 || response.status === 503) {
    await response.body?.cancel().catch(() => {});
    return {
      status: 'BLOCKED',
      httpStatus: response.status,
      note: `Access restricted (HTTP ${response.status}). Bot protection or access control not bypassed.`,
    };
  }
  if (response.status >= 400) {
    await response.body?.cancel().catch(() => {});
    return { status: 'ERROR', httpStatus: response.status, note: `HTTP ${response.status}` };
  }
  const contentType = response.headers.get('content-type');
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
    await response.body?.cancel().catch(() => {});
    return { status: 'ERROR', httpStatus: response.status, note: `Unsupported content type: ${contentType.slice(0, 80)}` };
  }
  let body: Uint8Array;
  try {
    body = await readBodyCapped(response, MAX_BODY_BYTES);
  } catch (error) {
    return { status: 'ERROR', httpStatus: response.status, note: `Body read failed: ${String((error as Error)?.message ?? error).slice(0, 120)}` };
  }
  const html = new TextDecoder('utf-8', { fatal: false }).decode(body);
  return {
    status: 'COLLECTED',
    page: extractPage(rawUrl, finalUrl, response.status, contentType, html),
  };
}

export function extractPage(
  requestedUrl: string,
  finalUrl: string,
  httpStatus: number,
  contentType: string | null,
  html: string,
): PageExtract {
  const $ = cheerio.load(html);
  const base = new URL(finalUrl);

  // Capture third-party asset hosts BEFORE the scripts are stripped. A booking
  // or ordering widget injected by JavaScript never appears as an anchor, so
  // without this the audit cannot tell "no booking path exists" apart from
  // "a booking path exists but is rendered by a script we do not execute".
  const assetHosts = new Set<string>();
  $('script[src], iframe[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    try {
      const u = new URL(src, base);
      if (u.hostname && u.hostname !== base.hostname) assetHosts.add(u.hostname.toLowerCase());
    } catch {
      /* ignore unparseable src */
    }
  });

  // Destinations declared by embedded widgets, collected before the scripts go.
  // Knowing a widget is present is not the same as knowing where its button
  // leads; an iframe src or a data-* URL states the destination in the served
  // HTML, so it can be categorized and probed like any other pathway instead of
  // being reported as unresolvable.
  const embedTargets = new Map<string, string>();
  const addEmbedTarget = (raw: string | undefined, label: string) => {
    if (!raw || embedTargets.size >= MAX_EMBED_TARGETS) return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(trimmed)) return;
    try {
      const u = new URL(trimmed, base);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
      const normalized = normalizeUrl(u);
      if (!embedTargets.has(normalized)) embedTargets.set(normalized, label);
    } catch {
      /* not a URL — ignore */
    }
  };
  $('iframe[src]').each((_, el) => addEmbedTarget($(el).attr('src'), $(el).attr('title')?.trim() || '(embedded widget)'));
  for (const attribute of URL_ATTRIBUTES) {
    $(`[${attribute}]`).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120);
      addEmbedTarget($(el).attr(attribute), text || `(${attribute})`);
    });
  }
  $('[onclick]').each((_, el) => {
    const handler = $(el).attr('onclick') ?? '';
    const text = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120);
    for (const match of handler.matchAll(INLINE_URL_REGEX)) addEmbedTarget(match[1], text || '(button)');
  });

  // Destinations stated INSIDE widget markup and configuration.
  //
  // A vendor script proves a widget is present, never that a pathway exists —
  // so nothing here treats an asset, a bundle or branding as a pathway. What it
  // does is read destinations the vendor already states in the public HTML:
  // SpotHopper routinely names `/order-online/<slug>` or `/reservations/<slug>`
  // in the widget's own configuration, which is the difference between naming
  // where the Order button leads and reporting it as unresolvable.
  //
  // Three guards keep this honest, and all three must pass:
  //   1. Static bundles are rejected. `widget.js` is an asset, not a
  //      destination, and a vendor host alone must never resolve a pathway.
  //   2. The URL must categorize as reservation or ordering FROM ITSELF —
  //      categorizeLink is called with empty text, so no button label or
  //      surrounding copy can talk a URL into a category its path does not
  //      support.
  //   3. The host must be a known widget vendor or the site's own. Inline
  //      scripts carry analytics beacons whose query strings mention "order";
  //      without this an unrelated third-party URL could be reported as a
  //      customer ordering pathway.
  //
  // A destination that fails any guard is simply not collected, and the audit
  // continues to report UNKNOWN with the widget-detected reason attached.
  const isWidgetVendorHost = (hostname: string) =>
    WIDGET_ASSET_HOSTS.some(([pattern]) => pattern.test(hostname));

  const addWidgetDestination = (raw: string | undefined, label: string) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    let u: URL;
    try {
      u = new URL(trimmed, base);
    } catch {
      return;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    // Guard 1 — an asset is not a destination.
    if (STATIC_ASSET_PATH.test(u.pathname)) return;
    // Guard 3 — vendor or first-party only.
    const host = u.hostname.toLowerCase();
    if (!isWidgetVendorHost(host) && host !== base.hostname.toLowerCase()) return;
    // Guard 2 — the URL must declare the category by itself.
    const categories = categorizeLink(u, '');
    if (!categories.includes('reservation') && !categories.includes('ordering')) return;
    addEmbedTarget(trimmed, label);
  };

  $('script[src]').each((_, el) => addWidgetDestination($(el).attr('src'), '(widget script)'));

  let scriptScanned = 0;
  $('script:not([src])').each((_, el) => {
    if (scriptScanned >= MAX_SCRIPT_SCAN) return;
    const body = $(el).text() ?? '';
    const slice = body.slice(0, MAX_SCRIPT_SCAN - scriptScanned).replace(JSON_ESCAPED_SLASH, '/');
    scriptScanned += slice.length;
    for (const match of slice.matchAll(SCRIPT_URL_REGEX)) {
      // Trailing punctuation is part of the surrounding JS, not the URL.
      addWidgetDestination(match[0].replace(/[),;.'"\\]+$/, ''), '(widget configuration)');
    }
  });

  // Business identity, read BEFORE the scripts are stripped: schema.org
  // metadata lives inside <script type="application/ld+json">, which the next
  // line removes. Reading it after was why the audit never saw the site's own
  // statement of its name.
  const structuredNames = extractStructuredNames($);

  $('script, style, noscript').remove();
  const title = $('title').first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
  const ogSiteName = $('meta[property="og:site_name"]').attr('content')?.trim() || null;
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null;
  const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim() || null;
  const hasViewportMeta = $('meta[name="viewport"]').length > 0;
  const hasStructuredData = html.includes('application/ld+json') || $('[itemtype]').length > 0;

  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t && t.length <= 140 && headings.length < 40) headings.push(t);
  });

  const bodyText = textWithNodeBoundaries($('body').get(0)).replace(/\s+/g, ' ').trim().slice(0, MAX_SCAN_TEXT);

  const internalLinks: { href: string; text: string }[] = [];
  const socialLinks = new Set<string>();
  const pdfLinks = new Set<string>();
  const categorizedLinks: PageExtract['categorizedLinks'] = {};
  const vendorCredits: { href: string; text: string }[] = [];
  let clickToCallLinks = 0;
  const ctas: string[] = [];
  const phoneOrderCtas: string[] = [];

  $('a[href]').each((_, el) => {
    const hrefRaw = $(el).attr('href') ?? '';
    const text = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120);
    if (hrefRaw.startsWith('tel:')) {
      clickToCallLinks++;
      if (text && PHONE_ORDER_INTENT.test(text) && phoneOrderCtas.length < 10) phoneOrderCtas.push(text);
      return;
    }
    if (hrefRaw.startsWith('mailto:') || hrefRaw.startsWith('javascript:') || hrefRaw === '#') return;
    let abs: URL;
    try {
      abs = new URL(hrefRaw, base);
    } catch {
      return;
    }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;
    const absStr = normalizeUrl(abs);
    if (SOCIAL_HOSTS.test(abs.hostname)) {
      socialLinks.add(absStr);
      return;
    }
    if (/\.pdf(\?|$)/i.test(abs.pathname)) pdfLinks.add(absStr);

    // Who is this link FOR? A vendor credit, an agency's marketing page or a
    // privacy policy is not a customer pathway, and counting one as contact
    // health is how a footer credit ended up improving a restaurant's score.
    //
    // `selfCategories` is the URL judged with EMPTY anchor text, so a button
    // label can never talk a vendor's homepage into looking like an ordering
    // page. Matched on text and destination, deliberately not on being inside a
    // footer: plenty of restaurants put a real "Order Online" link in the
    // footer, and excluding by location would discard genuine pathways.
    const role = classifyLinkRole({
      href: absStr,
      text,
      siteHost: base.hostname,
      selfCategories: categorizeLink(abs, ''),
    }).role;
    if (!contributesToCustomerPathway(role)) {
      if (role === 'VENDOR_CREDIT' || role === 'DEVELOPER_PLATFORM') vendorCredits.push({ href: absStr, text });
      return;
    }

    // Query string included: booking and ordering widgets routinely carry the
    // intent there (?action=reservation, ?destination=private_parties) and
    // nowhere else — and a declared destination outranks the anchor text.
    for (const cat of categorizeLink(abs, text)) {
      (categorizedLinks[cat] ??= []).push({ href: absStr, text, source: 'anchor' });
    }
    if (abs.hostname === base.hostname && internalLinks.length < 200) {
      internalLinks.push({ href: absStr, text });
    }
  });

  // Embedded-widget destinations are categorized on the same rules, but never
  // enter internalLinks: they are destinations to classify and test, not pages
  // of this site to crawl.
  for (const [href, label] of embedTargets) {
    let abs: URL;
    try {
      abs = new URL(href);
    } catch {
      continue;
    }
    if (SOCIAL_HOSTS.test(abs.hostname)) continue;
    // Same taxonomy as the anchor loop: a widget-declared destination pointing
    // at the vendor's own marketing page is still the vendor's marketing page.
    const embedRole = classifyLinkRole({
      href,
      text: label,
      siteHost: base.hostname,
      selfCategories: categorizeLink(abs, ''),
    }).role;
    if (!contributesToCustomerPathway(embedRole)) continue;
    const categories = categorizeLink(abs, label);
    if (categories.length === 0) continue;
    const link: CategorizedLink = { href, text: label, source: 'embed' };
    for (const cat of categories) {
      const existing = (categorizedLinks[cat] ??= []);
      if (!existing.some((l) => l.href === href)) existing.push(link);
    }
  }

  $('a, button').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (!t || t.length > 60) return;
    if (/order|reserve|book|call|menu|directions|gift|join|sign[- ]?up|contact|deliver|pickup|cater/i.test(t) && ctas.length < 30) {
      ctas.push(t);
    }
  });

  // Formatted at extraction, so every downstream consumer — evidence facts, the
  // report, the PDF — shows one shape. A number scraped as "((727)-367-4588)"
  // reached a client report verbatim, and punctuation the page happened to carry
  // is not information about the restaurant.
  const phones = Array.from(new Set((bodyText.match(PHONE_REGEX) ?? []).map(formatPhoneNumber))).slice(0, 5);
  const emails = Array.from(new Set(bodyText.match(EMAIL_REGEX) ?? []))
    .filter((e) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(e))
    .slice(0, 5);
  const hoursMatch = bodyText.match(HOURS_REGEX);
  const addressMatch = bodyText.match(ADDRESS_REGEX);

  const formsHtml = $('form').text() + ' ' + ($('form input[type="email"]').length > 0 ? 'email-input' : '');
  const emailCaptureSignal =
    $('form input[type="email"]').length > 0 || /newsletter|join our (email|mailing) list|subscribe/i.test(bodyText);
  const smsCaptureSignal = /text club|sms club|join.{0,20}text|text .{0,10}to \d{5,6}/i.test(bodyText);
  const loyaltySignal = /loyalty|rewards program|vip club|earn points/i.test(bodyText) || Boolean(categorizedLinks.loyalty?.length);
  const giftCardSignal = /gift ?cards?/i.test(bodyText) || Boolean(categorizedLinks.gift_card?.length);
  void formsHtml;

  return {
    requestedUrl,
    finalUrl,
    httpStatus,
    contentType,
    title,
    metaDescription,
    hasViewportMeta,
    hasStructuredData,
    structuredNames,
    ogSiteName,
    ogTitle,
    h1,
    https: base.protocol === 'https:',
    headings,
    ctas: Array.from(new Set(ctas)),
    phones,
    clickToCallLinks,
    emails,
    internalLinks,
    categorizedLinks,
    vendorCredits: vendorCredits.slice(0, 10),
    assetHosts: Array.from(assetHosts).slice(0, 40),
    phoneOrderCtas,
    socialLinks: Array.from(socialLinks).slice(0, 10),
    pdfLinks: Array.from(pdfLinks).slice(0, 10),
    hoursText: hoursMatch ? hoursMatch[0].slice(0, 200) : null,
    addressText: addressMatch ? terminateAddressAtZip(addressMatch[0]).slice(0, 200) : null,
    emailCaptureSignal,
    smsCaptureSignal,
    loyaltySignal,
    giftCardSignal,
    textSample: bodyText.slice(0, 4000),
  };
}

/**
 * Business `name` values published as schema.org metadata.
 *
 * Walks JSON-LD (including `@graph` collections and nested `@type` arrays) plus
 * microdata, and keeps only names attached to a business type. A `name` on a
 * WebPage or a BreadcrumbList is the page's name, not the restaurant's, and
 * accepting one would replace a correct name with a section heading.
 *
 * Never throws: a site with malformed JSON-LD simply yields nothing and the
 * next identity source in the precedence list is used.
 */
const BUSINESS_SCHEMA_TYPES =
  /^(?:Restaurant|LocalBusiness|FoodEstablishment|BarOrPub|CafeOrCoffeeShop|Bakery|Brewery|Winery|NightClub|Organization|Corporation)$/i;

const MAX_STRUCTURED_NAMES = 5;
const MAX_JSONLD_NODES = 500;

function extractStructuredNames($: cheerio.CheerioAPI): string[] {
  const names: string[] = [];
  let visited = 0;

  const visit = (node: unknown): void => {
    if (names.length >= MAX_STRUCTURED_NAMES || visited >= MAX_JSONLD_NODES) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== 'object') return;
    visited += 1;
    const record = node as Record<string, unknown>;

    const rawType = record['@type'];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    const isBusiness = types.some((t) => typeof t === 'string' && BUSINESS_SCHEMA_TYPES.test(t));
    if (isBusiness && typeof record.name === 'string') {
      const value = record.name.replace(/\s+/g, ' ').trim();
      if (value && !names.includes(value)) names.push(value);
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') visit(value);
    }
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    if (names.length >= MAX_STRUCTURED_NAMES) return;
    const body = $(el).text();
    if (!body || body.length > 200_000) return;
    try {
      visit(JSON.parse(body));
    } catch {
      /* malformed JSON-LD — the next identity source is used */
    }
  });

  $('[itemtype]').each((_, el) => {
    if (names.length >= MAX_STRUCTURED_NAMES) return;
    const itemtype = $(el).attr('itemtype') ?? '';
    const type = itemtype.split('/').pop() ?? '';
    if (!BUSINESS_SCHEMA_TYPES.test(type)) return;
    const value = $(el).find('[itemprop="name"]').first().text().replace(/\s+/g, ' ').trim();
    if (value && !names.includes(value)) names.push(value);
  });

  return names;
}

/**
 * Probe a link (GET, body discarded) to verify it is not broken. Uses the same
 * manual redirect loop as fetchPage so every redirect hop is re-validated
 * against the SSRF policy — a public link that 302s to a private or
 * link-local address is rejected, not followed.
 */
/**
 * Probe a link and report where it ACTUALLY ends up.
 *
 * `finalUrl` is the destination after redirects, which is the difference
 * between "a button labelled Order Online exists" and "that button leads to
 * Toast". Redirects were already followed here; the result was simply thrown
 * away, so no evidence could ever name the real destination.
 */
export async function probeLink(
  url: string,
  options: { timeoutMs?: number; deadline?: number } = {},
): Promise<{
  ok: boolean;
  httpStatus?: number;
  note: string;
  finalUrl?: string;
  disabledSignal?: string;
  placeholderSignal?: string;
  /** Whether the destination tested is a page a customer can open, or a machine interface. */
  destinationKind: DestinationKind;
  /** Why the probe did not succeed, when it did not. */
  failureKind?: ProbeFailureKind;
  /** The destination exists and refused the audit's GET. Never a customer-facing failure. */
  methodNotAllowed?: boolean;
}> {
  const requestedKind = classifyDestination(url).kind;
  const hop = await followRedirectsSafely(url, options.timeoutMs ?? PROBE_TIMEOUT_MS, options.deadline);
  if (hop.kind === 'failure') {
    if (hop.status === 'BLOCKED' && /safety policy/.test(hop.note)) {
      return { ok: false, httpStatus: hop.httpStatus, note: hop.note, destinationKind: requestedKind, failureKind: 'BLOCKED' };
    }
    if (hop.status === 'TIMEOUT') {
      return { ok: false, note: 'Timed out', destinationKind: requestedKind, failureKind: 'TIMEOUT' };
    }
    return {
      ok: false,
      httpStatus: hop.httpStatus,
      note: hop.note,
      destinationKind: requestedKind,
      failureKind: typeof hop.httpStatus === 'number' ? 'HTTP' : 'NETWORK',
    };
  }
  const { response, finalUrl } = hop;
  // Classified on where the probe ACTUALLY ended up. A customer-facing link
  // that redirects into an API endpoint is an API endpoint by the time it
  // answers, and the status it returns has to be read that way.
  const destinationKind = classifyDestination(finalUrl).kind;

  // Read a bounded slice before discarding the rest. The body used to be
  // cancelled unread, which is why a booking page with reservations switched
  // off was indistinguishable from a working one: both return 200.
  const { disabled: disabledSignal, placeholder: placeholderSignal } = await readContentSignals(response);

  await response.body?.cancel().catch(() => {});
  const redirected = normalizeUrl(new URL(finalUrl)) !== normalizeUrl(new URL(url));
  const suffix = redirected ? ` (redirects to ${finalUrl})` : '';
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    return {
      ok: true,
      httpStatus: response.status,
      note: `Access-restricted destination (treated as reachable, not verified)${suffix}`,
      finalUrl,
      destinationKind,
    };
  }

  // HTTP METHOD SEMANTICS.
  //
  // 405 and 501 are the server saying it understood the address and refused the
  // VERB. The resource is there; this prober only speaks GET. Reading either as
  // a broken customer journey reports the audit's own limitation as the
  // restaurant's defect — which is exactly what happened when a SpotHopper
  // reservation API answered 405 and the audit declared bookings dead on a site
  // whose booking widget worked.
  //
  // Reported as reachable-but-unverified, never as reachable-and-working: the
  // downstream classification still requires manual validation.
  if (isMethodSemanticsRefusal(response.status)) {
    return {
      ok: true,
      httpStatus: response.status,
      note:
        `HTTP ${response.status} — the destination exists and does not accept GET requests; ` +
        `it was not verified from the customer's side${suffix}`,
      finalUrl,
      destinationKind,
      methodNotAllowed: true,
    };
  }

  return {
    ok: response.status < 400,
    httpStatus: response.status,
    note: `HTTP ${response.status}${suffix}`,
    finalUrl,
    destinationKind,
    ...(response.status >= 400 ? { failureKind: 'HTTP' as const } : {}),
    ...(disabledSignal ? { disabledSignal } : {}),
    ...(placeholderSignal ? { placeholderSignal } : {}),
  };
}

/**
 * Bound on probe body read. Disabled-booking notices sit in the visible copy
 * near the top of the page; this is enough to see them without pulling whole
 * pages through the audit's time budget.
 */
const MAX_PROBE_BODY_BYTES = 64_000;

/**
 * Phrases a destination uses to say the service is not currently available.
 *
 * ONLY EVER DOWNGRADES. Nothing here can promote a destination to HEALTHY — a
 * missed phrase leaves the honest RESOLVED_UNVERIFIED, while a matched phrase
 * moves it to RISK. That asymmetry is deliberate: the cost of missing a signal
 * is a vaguer report, and the cost of inventing one is a false claim.
 */
const SERVICE_DISABLED_PATTERNS: [RegExp, string][] = [
  [/not\s+(?:currently\s+)?(?:accepting|taking)\s+(?:online\s+)?(?:reservations|bookings|orders)/i, 'not accepting reservations/orders'],
  [/(?:reservations|bookings|online\s+ordering|online\s+orders)\s+(?:are\s+|is\s+)?(?:currently\s+)?(?:unavailable|disabled|not\s+available|closed|paused)/i, 'reservations/ordering unavailable'],
  [/no\s+(?:reservations|bookings)\s+available/i, 'no availability offered'],
  [/(?:reservations|online\s+ordering)\s+(?:have|has)\s+been\s+(?:disabled|turned\s+off)/i, 'service disabled'],
  [/this\s+(?:restaurant|venue|location)\s+is\s+not\s+(?:currently\s+)?accepting/i, 'venue not accepting'],
  // Ordering-specific wording. Same downgrade-only rule as the rest.
  [/(?:online\s+)?ordering\s+is\s+(?:currently\s+)?(?:closed|offline|suspended)/i, 'ordering closed'],
  [/(?:we\s+are|we're)\s+not\s+(?:currently\s+)?taking\s+(?:online\s+)?orders/i, 'not taking online orders'],
  [/order(?:ing)?\s+(?:is\s+)?temporarily\s+(?:unavailable|disabled|suspended)/i, 'ordering temporarily unavailable'],
];

/**
 * A menu destination that loads but has no menu on it yet.
 *
 * Kept separate from SERVICE_DISABLED_PATTERNS because the menu case is
 * genuinely different. Reservations and ordering are transactions the business
 * can switch off, so reachability proves nothing about them. Reading a menu is
 * not a transaction: a menu page that loads IS a working menu, which is why
 * MENU keeps HEALTHY rather than becoming unverified.
 *
 * The one real menu failure this misses is the placeholder — a page that loads
 * and says the menu is coming. That is friction, not a dead end, and it is the
 * only thing this list is for.
 */
const PLACEHOLDER_CONTENT_PATTERNS: [RegExp, string][] = [
  [/menu\s+(?:is\s+)?coming\s+soon/i, 'menu coming soon'],
  [/(?:our\s+)?(?:new\s+)?menu\s+will\s+be\s+(?:posted|available|added|up)\s+(?:soon|shortly)/i, 'menu not yet posted'],
  [/menu\s+(?:is\s+)?(?:currently\s+)?being\s+updated/i, 'menu being updated'],
  [/check\s+back\s+soon\s+for\s+(?:our\s+)?menu/i, 'menu pending'],
];

/**
 * Content-level signals read from a destination's own page.
 *
 * `disabled` — the service is switched off (reservations/ordering).
 * `placeholder` — the page loads but the content is not there yet (menu).
 *
 * Reads at most MAX_PROBE_BODY_BYTES of HTML. Any failure — non-HTML, unreadable
 * stream, malformed bytes — yields nothing, which leaves the destination
 * classified as reachable-but-unverified rather than asserting anything.
 *
 * Both signals ONLY EVER DOWNGRADE. Neither can promote a destination to
 * HEALTHY. Missing a phrase costs a vaguer report; inventing one costs a false
 * claim, and only one of those is acceptable.
 */
async function readContentSignals(
  response: UndiciResponse,
): Promise<{ disabled?: string; placeholder?: string }> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/i.test(String(contentType))) return {};
  const body = response.body;
  if (!body) return {};

  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = '';
    for await (const chunk of body) {
      text += decoder.decode(chunk as Uint8Array, { stream: true });
      if (text.length >= MAX_PROBE_BODY_BYTES) break;
    }
    const haystack = text.slice(0, MAX_PROBE_BODY_BYTES).replace(/<[^>]{0,2000}>/g, ' ').replace(/\s+/g, ' ');

    const find = (patterns: [RegExp, string][]) => {
      for (const [pattern, label] of patterns) {
        const match = pattern.exec(haystack);
        if (match) return `${label}: "${match[0].trim().slice(0, 120)}"`;
      }
      return undefined;
    };

    return { disabled: find(SERVICE_DISABLED_PATTERNS), placeholder: find(PLACEHOLDER_CONTENT_PATTERNS) };
  } catch {
    /* unreadable body — stays unverified, never asserted */
    return {};
  }
}
