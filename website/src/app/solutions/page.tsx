import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import AgentCard from '@/components/AgentCard';
import { StatusBadge } from '@/components/StatusBadge';
import { agentsByOrder, availableAgents } from '@/data/agents';

export const metadata: Metadata = {
  title: 'AI Agents',
  description:
    'The Winners Bookmark AI agent ecosystem — Restaurant Rescue Agent, AI Front Desk, AI Sales Agent and Gigi. Each listed with its real availability.',
  alternates: { canonical: '/solutions' },
  openGraph: {
    title: 'AI Agents | Winners Bookmark',
    description: 'Specialised AI agents for restaurants and local service businesses.',
    url: '/solutions',
  },
};

export default function SolutionsPage() {
  const unavailable = agentsByOrder.filter((a) => a.status === 'COMING_SOON');

  return (
    <>
      <section className="border-b border-ink-line">
        <div className="shell py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">The ecosystem</p>
            <h1 className="mt-5 text-display-1 font-bold text-text-bright">
              Specialised AI agents, each solving one problem properly.
            </h1>
            <p className="lede mt-6 max-w-2xl">
              Every agent below shows exactly where it stands. {availableAgents.length} are
              available to businesses today; the rest are in development and labelled as such. We
              would rather you know that here than find out later.
            </p>
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading
          eyebrow="Available now"
          title="What you can put to work today"
          body="These are built, tested and running with real businesses."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {availableAgents.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}
        </div>
      </Section>

      {unavailable.length > 0 && (
        <Section className="border-t border-ink-line bg-ink-base/30">
          <SectionHeading
            eyebrow="In development"
            title="Where the ecosystem is heading"
            body="Not available yet. Published so you can see the direction — and because the agents that ship first are the ones businesses tell us they need."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {unavailable.map((agent) => (
              <article key={agent.slug} className="surface-interactive flex flex-col p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-display-3 font-bold text-text-bright">{agent.name}</h3>
                  <StatusBadge status={agent.status} />
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{agent.tagline}</p>
                <div className="mt-auto pt-7">
                  <Link href={`/solutions/${agent.slug}`} className="btn-text">
                    Read the direction <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}

      <Section className="border-t border-ink-line">
        <div className="surface p-8 text-center sm:p-12">
          <h2 className="text-display-2 font-bold text-text-bright">Not sure which one you need?</h2>
          <p className="lede mx-auto mt-4 max-w-xl">
            That is what the strategy call is for. Describe the problem and we will tell you which
            system addresses it — or whether something simpler would.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/contact" className="btn-primary">Book a Strategy Call</Link>
            <Link href="/consulting" className="btn-secondary">See our consulting services</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
