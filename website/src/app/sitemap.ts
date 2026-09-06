import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/data/site';
import { agentSlugs } from '@/data/agents';

/**
 * Sitemap, generated from the same registry the pages are.
 *
 * A new agent is therefore indexed automatically — the failure mode this
 * avoids is the usual one, where a hand-maintained sitemap silently stops
 * matching the site months after someone adds a page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: Array<{ path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }> = [
    { path: '', priority: 1, changeFrequency: 'weekly' },
    { path: '/solutions', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/restaurants', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/consulting', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/audit', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/about/founder', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'monthly' },
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${SITE_URL}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...agentSlugs().map((slug) => ({
      url: `${SITE_URL}/solutions/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
