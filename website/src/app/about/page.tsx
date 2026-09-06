import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import { company } from '@/data/site';
import { agentsByOrder } from '@/data/agents';

export const metadata: Metadata = {
  title: 'About',
  description: `${company.legalName} is an AI consulting and automation company building specialised AI agents for restaurants and local service businesses.`,
  alternates: { canonical: '/about' },
  openGraph: {
    title: `About | ${company.shortName}`,
    description: company.shortPositioning,
    url: '/about',
  },
};

const BELIEFS = [
  {
    title: 'Small businesses are underserved by AI, not overserved',
    body: 'Enterprise gets bespoke systems and dedicated teams. A restaurant gets a chatbot widget and a monthly invoice. The gap is not the technology — it is that nobody has done the work of understanding how these businesses actually operate.',
  },
  {
    title: 'The best AI is the AI nobody notices',
    body: 'A system that works is one where the phone gets answered and the order gets placed. If the customer is thinking about the technology, something has gone wrong.',
  },
  {
    title: 'Evidence beats confidence',
    body: 'It is easy to produce a report full of authoritative-sounding findings. It is harder, and far more useful, to produce one where every claim can be traced to something real. We build for the second.',
  },
  {
    title: 'Saying "we cannot do that" is a feature',
    body: 'Our systems are built to refuse rather than guess. An agent that invents an answer about allergens is worse than no agent at all.',
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-ink-line">
        <div className="shell py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">About</p>
            <h1 className="mt-5 text-display-1 font-bold text-text-bright">
              We build AI systems for businesses that cannot afford to lose customers.
            </h1>
            <p className="lede mt-6 max-w-2xl text-lg">{company.positioning}</p>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <SectionHeading eyebrow="Why we exist" title="The problem we kept seeing." />
          </div>
          <div className="max-w-prose space-y-5 text-[15px] leading-relaxed text-text-secondary">
            <p>
              A restaurant does everything right — good food, good staff, a full room on a Friday —
              and still loses money in places nobody is looking. The phone that rang during the
              rush. The menu that will not open properly on a phone. The ordering link that has
              pointed at a dead page since the last platform change.
            </p>
            <p>
              None of it shows up in a report. There is no alert for the customer who gave up.
              And the tools sold to fix it are mostly generic software pointed at a problem
              nobody bothered to understand first.
            </p>
            <p>
              {company.legalName} exists to close that gap: to find the specific places a specific
              business is losing people, prove it with evidence, and then build the system that
              stops it.
            </p>
          </div>
        </div>
      </Section>

      <Section className="border-y border-ink-line bg-ink-base/30">
        <SectionHeading eyebrow="What we believe" title="The convictions behind how we build." />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {BELIEFS.map((b) => (
            <div key={b.title} className="surface p-6 sm:p-7">
              <h3 className="text-base font-semibold text-text-bright">{b.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">{b.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Where we are"
          title="An honest picture of the company today."
          body="We are early. Rather than dress that up, here is exactly what exists."
        />
        <div className="mt-10 max-w-prose space-y-4">
          {agentsByOrder.map((agent) => (
            <div key={agent.slug} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink-line pb-4">
              <Link href={`/solutions/${agent.slug}`} className="inline-block py-1 text-[15px] font-semibold text-text-bright transition-colors hover:text-cobalt-light">
                {agent.name}
              </Link>
              <span className="text-sm text-text-muted">{agent.statusLabel}</span>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-prose text-sm leading-relaxed text-text-muted">
          We have no client logos to show you and no case studies published yet. When we have
          customer results we are permitted to share, they will appear on this site with the
          customer named. Until then, what we can offer is the reasoning behind how we work and a
          conversation where we tell you the truth about whether we can help.
        </p>
      </Section>

      <Section className="border-t border-ink-line">
        <div className="surface p-8 text-center sm:p-12">
          <h2 className="text-display-2 font-bold text-text-bright">Talk to Winners Bookmark.</h2>
          <p className="lede mx-auto mt-4 max-w-xl">
            Tell us what is not working in your business. We will tell you honestly whether this
            is something we can help with.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/contact" className="btn-primary">Book a Strategy Call</Link>
            <Link href="/about/founder" className="btn-secondary">Meet the founder</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
