import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { company, contact } from '@/data/site';
import { founderImageDataUri } from '@/data/founder-image';

export const metadata: Metadata = {
  title: 'About the Founder',
  description: `${company.founder} is the founder of ${company.legalName}, building practical AI systems for restaurants and local service businesses.`,
  alternates: { canonical: '/about/founder' },
  openGraph: {
    title: `${company.founder} | ${company.shortName}`,
    description: `Founder of ${company.legalName}.`,
    url: '/about/founder',
  },
};

const PRINCIPLES = [
  {
    title: 'Revenue leaks identified',
    body: 'Find where interested customers are dropping out before an order, booking, or enquiry is completed.',
  },
  {
    title: 'Missed enquiries captured',
    body: 'Give customers a response when staff cannot get to the phone or message in time.',
  },
  {
    title: 'Practical AI systems',
    body: 'Build around real business operations instead of forcing a business into generic software.',
  },
];

export default function FounderPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-night-line">
        <div className="shell py-16 sm:py-24 lg:py-28">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-x-2 text-xs text-snow-faint">
              <li><Link href="/" className="inline-block py-1.5 transition-colors hover:text-snow-dim">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href="/about" className="inline-block py-1.5 transition-colors hover:text-snow-dim">About</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-snow-dim">Founder</li>
            </ol>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div>
              <p className="eyebrow">Our Founder</p>
              <h1 className="mt-5 text-display-lg font-bold text-snow sm:text-display-xl">Meet the Founder</h1>
              <p className="lede mt-5 max-w-xl text-lg">
                Real experience. Practical AI solutions. A stronger tomorrow for local businesses.
              </p>

              <div className="mt-9">
                <h2 className="text-3xl font-bold text-snow">{company.founder}</h2>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-electric-light">
                  {company.founderRole}, {company.legalName}
                </p>
              </div>

              <div className="mt-7 h-1 w-16 rounded-full bg-electric" aria-hidden="true" />

              <div className="mt-7 max-w-2xl space-y-5 text-[15px] leading-relaxed text-snow-dim sm:text-base">
                <p>
                  I founded {company.legalName} to help local businesses recover missed opportunities,
                  answer more enquiries, and implement practical AI systems that solve real business problems.
                </p>
                <p>
                  My focus is simple: find where a business is losing customers, determine what is actually
                  worth fixing, and build the AI system that solves it.
                </p>
              </div>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/contact" className="btn-primary">Book a Strategy Call</Link>
                <Link href="#approach" className="btn-secondary">About the Founder</Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-night-line bg-night-card shadow-2xl">
              <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_60%_20%,rgba(37,99,235,0.18),transparent_45%)]" />
              <img
                src={founderImageDataUri}
                alt="Keith Warren, founder of Winners Bookmark Incorporated"
                className="relative block h-auto w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <Section id="approach">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="eyebrow">The approach</p>
            <h2 className="mt-4 text-display-md font-bold text-snow">AI should solve the business problem, not become another one.</h2>
            <p className="lede mt-5">
              Winners Bookmark starts with the customer journey and the operational bottleneck, then uses AI only where it creates a useful outcome.
            </p>
          </div>

          <div className="space-y-5 text-[15px] leading-relaxed text-snow-dim">
            <p>
              The Restaurant Rescue Agent is built to identify where a customer journey breaks and attach evidence to the finding. The AI Front Desk is built to catch missed enquiries and handle routine customer questions without pretending to know what it does not know.
            </p>
            <p>
              The principle is the same across the company: practical systems, visible status, and no invented performance claims. If a simple website fix is the right answer, that should be said plainly. If automation can remove a recurring revenue leak, then that is where the system belongs.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PRINCIPLES.map((item) => (
            <div key={item.title} className="card p-6">
              <h3 className="text-base font-semibold text-snow">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-snow-dim">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-y border-night-line bg-night-soft/30">
        <div className="max-w-3xl">
          <p className="eyebrow">Why Winners Bookmark</p>
          <h2 className="mt-4 text-display-md font-bold text-snow">Built for owners who need useful answers, not AI theatre.</h2>
          <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-snow-dim">
            <p>
              Winners Bookmark is an early company, and the website says so honestly. Every agent carries its real status. Capabilities still in development are labelled as such. Results are not published until there is real customer evidence behind them.
            </p>
            <p>
              That discipline matters because trust is part of the product. A business owner should know exactly what is available, what is still being built, and what problem a system is designed to solve before making a decision.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="card relative overflow-hidden p-8 text-center sm:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(37,99,235,0.18),transparent_70%)]" />
          <div className="relative">
            <h2 className="text-display-md font-bold text-snow">Talk to Keith directly.</h2>
            <p className="lede mx-auto mt-4 max-w-xl">
              Tell me what is happening in your business. I will tell you whether AI is worth using, what I would fix first, and when a simpler solution makes more sense.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/contact" className="btn-primary">Book a Strategy Call</Link>
              <a href={`mailto:${contact.email}`} className="btn-secondary">Email directly</a>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
