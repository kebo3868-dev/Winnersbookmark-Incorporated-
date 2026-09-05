import Link from 'next/link';
import { Wordmark } from './Logo';
import { company, footerNav, contact } from '@/data/site';

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-night-line bg-night-soft/40">
      <div className="shell py-14 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="lede mt-5 max-w-xs text-sm">{company.shortPositioning}</p>
            <Link href="/contact" className="btn-primary mt-6 !min-h-[44px] !px-5 !py-2.5">
              Book a Strategy Call
            </Link>
          </div>

          {footerNav.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-snow-faint">
                {group.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-snow-dim transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-night-line pt-7 text-xs text-snow-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {company.legalName}. All rights reserved.
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
