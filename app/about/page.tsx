import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "About",
  description:
    "The story and standards behind Winnersbookmark Daily Blogs — Keith Warren's legacy platform for men who are serious about growth.",
};

export default function AboutPage() {
  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow="The Mission"
            title="A Legacy Platform, Not a Blog."
            subtitle="Winnersbookmark Daily Blogs exists to hand men the knowledge, structure, and standards to build forward — every single day."
          />

          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <ImagePlaceholder
                src="/images/hero-legacy-dashboard.jpg"
                alt="The Winnersbookmark legacy — men building daily"
                gradient="from-gold-700/30 via-espresso-800 to-ink-950"
                className="min-h-[360px] rounded-md border border-gold-500/20"
                label="Replace with final photography — /public/images"
              />
            </Reveal>

            <Reveal delay={0.1}>
              <div className="space-y-5 text-base leading-relaxed text-cream-300/80">
                <p>
                  Winnersbookmark Daily Blogs was founded by{" "}
                  <span className="font-semibold text-cream-50">
                    Keith Warren
                  </span>{" "}
                  under Winners Bookmark Incorporated with a single conviction:
                  a man doesn&apos;t change his life in one dramatic moment —
                  he changes it in daily increments, held to a standard.
                </p>
                <p>
                  So this platform runs on rhythm. Every day: a new blog, a new
                  lesson, a new standard, a new action step. Every month: the
                  mentors rotate, the books rotate, the theme rotates, the
                  challenge rotates. Nothing stays stale, because growth
                  doesn&apos;t either.
                </p>
                <p>
                  It is built for men 18 to 70 — the young man laying his
                  foundation, the builder leading a family, and the elder
                  still walking strong. Growth does not expire. Discipline has
                  no age limit.
                </p>
                <blockquote className="border-l-2 border-gold-500/60 pl-5 font-display text-xl italic text-cream-100">
                  &ldquo;Daily Discipline. Strategic Growth. Built for
                  Winners.&rdquo;
                </blockquote>
                <p className="text-[11px] uppercase tracking-luxe text-gold-500">
                  Keith Warren · Founder, Winners Bookmark Incorporated
                </p>
                <Button href="/membership" className="mt-2">
                  Join the System <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Reveal>
          </div>

          <div className="mt-20 grid gap-5 md:grid-cols-3">
            {[
              [
                "The Standard",
                "Premium knowledge, delivered daily. No filler, no recycled quotes — every drop ends in an action step.",
              ],
              [
                "The Rotation",
                "Monthly mentors, books, themes, and challenges keep the platform alive and the man evolving.",
              ],
              [
                "The Legacy",
                "This isn't content to consume. It's structure to build with — the web you'll be glad you built.",
              ],
            ].map(([title, text], i) => (
              <Reveal key={title} delay={Math.min(i * 0.06, 0.2)}>
                <div className="rounded-md border border-cream-50/[0.08] bg-ink-800/70 p-7">
                  <p className="font-display text-2xl font-semibold text-gold-500">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 font-display text-xl font-semibold text-cream-50">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-300/70">
                    {text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
