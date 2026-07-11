import type { Metadata } from "next";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { FeaturedArticle } from "@/components/cards/FeaturedArticle";
import { DailyKnowledgeCard } from "@/components/cards/DailyKnowledgeCard";
import { Reveal } from "@/components/ui/Reveal";
import { dailyKnowledge, todayDateISO } from "@/data/dailyKnowledge";
import { featuredArticle } from "@/data/articles";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Today's Knowledge",
  description:
    "Today's discipline lesson, fitness standard, nutrition move, money habit, book insight, mentor lesson, AI productivity tip, and reflection question.",
};

export default function TodayPage() {
  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow={`Today · ${formatDate(todayDateISO)}`}
            title="Today's Knowledge"
            subtitle="Eight fresh drops. Read them, act on one, and come back tomorrow — the board resets daily."
          />
          <FeaturedArticle article={featuredArticle} />
        </div>
      </section>

      <section className="bg-ink-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {dailyKnowledge.map((item, i) => (
              <Reveal key={item.id} delay={Math.min(i * 0.05, 0.3)}>
                <DailyKnowledgeCard item={item} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        headline="One Standard a Day Compounds."
        subheadline="Don't try to apply all eight. Pick one drop, execute it fully, and let the daily rhythm do the compounding."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
