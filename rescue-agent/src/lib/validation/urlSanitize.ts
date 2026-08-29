/**
 * URL INPUT SANITIZATION
 *
 * A URL copied out of a browser, a PDF, a chat message or a spreadsheet
 * routinely arrives carrying characters nobody typed and nobody can see. The
 * audit that prompted this module received:
 *
 *     https://leverocks.com/%E2%81%A0
 *
 * `%E2%81%A0` is the UTF-8 encoding of U+2060 WORD JOINER — an invisible
 * formatting character that rode along with the copy. The site is fine; the
 * path is not. The crawler asked for a page that does not exist, got 404, and
 * the audit reported a website failure against a healthy restaurant.
 *
 * ── THE RULE THIS MODULE FOLLOWS ─────────────────────────────────────────────
 *
 * Remove only what cannot legitimately form the intended URL. An over-eager
 * sanitizer that mangles an internationalized domain or strips a meaningful
 * query value trades a visible 404 for a silent wrong answer, which is worse.
 * So the removals below are limited to invisible formatting characters, and
 * every removal is reported back for the audit trail.
 */

/** A single class of character removed from the input, kept for diagnostics. */
export interface SanitizationRemoval {
  /** `U+2060` style code point label. */
  codePoint: string;
  name: string;
  count: number;
}

export type UrlSanitizationResult =
  | {
      ok: true;
      /** Exactly what the operator supplied, untouched. */
      raw: string;
      /** Canonical URL to persist, crawl, and display. */
      normalized: string;
      /** The parsed canonical URL, so callers do not re-parse. */
      url: URL;
      removals: SanitizationRemoval[];
      /** True when sanitization actually altered the input. */
      changed: boolean;
    }
  | { ok: false; raw: string; reason: string; removals: SanitizationRemoval[] };

/**
 * Invisible formatting characters that never legitimately form part of a URL an
 * operator meant to type.
 *
 * ZWNJ (U+200C) and ZWJ (U+200D) are deliberately NOT in this table. IDNA2008
 * permits both inside internationalized domain labels under contextual rules,
 * so removing them unconditionally would silently rewrite a legitimate host.
 * They are handled by ZERO_WIDTH_JOINERS below, under a narrower rule.
 */
const ALWAYS_INVISIBLE: [string, string][] = [
  ['\u200B', 'ZERO WIDTH SPACE'],
  ['\u2060', 'WORD JOINER'],
  ['\uFEFF', 'ZERO WIDTH NO-BREAK SPACE / BYTE ORDER MARK'],
  ['\u00AD', 'SOFT HYPHEN'],
  ['\u180E', 'MONGOLIAN VOWEL SEPARATOR'],
  ['\u200E', 'LEFT-TO-RIGHT MARK'],
  ['\u200F', 'RIGHT-TO-LEFT MARK'],
  ['\u061C', 'ARABIC LETTER MARK'],
  ['\u2061', 'FUNCTION APPLICATION'],
  ['\u2062', 'INVISIBLE TIMES'],
  ['\u2063', 'INVISIBLE SEPARATOR'],
  ['\u2064', 'INVISIBLE PLUS'],
];

/**
 * Removed only when the input is otherwise pure ASCII.
 *
 * A URL with no non-ASCII characters anywhere is not an internationalized one,
 * so a zero-width joiner in it is a paste artifact with no possible meaning.
 * The moment real non-ASCII text is present the URL might genuinely be
 * internationalized, and these are left alone rather than risk rewriting a host
 * the audit was asked to visit.
 */
const ZERO_WIDTH_JOINERS: [string, string][] = [
  ['\u200C', 'ZERO WIDTH NON-JOINER'],
  ['\u200D', 'ZERO WIDTH JOINER'],
];

