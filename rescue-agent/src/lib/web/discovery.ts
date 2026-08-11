import type { LinkCategory, PageExtract } from './collector';

export const MAX_PAGES = 10;

const PRIORITY_ORDER: LinkCategory[] = [
  'menu',
  'contact',
  'reservation',
  'ordering',
  'location',
  'hours',
  'catering',
  'private_dining',
  'events',
  'gift_card',
  'loyalty',
  'faq',
  'about',
];

/**
 * Select up to (MAX_PAGES - 1) internal pages worth collecting after the homepage,
 * ordered by audit relevance. Only same-site links; deduplicated; bounded.
 */
export function discoverRelevantPages(home: PageExtract, limit = MAX_PAGES - 1): { url: string; sourceType: string }[] {
  const homeHost = new URL(home.finalUrl).hostname;
  const seen = new Set<string>([normalizeForDedup(home.finalUrl), normalizeForDedup(home.requestedUrl)]);
  const selected: { url: string; sourceType: string }[] = [];

  for (const category of PRIORITY_ORDER) {
    if (selected.length >= limit) break;
    const links = home.categorizedLinks[category] ?? [];
    for (const link of links) {
      if (selected.length >= limit) break;
      // Widget endpoints are destinations to probe, not pages to crawl: an
      // iframe src returns a widget fragment, and collecting it would spend one
      // of the few page slots on markup no customer browses.
      if (link.source === 'embed') continue;
      let parsed: URL;
      try {
        parsed = new URL(link.href);
      } catch {
        continue;
      }
      if (parsed.hostname !== homeHost) continue; // external platforms are probed, not crawled
      const key = normalizeForDedup(link.href);
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push({ url: link.href, sourceType: category.toUpperCase() });
    }
  }
  return selected;
}

function normalizeForDedup(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
