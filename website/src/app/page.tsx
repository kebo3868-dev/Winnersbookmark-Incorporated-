import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import AgentCard from '@/components/AgentCard';
import { featuredAgents, agentsByOrder, availableAgents } from '@/data/agents';
import { company, SITE_URL, contact } from '@/data/site';

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

const STEPS = [
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
];

/**
 * The hero illustration: what the AI Front Desk does, drawn as the log an owner
 * would see. It is labelled as an illustration on its face — the names, times
 * and messages are invented to show the shape of the workflow, and nothing in
 * it is a result or a metric. That label is load-bearing; do not remove it.
 */
const HERO_LOG = [
  {
    time: '9:42 pm',
    kind: 'Missed call',
    detail: 'Rang out during close-down',
    action: 'Texted back',
  },
  {
    time: '9:43 pm',
    kind: 'Question',
    detail: '“Do you deliver to Eastside?”',
    action: 'Answered',
  },
  {
    time: '9:47 pm',
    kind: 'Booking request',
    detail: 'Table for six, Friday evening',
    action: 'Captured',
  },
  {
    time: '9:51 pm',
    kind: 'Catering enquiry',
    detail: 'Needs a person to quote',
    action: 'Escalated',
  },
];

function HeroLog() {
  return (
    <figure className="card relative overflow-hidden p-0 shadow-lift">
      <div className="flex items-center justify-between gap-3 border-b border-night-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric-light/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-electric-light" />
          </span>
          <span className="text-[13px] font-semibold text-snow">Front desk · after hours</span>
        </div>
        <span className="rounded-full border border-night-edge px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-snow-faint">
          Illustration
        </span>
      </div>

      <ol className="divide-y divide-night-line">
        {HERO_LOG.map((row) => (
          <li key={row.time} className="grid grid-cols-[4.25rem_1fr_auto] items-center gap-4 px-5 py-4">
            <time className="font-mono text-[11px] text-snow-faint">{row.time}</time>
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-snow">{row.kind}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-snow-dim">{row.detail}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-electric/10 px-2.5 py-1 text-[11px] font-semibold text-electric-light ring-1 ring-inset ring-electric/25">
              <span aria-hidden="true">✓</span>
              {row.action}
            </span>
          </li>
        ))}
      </ol>

      <figcaption className="border-t border-night-line bg-night-soft/60 px-5 py-3.5 text-[11.5px] leading-relaxed text-snow-faint">
        An example of the workflow, not customer data. Every enquiry gets a response or
        reaches a person — none of them go to voicemail.
      </figcaption>
    </figure>
  );
}

