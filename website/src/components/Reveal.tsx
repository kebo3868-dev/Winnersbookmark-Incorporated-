'use client';

import { useEffect, useRef, type ReactNode, type ElementType } from 'react';

/**
 * SCROLL REVEAL
 *
 * One IntersectionObserver per element, disconnected the moment it fires. No
 * animation library, no scroll listener, no work on the main thread after the
 * element has appeared.
 *
 * The element is NOT hidden by JavaScript — it starts hidden in CSS and is
 * released by a data attribute. That ordering matters: if JS fails to load, or
 * the browser has no IntersectionObserver, the fallback below reveals
 * everything immediately rather than leaving a blank page. Content is never
 * dependent on script to be visible.
 *
 * `prefers-reduced-motion` is handled in CSS (globals.css), so the animation
 * simply does not play while the content still shows.
 */
export default function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger, in ms. Keep under ~240ms total across a group; beyond that it
   *  stops reading as choreography and starts reading as lag. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      el.setAttribute('data-revealed', '');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-revealed', '');
        observer.disconnect();
      },
      // Fires slightly before the element reaches the viewport, so it is
      // already settled by the time the reader's eye arrives.
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal=""
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}
