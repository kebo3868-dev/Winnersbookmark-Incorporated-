import {
  Apple,
  BookMarked,
  BookOpen,
  Bookmark,
  Cpu,
  Crosshair,
  Crown,
  Dumbbell,
  Flame,
  Footprints,
  GraduationCap,
  HeartPulse,
  Landmark,
  ListChecks,
  PenLine,
  Shield,
  Sunrise,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  Weight,
  type LucideIcon,
} from "lucide-react";

/** Explicit icon registry so data files can reference icons by name. */
const registry: Record<string, LucideIcon> = {
  Apple,
  BookMarked,
  BookOpen,
  Bookmark,
  Cpu,
  Crosshair,
  Crown,
  Dumbbell,
  Flame,
  Footprints,
  GraduationCap,
  HeartPulse,
  Landmark,
  ListChecks,
  PenLine,
  Shield,
  Sunrise,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  Weight,
};

export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Component = registry[name] ?? Shield;
  return <Component className={className} aria-hidden="true" />;
}
