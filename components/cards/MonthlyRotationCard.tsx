import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import type { RotationItem } from "@/data/challenges";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { accentStyles } from "@/components/ui/accents";
import { cn } from "@/lib/utils";

export function MonthlyRotationCard({
  item,
  month,
}: {
  item: RotationItem;
  month: string;
}) {
  const styles = accentStyles[item.accent];

  return (
    <Card className="flex h-full flex-col p-7">
      <div className="mb-6 flex items-center justify-between">
        <span
          className={cn(
            "inline-flex h-12 w-12 items-center justify-center rounded-sm border",
            styles.bg,
            styles.border
          )}
        >
          <Icon name={item.icon} className={cn("h-5 w-5", styles.text)} />
        </span>
        {/* Rotation badge — makes the monthly swap explicit */}
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-cream-50/[0.08] bg-ink-900/60 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-luxe text-cream-300/50">
          <RefreshCw className="h-3 w-3 text-gold-500" />
          Rotates Monthly
        </span>
      </div>

      <p className={cn("text-[10px] font-semibold uppercase tracking-luxe", styles.text)}>
        {item.label}
      </p>
      <h3 className="mt-2 font-display text-xl font-semibold text-cream-50">
        {item.title}
      </h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-cream-300/70">
        {item.description}
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-cream-50/[0.06] pt-4">
        <span className="text-[10px] uppercase tracking-luxe text-cream-300/40">
          {month}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">
          Explore <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>

      <Link href={item.href} className="absolute inset-0" aria-label={item.title} />
    </Card>
  );
}
