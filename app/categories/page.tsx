import type { Metadata } from "next";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { CategoryCard } from "@/components/cards/CategoryCard";
import { BlogCard } from "@/components/cards/BlogCard";
import { Reveal } from "@/components/ui/Reveal";
import { categories } from "@/data/categories";
import { getArticlesByCategory } from "@/data/articles";

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Twelve pillars of mastery — discipline, focus, confidence, fitness, nutrition, money, books, mentors, leadership, goal setting, AI productivity, and legacy building.",
};

export default function CategoriesPage() {
  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow="The Twelve Pillars"
            title="Categories"
            subtitle="Every article, mentor lesson, and challenge on this platform maps to one of twelve domains of mastery."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category, i) => (
              <Reveal key={category.id} delay={Math.min(i * 0.04, 0.3)}>
                <CategoryCard category={category} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Per-category article shelves (anchored for CategoryCard deep links) */}
      <section className="bg-ink-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl space-y-16 px-5 lg:px-8">
          {categories.map((category) => {
            const shelf = getArticlesByCategory(category.name);
            if (shelf.length === 0) return null;
            return (
              <div key={category.id} id={category.slug} className="scroll-mt-24">
                <div className="mb-8 flex items-baseline gap-4">
                  <h2 className="font-display text-2xl font-semibold text-cream-50">
                    {category.name}
                  </h2>
                  <span className="text-[11px] uppercase tracking-luxe text-cream-300/40">
                    {shelf.length} article{shelf.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {shelf.map((article) => (
                    <BlogCard key={article.slug} article={article} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <CTASection />
    </>
  );
}