export default function HomePage() {
  const organisationLd = {
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organisationLd) }}
      />
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-night-line">
        <div aria-hidden="true" className="grid-paper pointer-events-none absolute inset-0" />
        <div className="shell relative grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-32">
          <div className="animate-rise">
            <p className="eyebrow">AI Consulting &amp; Automation</p>

            <h1 className="mt-7 font-display text-display-xl text-snow">
              Stop losing customers you <span className="em">already earned.</span>
            </h1>

            <p className="lede mt-7 max-w-xl text-lg sm:text-xl">
              {company.legalName} builds AI systems that answer the calls you miss, find the
              revenue leaking out of your website, and capture the enquiries that would otherwise
              disappear — for restaurants and local service businesses.
            </p>

            {/* Exactly two actions. The brief was explicit about not putting
                five competing choices in a hero, and a primary CTA only reads
                as primary when it is the only solid blue thing here. */}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className="btn-primary group">
                Book a Strategy Call
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </Link>
              <Link href="/solutions" className="btn-secondary">
                Explore the AI Agents
              </Link>
            </div>

            <p className="mt-7 max-w-md text-sm leading-relaxed text-snow-faint">
              No cost, no obligation. We will tell you plainly whether AI is the right answer to
              your problem — including when it is not.
            </p>
          </div>

          <div className="animate-rise-late lg:pl-4">
            <HeroLog />
          </div>
        </div>

        {/* Trust strip in place of a logo wall the company does not have. */}
        <div className="relative border-t border-night-line bg-night-soft/40">
          <ul className="shell grid gap-x-8 gap-y-3 py-5 text-[13px] text-snow-dim sm:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-electric-light">{String(i + 1).padStart(2, '0')}</span>
                {p.title}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── THE PROBLEM ───────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading
          eyebrow="The problem"
          title={<>The revenue you lose is the revenue <span className="em">you never see.</span></>}
          body="Nobody sends you a report about the customer who called and got no answer, or the one who could not read your menu on a phone. These losses are invisible from inside the business — which is exactly why they persist."
        />

        {/* A ledger, not a card grid: numbered entries divided by hairlines. */}
        <ol className="mt-16 grid border-t border-night-line sm:grid-cols-2">
          {PAINS.map((pain, i) => (
            <li
              key={pain.title}
              className={`flex gap-6 border-b border-night-line py-9 sm:py-10 ${
                i % 2 === 0 ? 'sm:border-r sm:pr-10' : 'sm:pl-10'
              }`}
            >
              <span className="w-12 shrink-0 font-display text-[2.6rem] leading-none text-snow-faint/70">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-[17px] font-semibold leading-snug text-snow">{pain.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-snow-dim">{pain.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── THE ECOSYSTEM ─────────────────────────────────────────────────── */}
      <Section className="border-y border-night-line bg-night-soft/30">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="The WBI AI ecosystem"
            title={<>Specialised agents, <span className="em">built to work together.</span></>}
            body="Each agent solves one problem properly rather than solving many badly. Every one carries its real availability — so you always know what you can use today."
          />
          <Link href="/solutions" className="btn-secondary shrink-0 self-start lg:self-end">
            See all AI agents
          </Link>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {featuredAgents.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}
        </div>

        {/* The non-featured agents get an honest, low-key listing rather than
            equal billing — they are not purchasable and should not compete
            visually with the two that are. */}
        <div className="mt-6 rounded-2xl border border-dashed border-night-edge p-6 sm:p-8">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className="text-sm font-semibold text-snow">Also in the ecosystem</h3>
            <p className="text-sm text-snow-faint">
              In development and not yet available. Listed so you can see where this is going.
            </p>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {agentsByOrder
              .filter((a) => !a.featured)
              .map((agent) => (
                <li key={agent.slug}>
                  <Link
                    href={`/solutions/${agent.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-night-line bg-night-card/60 px-5 py-4 transition-colors hover:border-night-edge"
                  >
                    <span>
                      <span className="block font-display text-xl text-snow">{agent.name}</span>
                      <span className="mt-0.5 block text-xs text-snow-faint">
                        {agent.statusLabel.split('—')[0].trim()}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-snow-faint transition-transform group-hover:translate-x-0.5 group-hover:text-snow">
                      →
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </Section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <Section id="how-it-works">
        <SectionHeading
          eyebrow="How we work"
          title={<>Find the problem. Prove it. <span className="em">Then fix it.</span></>}
          body="We do not start by selling you software. We start by establishing what is actually costing you money — and sometimes the honest answer is that you do not need us."
        />

        <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {/* The connecting rail between steps — desktop only, where the steps
              sit in a row and the sequence needs showing. */}
          <span aria-hidden="true" className="rule-fade absolute left-0 top-[19px] hidden md:block" />
          {STEPS.map((item) => (
            <li key={item.step} className="relative">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-night-edge bg-night font-mono text-[11px] font-semibold text-electric-light shadow-edge">
                {item.step}
              </span>
              <h3 className="mt-7 font-display text-[1.85rem] leading-tight text-snow">{item.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-snow-dim">{item.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── OUTCOMES ──────────────────────────────────────────────────────── */}
      <Section className="border-y border-night-line bg-night-soft/30">
        <SectionHeading
          eyebrow="What you get"
          title={<>Business outcomes, <span className="em">not a technology project.</span></>}
          body="You do not need to understand how any of this works. You need the phone answered and the orders completed."
        />

        {/* gap-px over a line-coloured ground draws perfect 1px gridlines
            without doubled borders where cells meet. */}
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-night-line bg-night-line sm:grid-cols-2 lg:grid-cols-3">
          {OUTCOMES.map((outcome) => (
            <div key={outcome.title} className="bg-night-card p-7 sm:p-8">
              <span aria-hidden="true" className="block h-px w-6 bg-electric-light" />
              <h3 className="mt-6 text-[17px] font-semibold text-snow">{outcome.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-snow-dim">{outcome.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── HOW WE OPERATE (trust, in place of fabricated proof) ──────────── */}
      <Section>
        <div className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <p className="eyebrow mb-5">Why trust us</p>
            <blockquote className="font-display text-display-md text-snow">
              “We would rather lose the sale than <span className="em">overstate the product.</span>”
            </blockquote>
            <p className="lede mt-6 max-w-lg">
              Winners Bookmark is a young company. We do not have a wall of client logos, and we
              are not going to invent one. What we can show you is how we work.
            </p>
            <Link href="/about" className="btn-secondary mt-9">
              About the company
            </Link>
          </div>

          <ol className="divide-y divide-night-line border-y border-night-line">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-8">
                <span className="pt-1 font-mono text-[11px] text-electric-light">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold text-snow">{p.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-snow-dim">{p.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ── INDUSTRIES ────────────────────────────────────────────────────── */}
      <Section className="border-y border-night-line bg-night-soft/30">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <SectionHeading
            eyebrow="Who we work with"
            title={<>Businesses where a missed call is <span className="em">a lost customer.</span></>}
            body="Our systems are built for businesses that run on local demand and where the phone still matters. Restaurants are where we started and where we are deepest."
          />
          <ul className="flex flex-wrap gap-2.5 lg:justify-end">
            {INDUSTRIES.map((industry, i) => (
              <li
                key={industry}
                className={`rounded-full border px-4 py-2 text-sm ${
                  i === 0
                    ? 'border-electric/40 bg-electric/10 text-snow'
                    : 'border-night-line bg-night-card text-snow-dim'
                }`}
              >
                {industry}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <Section>
        <div className="card relative overflow-hidden px-6 py-16 text-center sm:px-14 sm:py-24">
          <div aria-hidden="true" className="grid-paper pointer-events-none absolute inset-0" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(37,99,235,0.2),transparent_70%)]"
          />
          <div className="relative">
            <p className="eyebrow justify-center">Start here</p>
            <h2 className="mx-auto mt-6 max-w-3xl font-display text-display-lg text-snow">
              Find out what your business <span className="em">is losing.</span>
            </h2>
            <p className="lede mx-auto mt-6 max-w-xl">
              Tell us about your business and we will tell you, honestly, whether we can help —
              and what we would do first.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/contact" className="btn-primary group">
                Book a Strategy Call
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </Link>
              <Link href="/audit" className="btn-secondary">
                Request an AI Business Audit
              </Link>
            </div>
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-snow-faint">
              {availableAgents.length} of our AI agents are available today · The rest are labelled honestly
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
