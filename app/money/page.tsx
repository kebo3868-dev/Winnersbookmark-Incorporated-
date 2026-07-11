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
  title: "Money",
  description:
    "Money is stored discipline — budget habits, skill building, planning, income growth, and daily execution.",
};

const systems = [
  {
    icon: "Wallet",
    title: "Pay Yourself First",
    text: "Automatic transfers on payday, before you can touch the money. Automated discipline never has a weak day.",
  },
  {
    icon: "Shield",
    title: "The 24-Hour Rule",
    text: "Unplanned purchases over $50 wait a day. Most impulses die overnight; what survives was worth buying.",
  },
  {
    icon: "ListChecks",
    title: "Every Dollar a Job",
    text: "Budget before the month starts. A budget is you at full strength commanding your weaker moments.",
  },
  {
    icon: "Target",
    title: "Skill Building",
    text: "Thirty minutes daily on one income-raising skill. Cutting costs has a floor; earning has no ceiling.",
  },
  {
    icon: "BookOpen",
    title: "Reading & Planning",
    text: "The monthly money book plus a weekly planning session. Wealth is built on paper before it hits the account.",
  },
  {
    icon: "TrendingUp",
    title: "Income Growth",
    text: "Track net worth monthly and asks quarterly — the raise, the rate, the new client. Fortune favors the man who asks.",
  },
];

export default function MoneyPage() {
  const articles = getArticlesByCategory("Money");

  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow="Wealth Systems · Money"
            title="Money Is Stored Discipline."
            subtitle="Your bank account is a mirror of your habits, not your luck. Build the habits and the mirror changes."
          />

          <Reveal>
            <ImagePlaceholder
              src="/images/money-productivity.jpg"
              alt="Money habits, planning, and digital dashboards"
              gradient="from-gold-700/25 via-espresso-800 to-ink-950"
              className="flex min-h-[300px] items-end rounded-md border border-gold-500/20 p-8 md:p-10"
              label="Replace with final photography — /public/images/money-productivity.jpg"
            >
              <div className="relative max-w-xl">
                <p className="text-[10px] font-semibold uppercase tracking-luxe text-gold-400">
                  This Month's Money Skill
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-cream-50">
                  Automated Pay-Yourself-First
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-cream-200/70">
                  Set the transfer once, at full strength, and let the system
                  save while you sleep. Then run the 24-hour rule on everything
                  unplanned.
                </p>
              </div>
            </ImagePlaceholder>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {systems.map((system, i) => (
              <Reveal key={system.title} delay={Math.min(i * 0.05, 0.25)}>
                <Card className="flex h-full flex-col p-6">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-sm border border-gold-500/30 bg-gold-500/10">
                    <Icon name={system.icon} className="h-5 w-5 text-gold-400" />
                  </span>
                  <h3 className="font-display text-lg font-semibold text-cream-50">
                    {system.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-300/70">
                    {system.text}
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
            <SectionHeader eyebrow="From the Blog" title="Money Knowledge" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <BlogCard key={article.slug} article={article} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <CTASection
        headline="Store Your Discipline."
        subheadline="Members get the monthly money skill, budget frameworks, and habit tracking in the dashboard."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
