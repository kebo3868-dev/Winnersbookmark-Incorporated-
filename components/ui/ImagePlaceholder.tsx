import { cn } from "@/lib/utils";

/**
 * ImagePlaceholder — premium gradient placeholder for photography.
 *
 * HOW TO ADD FINAL IMAGES:
 * 1. Drop licensed photography into /public/images using the expected
 *    filenames (see /public/images/README.md for the full list, e.g.
 *    hero-legacy-dashboard.jpg, men-of-all-ages-health.jpg, ...).
 * 2. Replace this component's gradient <div> with <Image src={src} fill />
 *    from next/image — the `src` prop already carries the correct path.
 *
 * Until then it renders a cinematic gradient with a film-grain texture and
 * gold vignette so the layout looks premium without any assets.
 */
interface ImagePlaceholderProps {
  src?: string; // intended final image path, e.g. /images/clean-nutrition.jpg
  alt?: string;
  gradient?: string; // Tailwind gradient stops
  className?: string;
  label?: string;
  children?: React.ReactNode;
}

export function ImagePlaceholder({
  src,
  alt,
  gradient = "from-espresso-700 via-ink-800 to-ink-950",
  className,
  label,
  children,
}: ImagePlaceholderProps) {
  return (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt}
      data-image-src={src}
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        gradient,
        className
      )}
    >
      {/* Gold vignette + texture for a cinematic feel */}
      <div className="absolute inset-0 bg-hero-vignette" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(250,246,238,0.06)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950/80 to-transparent" />
      {label ? (
        <span className="absolute bottom-3 left-4 text-[10px] uppercase tracking-luxe text-cream-200/50">
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}
