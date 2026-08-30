/**
 * RESTAURANT NAME RESOLUTION
 *
 * The restaurant is called Leverock's Great Seafood. Its own homepage says so,
 * in its title tag and in its structured data. The audit — and the PDF the
 * owner is handed — said "Leverocks Great Seafood".
 *
 * The apostrophe was never lost by the crawler: nothing read the site's own
 * statement of its name at all. The name came from whatever an operator typed
 * into the intake form, and an operator typing quickly does not reach for `'`.
 * A report that misspells the business on page one has already told the owner
 * how carefully it was made.
 *
 * ── PRECEDENCE ──────────────────────────────────────────────────────────────
 *
 *   1. Structured business metadata (schema.org Restaurant / LocalBusiness
 *      `name`). This is the business stating its own name in a machine-readable
 *      field it maintains deliberately.
 *   2. Authoritative homepage metadata — `og:site_name`, then `og:title`, then
 *      `<title>`.
 *   3. The homepage `<h1>`, when it reads like an identity rather than a slogan.
 *   4. The name the operator typed.
 *   5. The hostname, as a last resort.
 *
 * A weaker source is used only when every stronger one yields nothing usable.
 */

export type NameSource =
  | 'STRUCTURED_DATA'
  | 'OG_SITE_NAME'
  | 'OG_TITLE'
  | 'PAGE_TITLE'
  | 'HEADING'
  | 'USER_PROVIDED'
  | 'HOSTNAME';

export interface ResolvedName {
  name: string;
  source: NameSource;
  /** Why this source won, for the audit trail. */
  reason: string;
}

export interface NameCandidates {
  /** `name` values from schema.org Restaurant / LocalBusiness / Organization blocks. */
  structuredNames?: string[];
  ogSiteName?: string | null;
  ogTitle?: string | null;
  pageTitle?: string | null;
  h1?: string | null;
  userProvided?: string | null;
  hostname?: string | null;
}

/**
 * Separators a site uses between its name and a tagline.
 *
 * Only these, and only with surrounding whitespace. A bare hyphen with no
 * spaces is part of the name far more often than it is a separator
 * ("Chick-fil-A", "T-Bone Steakhouse"), and splitting on it would mutilate real
 * brands to solve a problem those sites do not have.
 */
const TITLE_SEPARATOR = /\s+[|–—·•]\s+|\s+-\s+|\s+::\s+/;

/**
 * Trailing fragments that are descriptions of a restaurant rather than its name.
 *
 * Used only to decide WHICH side of a separator is the name — never to edit the
 * name itself. Conservative on purpose: "Seafood" is in plenty of real
 * restaurant names, so a segment is only discarded when the OTHER segment also
 * looks like a name.
 */
