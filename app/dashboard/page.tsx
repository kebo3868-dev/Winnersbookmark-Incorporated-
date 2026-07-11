import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { Reveal } from "@/components/ui/Reveal";
import { dashboardTiles } from "@/data/dashboard";
import { rotationMonth, rotationTheme } from "@/data/challenges";
import { todayDateISO } from "@/data/dailyKnowledge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Member Dashboard",
  description:
    "Your command center — today's knowledge, this month's rotation, reading progress, saved articles, and the legacy tracker.",
};

/**
 * Member Dashboard — placeholder member experience.
 * In production this page sits behind authentication and renders live,
 * per-member data (see /login for the planned auth setup).
 */
export default function DashboardPage() {
  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <Reveal>
            <div className="flex flex-col justify-between gap-6 border-b border-cream-50/[0.08] pb-10 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-luxe text-gold-500">
                  Member Dashboard · {formatDate(todayDateISO)}
                </p>
                <h1 className="mt-3 font-display text-4xl font-semibold text-cream-50 md:text-5xl">
                  Welcome back, Winner.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-cream-300/70">
                  {rotationMonth} theme: {rotationTheme}. Today&apos;s knowledge
                  is live — one standard executed beats eight admired.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-ember-500/30 bg-ember-500/10 px-5 py-4">
                <Flame className="h-6 w-6 text-ember-400" />
                <div>
                  <p className="font-display text-2xl font-semibold text-cream-50">
                    12 days
                  </p>
                  <p className="text-[10px] uppercase tracking-luxe text-cream-300/50">
                    Current streak
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dashboardTiles.map((tile, i) => (
              <Reveal key={tile.id} delay={Math.min(i * 0.04, 0.3)}>
                <DashboardCard tile={tile} />
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10">
            <p className="text-center text-[10px] uppercase tracking-[0.14em] text-cream-300/30">
              Preview with sample data — live member tracking arrives with
              authentication
            </p>
          </Reveal>
        </div>
      </section>

      <CTASection
        headline="This Could Be Your Command Center."
        subheadline="Members track today's knowledge, monthly rotations, reading progress, and the legacy they're building — all in one place."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
