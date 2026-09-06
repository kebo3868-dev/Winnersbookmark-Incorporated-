/**
 * COMPANY + SITE CONFIGURATION
 *
 * Single source of truth for brand facts, contact routes and canonical URLs.
 * Pages read from here so a change to the company's email or domain is one
 * edit, not a search-and-replace across twenty files.
 */

/**
 * Canonical origin, used for absolute URLs in metadata, Open Graph tags,
 * the sitemap and structured data.
 *
 * NO CUSTOM DOMAIN IS ASSUMED. An audit of this repository, its documentation,
 * its CI configuration and its environment templates found no evidence that
 * winnersbookmark.com is registered to or controlled by the company — the one
 * mention (`hello@winnersbookmark.com`) sits in the Daily Blogs prototype
 * alongside placeholder Stripe, Gumroad and social URLs that are equally
 * unverified.
 *
 * So resolution order is:
 *   1. NEXT_PUBLIC_SITE_URL — set this when a domain IS verified and connected.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the stable production alias Vercel
 *      injects, which is correct until a custom domain exists.
 *   3. localhost, for development.
 *
 * Connecting winnersbookmark.com later is then a Vercel setting plus one
 * environment variable. No code change, no redeploy of content.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();

/** True once a real domain has been configured. Drives nothing user-visible
 *  today, but lets a page opt out of emitting canonical tags that would point
 *  at a preview URL. */
export const HAS_CANONICAL_DOMAIN = Boolean(
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim(),
);

export const company = {
  legalName: 'Winners Bookmark Incorporated',
  shortName: 'Winners Bookmark',
  founder: 'Keith Warren',
  founderRole: 'Founder',

  /** What the company does, in one sentence a non-technical owner understands. */
  positioning:
    'An AI consulting and automation company that helps restaurants and local service businesses recover missed revenue, answer every customer, and automate the work that eats their day.',

  /** Shorter form, for meta descriptions and cards. */
  shortPositioning:
    'AI systems that recover missed revenue for restaurants and local service businesses.',
} as const;

/**
 * Contact routes.
 *
 * `bookingUrl` is intentionally null. No scheduling system (Calendly, Cal.com,
 * SavvyCal, HubSpot) is configured anywhere in this repository, and inventing a
 * URL would produce a dead primary CTA — the single most damaging bug a
 * marketing site can ship. Until one is configured, the contact form IS the
 * booking path: it captures the inquiry and tells the prospect what happens
 * next. Set NEXT_PUBLIC_BOOKING_URL to switch every "book a call" affordance
 * over to a real scheduler.
 */
const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || null;

export const contact = {
  /** Fallback address shown when the inquiry form cannot reach the pipeline.
   *  Overridable so it can be corrected without a code change. */
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || 'keith@winnersbookmark.com',
  bookingUrl,
  hasBooking: bookingUrl !== null,
} as const;

/**
 * Primary navigation. Deliberately five items: the ecosystem, the two flagship
 * offers' parent section, the proof, the company, and the action.
 *
 * The Daily Blogs product is NOT in this navigation. It is a separate business
 * with a separate audience, preserved in the repository at the founder's
 * direction, and putting it here would confuse an executive evaluating an AI
 * consultancy.
 */
export const primaryNav = [
  { href: '/solutions', label: 'AI Agents' },
  { href: '/consulting', label: 'Consulting' },
  { href: '/restaurants', label: 'For Restaurants' },
  { href: '/about', label: 'About' },
] as const;

export const footerNav = [
  {
    heading: 'AI Agents',
    links: [
      { href: '/solutions', label: 'All AI Agents' },
      { href: '/solutions/restaurant-rescue-agent', label: 'Restaurant Rescue Agent' },
      { href: '/solutions/ai-front-desk', label: 'AI Front Desk' },
      { href: '/solutions/ai-sales-agent', label: 'AI Sales Agent' },
      { href: '/solutions/gigi', label: 'Gigi' },
    ],
  },
  {
    heading: 'Services',
    links: [
      { href: '/consulting', label: 'AI Consulting' },
      { href: '/restaurants', label: 'Restaurant AI' },
      { href: '/audit', label: 'AI Business Audit' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About Winners Bookmark' },
      { href: '/about/founder', label: 'About the Founder' },
      { href: '/contact', label: 'Contact' },
    ],
  },
] as const;
