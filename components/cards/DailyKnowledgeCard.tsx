import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DailyKnowledgeItem } from "@/data/dailyKnowledge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { accentStyles } from "@/components/ui/accents";
import { cn } from "@/lib/utils";

export function DailyKnowledgeCard({ item }: { item: DailyKnowledgeItem }) {
  const styles = accentStyles[item.accent];

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="mb-5 flex items-start justify-between">
        <span
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-sm border",
            styles.bg,
            styles.border
          )}
        >
          <Icon name={item.icon} className={cn("h-5 w-5", styles.text)} />
        </span>
        <ArrowUpRight className="h-4 w-4 text-cream-300/30 transition-colors group-hover:text-gold-400" />
      </div>

      <p className={cn("text-[10px] font-semibold uppercase tracking-luxe", styles.text)}>
        {item.label}
      </p>
      <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-cream-50">
        {item.title}
      </h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-cream-300/70">
        {item.insight}
      </p>

      <div className="mt-5 border-t border-cream-50/[0.06] pt-4">
        <p className="text-xs leading-relaxed text-cream-200/60">
          <span className={cn("font-semibold uppercase tracking-[0.14em]", styles.text)}>
            Action:{" "}
          </span>
          {item.action}
        </p>
      </div>

      <Link href={item.href} className="absolute inset-0" aria-label={item.title} />
    </Card>
  );
}
