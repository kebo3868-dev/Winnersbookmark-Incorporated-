import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import AgentCard from '@/components/AgentCard';
import { featuredAgents, agentsByOrder, availableAgents } from '@/data/agents';
import { company } from '@/data/site';

/**
 * HOMEPAGE
 *
 * The job of this page, in order: say what the company does in language a
 * restaurant owner understands, name the problem they already feel, show the
 * systems that address it with their real availability attached, and give one
 * obvious next action.
 *
 * Note what the hero does NOT do: it does not open with "AI-powered" anything.
 * The visitor is an owner losing orders, not a buyer of AI. Business outcome
 * first, technology second — that ordering is the whole positioning.
 */

const PAINS = [
  {
    title: 'The phone rings and nobody can answer it',
    body: 'Mid-rush, after hours, on a day off. That caller does not leave a voicemail — they call the next business on the list.',
  },
  {
    title: 'Customers give up before they order',
    body: 'A menu that only opens as a PDF, an ordering button that goes nowhere, a phone number you cannot tap. Small friction, repeated all day.',
  },
  {
    title: 'Staff answer the same questions all day',
    body: 'Hours, parking, whether you deliver. Every one of those interruptions costs attention that should be going to customers in the room.',
  },
  {
    title: 'Enquiries arrive everywhere and get lost',
    body: 'Texts, voicemails, emails, form submissions. Nothing joins them up, so follow-up depends on whoever happens to remember.',
  },
];

const OUTCOMES = [
  { title: 'Recover missed revenue', body: 'Find and close the gaps where interested customers are dropping out.' },
  { title: 'Answer every enquiry', body: 'Missed calls, after-hours messages and repeat questions get a response instead of silence.' },
  { title: 'Capture every lead', body: 'Enquiries land in one place with the customer’s details and what they actually wanted.' },
  { title: 'Free your staff', body: 'Routine questions stop interrupting service so your team can do the work customers came for.' },
  { title: 'See what is really happening', body: 'Evidence about your customer journey, not guesses about it.' },
  { title: 'Fix the right thing first', body: 'Findings ranked by what actually stands between a customer and an order.' },
];

const INDUSTRIES = [
  'Restaurants and cafés',
  'Bars and breweries',
  'Salons and barbershops',
  'Home and trade services',
  'Clinics and practices',
  'Local service businesses',
];

