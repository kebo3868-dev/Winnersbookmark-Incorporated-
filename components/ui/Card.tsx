import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  id?: string;
}

/** Base luxury card — deep charcoal surface, hairline border, gold hover. */
export function Card({ children, className, hover = true, id }: CardProps) {
  return (
    <div
      id={id}
      className={cn(
        "group relative rounded-md border border-cream-50/[0.08] bg-ink-800/80 shadow-luxe backdrop-blur-sm transition-all duration-500",
        hover &&
          "hover:-translate-y-1 hover:border-gold-500/40 hover:shadow-gold-glow",
        className
      )}
    >
      {children}
    </div>
  );
}
