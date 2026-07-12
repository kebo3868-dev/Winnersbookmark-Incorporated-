import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Category } from "@/data/categories";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { accentStyles } from "@/components/ui/accents";
import { cn } from "@/lib/utils";

export function CategoryCard({ category }: { category: Category }) {
  const styles = accentStyles[category.accent];

  return (
    <Card className="flex h-full flex-col p-6">
      <span
        className={cn(
          "mb-5 inline-flex h-11 w-11 items-center justify-center rounded-sm border transition-transform duration-500 group-hover:scale-110",
          styles.bg,
          styles.border
        )}
      >
        <Icon name={category.icon} className={cn("h-5 w-5", styles.text)} />
      </span>
      <h3 className="font-display text-lg font-semibold text-cream-50 transition-colors group-hover:text-gold-300">
        {category.name}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-cream-300/70">
        {category.description}
      </p>
      <span className="mt-5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-500 transition-colors group-hover:text-gold-300">
        Explore {category.name}
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
      <Link
        href={`/categories#${category.slug}`}
        className="absolute inset-0"
        aria-label={`Explore ${category.name}`}
      />
    </Card>
  );
}
