import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Restaurant Rescue Agent — Winners Bookmark Incorporated',
  description: 'Restaurant revenue intelligence and AI opportunity detection engine.',
};

const NAV = [
  { href: '/', label: 'Command Center' },
  { href: '/audits/new', label: 'New Audit' },
  { href: '/audits', label: 'Audits' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-obsidian-line bg-obsidian-soft/60 backdrop-blur sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="font-display text-gold text-lg tracking-wide">WINNERS BOOKMARK</span>
              <span className="label hidden sm:inline">Restaurant Rescue Agent</span>
            </Link>
            <nav className="flex gap-6">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="text-xs uppercase tracking-[0.15em] text-ivory-dim hover:text-gold transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
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
