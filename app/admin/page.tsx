import type { Metadata } from "next";
import {
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Content operations for Winnersbookmark Daily Blogs.",
  robots: { index: false },
};

const panels = [
  {
    icon: FileText,
    title: "Daily Blog Publisher",
    text: "Write, schedule, and publish the daily article. Queue shows the next 14 days of planned drops.",
    stat: "10 published · 4 scheduled",
  },
  {
    icon: CalendarDays,
    title: "Monthly Rotation Manager",
    text: "Swap the mentor board, book stack, theme, and challenges for next month before rotation day.",
    stat: "Next rotation: Aug 1",
  },
  {
    icon: GraduationCap,
    title: "Mentor Board Editor",
    text: "Curate next month's nine mentors — fields, core lessons, monthly focuses, and quotes.",
    stat: "9 active · 27 archived",
  },
  {
    icon: BookOpen,
    title: "Book Stack Editor",
    text: "Set next month's five books with key ideas and reading plans.",
    stat: "5 active · 15 archived",
  },
  {
    icon: Users,
    title: "Members",
    text: "Trials, active subscriptions, churn, and engagement once payments and auth are live.",
    stat: "Awaiting integration",
  },
  {
    icon: Settings,
    title: "Site Settings",
    text: "Branding, SEO defaults, checkout links, and notification templates.",
    stat: "3 pending tasks",
  },
];

/**
 * Admin Dashboard — PLACEHOLDER.
 * In production this route sits behind admin-only authentication and drives
 * the CMS/database that replaces the static /data files.
 */
export default function AdminPage() {
  return (
    <section className="relative min-h-screen bg-ink-950 pt-[72px]">
      <div className="absolute inset-0 bg-gold-radial" />
      <div className="relative mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
        <SectionHeader
          align="left"
          eyebrow="Winners Bookmark Incorporated · Internal"
          title="Admin Dashboard"
          subtitle="Content operations for the daily and monthly rotation systems. Placeholder — connects to the CMS when live."
        />

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {panels.map((panel, i) => (
            <Reveal key={panel.title} delay={Math.min(i * 0.05, 0.25)}>
              <Card className="flex h-full flex-col p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-gold-500/30 bg-gold-500/10">
                    <panel.icon className="h-5 w-5 text-gold-400" />
                  </span>
                  <LayoutDashboard className="h-4 w-4 text-cream-300/20" />
                </div>
                <h2 className="font-display text-lg font-semibold text-cream-50">
                  {panel.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-cream-300/70">
                  {panel.text}
                </p>
                <p className="mt-4 border-t border-cream-50/[0.06] pt-3 text-[10px] font-semibold uppercase tracking-luxe text-gold-500/80">
                  {panel.stat}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10">
          <p className="text-[10px] uppercase tracking-[0.14em] text-cream-300/30">
            Placeholder admin — gate behind admin auth before launch
          </p>
        </Reveal>
      </div>
    </section>
  );
}
