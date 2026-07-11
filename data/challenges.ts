/**
 * Monthly Rotation — mentors, books, and standards that change every month.
 *
 * This is the rotation dashboard data. Swap `monthlyRotation` at the start of
 * each month (or key entries by month in production) and the Monthly Rotation
 * section + page update everywhere automatically.
 */

export interface RotationItem {
  id: string;
  label: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name resolved in MonthlyRotationCard
  accent: "gold" | "health" | "ember" | "focus";
  href: string;
}

export const rotationMonth = "July 2026";
export const rotationTheme = "Build the Web — Systems Before Opportunity";

export const monthlyRotation: RotationItem[] = [
  {
    id: "mentor",
    label: "Mentor of the Month",
    title: "Jim Rohn",
    description:
      "The philosophy of personal development: work harder on yourself than on your job, and let disciplines compound.",
    icon: "GraduationCap",
    accent: "gold",
    href: "/mentors",
  },
  {
    id: "book",
    label: "Book of the Month",
    title: "Deep Work — Cal Newport",
    description:
      "Focus is the new capital. This month we train attention like a lift: progressive, scheduled, protected.",
    icon: "BookOpen",
    accent: "focus",
    href: "/books",
  },
  {
    id: "fitness",
    label: "Fitness Focus of the Month",
    title: "Strength Foundations",
    description:
      "Three full-body strength sessions weekly plus a daily 8,000-step floor. Build the frame that carries the mission.",
    icon: "Dumbbell",
    accent: "ember",
    href: "/fitness",
  },
  {
    id: "money",
    label: "Money Skill of the Month",
    title: "Automated Pay-Yourself-First",
    description:
      "Set up automatic transfers on payday and run the 24-hour rule on every unplanned purchase over $50.",
    icon: "Wallet",
    accent: "gold",
    href: "/money",
  },
  {
    id: "discipline",
    label: "Discipline Challenge of the Month",
    title: "The First 90 Challenge",
    description:
      "For 30 days: no phone for the first 90 minutes after waking. Own the morning before the world does.",
    icon: "Shield",
    accent: "ember",
    href: "/monthly-rotation",
  },
  {
    id: "leadership",
    label: "Leadership Lesson of the Month",
    title: "Calm Is a Decision",
    description:
      "Composure under pressure, drawn from Marcus Aurelius and modern command rooms. Slow is smooth; smooth is fast.",
    icon: "Crown",
    accent: "focus",
    href: "/monthly-rotation",
  },
];

export interface WeeklyChallenge {
  week: number;
  title: string;
  standard: string;
}

export const weeklyChallenges: WeeklyChallenge[] = [
  {
    week: 1,
    title: "Own the Morning",
    standard: "No phone for the first 90 minutes. One deep-work block before noon, every day.",
  },
  {
    week: 2,
    title: "Fuel Discipline",
    standard: "Protein at every meal, water before coffee, kitchen closed by 9pm.",
  },
  {
    week: 3,
    title: "Money Audit",
    standard: "Read every transaction from the last 30 days. Cancel two subscriptions your future self wouldn't keep.",
  },
  {
    week: 4,
    title: "Build a Strand",
    standard: "Create one asset that works without you — a post, a system, a template, a relationship.",
  },
];
