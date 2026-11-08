import Link from 'next/link';
import { Wordmark } from './Logo';
import { company, footerNav, contact } from '@/data/site';

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-night-line bg-night-soft/40">
      <div className="shell py-14 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="lede mt-5 max-w-xs text-sm">{company.shortPositioning}</p>
            <Link href={contact.strategyCallHref} className="btn-primary mt-6 !min-h-[44px] !px-5 !py-2.5">
              {contact.strategyCallLabel}
            </Link>
          </div>

          {footerNav.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-snow-faint">
                {group.heading}
              </h2>
              {/* `py-1.5` + `inline-block` gives each link a ~32px tap target
                  in a stacked list. Padding rather than margin, so the target
                  grows instead of just the gap between targets. */}
              <ul className="mt-3 space-y-0.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-block py-1.5 text-sm text-snow-dim transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Oversized wordmark as a sign-off. Decorative: the real name is in the
            lockup above and the copyright line below. */}
        <p
          aria-hidden="true"
          className="pointer-events-none mt-16 select-none whitespace-nowrap font-display text-[clamp(3rem,12.4vw,10.4rem)] leading-[0.85] tracking-[-0.03em] text-transparent [-webkit-text-stroke:1px_rgba(168,178,196,0.16)]"
        >
          Winners Bookmark
        </p>

        <div className="mt-8 flex flex-col gap-3 border-t border-night-line pt-7 text-xs text-snow-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {company.shortName}. All rights reserved.
          </p>
          <p>
            Founded by {company.founder} ·{' '}
            <a href={`mailto:${contact.email}`} className="transition-colors hover:text-snow-dim">
              {contact.email}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
