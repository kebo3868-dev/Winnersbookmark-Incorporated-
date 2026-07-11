import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import type { Article } from "@/data/articles";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { formatDate } from "@/lib/utils";

export function BlogCard({ article }: { article: Article }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <ImagePlaceholder
        src={article.heroImage}
        alt={article.title}
        gradient="from-espresso-600 via-ink-800 to-ink-950"
        className="h-44"
        label={article.category}
      >
        {article.premiumLocked ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-sm border border-gold-500/40 bg-ink-950/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-luxe text-gold-400">
            <Lock className="h-3 w-3" /> Members
          </span>
        ) : null}
      </ImagePlaceholder>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-center gap-3">
          <Badge>{article.category}</Badge>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-cream-300/40">
            <Clock className="h-3 w-3" /> {article.readingTime}
          </span>
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug text-cream-50 transition-colors group-hover:text-gold-300">
          {article.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-cream-300/70">
          {article.excerpt}
        </p>
        <div className="mt-5 flex items-center justify-between border-t border-cream-50/[0.06] pt-4 text-[11px] uppercase tracking-[0.14em] text-cream-300/50">
          <span>{article.author}</span>
          <span>{formatDate(article.date)}</span>
        </div>
      </div>

      <Link
        href={`/blog/${article.slug}`}
        className="absolute inset-0"
        aria-label={article.title}
      />
    </Card>
  );
}
