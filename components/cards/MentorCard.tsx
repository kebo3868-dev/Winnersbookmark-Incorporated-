import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import type { MonthlyMentor } from "@/data/monthlyMentors";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * MentorCard — symbolic leadership visuals only. No celebrity photos are
 * used; each card renders a cinematic monogram/silhouette treatment until
 * licensed assets are added (swap the gradient block for an <Image>).
 */
export function MentorCard({ mentor }: { mentor: MonthlyMentor }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div
        className={cn(
          "relative flex h-40 items-center justify-center bg-gradient-to-br",
          mentor.gradient
        )}
      >
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(250,246,238,0.06)_1px,transparent_1px)] [background-size:20px_20px]" />
        {/* Symbolic silhouette: podium line + monogram */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-950/90 to-transparent" />
        <span className="relative font-display text-5xl font-semibold tracking-widest text-cream-50/90">
          {mentor.monogram}
        </span>
        <span className="absolute bottom-3 left-4 text-[9px] uppercase tracking-luxe text-cream-200/40">
          {mentor.field}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-xl font-semibold text-cream-50 transition-colors group-hover:text-gold-300">
          {mentor.name}
        </h3>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-luxe text-gold-500">
          {mentor.field}
        </p>

        <div className="mt-4 flex gap-2.5 border-l-2 border-gold-500/40 pl-3">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500/70" />
          <p className="text-sm italic leading-relaxed text-cream-200/80">
            {mentor.coreLesson}
          </p>
        </div>

        <p className="mt-4 flex-1 text-xs leading-relaxed text-cream-300/60">
          <span className="font-semibold uppercase tracking-[0.14em] text-cream-200/70">
            This month:{" "}
          </span>
          {mentor.monthlyFocus}
        </p>

        <span className="mt-5 inline-flex items-center gap-1 border-t border-cream-50/[0.06] pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-500 transition-colors group-hover:text-gold-300">
          Study {mentor.name.split(" ")[0]}&apos;s Lessons
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>

      <Link
        href={`/mentors#${mentor.id}`}
        className="absolute inset-0"
        aria-label={`Study ${mentor.name}`}
      />
    </Card>
  );
}
