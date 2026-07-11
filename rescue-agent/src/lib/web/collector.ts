import * as cheerio from 'cheerio';
import type { Response as UndiciResponse } from 'undici';
import { validateUrlTarget, normalizeUrl } from '@/lib/validation/url';
import { safeFetchHop, readBodyCapped } from '@/lib/web/safeFetch';

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

export interface PageExtract {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  hasViewportMeta: boolean;
  hasStructuredData: boolean;
  https: boolean;
  headings: string[];
  ctas: string[];
  phones: string[];
  clickToCallLinks: number;
  emails: string[];
  internalLinks: { href: string; text: string }[];
  categorizedLinks: Partial<Record<LinkCategory, { href: string; text: string }[]>>;
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
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 2_500_000;

const CATEGORY_PATTERNS: Record<LinkCategory, RegExp> = {
  menu: /\bmenu(s)?\b|\bfood\b|\bdrinks?\b|\bwine[- ]?list\b/i,
  reservation: /reserv|booking|book[- ]?(a[- ]?)?table|opentable|resy|tock|yelp.*reservations|sevenrooms/i,
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

const SOCIAL_HOSTS = /facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|yelp\.com|linkedin\.com|threads\.net/i;

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;
// Quantifiers are bounded so backtracking stays linear even on pathological
// multi-megabyte unbroken text runs (extraction regexes run on untrusted HTML).
const EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9-]{1,63}(?:\.[a-zA-Z0-9-]{1,63}){1,4}/g;
// Entity extraction scans at most this much visible text; contact details on
// real restaurant pages appear far earlier, and this bounds regex work.
const MAX_SCAN_TEXT = 300_000;
const HOURS_REGEX =
  /((mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*(–|-|to|through|thru)?\s*(mon|tue|wed|thu|fri|sat|sun)?[a-z]*\.?[:\s]*\d{1,2}(:\d{2})?\s*(am|pm)\s*(–|-|to)\s*\d{1,2}(:\d{2})?\s*(am|pm))/i;
const ADDRESS_REGEX = /\d{1,6}\s+[A-Za-z0-9.'\- ]{3,40}\s(street|st\.?|avenue|ave\.?|boulevard|blvd\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|way|highway|hwy\.?|parkway|pkwy\.?|court|ct\.?|place|pl\.?)\b[^\n]{0,60}/i;

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
async function followRedirectsSafely(rawUrl: string, timeoutMs: number): Promise<HopResult> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validation = await validateUrlTarget(currentUrl);
    if (!validation.ok) {
      return { kind: 'failure', status: 'BLOCKED', note: `Destination rejected by safety policy: ${validation.reason}` };
    }
    const target = validation.url.toString();
    let response: UndiciResponse;
    try {
      response = await safeFetchHop(target, {
        timeoutMs,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      });
    } catch (error) {
      return classifyFetchError(error, timeoutMs);
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

export async function fetchPage(rawUrl: string): Promise<FetchOutcome> {
  const hop = await followRedirectsSafely(rawUrl, FETCH_TIMEOUT_MS);
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
  $('script, style, noscript').remove();

  const base = new URL(finalUrl);
  const title = $('title').first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
  const hasViewportMeta = $('meta[name="viewport"]').length > 0;
  const hasStructuredData = html.includes('application/ld+json') || $('[itemtype]').length > 0;

  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t && t.length <= 140 && headings.length < 40) headings.push(t);
  });

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_SCAN_TEXT);

  const internalLinks: { href: string; text: string }[] = [];
  const socialLinks = new Set<string>();
  const pdfLinks = new Set<string>();
  const categorizedLinks: PageExtract['categorizedLinks'] = {};
  let clickToCallLinks = 0;
  const ctas: string[] = [];

  $('a[href]').each((_, el) => {
    const hrefRaw = $(el).attr('href') ?? '';
    const text = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120);
    if (hrefRaw.startsWith('tel:')) {
      clickToCallLinks++;
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

    const haystack = `${abs.pathname} ${abs.hostname} ${text}`;
    (Object.keys(CATEGORY_PATTERNS) as LinkCategory[]).forEach((cat) => {
      if (CATEGORY_PATTERNS[cat].test(haystack)) {
        (categorizedLinks[cat] ??= []).push({ href: absStr, text });
      }
    });
    if (abs.hostname === base.hostname && internalLinks.length < 200) {
      internalLinks.push({ href: absStr, text });
    }
  });

  $('a, button').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (!t || t.length > 60) return;
    if (/order|reserve|book|call|menu|directions|gift|join|sign[- ]?up|contact|deliver|pickup|cater/i.test(t) && ctas.length < 30) {
      ctas.push(t);
    }
  });

  const phones = Array.from(new Set(bodyText.match(PHONE_REGEX) ?? [])).slice(0, 5);
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
    https: base.protocol === 'https:',
    headings,
    ctas: Array.from(new Set(ctas)),
    phones,
    clickToCallLinks,
    emails,
    internalLinks,
    categorizedLinks,
    socialLinks: Array.from(socialLinks).slice(0, 10),
    pdfLinks: Array.from(pdfLinks).slice(0, 10),
    hoursText: hoursMatch ? hoursMatch[0].slice(0, 200) : null,
    addressText: addressMatch ? addressMatch[0].slice(0, 200) : null,
    emailCaptureSignal,
    smsCaptureSignal,
    loyaltySignal,
    giftCardSignal,
    textSample: bodyText.slice(0, 4000),
  };
}

/**
 * Probe a link (GET, body discarded) to verify it is not broken. Uses the same
 * manual redirect loop as fetchPage so every redirect hop is re-validated
 * against the SSRF policy — a public link that 302s to a private or
 * link-local address is rejected, not followed.
 */
export async function probeLink(url: string): Promise<{ ok: boolean; httpStatus?: number; note: string }> {
  const hop = await followRedirectsSafely(url, 10_000);
  if (hop.kind === 'failure') {
    if (hop.status === 'BLOCKED' && /safety policy/.test(hop.note)) {
      return { ok: false, httpStatus: hop.httpStatus, note: hop.note };
    }
    if (hop.status === 'TIMEOUT') return { ok: false, note: 'Timed out' };
    return { ok: false, httpStatus: hop.httpStatus, note: hop.note };
  }
  const { response } = hop;
  await response.body?.cancel().catch(() => {});
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    return { ok: true, httpStatus: response.status, note: 'Access-restricted destination (treated as reachable, not verified)' };
  }
  return { ok: response.status < 400, httpStatus: response.status, note: `HTTP ${response.status}` };
}
