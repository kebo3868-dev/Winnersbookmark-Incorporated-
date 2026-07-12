import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="relative flex min-h-screen items-center justify-center bg-ink-950 px-5 pt-[72px]">
      <div className="absolute inset-0 bg-gold-radial" />
      <div className="relative max-w-lg py-20 text-center">
        <p className="font-display text-7xl font-semibold text-gold-500/60">404</p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-cream-50">
          This Page Doesn&apos;t Exist.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-cream-300/70">
          But the standard does. Head back and pick up today&apos;s knowledge —
          the day isn&apos;t over yet.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button href="/">
            <ArrowLeft className="h-4 w-4" /> Back Home
          </Button>
          <Button href="/today" variant="outline">
            Today&apos;s Knowledge
          </Button>
        </div>
      </div>
    </section>
  );
}
