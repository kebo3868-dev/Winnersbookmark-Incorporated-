/**
 * Monthly Book Stack — DESIGNED TO ROTATE EVERY MONTH.
 *
 * These are the sample titles for the current month. To rotate: replace this
 * array (or add a new month entry keyed by `month`) and the entire site —
 * home section, /books page, dashboard — updates automatically.
 */

export interface MonthlyBook {
  id: string;
  title: string;
  author: string;
  focus: string;
  keyIdea: string;
  whyThisMonth: string;
  spineColor: string; // Tailwind gradient classes for the premium book spine
  accent: "gold" | "health" | "ember" | "focus";
}

export const bookStackMonth = "July 2026";

export const monthlyBooks: MonthlyBook[] = [
  {
    id: "deep-work",
    title: "Deep Work",
    author: "Cal Newport",
    focus: "Focus & Attention",
    keyIdea:
      "The ability to concentrate without distraction is becoming both rarer and more valuable — train it deliberately.",
    whyThisMonth:
      "Pairs with this month's discipline challenge: two deep-work hours before noon.",
    spineColor: "from-focus-500 to-ink-800",
    accent: "focus",
  },
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    focus: "Habit Architecture",
    keyIdea:
      "You do not rise to the level of your goals; you fall to the level of your systems. Get 1% better daily.",
    whyThisMonth:
      "The foundation text for every standard we set on this platform.",
    spineColor: "from-gold-600 to-espresso-800",
    accent: "gold",
  },
  {
    id: "48-laws",
    title: "The 48 Laws of Power",
    author: "Robert Greene",
    focus: "Strategy & Awareness",
    keyIdea:
      "Power dynamics run through every room. Learn the laws as armor — pattern recognition, not manipulation.",
    whyThisMonth:
      "Read alongside the Spider King Strategy article for the strategic layer.",
    spineColor: "from-ink-600 to-ink-900",
    accent: "ember",
  },
  {
    id: "think-and-grow-rich",
    title: "Think and Grow Rich",
    author: "Napoleon Hill",
    focus: "Wealth Mindset",
    keyIdea:
      "Definiteness of purpose, backed by burning desire and organized planning, is the starting point of all achievement.",
    whyThisMonth:
      "Anchors this month's money skill: writing a definite chief aim.",
    spineColor: "from-bronze-500 to-espresso-900",
    accent: "gold",
  },
  {
    id: "7-habits",
    title: "The 7 Habits of Highly Effective People",
    author: "Stephen R. Covey",
    focus: "Character & Effectiveness",
    keyIdea:
      "Private victory precedes public victory — be proactive, begin with the end in mind, put first things first.",
    whyThisMonth:
      "The character foundation under this month's leadership lesson.",
    spineColor: "from-health-500 to-ink-800",
    accent: "health",
  },
];
