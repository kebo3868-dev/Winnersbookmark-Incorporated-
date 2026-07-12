import type { Metadata } from "next";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Member Login",
  description: "Log in to your Winnersbookmark Daily Blogs member account.",
};

export default function LoginPage() {
  return (
    <section className="relative flex min-h-screen items-center justify-center bg-ink-950 px-5 pt-[72px]">
      <div className="absolute inset-0 bg-gold-radial" />
      <Reveal className="relative w-full max-w-md py-16">
        <div className="rounded-md border border-gold-500/20 bg-ink-800/90 p-8 shadow-luxe md:p-10">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-sm border border-gold-500/30 bg-gold-500/10">
            <LogIn className="h-5 w-5 text-gold-400" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold text-cream-50">
            Member Login
          </h1>
          <p className="mt-2 text-sm text-cream-300/70">
            Welcome back. The board has been updated since you left.
          </p>

          {/*
           * PLACEHOLDER AUTHENTICATION — no real auth yet.
           * Recommended production setup: NextAuth.js (Auth.js) with email
           * magic links + Google provider, or Clerk. Gate premium articles
           * and /dashboard on the session's subscription status (synced from
           * Stripe/Gumroad webhooks).
           */}
          <form className="mt-8 space-y-4" action="/dashboard">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-luxe text-cream-300/60"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-sm border border-cream-50/10 bg-ink-950 px-4 py-3 text-sm text-cream-100 placeholder:text-cream-300/30 focus:border-gold-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-luxe text-cream-300/60"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full rounded-sm border border-cream-50/10 bg-ink-950 px-4 py-3 text-sm text-cream-100 placeholder:text-cream-300/30 focus:border-gold-500/50 focus:outline-none"
              />
            </div>
            <Button type="submit" className="w-full" size="lg">
              Enter the Dashboard
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-cream-300/50">
            Not a member yet?{" "}
            <Link href="/membership" className="font-semibold text-gold-400 hover:text-gold-300">
              Start your 7-day free trial
            </Link>
          </p>
          <p className="mt-4 text-center text-[10px] uppercase tracking-[0.14em] text-cream-300/30">
            Placeholder login — authentication integration pending
          </p>
        </div>
      </Reveal>
    </section>
  );
}
