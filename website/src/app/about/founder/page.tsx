import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { company, contact } from '@/data/site';

export const metadata: Metadata = {
  title: 'About the Founder',
  description: `${company.founder} is the founder of ${company.legalName}, building AI systems for restaurants and local service businesses.`,
  alternates: { canonical: '/about/founder' },
  openGraph: {
    title: `${company.founder} | ${company.shortName}`,
    description: `Founder of ${company.legalName}.`,
    url: '/about/founder',
  },
};

/**
 * FOUNDER PAGE — CONTENT GAP, DELIBERATELY UNFILLED
 *
 * This page contains no biography, because no verifiable biographical
 * information about the founder exists anywhere in this repository, and a
 * founder page is the single worst place on a website to invent detail. A
 * fabricated career history is both a trust problem and a legal one, and it is
 * the kind of thing a prospect checks.
 *
 * What IS here is true and sourced from the codebase itself: the company, the
 * founder's name and role, and the philosophy that is genuinely evidenced by
 * how the products are built. That makes the page publishable today rather
 * than a placeholder.
 *
 * TO COMPLETE: supply the founder's background, the origin story, and a
 * photograph. Everything below the "In his own words" heading is written to be
 * replaced wholesale once that copy exists.
 */
export default function FounderPage() {
  return (
    <>
      <section className="border-b border-ink-line">
        <div className="shell py-16 sm:py-24">
          <nav aria-label="Breadcrumb" className="mb-7">
            <ol className="flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
              <li><Link href="/" className="inline-block py-1.5 transition-colors hover:text-text-secondary">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href="/about" className="inline-block py-1.5 transition-colors hover:text-text-secondary">About</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-text-secondary">Founder</li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <p className="eyebrow">{company.founderRole}</p>
            <h1 className="mt-5 text-display-1 font-bold text-text-bright">{company.founder}</h1>
            <p className="lede mt-5 max-w-2xl text-lg">
              Founder of {company.legalName}, building the AI systems that keep restaurants and
              local service businesses from losing the customers they have already earned.
            </p>
          </div>
        </div>
      </section>

      <Section>
        <div className="max-w-prose">
          <h2 className="text-display-3 font-bold text-text-bright">The approach</h2>
          <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-text-secondary">
            <p>
              Winners Bookmark was founded on a specific conviction: that the AI tools sold to
              small businesses are mostly generic software with a sales layer on top, and that the
              businesses buying them deserve systems built around how they actually operate.
            </p>
            <p>
              That conviction shows up in unusual places in the products. The Restaurant Rescue
              Agent is architecturally forbidden from stating a finding it cannot attach evidence
              to. The AI Front Desk refuses to answer questions outside what it has been told,
              rather than generating something plausible. Neither product will produce a revenue
              projection, because a projection would be a guess wearing the costume of data.
            </p>
            <p>
              Those are not marketing positions. They are enforced in the code, and they cost
              features that would be easier to sell.
            </p>
          </div>

          <h2 className="mt-14 text-display-3 font-bold text-text-bright">Building in public, honestly</h2>
          <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-text-secondary">
            <p>
              Winners Bookmark is an early company, and this site says so throughout. Every agent
              carries its real status. There are no client logos, no testimonials and no case
              studies, because there are none to publish yet — not because they are being saved
              for a redesign.
            </p>
            <p>
              The intention is that the first customers get a company that tells them the truth
              about what it can do, and that this remains true when there are considerably more
              of them.
            </p>
          </div>
        </div>
      </Section>

      <Section className="border-t border-ink-line">
        <div className="surface p-8 text-center sm:p-12">
          <h2 className="text-display-2 font-bold text-text-bright">Talk to Keith directly.</h2>
          <p className="lede mx-auto mt-4 max-w-xl">
            Enquiries to Winners Bookmark reach the founder. If you want to talk about what AI
            could do for your business, start here.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/contact" className="btn-primary">Book a Strategy Call</Link>
            <a href={`mailto:${contact.email}`} className="btn-secondary">Email directly</a>
          </div>
        </div>
      </Section>
    </>
  );
}
