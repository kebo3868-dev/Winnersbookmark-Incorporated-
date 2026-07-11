import * as cheerio from 'cheerio';
import { validateUrlTarget, normalizeUrl } from '@/lib/validation/url';

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
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const HOURS_REGEX =
  /((mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*(–|-|to|through|thru)?\s*(mon|tue|wed|thu|fri|sat|sun)?[a-z]*\.?[:\s]*\d{1,2}(:\d{2})?\s*(am|pm)\s*(–|-|to)\s*\d{1,2}(:\d{2})?\s*(am|pm))/i;
const ADDRESS_REGEX = /\d{1,6}\s+[A-Za-z0-9.'\- ]{3,40}\s(street|st\.?|avenue|ave\.?|boulevard|blvd\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|way|highway|hwy\.?|parkway|pkwy\.?|court|ct\.?|place|pl\.?)\b[^\n]{0,60}/i;

/**
 * Fetch a single URL with manual redirect following so every hop is re-validated
 * against the SSRF policy. Never bypasses auth, captchas, or bot protection —
 * a 401/403/429 is recorded as BLOCKED, not worked around.
 */
export async function fetchPage(rawUrl: string): Promise<FetchOutcome> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validation = await validateUrlTarget(currentUrl);
    if (!validation.ok) {
      return { status: 'BLOCKED', note: `Destination rejected by safety policy: ${validation.reason}` };
    }
    const target = validation.url.toString();
    let response: Response;
    try {
      response = await fetch(target, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('timeout') || (error as Error)?.name === 'TimeoutError') {
        return { status: 'TIMEOUT', note: `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s` };
      }
      return { status: 'UNAVAILABLE', note: `Network failure: ${message.slice(0, 200)}` };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return { status: 'ERROR', httpStatus: response.status, note: 'Redirect without location header' };
      currentUrl = new URL(location, target).toString();
      continue;
    }
    if (response.status === 401 || response.status === 403 || response.status === 429 || response.status === 503) {
      return {
        status: 'BLOCKED',
        httpStatus: response.status,
        note: `Access restricted (HTTP ${response.status}). Bot protection or access control not bypassed.`,
      };
    }
    if (response.status >= 400) {
      return { status: 'ERROR', httpStatus: response.status, note: `HTTP ${response.status}` };
    }
    const contentType = response.headers.get('content-type');
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      return { status: 'ERROR', httpStatus: response.status, note: `Unsupported content type: ${contentType.slice(0, 80)}` };
    }
    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, MAX_BODY_BYTES));
    return {
      status: 'COLLECTED',
      page: extractPage(rawUrl, target, response.status, contentType, html),
    };
  }
  return { status: 'ERROR', note: `Exceeded ${MAX_REDIRECTS} redirects` };
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

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

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

/** Probe a link (GET, no body parse) to verify it is not broken. Re-validates target for SSRF. */
export async function probeLink(url: string): Promise<{ ok: boolean; httpStatus?: number; note: string }> {
  const validation = await validateUrlTarget(url);
  if (!validation.ok) return { ok: false, note: `Rejected by safety policy: ${validation.reason}` };
  try {
    const response = await fetch(validation.url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: { 'user-agent': USER_AGENT },
    });
    if (response.body) {
      try {
        await response.body.cancel();
      } catch {
        /* ignore */
      }
    }
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      return { ok: true, httpStatus: response.status, note: 'Access-restricted destination (treated as reachable, not verified)' };
    }
    return { ok: response.status < 400, httpStatus: response.status, note: `HTTP ${response.status}` };
  } catch (error) {
    const name = (error as Error)?.name ?? '';
    if (name === 'TimeoutError') return { ok: false, note: 'Timed out' };
    return { ok: false, note: `Network failure: ${String((error as Error)?.message ?? error).slice(0, 120)}` };
  }
}
