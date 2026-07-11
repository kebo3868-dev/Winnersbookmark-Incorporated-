import { ArrowRight, Clock, Quote } from "lucide-react";
import type { Article } from "@/data/articles";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { Reveal } from "@/components/ui/Reveal";
import { formatDate } from "@/lib/utils";

export function FeaturedArticle({ article }: { article: Article }) {
  return (
    <Reveal>
      <div className="overflow-hidden rounded-md border border-gold-500/20 bg-ink-800/80 shadow-luxe md:grid md:grid-cols-2">
        <ImagePlaceholder
          src={article.heroImage}
          alt={article.title}
          gradient="from-gold-700/30 via-espresso-800 to-ink-950"
          className="h-64 md:h-full md:min-h-[420px]"
          label="Featured — replace with final photography"
        >
          <div className="absolute left-6 top-6">
            <Badge accent="gold">Today&apos;s Featured Knowledge</Badge>
          </div>
        </ImagePlaceholder>

        <div className="flex flex-col justify-center p-8 md:p-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge>{article.category}</Badge>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-cream-300/50">
              <Clock className="h-3 w-3" /> {article.readingTime}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-cream-300/50">
              {formatDate(article.date)}
            </span>
          </div>

          <h3 className="font-display text-3xl font-semibold leading-tight text-cream-50 md:text-4xl">
            {article.title}
          </h3>
          <p className="mt-3 text-lg italic text-gold-300/90">
            {article.subtitle}
          </p>

          <div className="mt-6 flex gap-3 border-l-2 border-gold-500/50 pl-4">
            <Quote className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
            <p className="text-sm leading-relaxed text-cream-300/80">
              {article.excerpt}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Button href={`/blog/${article.slug}`}>
              Read Today&apos;s Blog <ArrowRight className="h-4 w-4" />
            </Button>
            <span className="text-[11px] uppercase tracking-luxe text-cream-300/50">
              By {article.author}
            </span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
