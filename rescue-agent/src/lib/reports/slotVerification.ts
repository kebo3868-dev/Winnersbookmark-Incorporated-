import { EVIDENCE_TEMPLATES } from './generated/evidenceTemplates';
import { ENGINE_FINDING_CATEGORIES, ENGINE_NOTE_TEMPLATES } from './generated/observationTemplates';
import { JOURNEY_STAGES, JOURNEY_STATUSES, SCORE_CATEGORIES, EVIDENCE_TYPES } from './canonicalIdentifiers';
import { assessNarrative, isClaimFree } from './narrativePolicy';
import { mentionsAutomation } from './automationWording';
import { isPublishableRestaurantName } from './clientName';

/**
 * A TEMPLATE FRAME DOES NOT VERIFY WHAT WAS INTERPOLATED INTO IT.
 *
 * Review of 5bfac83: "Homepage title: "The AI Front Desk, a quantum leap for
 * the restaurant"." matched a real engine template, and the quoted value
 * passed a claim screen, so it was published. A matching frame proves only
 * that the engine writes sentences of that shape. Every interpolated value is
 * now verified on its own, against data, before it is shown:
 *
 *  - SOURCE_BOUND: a page title is shown only when it equals the pageTitle the
 *    collector stored for that evidence's own source page (AuditSource). Text
 *    the collector keeps no copy of (a meta description) is never shown.
 *  - BOUND_URL: a URL whose host is one of the audit's collected pages, the
 *    restaurant's own website, a URL the operator supplied at intake, or a
 *    named ordering, reservation or social platform (exact domain, not a
 *    substring).
 *  - STRUCTURED: a number, a count, an HTTP status, a phone number, an email
 *    address, or a street address in the restaurant's own city and state.
 *  - ENGINE_PHRASE: a probe note or phrase the collector or engine writes
 *    (generated from their source: probe notes and the return values of
 *    their string-returning helpers, e.g. "The address could not be resolved (no DNS
 *    record answered)"), with its own values verified as above.
 *  - VOCABULARY: a short label made only of words from a closed vocabulary —
 *    the engine's own audited evidence wording, standard navigation and hours words,
 *    the canonical identifiers, the named ordering and reservation platforms
 *    the engine detects, and the restaurant's own name and location —
 *    which also passes the narrative policy and the claim check. An
 *    endorsement needs words ("boon", "investment", "wonders", a product name)
 *    that the vocabulary does not contain; the vocabulary is an allowlist, not
 *    a list of forbidden words.
 *
 * A value that is none of these is not shown. Stored records are not changed.
 */

export interface CollectedSource {
  id: string;
  url: string;
  pageTitle?: string | null;
  sourceType?: string | null;
}
export interface PublicationContext {
  sources: CollectedSource[];
  restaurant: { name: string; websiteUrl?: string | null; city?: string | null; state?: string | null };
  /** URLs the operator supplied at intake (Audit.orderingUrlInput and the like): their hosts may be quoted, never linked. */
  suppliedUrls?: readonly (string | null | undefined)[];
}
export type SlotVerdict = 'SOURCE_BOUND' | 'BOUND_URL' | 'STRUCTURED' | 'VOCABULARY' | 'ENGINE_PHRASE';

/** Ordering, reservation, social and review platforms an evidence URL may name (exact domain or a subdomain of it). */
export const PLATFORM_DOMAINS = [
  'spothopperapp.com', 'spotapps.co', 'opentable.com', 'resy.com', 'sevenrooms.com', 'exploretock.com', 'tockhq.com',
  'yelp.com', 'toasttab.com', 'toast.com', 'doordash.com', 'ubereats.com', 'grubhub.com', 'postmates.com', 'chownow.com',
  'slicelife.com', 'olo.com', 'squareup.com', 'square.site', 'clover.com', 'menufy.com',
  'facebook.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'youtube.com', 'linkedin.com', 'pinterest.com',
  'tripadvisor.com', 'google.com', 'goo.gl',
] as const;

