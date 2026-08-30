import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import SiteNav from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Restaurant Rescue Agent — Winners Bookmark Incorporated',
  description: 'Restaurant revenue intelligence and AI opportunity detection engine.',
};

const NAV = [
  { href: '/', label: 'Command Center' },
  { href: '/audits/new', label: 'New Audit' },
  { href: '/audits', label: 'Audits' },
  { href: '/leads', label: 'Leads' },
  { href: '/frontdesk', label: 'Front Desk' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-obsidian-line bg-obsidian-soft/60 backdrop-blur sticky top-0 z-10">
          {/* One row at every width. The nav no longer wraps because below `sm`
              it is not a row at all — SiteNav swaps it for a drawer, which is
              what stopped FRONT DESK falling onto a second line on a phone. */}
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-x-6">
            <Link href="/" className="flex items-baseline gap-3 min-w-0">
              <span className="font-display text-gold text-base sm:text-lg tracking-wide truncate">WINNERS BOOKMARK</span>
              <span className="label hidden sm:inline">Restaurant Rescue Agent</span>
            </Link>
            <SiteNav items={NAV} />
          </div>
        </header>
        {/* Extra bottom padding on phones so a floating control anchored to the
            bottom-right — a preview toolbar, a browser action bar — cannot sit
            on top of the last audit card's text. Desktop is unchanged. */}
        <main className="max-w-6xl mx-auto px-5 sm:px-6 py-8 sm:py-10 pb-28 sm:pb-10">{children}</main>
        <footer className="border-t border-obsidian-line mt-16">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap justify-between gap-4">
            <p className="label">Designed by Winnersbookmark Incorporated</p>
            <p className="label">Founder: Keith Warren</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
