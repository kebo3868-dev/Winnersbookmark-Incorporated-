import type { Metadata } from "next";
import { CreditCard, ShoppingBag } from "lucide-react";
import { PricingSection } from "@/components/sections/PricingSection";
import { CTASection } from "@/components/sections/CTASection";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Membership",
  description:
    "Join the Daily Growth System — $10/month with a 7-day free trial. Daily premium blogs, monthly mentor boards, book stacks, challenges, and the member dashboard.",
};

export default function MembershipPage() {
  return (
    <>
      <div className="pt-[72px]">
        <PricingSection />
      </div>

      {/* Checkout placeholders — anchored from pricing buttons */}
      <section className="bg-ink-900 py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <SectionHeader
            eyebrow="Checkout"
            title="Two Ways to Join"
            subtitle="Both checkouts unlock the same membership. Payment processing is not wired up yet — these are integration placeholders."
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Reveal>
              <Card id="stripe" className="scroll-mt-24 p-8" hover={false}>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-focus-500/30 bg-focus-500/10">
                  <CreditCard className="h-5 w-5 text-focus-400" />
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold text-cream-50">
                  Stripe Checkout
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-300/70">
                  Card, Apple Pay, and Google Pay. Subscription billing with a
                  7-day trial handled by Stripe.
                </p>
                {/*
                 * STRIPE INTEGRATION GOES HERE.
                 * Option A (fastest): create a Stripe Payment Link for the
                 * $10/mo price with trial_period_days=7 and set it as the
                 * button's href.
                 * Option B: add /app/api/checkout/route.ts that calls
                 *   stripe.checkout.sessions.create({
                 *     mode: "subscription",
                 *     line_items: [{ price: "price_XXXXXXXX", quantity: 1 }],
                 *     subscription_data: { trial_period_days: 7 },
                 *     success_url: `${origin}/dashboard`,
                 *     cancel_url: `${origin}/membership`,
                 *   })
                 * and redirect to session.url. Keys live in .env.local as
                 * STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
                 */}
                <button
                  type="button"
                  className="mt-6 w-full rounded-sm bg-focus-500/90 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-cream-50 transition-colors hover:bg-focus-400"
                >
                  Pay with Stripe — $10/mo
                </button>
                <p className="mt-3 text-center text-[10px] uppercase tracking-[0.14em] text-cream-300/40">
                  Placeholder — Stripe integration pending
                </p>
              </Card>
            </Reveal>

            <Reveal delay={0.1}>
              <Card id="gumroad" className="scroll-mt-24 p-8" hover={false}>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-ember-500/30 bg-ember-500/10">
                  <ShoppingBag className="h-5 w-5 text-ember-400" />
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold text-cream-50">
                  Gumroad Checkout
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-300/70">
                  One-click membership through Gumroad — ideal for PayPal users
                  and international members.
                </p>
                {/*
                 * GUMROAD INTEGRATION GOES HERE.
                 * Create the $10/mo membership product on Gumroad, then set
                 * the button's href to the product URL, e.g.
                 *   https://winnersbookmark.gumroad.com/l/daily-blogs
                 * Optionally load Gumroad's overlay script for in-page
                 * checkout: <script src="https://gumroad.com/js/gumroad.js" />
                 */}
                <button
                  type="button"
                  className="mt-6 w-full rounded-sm bg-ember-500/90 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-cream-50 transition-colors hover:bg-ember-400"
                >
                  Pay with Gumroad — $10/mo
                </button>
                <p className="mt-3 text-center text-[10px] uppercase tracking-[0.14em] text-cream-300/40">
                  Placeholder — Gumroad integration pending
                </p>
              </Card>
            </Reveal>
          </div>

          <Reveal className="mt-12">
            <div className="rounded-md border border-cream-50/[0.08] bg-ink-800/70 p-8">
              <h3 className="font-display text-xl font-semibold text-cream-50">
                The Standard Guarantee
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-cream-300/70">
                Try the full system free for 7 days. If it doesn&apos;t raise
                your standards, cancel in two clicks — no calls, no friction,
                no guilt. Stay, and it costs less than the habits it replaces.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <CTASection />
    </>
  );
}
