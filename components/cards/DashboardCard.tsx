import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DashboardTile } from "@/data/dashboard";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { accentStyles } from "@/components/ui/accents";
import { cn } from "@/lib/utils";

export function DashboardCard({ tile }: { tile: DashboardTile }) {
  const styles = accentStyles[tile.accent];

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-start justify-between">
        <span
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-sm border",
            styles.bg,
            styles.border
          )}
        >
          <Icon name={tile.icon} className={cn("h-[18px] w-[18px]", styles.text)} />
        </span>
        <ArrowUpRight className="h-4 w-4 text-cream-300/30 transition-colors group-hover:text-gold-400" />
      </div>

      <p className={cn("text-[10px] font-semibold uppercase tracking-luxe", styles.text)}>
        {tile.label}
      </p>
      <h3 className="mt-1.5 font-display text-base font-semibold text-cream-50">
        {tile.title}
      </h3>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-cream-300/60">
        {tile.detail}
      </p>

      {typeof tile.progress === "number" ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-cream-300/40">
            <span>Progress</span>
            <span className={styles.text}>{tile.progress}%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-600">
            <div
              className={cn("h-full rounded-full", styles.bar)}
              style={{ width: `${tile.progress}%` }}
            />
          </div>
        </div>
      ) : null}

      <Link href={tile.href} className="absolute inset-0" aria-label={tile.label} />
    </Card>
  );
}
