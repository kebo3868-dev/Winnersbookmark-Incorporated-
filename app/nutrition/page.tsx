import type { Metadata } from "next";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { BlogCard } from "@/components/cards/BlogCard";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { getArticlesByCategory } from "@/data/articles";

export const metadata: Metadata = {
  title: "Nutrition",
  description:
    "Clean meals, meal prep strategy, protein standards, and food discipline — fuel for the mission, not the mood.",
};

const standards = [
  {
    icon: "Apple",
    title: "Clean Meals",
    text: "Whole foods you can name. If your grandfather wouldn't recognize it as food, it's a sometimes-food at best.",
  },
  {
    icon: "ListChecks",
    title: "Meal Prep",
    text: "Decide once on Sunday, execute all week. One strong decision replaces twenty weak ones.",
  },
  {
    icon: "Dumbbell",
    title: "Protein Standard",
    text: "Protein at every meal — 30–40g within 90 minutes of waking. Muscle is the retirement account of the body.",
  },
  {
    icon: "HeartPulse",
    title: "Energy Management",
    text: "Stable fuel means stable mood, stable focus, stable discipline. Blood sugar spikes are decision-quality spikes.",
  },
  {
    icon: "Sunrise",
    title: "Eating Window",
    text: "Kitchen closes by 9pm. The late-night spiral is where good days go to die.",
  },
  {
    icon: "Shield",
    title: "80/20 Standard",
    text: "Excellence over perfection. Perfection quits in week three; standards compound for decades.",
  },
];

export default function NutritionPage() {
  const articles = getArticlesByCategory("Nutrition");

  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow="Body Systems · Nutrition"
            title="Every Meal Is a Vote."
            subtitle="Food is the most frequent discipline decision you make. Master the plate and you build the engine that powers everything else."
          />

          <Reveal>
            <ImagePlaceholder
              src="/images/clean-meal-prep.jpg"
              alt="Clean meal prep — whole foods, portioned and planned"
              gradient="from-health-500/25 via-ink-800 to-ink-950"
              className="flex min-h-[300px] items-end rounded-md border border-cream-50/[0.08] p-8 md:p-10"
              label="Replace with final photography — /public/images/clean-meal-prep.jpg"
            >
              <div className="relative max-w-xl">
                <p className="text-[10px] font-semibold uppercase tracking-luxe text-health-400">
                  This Month's Nutrition Move
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-cream-50">
                  Protein Before Noise
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-cream-200/70">
                  30–40 grams of protein within 90 minutes of waking. It
                  stabilizes energy, kills the craving spiral, and protects
                  muscle as you age.
                </p>
              </div>
            </ImagePlaceholder>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {standards.map((standard, i) => (
              <Reveal key={standard.title} delay={Math.min(i * 0.05, 0.25)}>
                <Card className="flex h-full flex-col p-6">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-sm border border-health-500/30 bg-health-500/10">
                    <Icon name={standard.icon} className="h-5 w-5 text-health-400" />
                  </span>
                  <h3 className="font-display text-lg font-semibold text-cream-50">
                    {standard.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-300/70">
                    {standard.text}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {articles.length > 0 ? (
        <section className="bg-ink-900 py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHeader eyebrow="From the Blog" title="Nutrition Knowledge" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <BlogCard key={article.slug} article={article} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <CTASection
        headline="Fuel the Mission."
        subheadline="Members get the monthly nutrition focus, meal prep frameworks, and streak tracking in the dashboard."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