const TAGLINE_MARKERS =
  /^(?:home|welcome|official site|official website|restaurant|menu|order online|book a table|reservations|best .+|.+ in [A-Z][a-z]+|serving .+|est\.? ?\d{4}|[a-z ,'&-]+ (?:restaurant|grill|bar|cafe|kitchen|seafood|steakhouse|pizzeria) in .+)$/i;

/**
 * Strings that are not a business name however they were obtained.
 *
 * A page whose title is "Home" tells the audit nothing, and using it would
 * replace a correct operator-typed name with a wrong one.
 *
 * ── WHY `null` IS IN THIS LIST ───────────────────────────────────────────────
 *
 * A live audit rendered the literal word "null" above the restaurant's URL on
 * the cover of a client report. The cause was not a null value: the site's CMS
 * had emitted `<meta property="og:site_name" content="null">`, so a four-letter
 * STRING called "null" flowed through every guard designed to catch an absent
 * one and became the business's name. Serialised junk values are ordinary
 * output from template engines, and they have to be rejected by content, not by
 * type.
 */
const NOT_A_NAME =
  /^(?:home|homepage|welcome|index|untitled|menu|about|contact|loading\.{0,3}|404|page not found|null|undefined|nan|n\/?a|none|false|true|0|-|—|\.+)$/i;

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;

/**
 * Normalize whitespace and typographic punctuation WITHOUT stripping anything
 * meaningful.
 *
 * The curly apostrophe is folded to a straight one so "Leverock’s" and
 * "Leverock's" are the same name; accents, ampersands, hyphens and the
 * apostrophe itself are preserved exactly. Nothing here removes a character a
 * business chose to have in its name.
 */
export function normalizeNameText(raw: string): string {
  return raw
    .replace(/[‘’ʼ՚]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function usable(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = normalizeNameText(value);
  if (cleaned.length < MIN_NAME_LENGTH || cleaned.length > MAX_NAME_LENGTH) return null;
  if (NOT_A_NAME.test(cleaned)) return null;
  return cleaned;
}

/**
 * Take the business name out of a page title, conservatively.
 *
 * "Leverock's Great Seafood | Waterfront Dining in St. Pete" → the first
 * segment. When no segment clearly reads as a tagline, the WHOLE title is kept
 * — a title with no separator, or one whose parts are all plausible names, is
 * safer left intact than guessed at.
 */
export function parseTitleForName(title: string): string | null {
  const cleaned = usable(title);
  if (!cleaned) return null;

  const segments = cleaned.split(TITLE_SEPARATOR).map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return cleaned;

  const named = segments.filter((s) => usable(s) && !TAGLINE_MARKERS.test(s));
  // Every segment looks like a tagline, or every segment looks like a name:
  // either way there is nothing to choose between them, so keep the title.
  if (named.length === 0) return cleaned;
  if (named.length === segments.length) return segments[0];
  return named[0];
}

/**
 * Resolve the restaurant's display name from everything known about it.
 *
 * Always returns a name: the hostname is the floor, so no caller has to handle
 * a null.
 */
export function resolveRestaurantName(candidates: NameCandidates): ResolvedName {
  for (const raw of candidates.structuredNames ?? []) {
    const name = usable(raw);
    if (name) {
      return { name, source: 'STRUCTURED_DATA', reason: 'schema.org business metadata published by the site' };
    }
  }

  const ogSite = usable(candidates.ogSiteName);
  if (ogSite) return { name: ogSite, source: 'OG_SITE_NAME', reason: 'og:site_name declared in the homepage metadata' };

  const ogTitle = candidates.ogTitle ? parseTitleForName(candidates.ogTitle) : null;
  if (ogTitle) return { name: ogTitle, source: 'OG_TITLE', reason: 'og:title declared in the homepage metadata' };

  const title = candidates.pageTitle ? parseTitleForName(candidates.pageTitle) : null;
  if (title) return { name: title, source: 'PAGE_TITLE', reason: 'homepage <title>, with any trailing tagline separated off' };

  const heading = usable(candidates.h1);
  if (heading) return { name: heading, source: 'HEADING', reason: 'homepage <h1> business identity' };

  const user = usable(candidates.userProvided);
  if (user) return { name: user, source: 'USER_PROVIDED', reason: 'name entered when the audit was requested' };

  const host = (candidates.hostname ?? '').replace(/^www\./, '');
  return {
    name: host || 'Unknown restaurant',
    source: 'HOSTNAME',
    reason: 'no business name was published on the site and none was entered',
  };
}

/**
 * LAST LINE OF DEFENCE before a name reaches a client's eyes.
 *
 * `resolveRestaurantName` runs once, at audit time, and writes to the database.
 * Report rendering happens later, from whatever is stored — a row written by an
 * older build, an import, or a manual edit. So the report layer cannot assume
 * the name it was handed went through the resolver, and a report that prints
 * "null" where a restaurant's name belongs has already lost the reader.
 *
 * Falls back to the website's domain, which is always true and never empty.
 * Deliberately dumb and total: it takes anything, including null and undefined,
 * and always returns something printable.
 */
export function safeDisplayName(name: string | null | undefined, websiteUrl?: string | null): string {
  const cleaned = typeof name === 'string' ? normalizeNameText(name) : '';
  if (cleaned && !NOT_A_NAME.test(cleaned)) return cleaned;

  const fallback = domainOf(websiteUrl);
  return fallback || 'Restaurant';
}

function domainOf(websiteUrl: string | null | undefined): string {
  if (!websiteUrl) return '';
  try {
    return new URL(/^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Should a stored name be replaced by a resolved one?
 *
 * True only when the resolved name comes from the site itself AND differs.
 * An operator-typed name is never overwritten by another operator-typed name,
 * and a resolved name identical to the stored one is not a change worth
 * recording in the evidence chain.
 */
export function shouldReplaceStoredName(stored: string | null, resolved: ResolvedName): boolean {
  if (resolved.source === 'USER_PROVIDED' || resolved.source === 'HOSTNAME') return false;
  if (!stored) return true;
  return normalizeNameText(stored) !== resolved.name;
}
