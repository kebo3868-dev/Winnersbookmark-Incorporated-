import type { Metadata } from 'next';
import { Suspense } from 'react';
import ContactForm from './ContactForm';
import { company, contact } from '@/data/site';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Talk to Winners Bookmark about AI for your business. Tell us what is not working and we will tell you honestly whether we can help.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: `Contact | ${company.shortName}`,
    description: 'Book a strategy call or request an AI business audit.',
    url: '/contact',
  },
};

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-night-line">
        <div className="shell py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Contact</p>
            <h1 className="mt-5 text-display-lg font-bold text-snow">
              Tell us what is not working.
            </h1>
            <p className="lede mt-5 max-w-2xl text-lg">
              You do not need to know what you want built, and you do not need to understand AI.
              Describe the problem and we will tell you honestly whether we can help — including
              when the answer is no.
            </p>
          </div>
        </div>
      </section>

      <div className="shell py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
          <div>
            {/* useSearchParams needs a Suspense boundary or the whole route
                opts out of static rendering. */}
            <Suspense
              fallback={<div className="card h-[600px] animate-pulse" aria-hidden="true" />}
            >
              <ContactForm />
            </Suspense>
          </div>

          <aside className="space-y-5">
            <div className="card p-6">
              <h2 className="text-base font-semibold text-snow">What happens after you send it</h2>
              <ol className="mt-5 space-y-4">
                {[
                  { t: 'Keith reads it', d: 'Enquiries go to the founder, not a shared inbox or a sales team.' },
                  { t: 'You get an honest reply', d: 'A first read on whether this is something we can help with, usually within one business day.' },
                  { t: 'We talk, if it fits', d: 'A call to go deeper. No obligation, and no pressure afterwards.' },
                ].map((step, i) => (
                  <li key={step.t} className="flex gap-3.5">
                    <span
                      aria-hidden="true"
                      className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded border border-electric/40 bg-electric/10 font-mono text-[11px] font-bold text-electric-light"
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-snow">{step.t}</p>
                      <p className="mt-1 text-sm leading-relaxed text-snow-dim">{step.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="card p-6">
              <h2 className="text-base font-semibold text-snow">Prefer email?</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-snow-dim">
                Write to us directly and it reaches the same place.
              </p>
              <a
                href={`mailto:${contact.email}`}
                className="mt-3 inline-block break-all py-1.5 text-sm font-semibold text-electric-light underline underline-offset-4 transition-colors hover:text-white"
              >
                {contact.email}
              </a>
            </div>

            <div className="card p-6">
              <h2 className="text-base font-semibold text-snow">What we will not do</h2>
              <ul className="mt-4 space-y-2.5">
                {[
                  'Sell you a system you do not need',
                  'Quote a revenue figure we cannot evidence',
                  'Add you to a mailing list',
                  'Chase you after a no',
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-snow-dim">
                    <span aria-hidden="true" className="mt-[3px] shrink-0 text-snow-faint">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
