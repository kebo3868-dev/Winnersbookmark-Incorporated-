import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import AgentCard from '@/components/AgentCard';
import SystemVisualization from '@/components/SystemVisualization';
import RevenueJourney from '@/components/RevenueJourney';
import RescueProof from '@/components/RescueProof';
import EvidenceStandard from '@/components/EvidenceStandard';
import Reveal from '@/components/Reveal';
import { BookmarkNotch, BrandRule } from '@/components/Logo';
import { featuredAgents, agentsByOrder, availableAgents } from '@/data/agents';
import { company, SITE_URL, contact } from '@/data/site';

/**
 * HOMEPAGE
 *
 * Ten-second test: an established restaurant owner should read "serious
 * technology company that can find and recover lost revenue", not "someone
 * experimenting with AI".
 *
 * What carries that, in order of contribution:
 *   1. The hero says the business outcome before it says "AI". The visitor is
 *      an owner losing orders, not a buyer of technology.
 *   2. The system visualization shows working infrastructure beside the claim.
 *   3. The leakage model gives the company a proprietary idea rather than a
 *      list of services.
 *   4. Nothing is invented. The trust strip names capabilities, not client
 *      counts; the proof section explains how we work instead of showing logos
 *      we do not have.
 */

const TRUST = [
  { label: 'Revenue Recovery', detail: 'Find what the business is losing' },
  { label: 'AI Front Desk', detail: 'Answer every inquiry' },
  { label: 'Restaurant Intelligence', detail: 'Built for food service' },
  { label: '24/7 Lead Capture', detail: 'Nothing falls through' },
];

const PAINS = [
  {
    n: '01',
    title: 'The phone rings and nobody can answer it',
    body: 'Mid-rush, after hours, on a day off. That caller does not leave a voicemail — they call the next business on the list.',
  },
  {
    n: '02',
    title: 'Customers give up before they order',
    body: 'A menu that only opens as a PDF, an ordering button that goes nowhere, a phone number you cannot tap. Small friction, repeated all day.',
  },
  {
    n: '03',
    title: 'Staff answer the same questions all day',
    body: 'Hours, parking, whether you deliver. Every interruption costs attention that should be going to customers in the room.',
  },
  {
    n: '04',
    title: 'Inquiries arrive everywhere and get lost',
    body: 'Texts, voicemails, emails, form submissions. Nothing joins them up, so follow-up depends on whoever happens to remember.',
  },
];

const RESTAURANT_INTELLIGENCE = [
  { title: 'Missed phone calls', body: 'The busiest hour is the hour nobody reaches the phone.' },
  { title: 'Broken ordering paths', body: 'Buttons pointing at platforms you left, or pages that no longer exist.' },
  { title: 'Reservation friction', body: 'Booking flows that ask for an account before they ask for a date.' },
  { title: 'Website conversion leakage', body: 'PDF menus, untappable numbers, hours nobody can find.' },
  { title: 'Repetitive questions', body: 'The same five answers, given by staff, all day, every day.' },
  { title: 'Uncaptured leads', body: 'Inquiries that arrive somewhere nobody is watching.' },
  { title: 'Review opportunities', body: 'Happy customers who were never asked at the right moment.' },
  { title: 'Visibility gaps', body: 'Information customers need that is not published anywhere.' },
];


