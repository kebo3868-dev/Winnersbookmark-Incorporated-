import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { MentorCard } from "@/components/cards/MentorCard";
import { Reveal } from "@/components/ui/Reveal";
import { monthlyMentors, mentorBoardMonth } from "@/data/monthlyMentors";

export const metadata: Metadata = {
  title: "This Month's Mentor Board",
  description:
    "Nine mentors on the board this month — philosophy, elite performance, strategy, leadership, and voice. The board rotates monthly.",
};

export default function MentorsPage() {
  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow={`Mentor Wisdom · ${mentorBoardMonth}`}
            title="This Month's Mentor Board"
            subtitle="You become the standards of the men you study. Nine minds on the board this month — each with a core lesson and a monthly focus."
          />

          <Reveal className="mx-auto mb-12 flex max-w-xl items-center justify-center gap-3 rounded-md border border-gold-500/20 bg-ink-800/60 px-5 py-3">
            <RefreshCw className="h-4 w-4 shrink-0 text-gold-500" />
            <p className="text-xs leading-relaxed text-cream-300/70">
              The mentor board rotates on the 1st of every month. Different
              fields, different eras, one purpose: raising your standards.
            </p>
          </Reveal>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {monthlyMentors.map((mentor, i) => (
              <div key={mentor.id} id={mentor.id} className="scroll-mt-24">
                <Reveal delay={Math.min(i * 0.04, 0.25)}>
                  <MentorCard mentor={mentor} />
                </Reveal>
              </div>
            ))}
          </div>

          <Reveal className="mt-12 text-center">
            <p className="mx-auto max-w-lg text-xs leading-relaxed text-cream-300/40">
              Mentor imagery is symbolic — monograms, silhouettes, and
              typography. No celebrity photography is used or implied.
            </p>
          </Reveal>
        </div>
      </section>

      <CTASection
        headline="Study the Standard. Become the Standard."
        subheadline="Members get the full mentor deep-dives — daily lessons, signature frameworks, and the archive of every past board."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
