import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lock,
  Quote,
} from "lucide-react";
import type { Article } from "@/data/articles";
import { getArticleBySlug } from "@/data/articles";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { BlogCard } from "@/components/cards/BlogCard";
import { formatDate } from "@/lib/utils";

/**
 * ArticleLayout — magazine-quality article reading experience.
 * Premium-locked articles show the first section, then a membership gate
 * (placeholder auth — see /login and /data notes).
 */
export function ArticleLayout({ article }: { article: Article }) {
  const related = article.relatedArticles
    .map((slug) => getArticleBySlug(slug))
    .filter((a): a is Article => Boolean(a));

  const visibleSections = article.premiumLocked
    ? article.contentSections.slice(0, 1)
    : article.contentSections;

  return (
    <article className="bg-ink-950 pt-[72px]">
      {/* Hero */}
      <ImagePlaceholder
        src={article.heroImage}
        alt={article.title}
        gradient="from-espresso-600 via-ink-800 to-ink-950"
        className="flex min-h-[420px] items-end"
        label="Replace with final photography — /public/images"
      >
        <div className="relative mx-auto w-full max-w-3xl px-5 pb-12 pt-32 lg:px-0">
          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-luxe text-cream-200/60 transition-colors hover:text-gold-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Daily Blog Feed
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{article.category}</Badge>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-cream-200/60">
              <Clock className="h-3 w-3" /> {article.readingTime}
            </span>
            {article.premiumLocked ? (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-gold-400">
                <Lock className="h-3 w-3" /> Members Article
              </span>
            ) : null}
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-cream-50 md:text-5xl">
            {article.title}
          </h1>
          <p className="mt-4 text-xl italic text-gold-300/90">
            {article.subtitle}
          </p>
          <p className="mt-6 text-[11px] uppercase tracking-luxe text-cream-300/50">
            By {article.author} · {formatDate(article.date)}
          </p>
        </div>
      </ImagePlaceholder>

      {/* Body */}
      <div className="mx-auto max-w-3xl px-5 py-14 lg:px-0">
        <p className="border-l-2 border-gold-500/60 pl-5 text-lg leading-relaxed text-cream-200/90">
          {article.excerpt}
        </p>

        {visibleSections.map((section, index) => (
          <section key={section.heading} className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-cream-50">
              <span className="mr-3 text-gold-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 40)}
                className="mt-5 text-base leading-[1.85] text-cream-300/80"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        {/* Pull quote */}
        <figure className="my-14 border-y border-gold-500/20 py-10 text-center">
          <Quote className="mx-auto mb-5 h-6 w-6 text-gold-500" />
          <blockquote className="font-display text-2xl font-medium italic leading-relaxed text-cream-100 md:text-[1.7rem]">
            &ldquo;{article.pullQuote}&rdquo;
          </blockquote>
          <figcaption className="mt-5 text-[10px] uppercase tracking-luxe text-gold-500">
            {article.author} · Winnersbookmark Daily Blogs
          </figcaption>
        </figure>

        {article.premiumLocked ? (
          /* Membership gate — placeholder entitlement check.
             In production, gate on the authenticated member's subscription. */
          <div className="rounded-md border border-gold-500/30 bg-gradient-to-br from-gold-600/10 to-ink-800 p-8 text-center md:p-12">
            <Lock className="mx-auto h-7 w-7 text-gold-400" />
            <h3 className="mt-5 font-display text-2xl font-semibold text-cream-50">
              This knowledge is for members.
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cream-300/70">
              Unlock the full article, today&apos;s action steps, reflection
              questions, and every daily drop — for less than a bad lunch.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-4">
              <Button href="/membership">Start 7-Day Free Trial</Button>
              <Button href="/login" variant="outline">
                Member Login
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Action steps */}
            <div className="rounded-md border border-cream-50/[0.08] bg-ink-800/80 p-8">
              <h3 className="flex items-center gap-2.5 font-display text-xl font-semibold text-cream-50">
                <CheckCircle2 className="h-5 w-5 text-gold-500" />
                Today&apos;s Action Steps
              </h3>
              <ol className="mt-5 space-y-3">
                {article.actionSteps.map((step, i) => (
                  <li key={step} className="flex gap-4 text-sm leading-relaxed text-cream-200/80">
                    <span className="font-display font-semibold text-gold-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Reflection questions */}
            <div className="mt-6 rounded-md border border-focus-500/20 bg-ink-800/80 p-8">
              <h3 className="flex items-center gap-2.5 font-display text-xl font-semibold text-cream-50">
                <HelpCircle className="h-5 w-5 text-focus-400" />
                Reflection Questions
              </h3>
              <ul className="mt-5 space-y-3">
                {article.reflectionQuestions.map((q) => (
                  <li
                    key={q}
                    className="border-l-2 border-focus-500/40 pl-4 text-sm italic leading-relaxed text-cream-200/80"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Related */}
      {related.length > 0 ? (
        <div className="mx-auto max-w-7xl border-t border-cream-50/[0.06] px-5 py-16 lg:px-8">
          <div className="mb-10 flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold text-cream-50 md:text-3xl">
              Continue Building
            </h2>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-luxe text-gold-500 transition-colors hover:text-gold-300"
            >
              All Articles <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {related.map((a) => (
              <BlogCard key={a.slug} article={a} />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
