'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * PRIMARY NAVIGATION
 *
 * Desktop keeps the horizontal row exactly as it was. Below `sm` the row is
 * replaced by a drawer, because five uppercase wide-tracked labels do not fit a
 * phone: FRONT DESK wrapped onto a second line and pushed the header taller than
 * the content it sits above.
 *
 * Wrapping was the previous fix and it is the reason this component exists — a
 * nav that reflows into two ragged rows reads as broken on the one screen size
 * most operators actually open this on.
 */

export interface NavItem {
  href: string;
  label: string;
}

export default function SiteNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigating away must close the drawer. Next.js keeps the layout mounted
  // across route changes, so without this the drawer stays open over the page
  // the user just asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      {/* Desktop — unchanged behaviour, no wrapping needed at this width. */}
      <nav className="hidden sm:flex justify-end gap-x-6" aria-label="Primary">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent(item.href) ? 'page' : undefined}
            className={`text-xs uppercase tracking-[0.15em] transition-colors ${
              isCurrent(item.href) ? 'text-gold' : 'text-ivory-dim hover:text-gold'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Mobile — one control, and a drawer that holds the full-width labels. */}
      <div className="sm:hidden relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="primary-nav-drawer"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          className="flex items-center gap-2 border border-obsidian-line rounded px-3 py-2 text-ivory-dim hover:text-gold hover:border-gold/40 transition-colors"
        >
          <span aria-hidden="true" className="flex flex-col gap-[3px]">
            <span className="block h-px w-4 bg-current" />
            <span className="block h-px w-4 bg-current" />
            <span className="block h-px w-4 bg-current" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.15em]">Menu</span>
        </button>

        <div
          id="primary-nav-drawer"
          hidden={!open}
          className="absolute right-0 top-full mt-2 z-20 w-56 rounded border border-obsidian-line bg-obsidian-soft shadow-xl"
        >
          <nav className="flex flex-col py-1" aria-label="Primary">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent(item.href) ? 'page' : undefined}
                className={`px-4 py-3 text-xs uppercase tracking-[0.15em] transition-colors ${
                  isCurrent(item.href) ? 'text-gold' : 'text-ivory-dim hover:text-gold hover:bg-obsidian/40'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
