import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { BookCard } from "@/components/cards/BookCard";
import { Reveal } from "@/components/ui/Reveal";
import { monthlyBooks, bookStackMonth } from "@/data/monthlyBooks";

export const metadata: Metadata = {
  title: "This Month's Book Stack",
  description:
    "Five books, distilled into daily insights. The stack rotates every month — read with the board, grow with the board.",
};

export default function BooksPage() {
  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow={`Book Wisdom · ${bookStackMonth}`}
            title="This Month's Book Stack"
            subtitle="Five titles chosen to match this month's theme. Each one is distilled into daily insights and action steps in the blog."
          />

          <Reveal className="mx-auto mb-12 flex max-w-xl items-center justify-center gap-3 rounded-md border border-gold-500/20 bg-ink-800/60 px-5 py-3">
            <RefreshCw className="h-4 w-4 shrink-0 text-gold-500" />
            <p className="text-xs leading-relaxed text-cream-300/70">
              The stack rotates on the 1st of every month. New theme, new
              books, new reading plan — archived stacks stay available to
              members.
            </p>
          </Reveal>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {monthlyBooks.map((book, i) => (
              <Reveal key={book.id} delay={Math.min(i * 0.05, 0.25)}>
                <BookCard book={book} />
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-14 rounded-md border border-cream-50/[0.08] bg-ink-800/70 p-8 md:p-10">
            <h2 className="font-display text-2xl font-semibold text-cream-50">
              How to Read With the Board
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {[
                ["01", "Ten pages a day", "The daily floor. Miss a day? Never miss twice."],
                ["02", "Underline and apply", "Every session ends with one action written down."],
                ["03", "Discuss in the dashboard", "Members track reading progress and reflections."],
              ].map(([num, title, text]) => (
                <div key={num}>
                  <p className="font-display text-xl font-semibold text-gold-500">{num}</p>
                  <h3 className="mt-2 font-semibold text-cream-50">{title}</h3>
                  <p className="mt-1.5 text-sm text-cream-300/70">{text}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <CTASection
        headline="Read Like It's Training."
        subheadline="Members get the monthly reading plan, chapter focuses, and the full archive of past book stacks."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
