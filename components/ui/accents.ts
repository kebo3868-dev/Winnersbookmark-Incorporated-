/**
 * Accent system — maps semantic accents to Tailwind classes.
 * gold = discipline/wealth · health = green · ember = energy · focus = blue.
 */

export type Accent = "gold" | "health" | "ember" | "focus";

export const accentStyles: Record<
  Accent,
  { text: string; bg: string; border: string; bar: string }
> = {
  gold: {
    text: "text-gold-400",
    bg: "bg-gold-500/10",
    border: "border-gold-500/30",
    bar: "bg-gold-500",
  },
  health: {
    text: "text-health-400",
    bg: "bg-health-500/10",
    border: "border-health-500/30",
    bar: "bg-health-400",
  },
  ember: {
    text: "text-ember-400",
    bg: "bg-ember-500/10",
    border: "border-ember-500/30",
    bar: "bg-ember-400",
  },
  focus: {
    text: "text-focus-400",
    bg: "bg-focus-500/10",
    border: "border-focus-500/30",
    bar: "bg-focus-400",
  },
};
