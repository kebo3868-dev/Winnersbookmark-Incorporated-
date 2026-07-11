import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/Reveal";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: SectionHeaderProps) {
  return (
    <Reveal
      className={cn(
        "mb-12 max-w-3xl md:mb-16",
        align === "center" ? "mx-auto text-center" : "text-left",
        className
      )}
    >
      {eyebrow ? (
        <p className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-luxe text-gold-500">
          {align === "center" ? (
            <span className="mx-auto inline-flex items-center gap-3">
              <span className="h-px w-8 bg-gold-500/50" />
              {eyebrow}
              <span className="h-px w-8 bg-gold-500/50" />
            </span>
          ) : (
            <>
              <span className="h-px w-8 bg-gold-500/50" />
              {eyebrow}
            </>
          )}
        </p>
      ) : null}
      <h2 className="font-display text-3xl font-semibold leading-tight text-cream-50 md:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-base leading-relaxed text-cream-300/80 md:text-lg">
          {subtitle}
        </p>
      ) : null}
    </Reveal>
  );
}
