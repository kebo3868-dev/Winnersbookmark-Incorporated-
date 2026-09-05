import type { ReactNode } from 'react';

/**
 * Section scaffolding. Every marketing section on the site is built from this
 * so vertical rhythm, heading levels and max-widths stay consistent — and so a
 * spacing change is one edit rather than forty.
 *
 * `as` exists because heading level is a document-structure decision, not a
 * styling one: a section heading is <h2> on a page with an <h1> hero, but the
 * same visual treatment is sometimes needed at <h3>.
 */
export function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'left',
  as: Heading = 'h2',
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: 'left' | 'center';
  as?: 'h2' | 'h3';
}) {
  const centered = align === 'center';
  return (
    <div className={`max-w-2xl ${centered ? 'mx-auto text-center' : ''}`}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <Heading className="text-display-md font-bold text-snow">{title}</Heading>
      {body && <p className="lede mt-4">{body}</p>}
    </div>
  );
}

export function Section({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`section ${className}`}>
      <div className="shell">{children}</div>
    </section>
  );
}
