import { Check, CreditCard, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "./SectionHeader";

const benefits = [
  "Daily premium blog",
  "Monthly mentor board",
  "Monthly book stack",
  "Weekly challenges",
  "Fitness and nutrition guidance",
  "Money and productivity lessons",
  "Downloadable infographics",
  "Member dashboard",
  "Saved articles",
  "Reflection prompts",
  "Legacy tracker",
];

export function PricingSection() {
  return (
    <section id="pricing" className="relative bg-ink-950 py-20 md:py-28">
      <div className="absolute inset-0 bg-gold-radial" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeader
          eyebrow="Membership"
          title="Join the Daily Growth System."
          subtitle="One standard. One system. Ten dollars a month — less than the habits it replaces."
        />

        <Reveal>
          <div className="mx-auto max-w-2xl overflow-hidden rounded-md border border-gold-500/30 bg-ink-800/90 shadow-gold-glow">
            <div className="border-b border-gold-500/20 bg-gradient-to-br from-gold-600/15 to-transparent p-8 text-center md:p-10">
              <p className="text-[11px] font-semibold uppercase tracking-luxe text-gold-500">
                Winnersbookmark Membership
              </p>
              <div className="mt-4 flex items-baseline justify-center gap-2">
                <span className="font-display text-6xl font-semibold text-cream-50">
                  $10
                </span>
                <span className="text-sm uppercase tracking-[0.16em] text-cream-300/60">
                  / month
                </span>
              </div>
              <p className="mt-3 text-sm text-gold-300">
                7-day free trial · cancel anytime
              </p>
            </div>

            <div className="p-8 md:p-10">
              <ul className="grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <span className="text-sm text-cream-200/80">{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-9 grid gap-3 sm:grid-cols-2">
                <Button href="/membership" size="lg" className="w-full">
                  Start 7-Day Free Trial
                </Button>
                <Button href="/membership" variant="outline" size="lg" className="w-full">
                  Join for $10/month
                </Button>
              </div>

              {/*
               * PLACEHOLDER CHECKOUT — no real payment processing yet.
               *
               * STRIPE: replace the href below with a Stripe Payment Link, or
               * POST to /api/checkout that calls
               * stripe.checkout.sessions.create({ mode: "subscription",
               *   line_items: [{ price: "price_XXX", quantity: 1 }],
               *   subscription_data: { trial_period_days: 7 } })
               * and redirect to session.url.
               *
               * GUMROAD: replace the href below with the live Gumroad product
               * URL, e.g. https://winnersbookmark.gumroad.com/l/daily-blogs
               */}
              <div className="mt-6 grid gap-3 border-t border-cream-50/[0.06] pt-6 sm:grid-cols-2">
                <Button href="/membership#stripe" variant="ghost" className="w-full border border-cream-50/10">
                  <CreditCard className="h-4 w-4" /> Checkout with Stripe
                </Button>
                <Button href="/membership#gumroad" variant="ghost" className="w-full border border-cream-50/10">
                  <ShoppingBag className="h-4 w-4" /> Checkout with Gumroad
                </Button>
              </div>
              <p className="mt-4 text-center text-[10px] uppercase tracking-[0.14em] text-cream-300/40">
                Secure checkout placeholders — payment integration pending
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
