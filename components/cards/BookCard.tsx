import { BookOpen } from "lucide-react";
import type { MonthlyBook } from "@/data/monthlyBooks";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { accentStyles } from "@/components/ui/accents";
import { cn } from "@/lib/utils";

export function BookCard({ book }: { book: MonthlyBook }) {
  const styles = accentStyles[book.accent];

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* Symbolic book "cover" — premium gradient spine, no licensed art needed */}
      <div
        className={cn(
          "relative flex h-44 items-end bg-gradient-to-br p-5",
          book.spineColor
        )}
      >
        <div className="absolute inset-0 bg-hero-vignette" />
        <div className="absolute left-4 top-0 h-full w-px bg-cream-50/10" />
        <div className="absolute left-6 top-0 h-full w-px bg-cream-50/[0.06]" />
        <BookOpen className="absolute right-5 top-5 h-5 w-5 text-cream-50/30" />
        <div className="relative">
          <p className="font-display text-xl font-semibold leading-tight text-cream-50">
            {book.title}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-cream-200/60">
            {book.author}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <Badge accent={book.accent}>{book.focus}</Badge>
        <p className="mt-4 flex-1 text-sm leading-relaxed text-cream-300/70">
          {book.keyIdea}
        </p>
        <p className="mt-4 border-t border-cream-50/[0.06] pt-4 text-xs leading-relaxed text-cream-200/50">
          <span className={cn("font-semibold uppercase tracking-[0.14em]", styles.text)}>
            Why this month:{" "}
          </span>
          {book.whyThisMonth}
        </p>
      </div>
    </Card>
  );
}