/** Words of standard navigation labels and opening hours. Audited by hand: no evaluative or product words. */
export const NAVIGATION_WORDS = [
  'order', 'orders', 'ordering', 'online', 'now', 'here', 'pickup', 'pick', 'up', 'delivery', 'deliver', 'takeout', 'take', 'out', 'to', 'go',
  'menu', 'menus', 'view', 'our', 'see', 'full', 'food', 'foods', 'drink', 'drinks', 'wine', 'wines', 'beer', 'beers', 'cocktail', 'cocktails',
  'bar', 'lunch', 'dinner', 'brunch', 'breakfast', 'dessert', 'desserts', 'kids', 'specials', 'special', 'happy', 'hour', 'hours',
  'book', 'booking', 'a', 'an', 'the', 'table', 'tables', 'reserve', 'reservation', 'reservations', 'call', 'calls', 'us', 'today', 'tonight',
  'inquire', 'inquiry', 'inquiries', 'enquire', 'contact', 'catering', 'cater', 'event', 'events', 'private', 'party', 'parties', 'dining',
  'plan', 'your', 'gift', 'card', 'cards', 'certificate', 'certificates', 'buy', 'shop', 'store', 'follow', 'on', 'like', 'facebook',
  'instagram', 'twitter', 'tiktok', 'youtube', 'yelp', 'google', 'maps', 'about', 'location', 'locations', 'directions', 'find', 'visit',
  'home', 'join', 'sign', 'newsletter', 'email', 'club', 'rewards', 'loyalty', 'careers', 'jobs', 'faq', 'faqs', 'info', 'more', 'learn',
  'page', 'and', 'or', 'of', 'for', 'with', 'at', 'in', 'by', 'from', 'me', 'my', 'site', 'website', 'web', 'link', 'links',
  'mon', 'tue', 'tues', 'wed', 'thu', 'thur', 'thurs', 'fri', 'sat', 'sun', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'saturday', 'sunday', 'am', 'pm', 'a.m', 'p.m', 'noon', 'midnight', 'closed', 'open', 'daily', 'thru', 'through', 'until', 'till',
  'weekdays', 'weekends', 'everyday', 'every', 'day',
] as const;

/** The ordering and reservation platforms the engine names (evidence.ts PLATFORM_PATTERNS). */
export const PLATFORM_NAMES = [
  'SpotHopper', 'OpenTable', 'Resy', 'SevenRooms', 'Tock', 'Yelp Reservations', 'Toast', 'DoorDash', 'Uber Eats', 'Grubhub',
  'Postmates', 'ChowNow', 'Slice', 'Olo', 'Square', 'Clover', 'Menufy',
] as const;

