/**
 * Core Categories — the twelve pillars of the platform.
 * Icons are Lucide icon names resolved in CategoryCard.
 */

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  accent: "gold" | "health" | "ember" | "focus";
}

export const categories: Category[] = [
  {
    id: "discipline",
    name: "Discipline",
    slug: "discipline",
    description: "Systems, standards, and self-command that outlast motivation.",
    icon: "Shield",
    accent: "gold",
  },
  {
    id: "focus",
    name: "Focus",
    slug: "focus",
    description: "Deep work, attention control, and distraction defense.",
    icon: "Crosshair",
    accent: "focus",
  },
  {
    id: "confidence",
    name: "Confidence",
    slug: "confidence",
    description: "Earned self-belief built on evidence, voice, and posture.",
    icon: "Flame",
    accent: "ember",
  },
  {
    id: "fitness",
    name: "Fitness",
    slug: "fitness",
    description: "Strength, mobility, and energy standards for every age.",
    icon: "Dumbbell",
    accent: "ember",
  },
  {
    id: "nutrition",
    name: "Nutrition",
    slug: "nutrition",
    description: "Clean fuel, meal prep strategy, and food discipline.",
    icon: "Apple",
    accent: "health",
  },
  {
    id: "money",
    name: "Money",
    slug: "money",
    description: "Budget habits, skill building, and stored discipline.",
    icon: "Wallet",
    accent: "gold",
  },
  {
    id: "books",
    name: "Books",
    slug: "books",
    description: "The monthly book stack, distilled into usable wisdom.",
    icon: "BookOpen",
    accent: "focus",
  },
  {
    id: "mentors",
    name: "Mentors",
    slug: "mentors",
    description: "Lessons from the mentor board — rotating every month.",
    icon: "GraduationCap",
    accent: "gold",
  },
  {
    id: "leadership",
    name: "Leadership",
    slug: "leadership",
    description: "Presence, decision-making, and leading yourself first.",
    icon: "Crown",
    accent: "gold",
  },
  {
    id: "goal-setting",
    name: "Goal Setting",
    slug: "goal-setting",
    description: "Written targets, timelines, and the man they require.",
    icon: "Target",
    accent: "focus",
  },
  {
    id: "ai-productivity",
    name: "AI Productivity",
    slug: "ai-productivity",
    description: "Modern leverage — AI workflows for the disciplined man.",
    icon: "Cpu",
    accent: "focus",
  },
  {
    id: "legacy-building",
    name: "Legacy Building",
    slug: "legacy-building",
    description: "Building the web, the name, and the life that outlasts you.",
    icon: "Landmark",
    accent: "ember",
  },
];
