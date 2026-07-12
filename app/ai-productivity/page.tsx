import type { Metadata } from "next";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { CTASection } from "@/components/sections/CTASection";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "AI Productivity",
  description:
    "Modern leverage for the disciplined man — AI workflows for drafting, research, planning, and focus systems.",
};

const plays = [
  {
    icon: "Cpu",
    title: "Delegate the Draft",
    text: "First drafts, summaries, and research sweeps go to AI. Judgment, taste, and standards stay with you.",
  },
  {
    icon: "Crosshair",
    title: "Focus Systems",
    text: "Use AI to plan the deep work block, not to interrupt it. The tool serves the schedule, never the reverse.",
  },
  {
    icon: "ListChecks",
    title: "Workflow Templates",
    text: "Turn every recurring task into a reusable prompt workflow. Build the web once; let it catch work forever.",
  },
  {
    icon: "BookOpen",
    title: "Learning Accelerator",
    text: "Interrogate books and ideas with AI — argue with the text, generate application plans, test your understanding.",
  },
  {
    icon: "Wallet",
    title: "Income Leverage",
    text: "The market pays for output. AI multiplies the output of the man who already has discipline and direction.",
  },
  {
    icon: "Shield",
    title: "Discipline Guardrails",
    text: "AI accelerates the disciplined and distracts the undisciplined. Standards first, tools second.",
  },
];

export default function AIProductivityPage() {
  return (
    <>
      <section className="relative bg-ink-950 pt-[72px]">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <SectionHeader
            eyebrow="Modern Leverage · AI Productivity"
            title="Delegate the Draft. Keep the Judgment."
            subtitle="AI is the newest strand in the web. Used with discipline, it multiplies a man's output; used without it, it multiplies his distraction."
          />

          <Reveal>
            <ImagePlaceholder
              src="/images/money-productivity.jpg"
              alt="AI productivity dashboards and focused digital work"
              gradient="from-focus-500/25 via-ink-800 to-ink-950"
              className="flex min-h-[300px] items-end rounded-md border border-focus-500/20 p-8 md:p-10"
              label="Replace with final photography — /public/images/money-productivity.jpg"
            >
              <div className="relative max-w-xl">
                <p className="text-[10px] font-semibold uppercase tracking-luxe text-focus-400">
                  This Month's AI Focus
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-cream-50">
                  One Workflow, Fully Built
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-cream-200/70">
                  Pick one recurring task — reports, emails, research — and
                  build a complete AI-assisted workflow for it this month.
                  Depth over dabbling.
                </p>
              </div>
            </ImagePlaceholder>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plays.map((play, i) => (
              <Reveal key={play.title} delay={Math.min(i * 0.05, 0.25)}>
                <Card className="flex h-full flex-col p-6">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-sm border border-focus-500/30 bg-focus-500/10">
                    <Icon name={play.icon} className="h-5 w-5 text-focus-400" />
                  </span>
                  <h3 className="font-display text-lg font-semibold text-cream-50">
                    {play.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-300/70">
                    {play.text}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        headline="Old-School Discipline. New-School Leverage."
        subheadline="Members get a new AI productivity tip every day and a full workflow build every month."
        buttonLabel="Start 7-Day Free Trial"
      />
    </>
  );
}
