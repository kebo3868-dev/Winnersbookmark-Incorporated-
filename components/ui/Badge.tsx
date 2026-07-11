import { cn } from "@/lib/utils";
import { accentStyles, type Accent } from "./accents";

interface BadgeProps {
  children: React.ReactNode;
  accent?: Accent;
  className?: string;
}

export function Badge({ children, accent = "gold", className }: BadgeProps) {
  const styles = accentStyles[accent];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-luxe",
        styles.text,
        styles.bg,
        styles.border,
        className
      )}
    >
      {children}
    </span>
  );
}
