/**
 * Daily Knowledge — the heartbeat of the platform.
 *
 * Every item here is designed to be swapped out DAILY. In production this
 * file becomes a CMS collection or database table keyed by date; for now it
 * is static data that renders "today's" drops across the site.
 */

export interface DailyKnowledgeItem {
  id: string;
  label: string;
  title: string;
  insight: string;
  action: string;
  icon: string; // Lucide icon name resolved in DailyKnowledgeCard
  accent: "gold" | "health" | "ember" | "focus";
  href: string;
}

export const todayDateISO = "2026-07-11";

export const dailyKnowledge: DailyKnowledgeItem[] = [
  {
    id: "discipline",
    label: "Today's Discipline Lesson",
    title: "Win the First 90 Minutes",
    insight:
      "The first 90 minutes of your day set the tone for the next fourteen hours. Guard them like a vault — no phone, no feeds, no other people's priorities.",
    action: "Tomorrow morning: no screen until one meaningful task is complete.",
    icon: "Shield",
    accent: "gold",
    href: "/blog/discipline-beats-motivation",
  },
  {
    id: "fitness",
    label: "Today's Fitness Standard",
    title: "The Non-Negotiable 40",
    insight:
      "Forty minutes of intentional movement, every day, regardless of mood. Strength three days, walking or mobility the rest. Consistency beats intensity.",
    action: "Schedule tomorrow's 40 minutes now — put it in the calendar like a meeting.",
    icon: "Dumbbell",
    accent: "ember",
    href: "/fitness",
  },
  {
    id: "nutrition",
    label: "Today's Nutrition Move",
    title: "Protein Before Noise",
    insight:
      "Eat 30–40g of protein within 90 minutes of waking. It stabilizes energy, kills the mid-morning craving spiral, and protects muscle as you age.",
    action: "Prep tomorrow's high-protein breakfast tonight — decide once, not at 7am.",
    icon: "Apple",
    accent: "health",
    href: "/nutrition",
  },
  {
    id: "money",
    label: "Today's Money Habit",
    title: "The 24-Hour Purchase Rule",
    insight:
      "Any unplanned purchase over $50 waits 24 hours. Most impulses die overnight. What survives is usually worth buying — everything else was emotion.",
    action: "Move one impulse purchase from this week into a 24-hour holding list.",
    icon: "Wallet",
    accent: "gold",
    href: "/money",
  },
  {
    id: "book",
    label: "Today's Book Insight",
    title: "Deep Work: Attention Is the New Capital",
    insight:
      "Cal Newport's core claim: the ability to focus without distraction is becoming both rarer and more valuable. Whoever protects attention wins the decade.",
    action: "Block one 90-minute deep work session for tomorrow. Phone in another room.",
    icon: "BookOpen",
    accent: "focus",
    href: "/books",
  },
  {
    id: "mentor",
    label: "Today's Mentor Lesson",
    title: "Jim Rohn: Work Harder on Yourself",
    insight:
      "\"Work harder on yourself than you do on your job.\" Income rarely exceeds personal development — the market pays for the man you become.",
    action: "Invest 30 minutes today in a skill nobody is paying you for yet.",
    icon: "GraduationCap",
    accent: "gold",
    href: "/mentors",
  },
  {
    id: "ai",
    label: "Today's AI Productivity Tip",
    title: "Delegate the Draft, Keep the Judgment",
    insight:
      "Use AI for first drafts, summaries, and research sweeps — then apply your own judgment, taste, and standards. AI accelerates the disciplined and exposes the lazy.",
    action: "Pick one recurring writing task this week and build an AI-assisted workflow for it.",
    icon: "Cpu",
    accent: "focus",
    href: "/ai-productivity",
  },
  {
    id: "reflection",
    label: "Today's Reflection Question",
    title: "The Future Self Audit",
    insight:
      "If the man you want to be in five years watched a replay of today, what would he keep — and what would he cut?",
    action: "Write your answer in two sentences before you sleep tonight.",
    icon: "PenLine",
    accent: "ember",
    href: "/today",
  },
];
