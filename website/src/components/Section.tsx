import type { ReactNode } from 'react';
import Reveal from './Reveal';

/**
 * Section scaffolding. Every marketing section is built from these, so vertical
 * rhythm, heading level and measure stay consistent — and a spacing change is
 * one edit rather than forty.
 */
export function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'left',
  as: Heading = 'h2',
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: string;
  align?: 'left' | 'center';
  as?: 'h2' | 'h3';
}) {
  const centered = align === 'center';
  return (
    <div className={`max-w-2xl ${centered ? 'mx-auto text-center' : ''}`}>
      {eyebrow && (
        <Reveal as="p" className={`eyebrow mb-5 ${centered ? 'justify-center' : ''}`}>
          {eyebrow}
        </Reveal>
      )}
      <Reveal as={Heading} delay={60} className="text-display-2 text-text-bright">
        {title}
      </Reveal>
      {body && (
        <Reveal as="p" delay={120} className="lede mt-5">
          {body}
        </Reveal>
      )}
    </div>
  );
}

export function Section({
  children,
  className = '',
  id,
  tight = false,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tight?: boolean;
}) {
  return (
    <section id={id} className={`${tight ? 'section-tight' : 'section'} ${className}`}>
      <div className="shell">{children}</div>
    </section>
  );
}
