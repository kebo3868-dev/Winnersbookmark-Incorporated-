import type { Metadata } from "next";
import { Mail, MessageSquare, Newspaper } from "lucide-react";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach the Winnersbookmark Daily Blogs team — support, partnerships, and press.",
};

const channels = [
  {
    icon: Mail,
    title: "Member Support",
    text: "Billing, account access, and membership questions.",
    detail: "support@winnersbookmark.com",
  },
  {
    icon: MessageSquare,
    title: "Partnerships",
    text: "Brand collaborations, licensing, and speaking.",
    detail: "partners@winnersbookmark.com",
  },
  {
    icon: Newspaper,
    title: "Press",
    text: "Media inquiries and interview requests for Keith Warren.",
    detail: "press@winnersbookmark.com",
  },
];

export default function ContactPage() {
  return (
    <section className="relative min-h-screen bg-ink-950 pt-[72px]">
      <div className="absolute inset-0 bg-gold-radial" />
      <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
        <SectionHeader
          eyebrow="Contact"
          title="Talk to the Team."
          subtitle="Questions, partnerships, or press — pick a channel and we'll get back to you within two business days."
        />

        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            {channels.map((channel, i) => (
              <Reveal key={channel.title} delay={Math.min(i * 0.06, 0.2)}>
                <Card className="flex items-start gap-4 p-6" hover={false}>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-gold-500/30 bg-gold-500/10">
                    <channel.icon className="h-5 w-5 text-gold-400" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-cream-50">
                      {channel.title}
                    </h2>
                    <p className="mt-1 text-sm text-cream-300/70">{channel.text}</p>
                    <p className="mt-2 text-sm font-semibold text-gold-400">
                      {channel.detail}
                    </p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <Card className="p-8 md:p-10" hover={false}>
              <h2 className="font-display text-2xl font-semibold text-cream-50">
                Send a Message
              </h2>
              {/* Placeholder form — wire to an email service (Resend,
                  Formspree) or /app/api/contact route before launch. */}
              <form className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-luxe text-cream-300/60">
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      placeholder="Your name"
                      className="w-full rounded-sm border border-cream-50/10 bg-ink-950 px-4 py-3 text-sm text-cream-100 placeholder:text-cream-300/30 focus:border-gold-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-luxe text-cream-300/60">
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
                </div>
                <div>
                  <label htmlFor="subject" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-luxe text-cream-300/60">
                    Subject
                  </label>
                  <input
                    id="subject"
                    type="text"
                    required
                    placeholder="What's this about?"
                    className="w-full rounded-sm border border-cream-50/10 bg-ink-950 px-4 py-3 text-sm text-cream-100 placeholder:text-cream-300/30 focus:border-gold-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-luxe text-cream-300/60">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={6}
                    placeholder="Write your message..."
                    className="w-full resize-none rounded-sm border border-cream-50/10 bg-ink-950 px-4 py-3 text-sm text-cream-100 placeholder:text-cream-300/30 focus:border-gold-500/50 focus:outline-none"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  Send Message
                </Button>
                <p className="text-[10px] uppercase tracking-[0.14em] text-cream-300/30">
                  Placeholder form — email delivery integration pending
                </p>
              </form>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
