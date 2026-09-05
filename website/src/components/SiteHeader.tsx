'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from './Logo';
import { primaryNav } from '@/data/site';

/**
 * PRIMARY NAVIGATION
 *
 * Desktop is a row; below `lg` it becomes a drawer. The breakpoint is `lg`
 * rather than `sm` because the wordmark is two lines wide and four nav labels
 * plus a CTA do not fit a tablet without the row reflowing into two ragged
 * lines — which reads as broken on exactly the devices owners browse on.
 *
 * The drawer traps nothing and blocks nothing: Escape closes it, an outside
 * click closes it, and a route change closes it (Next keeps the layout mounted
 * across navigations, so without that last one the drawer would stay open over
 * the page the visitor just asked for).
 */
export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        // Return focus to the control that opened the drawer, or a keyboard
        // user is dropped at the top of the document with no idea where they are.
        toggleRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-night-line bg-night/85 backdrop-blur-md">
      <div className="shell flex h-[68px] items-center justify-between gap-4">
        <Link href="/" aria-label={`${'Winners Bookmark Incorporated'} — home`} className="shrink-0">
          <Wordmark />
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                isCurrent(item.href) ? 'text-white' : 'text-snow-dim hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/contact" className="btn-primary hidden !min-h-[44px] !px-5 !py-2.5 sm:inline-flex">
            Book a Strategy Call
          </Link>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-night-line text-snow-dim transition-colors hover:border-night-edge hover:text-white lg:hidden"
          >
            <span aria-hidden="true" className="flex flex-col gap-[4px]">
              <span className={`block h-[1.5px] w-4 bg-current transition-transform ${open ? 'translate-y-[5.5px] rotate-45' : ''}`} />
              <span className={`block h-[1.5px] w-4 bg-current transition-opacity ${open ? 'opacity-0' : ''}`} />
              <span className={`block h-[1.5px] w-4 bg-current transition-transform ${open ? '-translate-y-[5.5px] -rotate-45' : ''}`} />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        id="mobile-nav"
        ref={panelRef}
        hidden={!open}
        className="border-t border-night-line bg-night-soft lg:hidden"
      >
        <nav className="shell flex flex-col py-3" aria-label="Primary">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              className={`rounded-lg px-3 py-3.5 text-[15px] font-medium transition-colors ${
                isCurrent(item.href) ? 'bg-night-card text-white' : 'text-snow-dim hover:bg-night-card hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/contact" className="btn-primary mt-3 w-full">
            Book a Strategy Call
          </Link>
        </nav>
      </div>
    </header>
  );
}
