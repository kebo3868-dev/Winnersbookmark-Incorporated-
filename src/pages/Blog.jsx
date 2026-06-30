import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import Layout from '../components/Layout';
import ArticleCard from '../components/ArticleCard';
import MembershipCTA from '../components/MembershipCTA';
import { useMeta } from '../lib/useMeta';
import { sortedPosts } from '../data/posts';
import { categories } from '../data/categories';

export default function Blog() {
  useMeta(
    'The Blog — Daily Premium Content for Men',
    'Browse daily articles on discipline, focus, fitness, nutrition, money, book breakdowns, mentors, and self-mastery for men.'
  );

  const all = sortedPosts();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('all');

  const filtered = useMemo(() => {
    return all.filter((p) => {
      const matchesCat = active === 'all' || p.category === active;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCat && matchesQuery;
    });
  }, [all, active, query]);

  const featured = all[0];
  const rest = filtered.filter((p) => active !== 'all' || query ? true : p.slug !== featured.slug);

  const filterCats = [{ slug: 'all', name: 'All' }, ...categories];

  return (
    <Layout>
      <PageHero
        eyebrow="The Blog"
        title="Daily Tools for the Serious Man"
        blurb="Premium articles on discipline, focus, fitness, money, books, and self-mastery — new content every day at 7:00 AM."
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Featured (only on the default, unfiltered view) */}
        {active === 'all' && !query && (
          <div className="mb-12">
            <div className="eyebrow mb-4">Featured</div>
            <ArticleCard post={featured} variant="featured" />
          </div>
        )}

        {/* Search + filters */}
        <div className="glass card-pad mb-8 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles, topics, tags…"
              className="!pl-10"
              aria-label="Search articles"
            />
          </div>
          <div className="flex items-center gap-2 text-mist text-xs shrink-0">
            <SlidersHorizontal size={14} />
            {filtered.length} article{filtered.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 mb-8 scrollbar-hide">
          {filterCats.map((c) => (
            <button
              key={c.slug}
              onClick={() => setActive(c.slug)}
              className={`whitespace-nowrap px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors ${
                active === c.slug
                  ? 'border-gold/50 bg-gold/10 text-gold-light'
                  : 'border-ink-line bg-ink-card/60 text-chalk hover:text-paper hover:border-electric/50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Grid */}
        {rest.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rest.map((p) => (
              <ArticleCard key={p.slug} post={p} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p className="text-mist">No articles match your search. Try another topic.</p>
          </div>
        )}
      </div>

      <MembershipCTA variant="band" />
    </Layout>
  );
}

export function PageHero({ eyebrow, title, blurb }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[80%] h-[80%] rounded-full bg-gradient-to-br from-electric/15 to-transparent blur-3xl" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12 text-center">
        <div className="eyebrow mb-3">{eyebrow}</div>
        <h1 className="hero-title text-paper max-w-3xl mx-auto">{title}</h1>
        {blurb && <p className="mt-4 text-mist leading-relaxed max-w-2xl mx-auto">{blurb}</p>}
      </div>
    </section>
  );
}
