import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';

export const metadata: Metadata = {
  title: 'AI Business Audit',
  description:
    'Request an AI business audit: evidence-backed findings on where your customer journey is losing you revenue, and what to fix first.',
  alternates: { canonical: '/audit' },
  openGraph: {
    title: 'AI Business Audit | Winners Bookmark',
    description: 'Evidence-backed findings on where your business is losing revenue.',
    url: '/audit',
  },
};

const INCLUDED = [
  'Every finding tied to the page it was found on',
  'A confidence level on each finding, stated openly',
  'Revenue leaks ranked by what to fix first',
  'The ordering and booking paths tested, not assumed',
  'A clear statement of anything we could not analyse, and why',
  'Recommendations in plain English, with no obligation to buy anything',
];

const NOT_INCLUDED = [
  'A projected revenue figure — we would be inventing it',
  'A recovery percentage — we have no data that makes one honest',
  'A finding we cannot point to a source for',
  'Pressure to buy a system you do not need',
];

export default function AuditPage() {
  return (
    <>
      <section className="border-b border-ink-line">
        <div className="shell py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">AI Business Audit</p>
            <h1 className="mt-5 text-display-1 font-bold text-text-bright">
              Find out what your business is losing — before you buy anything.
            </h1>
            <p className="lede mt-6 max-w-2xl text-lg">
              An evidence-backed examination of the journey your customers actually take, and
              every point where that journey costs you people. You get the findings whether or not
              you work with us afterwards.
            </p>
            <div className="mt-9">
              <Link href="/contact?interest=ai-business-audit" className="btn-primary">
                Request an AI Business Audit
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="surface p-6 sm:p-8">
            <h2 className="text-display-3 font-bold text-text-bright">What the audit includes</h2>
            <ul className="mt-7 space-y-3.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-text-secondary">
                  <span aria-hidden="true" className="mt-[3px] shrink-0 font-bold text-signal-live">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* An explicit "what this is not" section. It disqualifies the wrong
              prospect early, and it is far more persuasive to the right one
              than another list of benefits would be. */}
          <div className="surface p-6 sm:p-8">
            <h2 className="text-display-3 font-bold text-text-bright">What it will not include</h2>
            <ul className="mt-7 space-y-3.5">
              {NOT_INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-text-secondary">
                  <span aria-hidden="true" className="mt-[3px] shrink-0 font-bold text-text-muted">✕</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-7 text-sm leading-relaxed text-text-muted">
              If that makes the audit sound less impressive than others you have been offered,
              that is the point. An audit full of confident numbers nobody can source is not
              worth acting on.
            </p>
          </div>
        </div>
      </Section>

      <Section className="border-y border-ink-line bg-ink-base/30">
        <SectionHeading
          eyebrow="The process"
          title="What happens after you ask"
        />
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { step: '01', title: 'You send us your details', body: 'Your website address and a short description of what is not working. That is all we need to begin.' },
            { step: '02', title: 'We run the analysis', body: 'We examine the public customer journey and record what we find, with a source for every finding.' },
            { step: '03', title: 'We walk you through it', body: 'You get the findings and a conversation about what they mean — including which ones are not worth your time.' },
          ].map((item) => (
            <li key={item.step} className="surface p-6 sm:p-7">
              <span className="font-mono text-xs font-bold tracking-wider text-cobalt-light">{item.step}</span>
              <h3 className="mt-4 text-lg font-semibold text-text-bright">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">{item.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <div className="surface p-8 text-center sm:p-12">
          <h2 className="text-display-2 font-bold text-text-bright">Request your audit.</h2>
          <p className="lede mx-auto mt-4 max-w-xl">
            Tell us about your business and we will get started. No obligation, and no
            pressure afterwards.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/contact?interest=ai-business-audit" className="btn-primary">
              Request an AI Business Audit
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