/** UTF-8 percent-encoding of a single character, upper-cased. */
function percentEncode(char: string): string {
  return Array.from(new TextEncoder().encode(char))
    .map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`)
    .join('');
}

/**
 * Tab, LF and CR are stripped from anywhere in the input rather than rejected.
 *
 * This is what the WHATWG URL parser does, and it is what a browser does with a
 * URL pasted across a line break. Every OTHER control character is a hard
 * reject — a URL is a single line of text, and a NUL or an escape sequence
 * inside one means the input is not the thing it claims to be.
 */
const STRIPPED_CONTROLS = /[\t\n\r]/g;
const REMAINING_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

/** Whitespace trimmed from the ends, including the Unicode spaces a paste can carry. */
const SURROUNDING_WHITESPACE = /^[\s\u00A0 \u2000-\u200A\u202F\u205F\u3000]+|[\s\u00A0 \u2000-\u200A\u202F\u205F\u3000]+$/g;

/**
 * Sanitize, validate and canonicalize a URL supplied by an operator.
 *
 * Order matters and each step exists for a reason:
 *   1. Trim surrounding whitespace — including non-breaking and Unicode spaces.
 *   2. Strip tab/LF/CR anywhere, then reject any remaining control character.
 *   3. Unicode-normalize to NFC, so visually identical inputs canonicalize the
 *      same way. None of the characters removed below are affected by NFC, so
 *      normalizing first is safe.
 *   4. Remove invisible formatting characters, in both literal and
 *      percent-encoded form. The percent-encoded form matters most: a URL
 *      copied out of a browser has already been through a URL parser, so
 *      U+2060 arrives as `%E2%81%A0` and no literal-character filter would
 *      ever see it.
 *   5. Parse, defaulting a missing scheme to https, and reject anything that is
 *      not http(s) or has no usable hostname.
 *   6. Canonicalize: lower-cased host, no fragment, no bare trailing slash.
 *
 * Never throws.
 */
export function sanitizeUrlInput(raw: string): UrlSanitizationResult {
  const removals: SanitizationRemoval[] = [];
  if (typeof raw !== 'string') return { ok: false, raw: String(raw ?? ''), reason: 'INVALID WEBSITE URL', removals };

  let value = raw.replace(SURROUNDING_WHITESPACE, '');
  if (!value) return { ok: false, raw, reason: 'INVALID WEBSITE URL', removals };

  const beforeControls = value;
  value = value.replace(STRIPPED_CONTROLS, '');
  if (value.length !== beforeControls.length) {
    removals.push({
      codePoint: 'U+0009/U+000A/U+000D',
      name: 'TAB / LINE FEED / CARRIAGE RETURN',
      count: beforeControls.length - value.length,
    });
  }
  if (REMAINING_CONTROLS.test(value)) {
    return { ok: false, raw, reason: 'URL CONTAINS CONTROL CHARACTERS', removals };
  }

  value = value.normalize('NFC');

  // A URL containing no non-ASCII characters cannot be an internationalized
  // one, which is what makes joiner removal safe in that case and only that case.
  const asciiOnly = !/[^\u0000-\u007F]/.test(value);
  const table = asciiOnly ? [...ALWAYS_INVISIBLE, ...ZERO_WIDTH_JOINERS] : ALWAYS_INVISIBLE;

  for (const [char, name] of table) {
    const codePoint = `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
    let count = 0;

    let next = value.split(char).join('');
    count += (value.length - next.length) / char.length;
    value = next;

    // The percent-encoded form — the shape this defect actually arrives in.
    const encoded = percentEncode(char);
    next = value.replace(new RegExp(encoded, 'gi'), '');
    count += (value.length - next.length) / encoded.length;
    value = next;

    if (count > 0) removals.push({ codePoint, name, count });
  }

  // Whitespace can surface at the ends once invisible characters are gone.
  value = value.replace(SURROUNDING_WHITESPACE, '');
  if (!value) return { ok: false, raw, reason: 'INVALID WEBSITE URL', removals };

  // A scheme is optional in what an operator types; anything other than http(s)
  // is refused rather than coerced into one.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) {
    return { ok: false, raw, reason: 'UNSUPPORTED URL SCHEME', removals };
  }
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, raw, reason: 'INVALID WEBSITE URL', removals };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, raw, reason: 'UNSUPPORTED URL SCHEME', removals };
  }
  if (!url.hostname) return { ok: false, raw, reason: 'INVALID WEBSITE URL', removals };

  const normalized = canonicalizeUrl(url);
  return { ok: true, raw, normalized, url: new URL(normalized), removals, changed: normalized !== raw };
}

/**
 * Canonical storage/display form.
 *
 * Lower-cases the host, drops the fragment (never sent to a server) and removes
 * the bare trailing slash on a root URL so `https://x.com/` and `https://x.com`
 * are one audit rather than two. Path and query are left exactly as parsed —
 * case, encoding and ordering in a query string can all be significant, and
 * "tidying" them is how a sanitizer starts fetching a different page than the
 * one it was handed.
 */
export function canonicalizeUrl(url: URL): string {
  const copy = new URL(url.toString());
  copy.hash = '';
  copy.hostname = copy.hostname.toLowerCase();
  let out = copy.toString();
  if (copy.pathname === '/' && !copy.search) out = out.replace(/\/$/, '');
  return out;
}

/**
 * Short, human-readable host for display in lists and failure states.
 *
 * The audit history and the failed-audit card show this instead of the raw
 * input: a percent-encoded invisible character is unreadable noise, and putting
 * it where the restaurant's identity belongs made a failed audit impossible to
 * tell apart from any other.
 */
export function displayDomain(rawOrUrl: string): string {
  const parsed = sanitizeUrlInput(rawOrUrl);
  const source = parsed.ok ? parsed.url : safeParse(rawOrUrl);
  if (!source) return rawOrUrl.trim().slice(0, 80);
  return source.hostname.replace(/^www\./, '');
}

function safeParse(value: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

/** One-line summary of what sanitization removed, for logs and the audit trail. */
export function describeRemovals(removals: SanitizationRemoval[]): string | null {
  if (removals.length === 0) return null;
  return removals.map((r) => `${r.count}× ${r.codePoint} ${r.name}`).join(', ');
}
