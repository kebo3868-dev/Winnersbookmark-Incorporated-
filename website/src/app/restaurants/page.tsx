import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import AgentCard from '@/components/AgentCard';
import { featuredAgents } from '@/data/agents';

export const metadata: Metadata = {
  title: 'Restaurant AI',
  description:
    'AI for restaurants: recover missed calls, fix the ordering path customers abandon, and stop losing revenue you already earned.',
  alternates: { canonical: '/restaurants' },
  openGraph: {
    title: 'Restaurant AI | Winners Bookmark',
    description: 'AI systems built specifically for restaurants and food service.',
    url: '/restaurants',
  },
};

const LEAKS = [
  {
    title: 'The unanswered phone',
    body: 'The busiest hour is the hour nobody can reach the phone. Those callers do not leave voicemails — they order from someone else.',
  },
  {
    title: 'The PDF menu',
    body: 'A menu that opens as a PDF is a menu most people will not read on a phone. It is one of the most common and most fixable losses we find.',
  },
  {
    title: 'The dead ordering link',
    body: 'An ordering button pointing at a platform you left, a page that 404s, a link nobody has clicked in a year. It fails silently, every day.',
  },
  {
    title: 'The invisible hours',
    body: 'If your hours are not obvious and current, people assume you are closed. Holiday hours are worse — that is a whole day of demand lost.',
  },
  {
    title: 'The untappable phone number',
    body: 'A phone number written as plain text instead of a tappable link. On a phone, that is friction between a hungry customer and an order.',
  },
  {
    title: 'The booking nobody finishes',
    body: 'A reservation path that takes too many steps, or routes through a platform that asks customers to make an account first.',
  },
];

export default function RestaurantsPage() {
  return (
    <>
      <section className="border-b border-night-line">
        <div className="shell py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">Restaurant AI</p>
            <h1 className="mt-5 text-display-lg font-bold text-snow">
              Restaurants are where we started, and where we go deepest.
            </h1>
            <p className="lede mt-6 max-w-2xl text-lg">
              Restaurants lose revenue in a very specific set of places — the phone, the menu, the
              ordering path, the booking path. We built systems for those places rather than a
              general tool pointed at a restaurant.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact?interest=restaurant-rescue-agent" className="btn-primary">
                Get Your Restaurant Audit
              </Link>
              <Link href="/solutions/restaurant-rescue-agent" className="btn-secondary">
                See the Rescue Agent
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading
          eyebrow="Where the money goes"
          title="Six places restaurants lose customers who were ready to buy."
          body="None of these look like an emergency on their own. Together they are the difference between a busy week and a quiet one."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEAKS.map((leak) => (
            <div key={leak.title} className="card p-6">
              <h3 className="text-[15px] font-semibold text-snow">{leak.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-snow-dim">{leak.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-prose text-sm text-snow-faint">
          We do not attach a dollar figure to any of these, because we would be making it up. What
          we do is show you which ones are happening on your site, with the evidence, so you can
          judge the cost against numbers you actually have.
        </p>
      </Section>

      <Section className="border-y border-night-line bg-night-soft/30">
        <SectionHeading
          eyebrow="The systems"
          title="What we run for restaurants"
          body="Two systems, available today, each addressing a different half of the problem: the customers who cannot reach you, and the customers who cannot complete an order."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {featuredAgents.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}
        </div>
      </Section>

      <Section>
        <div className="card p-8 text-center sm:p-12">
          <h2 className="text-display-md font-bold text-snow">
            Find out what your restaurant is losing.
          </h2>
          <p className="lede mx-auto mt-4 max-w-xl">
            Give us your website address. We will run the audit and show you exactly where
            customers are dropping out — with the evidence for every finding.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/contact?interest=restaurant-rescue-agent" className="btn-primary">
              Get Your Restaurant Audit
            </Link>
            <Link href="/contact" className="btn-secondary">Talk to us first</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