const SLOT_SOURCE = '([^\\n]{0,600}?)';
const literalWords = (pattern: string) =>
  pattern.split(SLOT_SOURCE).join(' ').replace(/\\(.)/g, '$1').toLowerCase().match(/[a-z][a-z'’]*/g) ?? [];

/** The engine's own audited evidence words, the navigation and hours words, the platform names and the canonical identifiers. */
const BASE_VOCABULARY: ReadonlySet<string> = new Set([
  // Evidence wording only: finding prose (titles, problems, impacts, journey
  // findings) discusses automation and value, and is not where page labels or
  // probe notes come from.
  ...EVIDENCE_TEMPLATES.flatMap((t) => literalWords(t.pattern)),
  ...NAVIGATION_WORDS,
  ...PLATFORM_NAMES.flatMap((n) => n.toLowerCase().split(/\s+/)),
  ...[...JOURNEY_STAGES, ...JOURNEY_STATUSES, ...SCORE_CATEGORIES, ...EVIDENCE_TYPES, ...ENGINE_FINDING_CATEGORIES].flatMap((s) =>
    s.toLowerCase().split(/[^a-z]+/).filter(Boolean),
  ),
]);

const words = (s: string) => s.toLowerCase().replace(/[’]/g, "'").match(/[a-z][a-z']*/g) ?? [];
const stripWww = (h: string) => h.toLowerCase().replace(/^www\./, '');
const hostOf = (u: string): string | null => {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:' ? stripWww(url.host) : null;
  } catch {
    return null;
  }
};

/** Hosts of the audit's collected pages, the restaurant's own website and the operator-supplied intake URLs. */
export function collectedHosts(ctx: PublicationContext): Set<string> {
  const hosts = new Set<string>();
  for (const s of ctx.sources) {
    const h = hostOf(s.url);
    if (h) hosts.add(h);
  }
  const site = ctx.restaurant.websiteUrl ? hostOf(ctx.restaurant.websiteUrl) : null;
  if (site) hosts.add(site);
  for (const u of ctx.suppliedUrls ?? []) {
    const h = u ? hostOf(u) : null;
    if (h) hosts.add(h);
  }
  return hosts;
}

/** A URL that may be quoted as data: a collected host, the restaurant's site, or a named platform. */
export function isBoundUrl(u: string, ctx: PublicationContext): boolean {
  const h = hostOf(u);
  if (!h || /\s/.test(u)) return false;
  if (collectedHosts(ctx).has(h)) return true;
  const bare = h.replace(/:\d+$/, '');
  return PLATFORM_DOMAINS.some((d) => bare === d || bare.endsWith(`.${d}`));
}

/**
 * A URL that may be shown as a clickable evidence link: one of the audit's
 * collected pages, or another page on the same host as one (a page of the
 * restaurant's own site the audit tested). Anything else is not linked.
 */
export function isLinkableUrl(u: string, ctx: PublicationContext): boolean {
  const h = hostOf(u);
  if (!h || /\s/.test(u)) return false;
  const norm = (x: string) => x.replace(/\/+$/, '');
  if (ctx.sources.some((s) => norm(s.url) === norm(u))) return true;
  return ctx.sources.some((s) => hostOf(s.url) === h);
}

const STRUCTURED = [
  /^\d{1,6}(?:[.,]\d{1,3})?%?$/, // a number, count or rating
  /^HTTP \d{3}$/, // an HTTP status
  /^(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/, // a North American phone number
  /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/, // an email address
];

/** A street address that names the restaurant's own city and state: "840 Pasadena Avenue South, St. Petersburg, FL 33707". */
function isOwnAddress(v: string, ctx: PublicationContext | undefined): boolean {
  const { city, state } = ctx?.restaurant ?? {};
  if (!city || !state) return false;
  const m = /^\d{1,6}[A-Za-z]?\s+[A-Za-z0-9 .'#-]{2,60},\s*([A-Za-z .'-]{2,40}),\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/.exec(v);
  return Boolean(m && m[1].trim().toLowerCase() === city.trim().toLowerCase() && m[2] === state.trim().toUpperCase());
}

/** The vocabulary for one audit: the base vocabulary plus the restaurant's own name and location. */
function vocabularyFor(ctx: PublicationContext | undefined): Set<string> {
  if (!ctx) return new Set(BASE_VOCABULARY);
  // The name is often read from the audited site, so its words widen the
  // allowlist only when the name itself passes the client-name screen.
  const name = isPublishableRestaurantName(ctx.restaurant.name) ? ctx.restaurant.name : '';
  const own = words([name, ctx.restaurant.city ?? '', ctx.restaurant.state ?? ''].join(' '));
  const v = new Set(BASE_VOCABULARY);
  for (const w of own) {
    v.add(w);
    v.add(w.replace(/'s$/, ''));
    v.add(w.replace(/'/g, ''));
  }
  return v;
}

const MAX_LABEL_WORDS = 24;

/** Whether a free-text value is made only of vocabulary words, numbers and times, and makes no claim. */
function vocabularyOnly(value: string, ctx: PublicationContext | undefined): boolean {
  const vocab = vocabularyFor(ctx);
  const tokens = value.split(/[\s|,;/()"“”—–\-:.&+!?*·•]+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > MAX_LABEL_WORDS) return false;
  for (const raw of tokens) {
    const t = raw.toLowerCase().replace(/[’]/g, "'").replace(/^'+|'+$/g, '');
    if (t === '') continue;
    if (/^\d+(?:[.:]\d+)*(?:am|pm|a|p|s|st|nd|rd|th)?$/.test(t)) continue;
      if (!vocab.has(t) && !vocab.has(t.replace(/'s$/, '')) && !vocab.has(t.replace(/s$/, ''))) return false;
  }
  // A quoted label that names an automation is never verified by vocabulary
  // alone: the evidence wording itself mentions detected automation, so its
  // words are in the vocabulary, but a label about one is not navigation.
  return !mentionsAutomation(value) && !/\bAI\b/i.test(value) && assessNarrative(value).safe && isClaimFree(value);
}

/** Which slots of which templates hold page text the collector keeps a copy of, or none of. */
export type SourceSlot = 'PAGE_TITLE' | 'UNCOLLECTED_PAGE_TEXT';
export function sourceSlotOf(evidenceType: string, field: 'fact' | 'supportingContext', pattern: string, slot: number): SourceSlot | null {
  if (evidenceType === 'BUSINESS_IDENTITY' && field === 'fact' && slot === 0 && pattern.startsWith('Homepage title: "')) return 'PAGE_TITLE';
  if (evidenceType === 'BUSINESS_IDENTITY' && field === 'supportingContext' && pattern.startsWith('Meta description: ')) return 'UNCOLLECTED_PAGE_TEXT';
  return null;
}

/**
 * The verdict for one interpolated value, or null when it cannot be verified.
 * `sourceTitle` is the pageTitle stored for the evidence's own source page.
 */
export function verifySlot(
  value: string,
  ctx: PublicationContext | undefined,
  sourceSlot: SourceSlot | null,
  sourceTitle: string | null,
  phrases = true,
): SlotVerdict | null {
  if (sourceSlot === 'UNCOLLECTED_PAGE_TEXT') return null;
  if (sourceSlot === 'PAGE_TITLE') {
    return sourceTitle !== null && value === sourceTitle && assessNarrative(value).safe ? 'SOURCE_BOUND' : null;
  }
  const v = value.trim();
  if (v === '') return 'STRUCTURED';
  if (STRUCTURED.some((re) => re.test(v)) || isOwnAddress(v, ctx)) return 'STRUCTURED';
  if (phrases && isEnginePhrase(v, ctx)) return 'ENGINE_PHRASE';
  // URLs, alone or in a list with the engine's own words ("<url> — works (HTTP 200)."):
  // every URL must be bound, and what is left must be vocabulary.
  const urls = v.match(/https?:\/\/[^\s,;]+/gi) ?? [];
  if (urls.length > 0) {
    if (!ctx || !urls.every((u) => isBoundUrl(u.replace(/[.)]+$/, ''), ctx))) return null;
    const rest = v.replace(/https?:\/\/[^\s,;]+/gi, ' ').trim();
    if (rest === '' || /^[\s,;.]+$/.test(rest)) return 'BOUND_URL';
    return vocabularyOnly(rest, ctx) ? 'BOUND_URL' : null;
  }
  return vocabularyOnly(v, ctx) ? 'VOCABULARY' : null;
}

const NOTE_PATTERNS = ENGINE_NOTE_TEMPLATES.map((p) => new RegExp(`^(?:${p})$`, 's'));

/** A probe note written by the collector or engine, whose own interpolated values verify. */
function isEnginePhrase(v: string, ctx: PublicationContext | undefined): boolean {
  const one = (text: string) =>
    NOTE_PATTERNS.some((re) => {
      const m = re.exec(text);
      return Boolean(m && m.slice(1).every((inner) => inner === undefined || verifySlot(inner, ctx, null, null, false) !== null));
    });
  if (one(v)) return true;
  // Several phrases written one after another: every sentence must be one.
  const sentences = v.split(/(?<=\.)\s+(?=[A-Z])/);
  return sentences.length > 1 && sentences.every(one);
}

/** Shown in place of a value that could not be verified. */
export const UNVERIFIED_VALUE = '[not verified]';
