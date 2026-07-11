/**
 * Lifestyle Cards — "Built for Every Man Still Becoming."
 *
 * Cinematic lifestyle imagery placeholders. Final photography goes in
 * /public/images using the `image` filenames below (see ImagePlaceholder).
 */

export interface LifestyleCard {
  id: string;
  title: string;
  caption: string;
  image: string; // path under /public/images — drop final photography here
  gradient: string; // premium gradient placeholder until photography lands
  icon: string; // Lucide icon name
  tag: string;
}

export const lifestyleCards: LifestyleCard[] = [
  {
    id: "young-training",
    title: "The Young Man Training Focus",
    caption: "Building the discipline engine early — reps before recognition.",
    image: "/images/discipline-training.jpg",
    gradient: "from-ember-500/30 via-ink-800 to-ink-950",
    icon: "Dumbbell",
    tag: "20s — Foundation",
  },
  {
    id: "midlife-health",
    title: "The Builder Rebuilding His Health",
    caption: "Strength, sleep, and clean fuel — leading the family from the front.",
    image: "/images/men-of-all-ages-health.jpg",
    gradient: "from-health-500/30 via-ink-800 to-ink-950",
    icon: "HeartPulse",
    tag: "40s — Command",
  },
  {
    id: "elder-strong",
    title: "The Elder Walking Strong",
    caption: "Walking, stretching, reading — staying sharp and dangerous at every age.",
    image: "/images/fitness-healthy-aging.jpg",
    gradient: "from-gold-500/25 via-espresso-800 to-ink-950",
    icon: "Footprints",
    tag: "60s+ — Legacy",
  },
  {
    id: "clean-eating",
    title: "Men Eating Clean",
    caption: "Whole food, real fuel — every plate a vote for the mission.",
    image: "/images/clean-nutrition.jpg",
    gradient: "from-health-500/25 via-ink-800 to-ink-950",
    icon: "Apple",
    tag: "Nutrition",
  },
  {
    id: "writing-goals",
    title: "Men Writing Goals",
    caption: "Pen to paper — written targets with timelines and standards.",
    image: "/images/reading-and-journaling.jpg",
    gradient: "from-focus-500/30 via-ink-800 to-ink-950",
    icon: "PenLine",
    tag: "Goal Setting",
  },
  {
    id: "lifting",
    title: "Men Under the Bar",
    caption: "Progressive overload — the body keeps the score of your promises.",
    image: "/images/discipline-training.jpg",
    gradient: "from-ember-500/25 via-ink-800 to-ink-950",
    icon: "Weight",
    tag: "Strength",
  },
  {
    id: "studying",
    title: "Men Studying Books",
    caption: "The monthly stack, underlined and applied — not just displayed.",
    image: "/images/monthly-book-stack.jpg",
    gradient: "from-gold-500/25 via-ink-800 to-ink-950",
    icon: "BookOpen",
    tag: "Books",
  },
  {
    id: "better-habits",
    title: "Men Building Better Habits",
    caption: "Meal prep, morning routines, tracked streaks — architecture over emotion.",
    image: "/images/clean-meal-prep.jpg",
    gradient: "from-bronze-500/30 via-espresso-800 to-ink-950",
    icon: "ListChecks",
    tag: "Habits",
  },
];
