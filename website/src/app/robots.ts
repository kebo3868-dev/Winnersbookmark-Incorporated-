import type { MetadataRoute } from 'next';
import { SITE_URL, HAS_CANONICAL_DOMAIN } from '@/data/site';

/**
 * Robots policy.
 *
 * A deployment with no resolvable public origin (a local build, an unconfigured
 * environment) is told not to index. That prevents a preview or placeholder
 * deployment being indexed ahead of the real site and competing with it —
 * which is genuinely hard to undo once it has happened.
 */
export default function robots(): MetadataRoute.Robots {
  if (!HAS_CANONICAL_DOMAIN) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
