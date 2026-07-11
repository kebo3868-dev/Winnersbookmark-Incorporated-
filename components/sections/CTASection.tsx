import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

interface CTASectionProps {
  headline?: string;
  subheadline?: string;
  buttonLabel?: string;
  buttonHref?: string;
}

export function CTASection({
  headline = "Your Legacy Is Built Daily.",
  subheadline = "Every day you either repeat the old pattern or build the next version of yourself. Winnersbookmark Daily Blogs gives you the knowledge, structure, and standards to build forward.",
  buttonLabel = "Start Building Today",
  buttonHref = "/membership",
}: CTASectionProps) {
  return (
    <section className="relative overflow-hidden border-t border-gold-500/15 bg-ink-950 py-24 md:py-32">
      <div className="absolute inset-0 bg-hero-vignette" />
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(198,161,91,0.05)_1px,transparent_1px)] [background-size:28px_28px]" />

      <Reveal className="relative mx-auto max-w-3xl px-5 text-center lg:px-8">
        <span className="mx-auto mb-8 block h-12 w-px bg-gradient-to-b from-transparent via-gold-500 to-transparent" />
        <h2 className="font-display text-4xl font-semibold leading-tight text-cream-50 md:text-5xl">
          {headline}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-cream-300/80 md:text-lg">
          {subheadline}
        </p>
        <div className="mt-10">
          <Button href={buttonHref} size="lg">
            {buttonLabel} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
