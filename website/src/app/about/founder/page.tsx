import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { company, contact } from '@/data/site';

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

export default function FounderPage() {
  return (
    <>
      <section className="border-b border-night-line">
        <div className="shell py-16 sm:py-24">
          <nav aria-label="Breadcrumb" className="mb-7">
            <ol className="flex flex-wrap items-center gap-x-2 text-xs text-snow-faint">
              <li><Link href="/" className="inline-block py-1.5 transition-colors hover:text-snow-dim">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href="/about" className="inline-block py-1.5 transition-colors hover:text-snow-dim">About</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-snow-dim">Founder</li>
            </ol>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.78fr] lg:gap-16">
            <div className="max-w-3xl">
              <p className="eyebrow">Our founder</p>
              <h1 className="mt-5 text-display-lg font-bold text-snow">Keith Warren</h1>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-electric-light">
                Founder, Winners Bookmark Incorporated
              </p>
              <p className="lede mt-6 max-w-2xl text-lg">
                I founded Winners Bookmark Incorporated to help local businesses recover missed
                revenue, answer every inquiry, and implement practical AI systems that solve real
                business problems.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/contact" className="btn-primary">Book a Strategy Call</Link>
                <Link href="/about" className="btn-secondary">About the company</Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-night-line bg-night-card shadow-2xl shadow-black/30 lg:max-w-none">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(37,99,235,0.18),transparent_42%)]" />
              <Image
                src="/images/keith-warren-founder.webp"
                alt="Keith Warren, founder of Winners Bookmark Incorporated"
                width={540}
                height={920}
                priority
                className="relative h-auto w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="eyebrow">Why WBI exists</p>
            <h2 className="mt-4 text-display-sm font-bold text-snow">Practical AI. Measurable business problems.</h2>
          </div>

          <div className="space-y-5 text-[15px] leading-relaxed text-snow-dim">
            <p>
              My focus is simple: give business owners the tools, support and AI expertise they
              need to operate more smoothly, serve more customers and grow with confidence.
            </p>
            <p>
              Winners Bookmark starts with the problem, not the software. We examine where a
              customer journey breaks down, prove what is happening with evidence, and only then
              recommend the system worth building.
            </p>
            <p>
              That approach is why our agents are designed to stay inside what they can verify.
              The Restaurant Rescue Agent ties findings to evidence. The AI Front Desk is built to
              answer from approved business information rather than inventing an answer that sounds
              plausible.
            </p>
          </div>
        </div>
      </Section>

      <Section className="border-y border-night-line bg-night-soft/30">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ['Evidence over hype', 'We would rather show you the proof than make a claim we cannot support.'],
            ['Business outcomes first', 'The goal is not more software. The goal is fewer missed customers and better operations.'],
            ['Build what is useful', 'If a simple fix beats an AI system, that is the recommendation we will make.'],
          ].map(([title, body]) => (
            <div key={title} className="card p-6 sm:p-7">
              <h3 className="text-base font-semibold text-snow">{title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-snow-dim">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="card p-8 text-center sm:p-12">
          <h2 className="text-display-md font-bold text-snow">Talk to Keith directly.</h2>
          <p className="lede mx-auto mt-4 max-w-xl">
            Inquiries to Winners Bookmark reach the founder. If you want to talk about what AI
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
