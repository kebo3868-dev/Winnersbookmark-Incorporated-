/**
 * Member Dashboard — placeholder data for the member experience.
 * In production this is generated per-member from their activity + the
 * current daily/monthly rotation.
 */

export interface DashboardTile {
  id: string;
  label: string;
  title: string;
  detail: string;
  icon: string; // Lucide icon name resolved in DashboardCard
  accent: "gold" | "health" | "ember" | "focus";
  progress?: number; // 0–100 for tiles that track progress
  href: string;
}

export const memberName = "Member";

export const dashboardTiles: DashboardTile[] = [
  {
    id: "today",
    label: "Today's Knowledge",
    title: "Discipline Beats Motivation",
    detail: "Today's blog, lesson, and action step are live. 8 min read.",
    icon: "Sunrise",
    accent: "gold",
    href: "/today",
  },
  {
    id: "mentor",
    label: "Monthly Mentor",
    title: "Jim Rohn",
    detail: "This month: daily disciplines and the compounding of small habits.",
    icon: "GraduationCap",
    accent: "gold",
    href: "/mentors",
  },
  {
    id: "book",
    label: "Monthly Book",
    title: "Deep Work — Cal Newport",
    detail: "Chapter focus this week: ritualize your deep work blocks.",
    icon: "BookOpen",
    accent: "focus",
    progress: 45,
    href: "/books",
  },
  {
    id: "challenge",
    label: "Weekly Challenge",
    title: "Week 2 — Fuel Discipline",
    detail: "Protein at every meal, water before coffee, kitchen closed by 9pm.",
    icon: "Trophy",
    accent: "ember",
    progress: 57,
    href: "/monthly-rotation",
  },
  {
    id: "fitness",
    label: "Fitness Standard",
    title: "Strength Foundations",
    detail: "2 of 3 strength sessions done this week. Steps average: 8,420.",
    icon: "Dumbbell",
    accent: "ember",
    progress: 66,
    href: "/fitness",
  },
  {
    id: "nutrition",
    label: "Nutrition Move",
    title: "Protein Before Noise",
    detail: "5-day streak on the morning protein standard. Keep the chain alive.",
    icon: "Apple",
    accent: "health",
    progress: 71,
    href: "/nutrition",
  },
  {
    id: "money",
    label: "Money Habit",
    title: "Pay Yourself First",
    detail: "Auto-transfer active. 24-hour rule saved you an estimated $180 this month.",
    icon: "Wallet",
    accent: "gold",
    progress: 80,
    href: "/money",
  },
  {
    id: "reading",
    label: "Reading Progress",
    title: "128 pages this month",
    detail: "On pace for the monthly book. Daily floor: 10 pages.",
    icon: "BookMarked",
    accent: "focus",
    progress: 45,
    href: "/books",
  },
  {
    id: "saved",
    label: "Saved Articles",
    title: "6 articles bookmarked",
    detail: "Latest save: The Spider King Strategy — build the web before you hunt.",
    icon: "Bookmark",
    accent: "gold",
    href: "/blog",
  },
  {
    id: "legacy",
    label: "Legacy Tracker",
    title: "3 strands built this month",
    detail: "Assets created that work without you: 3 of 4 monthly target.",
    icon: "Landmark",
    accent: "ember",
    progress: 75,
    href: "/dashboard",
  },
];
