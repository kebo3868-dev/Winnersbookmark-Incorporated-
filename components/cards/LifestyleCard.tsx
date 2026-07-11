import type { LifestyleCard as LifestyleCardType } from "@/data/lifestyleCards";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";

export function LifestyleCard({ card }: { card: LifestyleCardType }) {
  return (
    <Card className="overflow-hidden">
      <ImagePlaceholder
        src={card.image}
        alt={card.title}
        gradient={card.gradient}
        className="flex h-64 flex-col justify-end p-6"
      >
        <span className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-sm border border-cream-50/15 bg-ink-950/50 backdrop-blur-sm">
          <Icon name={card.icon} className="h-4 w-4 text-gold-400" />
        </span>
        <div className="relative">
          <p className="text-[9px] font-semibold uppercase tracking-luxe text-gold-400">
            {card.tag}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-cream-50">
            {card.title}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-cream-200/70">
            {card.caption}
          </p>
        </div>
      </ImagePlaceholder>
    </Card>
  );
}
