import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Clock, Calendar, User, Lock, ArrowLeft, ListChecks, Check, Sparkles } from 'lucide-react';
import Layout from '../components/Layout';
import ImagePlaceholder from '../components/ImagePlaceholder';
import ArticleBody from '../components/ArticleBody';
import MembershipCTA from '../components/MembershipCTA';
import ArticleCard from '../components/ArticleCard';
import CheckoutButtons from '../components/CheckoutButtons';
import { useMeta } from '../lib/useMeta';
import { postBySlug, posts } from '../data/posts';
import { categoryBySlug } from '../data/categories';
import { formatDate, accent } from '../lib/format';
import { site } from '../data/site';

export default function BlogPost() {
  const { slug } = useParams();
  const post = postBySlug(slug);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      setProgress(total > 0 ? Math.min(100, (h.scrollTop / total) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [slug]);

  useMeta(post?.title, post?.excerpt);

  if (!post) return <Navigate to="/blog" replace />;

  const cat = categoryBySlug(post.category);
  const a = accent(cat?.accent);
  const isLocked = post.tier === 'member';

  // For member posts, show only the opening blocks as a teaser.
  const teaserCount = 5;
  const visibleBlocks = isLocked ? post.body.slice(0, teaserCount) : post.body;

  const related = (post.related || [])
    .map((s) => postBySlug(s))
    .filter(Boolean)
    .slice(0, 3);

  // Section headings for the table of contents.
  const toc = post.body
    .filter((b) => b.type === 'h2')
    .map((b) => ({ text: b.text, id: slugify(b.text) }));

  return (
    <Layout>
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-0.5 bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-gold-light to-gold transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* HERO */}
      <article>
        <header className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-xs text-mist hover:text-gold-light mb-6">
            <ArrowLeft size={14} /> All Articles
          </Link>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Link to={`/categories/${cat?.slug}`} className={a.chip}>
              {cat?.name}
            </Link>
            {isLocked && (
              <span className="chip-gold">
                <Lock size={12} /> Members
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight text-paper">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-mist leading-relaxed">{post.subtitle}</p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ghost border-y border-ink-line py-4">
            <span className="inline-flex items-center gap-1.5"><User size={13} /> {post.author}</span>
            <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> {formatDate(post.date)}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={13} /> {post.readTime} min read</span>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
          <ImagePlaceholder
            ratio="aspect-[16/9]"
            accent={cat?.accent}
            label="Featured Image"
            caption={`Cinematic cover visual for “${post.title}”.`}
            className="shadow-panel-lg"
          />
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Key Takeaways */}
          {post.takeaways && (
            <aside className="mt-10 rounded-2xl border border-gold/30 bg-gold/[0.06] card-pad-lg">
              <div className="flex items-center gap-2 mb-4">
                <ListChecks size={18} className="text-gold-light" />
                <span className="eyebrow">Key Takeaways</span>
              </div>
              <ul className="grid gap-3">
                {post.takeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-[16px] leading-relaxed text-chalk">
                    <Check size={16} className="text-gold-light mt-1 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {/* Table of contents */}
          {toc.length > 1 && (
            <nav className="mt-8 glass card-pad">
              <div className="eyebrow mb-3">In This Article</div>
              <ol className="grid gap-2">
                {toc.map((item, i) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="text-sm text-chalk hover:text-gold-light transition-colors">
                      <span className="text-ghost mr-2">{String(i + 1).padStart(2, '0')}</span>
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* Body — with anchor ids injected for h2 */}
          <div className="mt-8">
            <ArticleBodyWithAnchors blocks={visibleBlocks} />
          </div>

          {/* Paywall for member content */}
          {isLocked ? (
            <Paywall />
          ) : (
            <>
              {/* Next steps */}
              <div className="rule-gold my-12" />
              <div className="glass card-pad-lg">
                <div className="eyebrow mb-2">Next Steps for the Reader</div>
                <p className="text-chalk leading-relaxed">
                  Don’t let this be just another article you nod along to. Pick the single most
                  useful idea above and put it into action before the day ends. Insight without
                  execution is entertainment — and you’re here to build something.
                </p>
              </div>

              <MembershipCTA variant="box" />
            </>
          )}
        </div>
      </article>

      {/* Related */}
      {related.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
          <div className="eyebrow mb-6">Related Deep Dives</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {related.map((p) => (
              <ArticleCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
}

function Paywall() {
  return (
    <div className="relative mt-2">
      {/* fade-out overlay */}
      <div className="absolute -top-40 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-ink-black pointer-events-none" />
      <div className="relative glass-strong rounded-3xl p-8 sm:p-12 text-center overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-gradient-to-br from-gold/25 to-transparent blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-gold/40 bg-gold/10 text-gold-light mb-5">
            <Lock size={24} />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-paper">
            This is members-only content
          </h2>
          <p className="mt-3 text-mist leading-relaxed max-w-lg mx-auto">
            You’ve read the opening. Unlock the full deep dive — plus every premium article, book
            breakdown, and mentor playbook — for just ${site.pricing.price}/month with a{' '}
            {site.pricing.trialDays}-day free trial. Cancel anytime.
          </p>
          <div className="mt-7 max-w-md mx-auto">
            <CheckoutButtons />
          </div>
          <Link to="/membership" className="inline-flex items-center gap-1.5 mt-5 text-sm text-gold-light hover:underline">
            <Sparkles size={14} /> See everything included
          </Link>
        </div>
      </div>
    </div>
  );
}

// Wraps ArticleBody, adding id anchors to h2 headings for the TOC.
function ArticleBodyWithAnchors({ blocks }) {
  const withIds = blocks.map((b) =>
    b.type === 'h2' ? { ...b, _id: slugify(b.text) } : b
  );
  return (
    <div>
      {withIds.map((b, i) =>
        b._id ? (
          <div key={i} id={b._id} className="scroll-mt-24">
            <ArticleBody blocks={[b]} />
          </div>
        ) : (
          <ArticleBody key={i} blocks={[b]} />
        )
      )}
    </div>
  );
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Pre-generate static params helper (unused at runtime, handy for reference).
export const allPostSlugs = posts.map((p) => p.slug);
