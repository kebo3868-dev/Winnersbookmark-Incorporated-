import { ArrowRight, BookOpen, Dumbbell, GraduationCap, PenLine, Salad, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { formatDate } from "@/lib/utils";
import { todayDateISO } from "@/data/dailyKnowledge";

/**
 * HeroSection — cinematic dashboard/collage hero.
 * The collage tiles are premium gradient placeholders; final photography
 * goes in /public/images (hero-legacy-dashboard.jpg and friends).
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-ink-950 pt-[72px]">
      {/* Atmosphere: gold radial + grain */}
      <div className="absolute inset-0 bg-gold-radial" />
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(250,246,238,0.04)_1px,transparent_1px)] [background-size:26px_26px]" />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 md:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-28">
        <Reveal>
          <p className="mb-6 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-luxe text-gold-500">
            <span className="h-px w-10 bg-gold-500/60" />
            Daily Discipline · Strategic Growth · Built for Winners
          </p>

          <h1 className="font-display text-4xl font-semibold leading-[1.08] text-cream-50 sm:text-5xl lg:text-[3.6rem]">
            New Knowledge Every Day.{" "}
            <span className="text-gold-400">A Stronger Man</span> Every Month.
          </h1>

          <p className="mt-4 font-display text-lg italic text-cream-300/70">
            Become the man your future respects.
          </p>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-cream-300/80 md:text-lg">
            Daily blogs, book wisdom, mentor lessons, fitness systems,
            nutrition guidance, money habits, AI productivity, and discipline
            challenges — for men who are serious about growth.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Button href="/today" size="lg">
              Read Today&apos;s Knowledge <ArrowRight className="h-4 w-4" />
            </Button>
            <Button href="/membership" variant="outline" size="lg">
              Start 7-Day Free Trial
            </Button>
            <Button href="/mentors" variant="ghost" size="lg">
              View This Month&apos;s Mentors
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-cream-50/[0.08] pt-6">
            {[
              ["365", "New blogs per year"],
              ["12", "Mentor boards annually"],
              ["60+", "Books distilled"],
            ].map(([stat, label]) => (
              <div key={label}>
                <p className="font-display text-2xl font-semibold text-gold-400">
                  {stat}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-luxe text-cream-300/50">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Collage-style legacy dashboard */}
        <Reveal delay={0.15}>
          <div className="relative">
            <div className="absolute -inset-6 rounded-lg bg-gold-500/[0.05] blur-2xl" />
            <div className="relative grid grid-cols-2 gap-3">
              <ImagePlaceholder
                src="/images/hero-legacy-dashboard.jpg"
                alt="Men of all ages training, reading, and building discipline"
                gradient="from-gold-700/40 via-espresso-800 to-ink-950"
                className="col-span-2 flex h-44 flex-col justify-end rounded-md border border-gold-500/20 p-5 sm:h-52"
              >
                <div className="relative">
                  <p className="text-[9px] font-semibold uppercase tracking-luxe text-gold-400">
                    Today&apos;s Knowledge · {formatDate(todayDateISO)}
                  </p>
                  <p className="mt-1.5 font-display text-xl font-semibold text-cream-50">
                    Discipline Beats Motivation
                  </p>
                  <p className="text-xs italic text-cream-200/60">
                    Motivation is emotion. Discipline is architecture.
                  </p>
                </div>
              </ImagePlaceholder>

              {[
                {
                  icon: Dumbbell,
                  title: "Fitness Standard",
                  sub: "The Non-Negotiable 40",
                  gradient: "from-ember-500/30 via-ink-800 to-ink-950",
                  src: "/images/discipline-training.jpg",
                },
                {
                  icon: Salad,
                  title: "Clean Eating",
                  sub: "Protein Before Noise",
                  gradient: "from-health-500/30 via-ink-800 to-ink-950",
                  src: "/images/clean-nutrition.jpg",
                },
                {
                  icon: BookOpen,
                  title: "Book of the Month",
                  sub: "Deep Work — Newport",
                  gradient: "from-focus-500/30 via-ink-800 to-ink-950",
                  src: "/images/monthly-book-stack.jpg",
                },
                {
                  icon: GraduationCap,
                  title: "Mentor Board",
                  sub: "Jim Rohn · July",
                  gradient: "from-gold-600/30 via-espresso-800 to-ink-950",
                  src: "/images/monthly-mentor-board.jpg",
                },
              ].map((tile) => (
                <ImagePlaceholder
                  key={tile.title}
                  src={tile.src}
                  alt={tile.title}
                  gradient={tile.gradient}
                  className="flex h-32 flex-col justify-end rounded-md border border-cream-50/[0.08] p-4 sm:h-36"
                >
                  <tile.icon className="absolute right-3.5 top-3.5 h-4 w-4 text-cream-50/40" />
                  <div className="relative">
                    <p className="text-[9px] font-semibold uppercase tracking-luxe text-gold-400">
                      {tile.title}
                    </p>
                    <p className="mt-1 text-sm font-medium text-cream-100">
                      {tile.sub}
                    </p>
                  </div>
                </ImagePlaceholder>
              ))}

              <div className="col-span-2 flex items-center justify-between rounded-md border border-cream-50/[0.08] bg-ink-800/80 px-5 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-gold-500/30 bg-gold-500/10">
                    <TrendingUp className="h-4 w-4 text-gold-400" />
                  </span>
                  <div>
                    <p className="text-[9px] uppercase tracking-luxe text-cream-300/50">
                      Money Habit + AI Productivity
                    </p>
                    <p className="text-sm font-medium text-cream-100">
                      Pay yourself first · Delegate the draft
                    </p>
                  </div>
                </div>
                <PenLine className="h-4 w-4 text-cream-300/30" />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
