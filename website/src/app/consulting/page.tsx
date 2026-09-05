import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';

export const metadata: Metadata = {
  title: 'AI Consulting',
  description:
    'AI consulting for businesses that want a straight answer: what AI can actually do for you, what it cannot, and what is worth building first.',
  alternates: { canonical: '/consulting' },
  openGraph: {
    title: 'AI Consulting | Winners Bookmark',
    description: 'Practical AI consulting, audits and implementation for local business.',
    url: '/consulting',
  },
};

const SERVICES = [
  {
    title: 'AI Opportunity Audit',
    body: 'We examine how your business actually runs and identify where automation would genuinely help — and where it would just add another system nobody maintains. You get a ranked list with reasoning, not a sales document.',
    deliverable: 'Written findings, ranked by impact',
  },
  {
    title: 'Customer Journey Analysis',
    body: 'We follow the path your customers take, from first contact to completed sale, and document every point where that path costs you people. This is where most recoverable revenue turns out to be hiding.',
    deliverable: 'Evidence-backed journey map',
  },
  {
    title: 'Automation Design',
    body: 'Once we know what is worth fixing, we design the system that fixes it — what it does, what it must never do, how it fails safely, and who is responsible when it does.',
    deliverable: 'System design and operating rules',
  },
  {
    title: 'Implementation',
    body: 'We build and deploy it, configure it around how your business actually works, and stay responsible for it running correctly. Not a handover of documentation.',
    deliverable: 'A working system, in service',
  },
  {
    title: 'Ongoing Operation',
    body: 'Systems drift. Menus change, hours change, staff change. We keep the agent accurate as the business moves rather than leaving you with something that was true in March.',
    deliverable: 'Monitoring and maintenance',
  },
];

const PRINCIPLES = [
  {
    title: 'We will tell you not to buy',
    body: 'Plenty of problems that look like AI problems are a broken link, a missing phone number, or a process nobody wrote down. If that is what we find, that is what we will tell you — it costs us a sale and saves you a project.',
  },
  {
    title: 'Evidence before recommendation',
    body: 'We do not recommend a system before we can show you the problem it solves in your own business. Every recommendation traces back to something we found.',
  },
  {
    title: 'You own the outcome, not the jargon',
    body: 'You will never need to understand a model, a pipeline, or a prompt to work with us. If we cannot explain what something does in plain English, we do not understand it well enough to sell it.',
  },
  {
    title: 'Honest about limits',
    body: 'AI is genuinely good at some things and genuinely bad at others. We are specific about which is which, including where our own systems stop.',
  },
];

export default function ConsultingPage() {
  return (
    <>
      <section className="border-b border-night-line">
        <div className="shell py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">AI Consulting</p>
            <h1 className="mt-5 text-display-lg font-bold text-snow">
              A straight answer about what AI can do for your business.
            </h1>
            <p className="lede mt-6 max-w-2xl text-lg">
              Most businesses do not need an AI strategy. They need one specific thing fixed, and
              they need to know whether AI is the right tool for it. That is the conversation we
              start with.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className="btn-primary">Book a Strategy Call</Link>
              <Link href="/audit" className="btn-secondary">Request an AI Business Audit</Link>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading
          eyebrow="What we do"
          title="From finding the problem to running the system."
          body="You can engage us at any point in this. Most businesses start with an audit, because deciding what to build before knowing what is broken is how projects get expensive."
        />
        <div className="mt-12 space-y-4">
          {SERVICES.map((service, i) => (
            <div key={service.title} className="card p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-mono text-xs font-bold tracking-wider text-electric-light"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="max-w-prose">
                    <h3 className="text-lg font-semibold text-snow">{service.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-snow-dim">{service.body}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded border border-night-edge px-2.5 py-1 text-[11px] font-medium text-snow-faint">
                  {service.deliverable}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-y border-night-line bg-night-soft/30">
        <SectionHeading
          eyebrow="How we work"
          title="The rules we hold ourselves to."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="card p-6 sm:p-7">
              <h3 className="text-base font-semibold text-snow">{p.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-snow-dim">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="card p-8 text-center sm:p-12">
          <h2 className="text-display-md font-bold text-snow">Start with a conversation.</h2>
          <p className="lede mx-auto mt-4 max-w-xl">
            Tell us what is not working. We will tell you whether we can help, what we would do
            first, and what it would take.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/contact" className="btn-primary">Book a Strategy Call</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
