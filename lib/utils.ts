/**
 * Shared utilities for Winnersbookmark Daily Blogs.
 */

/** Join conditional class names — a lightweight `cn` helper. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Format an ISO date (YYYY-MM-DD) as a long editorial date. */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** The current month label used across the monthly rotation system. */
export function currentMonthLabel(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
