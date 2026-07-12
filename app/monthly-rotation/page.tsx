import type { Metadata } from "next";
import { RefreshCw, Trophy } from "lucide-react";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { MonthlyRotationCard } from "@/components/cards/MonthlyRotationCard";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import {
  monthlyRotation,
  rotationMonth,
  rotationTheme,
  weeklyChallenges,
} from "@/data/challenges";

export const metadata: Metadata = {
  title: "Monthly Rotation",
  description:
    "The rotating monthly system — mentor, book, fitness focus, money skill, discipline challenge, and leadership lesson. Everything changes every month.",
};

export default function MonthlyRotationPage() {
  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow={`The Rotation Engine · ${rotationMonth}`}
            title="Nothing Here Stays Stale."
            subtitle={`This month's theme: ${rotationTheme}. On the 1st, everything below rotates — new mentor, new book, new standards.`}
          />

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {monthlyRotation.map((item, i) => (
              <Reveal key={item.id} delay={Math.min(i * 0.05, 0.25)}>
                <MonthlyRotationCard item={item} month={rotationMonth} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Weekly challenges */}
      <section className="bg-ink-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeader
            eyebrow="Inside the Month"
            title="This Month's Weekly Challenges"
            subtitle="Each month breaks into four weekly standards. Stack all four and the month changes you."
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {weeklyChallenges.map((challenge, i) => (
              <Reveal key={challenge.week} delay={Math.min(i * 0.06, 0.25)}>
                <Card className="flex h-full flex-col p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-gold-500/30 bg-gold-500/10">
                      <Trophy className="h-4 w-4 text-gold-400" />
                    </span>
                    <span className="font-display text-3xl font-semibold text-ink-500">
                      W{challenge.week}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-cream-50">
                    {challenge.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-300/70">
                    {challenge.standard}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12 flex items-center justify-center gap-3 text-center">
            <RefreshCw className="h-4 w-4 text-gold-500" />
            <p className="text-xs uppercase tracking-luxe text-cream-300/50">
              Rotation day: the 1st of every month
            </p>
          </Reveal>
        </div>
      </section>

      <CTASection
        headline="Twelve Months. Twelve Transformations."
        subheadline="A year on this platform means twelve mentors, twelve book stacks, twelve discipline challenges — and one significantly stronger man."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
