'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark, BookmarkNotch } from './Logo';
import { primaryNav } from '@/data/site';

/**
 * PRIMARY NAVIGATION
 *
 * Desktop: a restrained row. The active item is marked by the bookmark notch
 * rather than a pill or an underline — the brand's own geometry doing the work
 * a generic component would otherwise do.
 *
 * Mobile: a full-height panel, not a dropdown. A dropdown on a phone gives four
 * cramped rows under a header; a panel gives the navigation the same weight as
 * the page, which is what makes it feel like a product rather than a template.
 *
 * Accessibility this component owes and pays:
 *  - Escape closes and returns focus to the toggle.
 *  - Focus is trapped inside the open panel (Tab cycles, it cannot escape into
 *    the page behind).
 *  - Background scroll is locked while open, without the page jumping — the
 *    scrollbar's width is compensated.
 *  - Links close the panel on click, immediately, not after the route settles.
 */
export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  /* The header gains a border and a backdrop only once the page has moved.
     At the top it should feel like part of the hero, not a bar sitting on it. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Safety net for navigations that do not come from a panel link — a back
     button, a redirect. Panel links close on click, so this is not the primary
     mechanism; relying on it alone leaves the panel covering the new page for
     the whole route transition. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* Scroll lock + focus trap, active only while the panel is open. */
  useEffect(() => {
    if (!open) return;

    const { body, documentElement } = document;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = 'hidden';
    // Without this the page visibly jumps left as the scrollbar disappears.
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ease-out ${
          scrolled || open
            ? 'border-b border-ink-line bg-ink-void/88 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="shell flex h-[74px] items-center justify-between gap-6">
          <Link
            href="/"
            aria-label="Winners Bookmark Incorporated — home"
            className="-my-2 flex shrink-0 items-center py-2"
            onClick={() => setOpen(false)}
          >
            <Wordmark />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {primaryNav.map((item) => {
              const current = isCurrent(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={`group relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-[0.875rem] font-medium transition-colors duration-200 ease-out ${
                    current ? 'text-text-bright' : 'text-text-secondary hover:text-text-bright'
                  }`}
                >
                  {/* The active marker is the brand geometry, not a generic pill. */}
                  <span
                    className={`transition-opacity duration-200 ${current ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <BookmarkNotch size={9} className="text-cobalt-core" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/contact" className="btn-primary btn-sm hidden sm:inline-flex">
              Book a Strategy Call
            </Link>

            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-ink-line bg-ink-panel/70 text-text-secondary transition-colors duration-200 ease-out hover:border-ink-border hover:text-text-bright lg:hidden"
            >
              <span aria-hidden="true" className="relative flex h-[14px] w-[18px] flex-col justify-between">
                <span
                  className={`block h-[1.5px] w-full origin-center rounded-full bg-current transition-all duration-300 ease-out ${
                    open ? 'translate-y-[6.25px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-full rounded-full bg-current transition-all duration-200 ease-out ${
                    open ? 'scale-x-0 opacity-0' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-full origin-center rounded-full bg-current transition-all duration-300 ease-out ${
                    open ? '-translate-y-[6.25px] -rotate-45' : ''
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ---- Mobile panel ------------------------------------------------ */}
      {/* Scrim. Fades rather than appearing, and closes on tap. */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink-void/70 backdrop-blur-sm transition-opacity duration-300 ease-out lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        id="mobile-nav"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        // `invisible` (not `hidden`) so the panel can transition out; it is
        // removed from the tab order and the a11y tree while closed.
        className={`fixed inset-x-0 top-[74px] z-40 origin-top border-b border-ink-line bg-ink-base/97 backdrop-blur-2xl transition-all duration-300 ease-out lg:hidden ${
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible -translate-y-3 opacity-0'
        }`}
        style={{ maxHeight: 'calc(100dvh - 74px)', overflowY: 'auto' }}
        {...(open ? {} : { inert: '' as unknown as boolean })}
      >
        <nav className="shell flex flex-col py-6" aria-label="Primary">
          {primaryNav.map((item, i) => {
            const current = isCurrent(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={current ? 'page' : undefined}
                style={{ transitionDelay: open ? `${60 + i * 45}ms` : '0ms' }}
                className={`group flex items-center justify-between border-b border-ink-line/70 py-4 text-[1.0625rem] font-medium transition-all duration-300 ease-out ${
                  open ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                } ${current ? 'text-text-bright' : 'text-text-secondary'}`}
              >
                <span className="flex items-center gap-3">
                  <span className={current ? 'opacity-100' : 'opacity-0'}>
                    <BookmarkNotch size={11} className="text-cobalt-core" />
                  </span>
                  {item.label}
                </span>
                <span aria-hidden="true" className="text-text-faint transition-transform duration-300 ease-out group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            );
          })}

          <div
            style={{ transitionDelay: open ? `${60 + primaryNav.length * 45}ms` : '0ms' }}
            className={`mt-7 transition-all duration-300 ease-out ${
              open ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
          >
            <Link href="/contact" onClick={() => setOpen(false)} className="btn-primary w-full">
              Book a Strategy Call
            </Link>
            <p className="mt-4 text-center text-[0.8125rem] text-text-muted">
              No cost, no obligation.
            </p>
          </div>
        </nav>
      </div>
    </>
  );
}
