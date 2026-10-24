import { validateUrlTarget } from '@/lib/validation/url';
import { safeFetchHop, readBodyCapped } from './safeFetch';

const AGENT = 'WinnersBookmarkRescueAgent';
type Rule = { allow: boolean; path: string };
type Group = { agents: string[]; rules: Rule[] };
const cache = new Map<string, { expires: number; text: string | null }>();

/** Longest matching rule wins; Allow wins a tie. Empty Disallow allows all. */
export function robotsAllows(text: string, path: string): boolean {
  const groups: Group[] = [];
  let group: Group | undefined;
  let hasDirectives = false;
  for (const line of text.split(/\r?\n/)) {
    const clean = line.split('#')[0].trim();
    const colon = clean.indexOf(':');
    if (colon < 0) continue;
    const key = clean.slice(0, colon).toLowerCase();
    const value = clean.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!group || hasDirectives) { group = { agents: [], rules: [] }; groups.push(group); hasDirectives = false; }
      group.agents.push(value.toLowerCase());
    } else if (group) {
      hasDirectives = true;
      if ((key === 'allow' || key === 'disallow') && value) group.rules.push({ allow: key === 'allow', path: value });
    }
  }
  const specific = groups.filter((g) => g.agents.includes(AGENT.toLowerCase()));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  let length = -1;
  let allow = true;
  for (const rule of chosen.flatMap((g) => g.rules)) {
    const anchored = rule.path.endsWith('$');
    const pattern = anchored ? rule.path.slice(0, -1) : rule.path;
    const expression = '^' + pattern.split('*').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : '');
    const specificity = pattern.replace(/\*/g, '').length;
    if (new RegExp(expression).test(path) && (specificity > length || (specificity === length && rule.allow))) {
      length = specificity; allow = rule.allow;
    }
  }
  return allow;
}

/** No redirects or auth bypass. Ambiguous policy retrieval stops collection. */
export async function checkRobots(url: URL, timeoutMs: number): Promise<boolean> {
  const origin = url.origin;
  let cached = cache.get(origin);
  if (!cached || cached.expires < Date.now()) {
    let text: string | null = null;
    const target = `${origin}/robots.txt`;
    const validation = await validateUrlTarget(target);
    if (!validation.ok) return false;
    try {
      const response = await safeFetchHop(target, { timeoutMs: Math.max(1, Math.min(timeoutMs, 5000)), headers: { 'user-agent': AGENT } });
      if (response.status === 404 || response.status === 410) { text = ''; await response.body?.cancel(); }
      else if (response.status === 200) {
        const body = await readBodyCapped(response, 512_000);
        const decoded = new TextDecoder().decode(body);
        // HTML challenge pages and truncation are not an empty robots policy.
        if (body.length < 512_000 && !/<html|<!doctype/i.test(decoded)) text = decoded;
      } else { await response.body?.cancel(); }
    } catch { /* unknown policy: fail closed */ }
    cached = { expires: Date.now() + 300_000, text };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(origin, cached);
  }
  return cached.text !== null && robotsAllows(cached.text, url.pathname + url.search);
}
