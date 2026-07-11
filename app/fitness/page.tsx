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
  title: "Fitness",
  description:
    "Strength, mobility, walking, recovery, and healthy aging — realistic fitness standards for men of every age and level.",
};

const standards = [
  {
    icon: "Dumbbell",
    title: "Strength Training",
    text: "Three full-body sessions weekly. Progressive overload on the basics — squat, hinge, press, pull, carry.",
  },
  {
    icon: "Footprints",
    title: "Walking",
    text: "An 8,000-step daily floor. The most underrated fat-loss, recovery, and thinking tool a man owns.",
  },
  {
    icon: "HeartPulse",
    title: "Mobility",
    text: "Ten minutes daily — hips, shoulders, spine. The difference between aging and rusting.",
  },
  {
    icon: "Sunrise",
    title: "Recovery",
    text: "Sleep is the program. Seven-plus hours in a fixed window; the gym only works if the bed does.",
  },
  {
    icon: "Apple",
    title: "Hydration",
    text: "Water before coffee, a glass before every meal. Most fatigue is a hydration problem wearing a disguise.",
  },
  {
    icon: "Shield",
    title: "Healthy Aging",
    text: "Train for the decades: carry your own luggage at 70, lift your grandkids, stay dangerous.",
  },
];

export default function FitnessPage() {
  const articles = getArticlesByCategory("Fitness");

  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow="Body Systems · Fitness"
            title="Build the Body That Carries the Mission."
            subtitle="Not extreme bodybuilding — sustainable, realistic strength for men of every age and starting point."
          />

          <Reveal>
            <ImagePlaceholder
              src="/images/fitness-healthy-aging.jpg"
              alt="Men of different ages and fitness levels training realistically"
              gradient="from-ember-500/25 via-ink-800 to-ink-950"
              className="flex min-h-[300px] items-end rounded-md border border-cream-50/[0.08] p-8 md:p-10"
              label="Replace with final photography — /public/images/fitness-healthy-aging.jpg"
            >
              <div className="relative max-w-xl">
                <p className="text-[10px] font-semibold uppercase tracking-luxe text-ember-400">
                  This Month's Fitness Focus
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-cream-50">
                  Strength Foundations
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-cream-200/70">
                  Three strength sessions a week plus a daily step floor.
                  Consistency over intensity — the standard a man can hold for
                  thirty years beats the program he quits in thirty days.
                </p>
              </div>
            </ImagePlaceholder>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {standards.map((standard, i) => (
              <Reveal key={standard.title} delay={Math.min(i * 0.05, 0.25)}>
                <Card className="flex h-full flex-col p-6">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-sm border border-ember-500/30 bg-ember-500/10">
                    <Icon name={standard.icon} className="h-5 w-5 text-ember-400" />
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
            <SectionHeader eyebrow="From the Blog" title="Fitness Knowledge" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <BlogCard key={article.slug} article={article} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <CTASection
        headline="Lead Your Body First."
        subheadline="Members get the monthly fitness focus, weekly standards, and progress tracking in the dashboard."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
