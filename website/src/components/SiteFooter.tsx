import Link from 'next/link';
import { Wordmark, BookmarkNotch } from './Logo';
import { company, footerNav, contact } from '@/data/site';
import { availableAgents } from '@/data/agents';

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto border-t border-ink-line bg-ink-base/50">
      {/* A cobalt hairline along the very top edge — the site's closing mark. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-rule-cobalt" />

      <div className="shell py-16 sm:py-20">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-8">
          <div className="min-w-0">
            <Wordmark />
            <p className="mt-6 max-w-xs text-body text-text-secondary">
              {company.shortPositioning}
            </p>
            <Link href="/contact" className="btn-primary btn-sm mt-7">
              Book a Strategy Call
            </Link>

            {/* An honest, verifiable count — it reads from the registry, so it
                cannot drift from what the site actually offers. */}
            <p className="mt-6 flex items-center gap-2 text-[0.75rem] text-text-muted">
              <span className="status-dot bg-signal-live" />
              {availableAgents.length} AI agents available today
            </p>
          </div>

          {footerNav.map((group) => (
            <nav key={group.heading} aria-label={group.heading} className="min-w-0">
              <h2 className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-text-muted">
                <BookmarkNotch size={9} className="text-ink-steel" />
                {group.heading}
              </h2>
              <ul className="mt-4 space-y-0.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-block py-1.5 text-[0.875rem] text-text-secondary transition-colors duration-200 hover:text-text-bright"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 border-t border-ink-line pt-7">
          <div className="flex flex-col gap-3 text-[0.8125rem] text-text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© {year} {company.legalName}. All rights reserved.</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Founded by {company.founder}</span>
              <span aria-hidden="true" className="text-ink-steel">·</span>
              <a
                href={`mailto:${contact.email}`}
                className="break-all transition-colors duration-200 hover:text-text-secondary"
              >
                {contact.email}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