const PRINCIPLES = [
  {
    title: 'Evidence, not opinion',
    body: 'Every finding we report is tied to something we can show you — the page it came from and the context around it. If we cannot evidence it, we do not claim it.',
  },
  {
    title: 'We say what is not built yet',
    body: 'Every system on this site carries its real status. Live means live. In development means in development. You will never discover after signing that a capability was aspirational.',
  },
  {
    title: 'No invented numbers',
    body: 'You will not find a revenue guarantee or a recovery percentage anywhere on this site, because we have no data that would make one honest.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-night-line">
        <div className="shell py-20 sm:py-28 lg:py-32">
          <div className="max-w-3xl animate-rise">
            <p className="eyebrow">AI Consulting &amp; Automation</p>

            <h1 className="mt-5 text-display-xl font-bold text-snow">
              Stop losing customers you already earned.
            </h1>

            <p className="lede mt-6 max-w-2xl text-lg sm:text-xl">
              {company.legalName} builds AI systems that answer the calls you miss, find the
              revenue leaking out of your website, and capture the enquiries that would otherwise
              disappear — for restaurants and local service businesses.
            </p>

            {/* Exactly two actions. The brief was explicit about not putting
                five competing choices in a hero, and a primary CTA only reads
                as primary when it is the only solid blue thing here. */}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className="btn-primary">
                Book a Strategy Call
              </Link>
              <Link href="/solutions" className="btn-secondary">
                Explore the AI Agents
              </Link>
            </div>

            <p className="mt-6 text-sm text-snow-faint">
              No cost, no obligation. We will tell you plainly whether AI is the right answer to
              your problem — including when it is not.
            </p>
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM ───────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading
          eyebrow="The problem"
          title="The revenue you lose is the revenue you never see."
          body="Nobody sends you a report about the customer who called and got no answer, or the one who could not read your menu on a phone. These losses are invisible from inside the business — which is exactly why they persist."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {PAINS.map((pain) => (
            <div key={pain.title} className="card p-6 sm:p-7">
              <h3 className="text-base font-semibold text-snow">{pain.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-snow-dim">{pain.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── THE ECOSYSTEM ─────────────────────────────────────────────────── */}
      <Section className="border-y border-night-line bg-night-soft/30">
        <SectionHeading
          eyebrow="The WBI AI ecosystem"
          title="Specialised agents, built to work together."
          body="Each agent solves one problem properly rather than solving many badly. Every one carries its real availability — so you always know what you can use today."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {featuredAgents.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}
        </div>

        {/* The non-featured agents get an honest, low-key listing rather than
            equal billing — they are not purchasable and should not compete
            visually with the two that are. */}
        <div className="mt-10 rounded-xl border border-night-line bg-night-card/50 p-6 sm:p-7">
          <h3 className="text-sm font-semibold text-snow">Also in the ecosystem</h3>
          <p className="mt-1.5 text-sm text-snow-faint">
            In development and not yet available. Listed so you can see where this is going.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {agentsByOrder
              .filter((a) => !a.featured)
              .map((agent) => (
                <li key={agent.slug}>
                  <Link
                    href={`/solutions/${agent.slug}`}
                    className="flex items-baseline gap-2 text-sm text-snow-dim transition-colors hover:text-white"
                  >
                    <span className="font-semibold">{agent.name}</span>
                    <span className="text-xs text-snow-faint">— {agent.statusLabel.split('—')[0].trim()}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>

        <div className="mt-9">
          <Link href="/solutions" className="btn-secondary">
            See all AI agents
          </Link>
        </div>
      </Section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <Section id="how-it-works">
        <SectionHeading
          eyebrow="How we work"
          title="Find the problem. Prove it. Then fix it."
          body="We do not start by selling you software. We start by establishing what is actually costing you money — and sometimes the honest answer is that you do not need us."
        />

        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              step: '01',
              title: 'We audit what you have',
              body: 'We examine your business the way a customer experiences it and produce evidence of where that experience breaks down. You get the findings whether or not you work with us further.',
            },
            {
              step: '02',
              title: 'We agree what is worth fixing',
              body: 'Findings ranked by impact, in plain English. You decide what matters. If the fix is a cheap change to your website rather than an AI system, we will say so.',
            },
            {
              step: '03',
              title: 'We build and run the system',
              body: 'We deploy the agent that addresses the problem, configure it around how your business actually works, and stay responsible for it running properly.',
            },
          ].map((item) => (
            <li key={item.step} className="card p-6 sm:p-7">
              <span className="font-mono text-xs font-bold tracking-wider text-electric-light">
                {item.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-snow">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-snow-dim">{item.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── OUTCOMES ──────────────────────────────────────────────────────── */}
      <Section className="border-y border-night-line bg-night-soft/30">
        <SectionHeading
          eyebrow="What you get"
          title="Business outcomes, not a technology project."
          body="You do not need to understand how any of this works. You need the phone answered and the orders completed."
        />

        <div className="mt-12 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {OUTCOMES.map((outcome) => (
            <div key={outcome.title} className="border-l-2 border-electric/50 pl-5">
              <h3 className="text-base font-semibold text-snow">{outcome.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-snow-dim">{outcome.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── HOW WE OPERATE (trust, in place of fabricated proof) ──────────── */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Why trust us"
              title="We would rather lose the sale than overstate the product."
              body="Winners Bookmark is a young company. We do not have a wall of client logos, and we are not going to invent one. What we can show you is how we work."
            />
            <Link href="/about" className="btn-secondary mt-8">
              About the company
            </Link>
          </div>

          <div className="space-y-4">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="card p-6">
                <h3 className="text-base font-semibold text-snow">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-snow-dim">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── INDUSTRIES ────────────────────────────────────────────────────── */}
      <Section className="border-y border-night-line bg-night-soft/30">
        <SectionHeading
          eyebrow="Who we work with"
          title="Businesses where a missed call is a lost customer."
          body="Our systems are built for businesses that run on local demand and where the phone still matters. Restaurants are where we started and where we are deepest."
        />
        <ul className="mt-10 flex flex-wrap gap-2.5">
          {INDUSTRIES.map((industry) => (
            <li
              key={industry}
              className="rounded-full border border-night-line bg-night-card px-4 py-2 text-sm text-snow-dim"
            >
              {industry}
            </li>
          ))}
        </ul>
      </Section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <Section>
        <div className="card relative overflow-hidden p-8 text-center sm:p-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(37,99,235,0.18),transparent_70%)]"
          />
          <div className="relative">
            <h2 className="text-display-md font-bold text-snow">
              Find out what your business is losing.
            </h2>
            <p className="lede mx-auto mt-4 max-w-xl">
              Tell us about your business and we will tell you, honestly, whether we can help —
              and what we would do first.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/contact" className="btn-primary">
                Book a Strategy Call
              </Link>
              <Link href="/audit" className="btn-secondary">
                Request an AI Business Audit
              </Link>
            </div>
            <p className="mt-6 text-xs text-snow-faint">
              {availableAgents.length} of our AI agents are available today. The rest are labelled
              honestly.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
