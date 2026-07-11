import type { Metadata } from "next";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { BlogCard } from "@/components/cards/BlogCard";
import { Reveal } from "@/components/ui/Reveal";
import { articles } from "@/data/articles";

export const metadata: Metadata = {
  title: "Daily Blog Feed",
  description:
    "The full archive of daily knowledge — discipline, focus, fitness, nutrition, money, books, mentors, and legacy building.",
};

export default function BlogPage() {
  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow="The Archive"
            title="Daily Blog Feed"
            subtitle="One new article every day. The most recent knowledge sits at the top — start there."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, i) => (
              <Reveal key={article.slug} delay={Math.min(i * 0.04, 0.25)}>
                <BlogCard article={article} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        headline="Never Miss a Day."
        subheadline="Members get every article, every action step, and every reflection question — delivered daily."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