export default function HomePage() {
  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.legalName,
    alternateName: company.shortName,
    url: SITE_URL,
    description: company.positioning,
    founder: { '@type': 'Person', name: company.founder },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: contact.email,
      url: `${SITE_URL}/contact`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />

      {/* ═══ HERO ══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Grid texture, masked so it dissolves rather than stopping abruptly */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid opacity-[0.55] mask-fade-b" />

        <div className="shell relative pb-16 pt-12 sm:pb-24 sm:pt-20 lg:pb-32 lg:pt-24">
          <div className="grid items-center gap-11 sm:gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 xl:gap-20">
            {/* `min-w-0` on both columns is load-bearing, not defensive tidiness.
                Grid items default to `min-width: auto`, so a column refuses to
                shrink below its widest child's intrinsic minimum. The
                visualization sets that floor around 382px, and without this the
                TEXT column inherited it too — headline, lede and buttons all ran
                past the right edge of a 360px phone. */}
            <div className="min-w-0">
              <Reveal as="p" className="eyebrow">
                AI Consulting &amp; Automation
              </Reveal>

              <Reveal as="h1" delay={80} className="mt-6 text-hero text-text-bright">
                Stop losing customers you already earned.
              </Reveal>

              <Reveal as="p" delay={160} className="lede mt-8 max-w-measure">
                {company.legalName} builds AI systems that answer the calls businesses miss,
                uncover revenue leaking from their websites, and capture inquiries that would
                otherwise disappear.
              </Reveal>

              <Reveal delay={240} className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link href="/contact?interest=ai-business-audit" className="btn-primary">
                  Find My Revenue Leaks
                </Link>
                <Link href="/contact" className="btn-secondary">
                  Book a Strategy Call
                </Link>
              </Reveal>

              <Reveal as="p" delay={300} className="mt-7 text-[0.8125rem] leading-relaxed text-text-muted">
                No cost, no obligation. We will tell you plainly whether AI is the right answer to
                your problem — including when it is not.
              </Reveal>
            </div>

            {/* ---- System visualization ---- */}
            <Reveal delay={220} className="min-w-0 lg:pl-4">
              <SystemVisualization />
            </Reveal>
          </div>
        </div>

        {/* ---- Trust strip ---- */}
        <div className="relative border-y border-ink-line bg-ink-base/50">
          <div className="shell">
            <ul className="grid grid-cols-2 divide-x divide-y divide-ink-line/70 sm:grid-cols-4 sm:divide-y-0">
              {TRUST.map((item, i) => (
                <li key={item.label} className={`px-4 py-5 sm:px-5 sm:py-6 ${i === 0 ? 'border-l-0' : ''}`}>
                  <Reveal delay={i * 70}>
                    <div className="flex items-center gap-2">
                      <BookmarkNotch size={9} className="text-cobalt-core" />
                      <p className="text-[0.8125rem] font-semibold tracking-[-0.01em] text-text-primary">
                        {item.label}
                      </p>
                    </div>
                    <p className="mt-1.5 text-[0.75rem] leading-relaxed text-text-muted">{item.detail}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═══ THE PROBLEM ═══════════════════════════════════════════════════ */}
      <Section>
        <SectionHeading
          eyebrow="The problem"
          title="The revenue you lose is the revenue you never see."
          body="Nobody sends you a report about the customer who called and got no answer, or the one who could not read your menu on a phone. These losses are invisible from inside the business — which is exactly why they persist."
        />

        <div className="mt-11 grid sm:mt-14 gap-px overflow-hidden rounded-panel border border-ink-line bg-ink-line sm:grid-cols-2">
          {PAINS.map((pain, i) => (
            <Reveal key={pain.n} delay={i * 70} className="bg-ink-panel p-6 sm:p-8">
              <span className="font-mono text-[0.6875rem] tracking-[0.1em] text-cobalt-light">{pain.n}</span>
              <h3 className="mt-4 text-title text-text-bright">{pain.title}</h3>
              <p className="mt-2.5 text-body text-text-secondary">{pain.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══ REVENUE INTELLIGENCE ══════════════════════════════════════════ */}
      <Section className="border-y border-ink-line bg-ink-base/40">
        <SectionHeading
          eyebrow="Revenue intelligence"
          title="You probably do not need more traffic."
          body="You need to stop losing the customers already reaching you. More marketing sends more people into the same leaking funnel; we find where they are falling out and put a system at exactly that point."
        />

        <Reveal delay={120} className="mt-11 sm:mt-14">
          <RevenueJourney />
        </Reveal>

        <div className="mt-16">
          <SectionHeading
            eyebrow="What a finding looks like"
            title="Evidence you can open and check."
            body="This is the level of detail an audit returns: the problem, the page it was found on, why it costs you customers, and what to do about it."
            as="h3"
          />
          <Reveal delay={120} className="mt-10">
            <RescueProof />
          </Reveal>
        </div>
      </Section>

      {/* ═══ THE ECOSYSTEM ═════════════════════════════════════════════════ */}
      <Section>
        <SectionHeading
          eyebrow="The WBI AI ecosystem"
          title="Specialized agents, built to work together."
          body="Each agent solves one problem properly rather than solving many badly. Every one carries its real availability — so you always know what you can use today."
        />

        <div className="mt-11 grid sm:mt-14 gap-6 lg:grid-cols-2">
          {featuredAgents.map((agent, i) => (
            <Reveal key={agent.slug} delay={i * 90}>
              <AgentCard agent={agent} index={i} />
            </Reveal>
          ))}
        </div>

        {/* Non-featured agents get honest, low-key billing — they are not
            purchasable and must not compete visually with the two that are. */}
        <Reveal delay={140} className="mt-6">
          <div className="surface p-6 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-title text-text-primary">Also in the ecosystem</h3>
              <p className="text-[0.8125rem] text-text-muted">In development — not yet available</p>
            </div>
            <ul className="mt-5 grid gap-px overflow-hidden rounded-[10px] border border-ink-line bg-ink-line sm:grid-cols-2">
              {agentsByOrder
                .filter((a) => !a.featured)
                .map((agent) => (
                  <li key={agent.slug} className="bg-ink-base">
                    <Link
                      href={`/solutions/${agent.slug}`}
                      className="group flex items-start justify-between gap-3 px-4 py-4 transition-colors duration-200 hover:bg-ink-panel"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-baseline gap-x-2.5">
                          <span className="text-[0.875rem] font-medium text-text-primary">
                            {agent.name}
                          </span>
                          <span className="text-[0.6875rem] uppercase tracking-[0.1em] text-signal-planned">
                            {agent.statusLabel.split('—')[0].trim()}
                          </span>
                        </span>
                        {/* The purpose line, so "Gigi" is not just a name. */}
                        <span className="mt-1 block text-[0.75rem] leading-relaxed text-text-muted">
                          {agent.purpose}
                        </span>
                      </span>
                      <span aria-hidden="true" className="mt-0.5 shrink-0 text-text-faint transition-transform duration-300 ease-out group-hover:translate-x-0.5">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={180} className="mt-9">
          <Link href="/solutions" className="btn-secondary">See all AI agents</Link>
        </Reveal>
      </Section>

      {/* ═══ RESTAURANT INTELLIGENCE ═══════════════════════════════════════ */}
      <Section className="border-y border-ink-line bg-ink-base/40">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Restaurant intelligence"
              title="Restaurants are where we go deepest."
              body="Restaurants lose revenue in a specific set of places. We built systems for those places rather than a general tool pointed at a restaurant."
            />
            <Reveal delay={180} className="mt-9 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link href="/contact?interest=restaurant-rescue-agent" className="btn-primary">
                Get Your Restaurant Audit
              </Link>
              <Link href="/restaurants" className="btn-secondary">Restaurant AI</Link>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <ul className="grid gap-px overflow-hidden rounded-panel border border-ink-line bg-ink-line sm:grid-cols-2">
              {RESTAURANT_INTELLIGENCE.map((item) => (
                <li key={item.title} className="bg-ink-panel p-5">
                  <div className="flex items-start gap-2.5">
                    <BookmarkNotch size={10} className="mt-1 text-cobalt-core" />
                    <div className="min-w-0">
                      <h3 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text-primary">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-text-muted">{item.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      {/* ═══ HOW WE WORK ═══════════════════════════════════════════════════ */}
      <Section>
        <SectionHeading
          eyebrow="How we work"
          title="Find the problem. Prove it. Then fix it."
          body="We do not start by selling you software. We start by establishing what is actually costing you money — and sometimes the honest answer is that you do not need us."
        />

        <ol className="mt-11 grid sm:mt-14 gap-6 md:grid-cols-3">
          {[
            { step: '01', title: 'We audit what you have', body: 'We examine your business the way a customer experiences it and produce evidence of where that experience breaks down. You get the findings whether or not you work with us further.' },
            { step: '02', title: 'We agree what is worth fixing', body: 'Findings ranked by impact, in plain English. You decide what matters. If the fix is a cheap change to your website rather than an AI system, we will say so.' },
            { step: '03', title: 'We build and run the system', body: 'We deploy the agent that addresses the problem, configure it around how your business actually works, and stay responsible for it running properly.' },
          ].map((item, i) => (
            <Reveal key={item.step} delay={i * 90} as="li" className="surface p-7 sm:p-8">
              <div className="flex items-center gap-2.5">
                <BookmarkNotch size={11} className="text-cobalt-core" />
                <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-cobalt-light">{item.step}</span>
              </div>
              <h3 className="mt-5 text-display-3 text-text-bright">{item.title}</h3>
              <p className="mt-3 text-body text-text-secondary">{item.body}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* ═══ EVIDENCE STANDARD ════════════════════════════════════════════ */}
      <Section className="border-y border-ink-line bg-ink-base/40">
        <EvidenceStandard />
        <Reveal delay={180} className="mt-10">
          <Link href="/about" className="btn-secondary">About the company</Link>
        </Reveal>
      </Section>

      {/* ═══ FINAL CTA ═════════════════════════════════════════════════════ */}
      <Section>
        <Reveal>
          <div className="surface-raised relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-64"
              style={{ background: 'radial-gradient(ellipse 55% 100% at 50% 0%, rgba(36,84,235,0.18), transparent 72%)' }}
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid opacity-40 mask-fade-b" />

            <div className="relative mx-auto max-w-2xl">
              <BrandRule className="mx-auto mb-9 max-w-[180px]" />
              <h2 className="text-display-1 text-text-bright">
                Find out what your business is losing.
              </h2>
              <p className="lede mx-auto mt-6 max-w-measure">
                Tell us about your business and we will tell you, honestly, whether we can help —
                and what we would do first.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/contact?interest=ai-business-audit" className="btn-primary">
                  Request a Revenue Leak Review
                </Link>
                <Link href="/contact" className="btn-secondary">Book a Strategy Call</Link>
              </div>

              {/* What the click actually commits you to. */}
              <ol className="mx-auto mt-10 grid max-w-xl gap-px overflow-hidden rounded-[10px] border border-ink-line bg-ink-line text-left sm:grid-cols-3">
                {[
                  { n: '1', t: 'You send the form', d: 'Your website address and what is not working. Nothing else is required.' },
                  { n: '2', t: 'Keith reads it', d: 'It reaches the founder directly, not a shared inbox or a sales team.' },
                  { n: '3', t: 'You get an honest read', d: 'Usually within one business day — including if we think you do not need us.' },
                ].map((step) => (
                  <li key={step.n} className="bg-ink-panel p-4">
                    <span className="font-mono text-[0.6875rem] text-cobalt-light">0{step.n}</span>
                    <p className="mt-2 text-[0.8125rem] font-semibold text-text-primary">{step.t}</p>
                    <p className="mt-1 text-[0.75rem] leading-relaxed text-text-muted">{step.d}</p>
                  </li>
                ))}
              </ol>

              <p className="mt-7 text-[0.8125rem] text-text-muted">
                No cost, no obligation, and no follow-up sequence. {availableAgents.length} of our
                AI agents are available today; the rest are labeled honestly.
              </p>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
