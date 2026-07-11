import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { HeroSection } from "@/components/sections/HeroSection";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { PricingSection } from "@/components/sections/PricingSection";
import { CTASection } from "@/components/sections/CTASection";
import { DailyKnowledgeCard } from "@/components/cards/DailyKnowledgeCard";
import { MonthlyRotationCard } from "@/components/cards/MonthlyRotationCard";
import { LifestyleCard } from "@/components/cards/LifestyleCard";
import { CategoryCard } from "@/components/cards/CategoryCard";
import { FeaturedArticle } from "@/components/cards/FeaturedArticle";
import { BookCard } from "@/components/cards/BookCard";
import { MentorCard } from "@/components/cards/MentorCard";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { dailyKnowledge } from "@/data/dailyKnowledge";
import { monthlyRotation, rotationMonth, rotationTheme } from "@/data/challenges";
import { lifestyleCards } from "@/data/lifestyleCards";
import { categories } from "@/data/categories";
import { featuredArticle } from "@/data/articles";
import { monthlyBooks, bookStackMonth } from "@/data/monthlyBooks";
import { monthlyMentors, mentorBoardMonth } from "@/data/monthlyMentors";
import { dashboardTiles } from "@/data/dashboard";

export default function HomePage() {
  return (
    <>
      {/* 1 — Hero */}
      <HeroSection />

      {/* 2 — Daily Knowledge */}
      <section className="relative border-t border-cream-50/[0.06] bg-ink-900 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow="The Daily System"
            title="Every Day, New Knowledge."
            subtitle="Eight fresh drops, every single day. Yesterday's lessons are archived; today's standards are live."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {dailyKnowledge.map((item, i) => (
              <Reveal key={item.id} delay={Math.min(i * 0.05, 0.3)}>
                <DailyKnowledgeCard item={item} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3 — Monthly Rotation */}
      <section className="relative bg-ink-950 py-20 md:py-28">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow={`Monthly Rotation · ${rotationMonth}`}
            title="New Mentors. New Books. New Standards Every Month."
            subtitle={`This month's theme: ${rotationTheme}. When the month turns, everything rotates — nothing on this platform stays stale.`}
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {monthlyRotation.map((item, i) => (
              <Reveal key={item.id} delay={Math.min(i * 0.05, 0.25)}>
                <MonthlyRotationCard item={item} month={rotationMonth} />
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10 text-center">
            <Link
              href="/monthly-rotation"
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-luxe text-gold-500 transition-colors hover:text-gold-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              See the Full Monthly Rotation
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* 4 — Men of All Ages Lifestyle */}
      <section className="border-t border-cream-50/[0.06] bg-ink-900 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow="Every Age. Every Stage."
            title="Built for Every Man Still Becoming."
            subtitle="Growth does not expire. Discipline has no age limit."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {lifestyleCards.map((card, i) => (
              <Reveal key={card.id} delay={Math.min(i * 0.05, 0.3)}>
                <LifestyleCard card={card} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5 — Core Categories */}
      <section className="bg-ink-950 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow="The Twelve Pillars"
            title="Choose Your Battlefield."
            subtitle="Twelve domains of mastery. Every article, mentor, and challenge maps to one of them."
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

      {/* 6 — Featured Daily Blog */}
      <section className="border-t border-cream-50/[0.06] bg-ink-900 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow="Fresh Off the Press"
            title="Today's Featured Knowledge"
          />
          <FeaturedArticle article={featuredArticle} />
        </div>
      </section>

      {/* 7 — Book Wisdom */}
      <section className="bg-ink-950 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow={`Book Wisdom · Rotates Monthly · ${bookStackMonth}`}
            title="This Month's Book Stack"
            subtitle="Five titles, distilled into daily insights. Next month: a brand-new stack."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {monthlyBooks.map((book, i) => (
              <Reveal key={book.id} delay={Math.min(i * 0.05, 0.25)}>
                <BookCard book={book} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 8 — Mentor Wisdom */}
      <section className="border-t border-cream-50/[0.06] bg-ink-900 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow={`Mentor Wisdom · Rotates Monthly · ${mentorBoardMonth}`}
            title="This Month's Mentor Board"
            subtitle="Nine minds on the board this month — philosophy, performance, power, and voice."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {monthlyMentors.map((mentor, i) => (
              <Reveal key={mentor.id} delay={Math.min(i * 0.04, 0.25)}>
                <MentorCard mentor={mentor} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 9 — Fitness & Nutrition */}
      <section className="bg-ink-950 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow="Body Systems"
            title="Build the Body That Carries the Mission."
            subtitle="Strength, mobility, walking, recovery, hydration, clean meals — realistic standards for every age and starting point."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <Reveal>
              <ImagePlaceholder
                src="/images/fitness-healthy-aging.jpg"
                alt="Men of all ages training with realistic, sustainable standards"
                gradient="from-ember-500/25 via-ink-800 to-ink-950"
                className="flex min-h-[320px] flex-col justify-end rounded-md border border-cream-50/[0.08] p-8"
              >
                <div className="relative">
                  <p className="text-[10px] font-semibold uppercase tracking-luxe text-ember-400">
                    Fitness Standards
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-cream-50">
                    Strength · Mobility · Walking · Recovery
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-cream-200/70">
                    Three strength sessions, a daily step floor, real sleep, and
                    hydration. Healthy aging over extreme bodybuilding —
                    sustainable power at 25, 45, and 70.
                  </p>
                  <Button href="/fitness" variant="outline" size="sm" className="mt-6">
                    Explore Fitness <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </ImagePlaceholder>
            </Reveal>
            <Reveal delay={0.1}>
              <ImagePlaceholder
                src="/images/clean-meal-prep.jpg"
                alt="Clean meals and disciplined meal prep"
                gradient="from-health-500/25 via-ink-800 to-ink-950"
                className="flex min-h-[320px] flex-col justify-end rounded-md border border-cream-50/[0.08] p-8"
              >
                <div className="relative">
                  <p className="text-[10px] font-semibold uppercase tracking-luxe text-health-400">
                    Nutrition Standards
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-cream-50">
                    Clean Meals · Meal Prep · Protein · Energy
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-cream-200/70">
                    Decide once on Sunday, execute all week. Protein at every
                    meal, water before coffee, whole foods you can name — fuel
                    for the mission, not the mood.
                  </p>
                  <Button href="/nutrition" variant="outline" size="sm" className="mt-6">
                    Explore Nutrition <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </ImagePlaceholder>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 10 — Money & Productivity */}
      <section className="border-t border-cream-50/[0.06] bg-ink-900 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow="Wealth Systems"
            title="Money Is Stored Discipline."
            subtitle="Skill building, budget habits, AI productivity, reading, planning, and daily execution — the compounding machine."
          />
          <Reveal>
            <ImagePlaceholder
              src="/images/money-productivity.jpg"
              alt="Money habits and AI productivity dashboards"
              gradient="from-gold-700/25 via-espresso-800 to-ink-950"
              className="flex min-h-[300px] flex-col justify-center rounded-md border border-gold-500/20 p-8 md:p-12"
            >
              <div className="relative grid gap-8 md:grid-cols-3">
                {[
                  {
                    title: "Budget Habits",
                    text: "Pay yourself first, the 24-hour rule, and every dollar assigned a job before the month starts.",
                    href: "/money",
                  },
                  {
                    title: "Skill Building",
                    text: "Thirty minutes daily on one income-raising skill — writing, selling, leadership, leverage.",
                    href: "/money",
                  },
                  {
                    title: "AI Productivity",
                    text: "Delegate the draft, keep the judgment. Modern leverage for the disciplined man.",
                    href: "/ai-productivity",
                  },
                ].map((block) => (
                  <div key={block.title}>
                    <h3 className="font-display text-xl font-semibold text-gold-300">
                      {block.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-cream-200/70">
                      {block.text}
                    </p>
                    <Link
                      href={block.href}
                      className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-500 transition-colors hover:text-gold-300"
                    >
                      Learn More <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </ImagePlaceholder>
          </Reveal>
        </div>
      </section>

      {/* 11 — Membership */}
      <PricingSection />

      {/* 12 — Member Dashboard Preview */}
      <section className="border-t border-cream-50/[0.06] bg-ink-900 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow="Inside the Membership"
            title="Your Command Center."
            subtitle="The member dashboard tracks today's knowledge, this month's rotation, and the legacy you're building."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {dashboardTiles.slice(0, 8).map((tile, i) => (
              <Reveal key={tile.id} delay={Math.min(i * 0.04, 0.25)}>
                <DashboardCard tile={tile} />
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10 text-center">
            <Button href="/dashboard" variant="outline">
              Preview the Full Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </Reveal>
        </div>
      </section>

      {/* 13 — Final CTA */}
      <CTASection />
    </>
  );
}
