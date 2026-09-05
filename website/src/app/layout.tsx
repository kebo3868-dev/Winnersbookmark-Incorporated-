import type { Metadata } from 'next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { SITE_URL, company } from '@/data/site';

/**
 * Root metadata. `metadataBase` makes every relative Open Graph and canonical
 * URL on the site resolve to an absolute one, so pages declare
 * `alternates.canonical: '/solutions'` and get the right absolute URL for
 * whichever origin this deployment is actually served from.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${company.legalName} — AI Systems for Restaurants and Local Business`,
    template: `%s | ${company.shortName}`,
  },
  description: company.positioning,
  applicationName: company.legalName,
  authors: [{ name: company.founder }],
  creator: company.legalName,
  publisher: company.legalName,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: company.legalName,
    title: `${company.legalName} — AI Systems for Restaurants and Local Business`,
    description: company.positioning,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${company.legalName} — AI Systems for Restaurants and Local Business`,
    description: company.shortPositioning,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export const viewport = {
  themeColor: '#05070d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        {/* Keyboard users must be able to reach the content without tabbing the
            whole navigation on every page. Visually hidden until focused. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-electric focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
