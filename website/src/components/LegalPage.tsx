import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandRule } from './Logo';

/**
 * Shared shell for the legal pages. Narrow measure, generous leading — these
 * are documents to be read, not marketing surfaces, and they should look like
 * the company takes them seriously.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <>
      <section className="border-b border-ink-line">
        <div className="shell py-14 sm:py-20">
          <div className="max-w-prose">
            <p className="eyebrow">Legal</p>
            <h1 className="mt-5 text-display-1 text-text-bright">{title}</h1>
            <p className="lede mt-5">{intro}</p>
            <p className="mt-6 font-mono text-[0.75rem] text-text-muted">Last updated: {updated}</p>
          </div>
        </div>
      </section>

      <div className="shell py-14 sm:py-20">
        <div className="max-w-prose space-y-12">{children}</div>

        <BrandRule className="mx-auto mt-16 max-w-[180px]" />
        <p className="mt-8 text-center text-[0.8125rem] text-text-muted">
          Questions about this page?{' '}
          <Link href="/contact" className="font-semibold text-cobalt-light underline underline-offset-4 hover:text-text-bright">
            Contact us
          </Link>
          .
        </p>
      </div>
    </>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-display-3 text-text-bright">{heading}</h2>
      <div className="mt-4 space-y-4 text-body text-text-secondary [&_a]:font-semibold [&_a]:text-cobalt-light [&_a]:underline [&_a]:underline-offset-4 [&_strong]:text-text-primary">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-cobalt-core" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
