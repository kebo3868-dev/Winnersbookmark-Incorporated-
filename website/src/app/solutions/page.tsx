import type { Metadata } from 'next';
import Link from 'next/link';
import { contact, socialImage } from '@/data/site';
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
    images: [socialImage],
    title: 'AI Agents | Winners Bookmark',
    description: 'Specialized AI agents for restaurants and local service businesses.',
    url: '/solutions',
  },
};

export default function SolutionsPage() {
  const unavailable = agentsByOrder.filter((a) => !availableAgents.includes(a));

  return (
    <>
      <section className="border-b border-night-line">
        <div className="shell py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">The ecosystem</p>
            <h1 className="mt-5 font-display text-display-lg font-normal text-snow">
              Specialized AI agents, each solving one problem properly.
            </h1>
            <p className="lede mt-6 max-w-2xl">
              Explore the audit you can request today and the agents we are developing.
            </p>
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading
          eyebrow="Available now"
          title="What you can put to work today"
          body="Request an evidence-backed review of your restaurant’s public website."
        />
        <div className="mt-10 grid gap-5">
          {availableAgents.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}
        </div>
      </Section>

      {unavailable.length > 0 && (
        <Section className="border-t border-night-line bg-night-soft/30">
          <SectionHeading
            eyebrow="In development"
            title="Where the ecosystem is heading"
            body="Not available yet. Published so you can see the direction — and because the agents that ship first are the ones businesses tell us they need."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {unavailable.map((agent) => (
              <article key={agent.slug} className="card card-hover flex flex-col p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-display-sm font-bold text-snow">{agent.name}</h3>
                  <StatusBadge status={agent.status} />
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-snow-dim">{agent.tagline}</p>
                <div className="mt-auto pt-7">
                  <Link href={`/solutions/${agent.slug}`} className="btn-ghost">
                    Read the direction <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}

      <Section className="border-t border-night-line">
        <div className="card p-8 text-center sm:p-12">
          <h2 className="font-display text-display-md font-normal text-snow">Not sure which one you need?</h2>
          <p className="lede mx-auto mt-4 max-w-xl">
            That is what the strategy call is for. Describe the problem and we will tell you which
            system addresses it — or whether something simpler would.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={contact.strategyCallHref} className="btn-primary">{contact.strategyCallLabel}</Link>
            <Link href="/consulting" className="btn-secondary">See our consulting services</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
