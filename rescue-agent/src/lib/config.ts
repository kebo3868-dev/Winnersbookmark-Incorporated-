/**
 * Company configuration — the single place contact and product details live so
 * they are never scattered through report templates. Values here are PUBLIC
 * (they appear on client deliverables); never put secrets in this file.
 */
/**
 * Length of the Restaurant Rescue Review, in minutes — the ONE place it is set.
 *
 * The client report and PDF booked a 20-minute review while the sales brief
 * asked the same prospect for 15 minutes and timed its agenda to 15. Every
 * mention of the review's length, and the talk-track agenda, is now built from
 * this value.
 */
const REVIEW_MINUTES = 20;

export const COMPANY = {
  reviewMinutes: REVIEW_MINUTES,
  name: 'Winnersbookmark',
  shortName: 'Winnersbookmark',
  founder: 'Keith Warren',
  consultantName: 'Keith Warren',
  phone: '727-291-5965',
  footer: 'Designed by Winnersbookmark',
  productName: 'Restaurant Rescue Audit',
  reportSubtitle: 'Restaurant Revenue Intelligence & AI Opportunity Assessment',
  nextStepCta: `Schedule a ${REVIEW_MINUTES}-minute Restaurant Rescue Review to compare the public audit with your actual operating data.`,
  ctaHeadline: `BOOK YOUR ${REVIEW_MINUTES}-MINUTE RESTAURANT RESCUE REVIEW`,
  ctaSubtext: 'Compare this public audit with your actual call, booking, ordering, and operating data.',
} as const;

/**
 * Contact + booking resolution. `email` and `bookingUrl` are optional and read
 * from the environment so they are configured once, never scattered. These are
 * PUBLIC values printed on client deliverables — never secrets. When
 * BOOKING_URL is unset, the report shows a phone-based fallback instead of a
 * fake link or broken QR code.
 */
export interface Contact {
  company: string;
  consultantName: string;
  phone: string;
  email: string | null;
  bookingUrl: string | null;
  fallbackText: string;
}

export function getContact(env: Record<string, string | undefined> = process.env): Contact {
  const rawBooking = env.BOOKING_URL?.trim() || null;
  let bookingUrl: string | null = null;
  if (rawBooking && /^https?:\/\/\S+$/.test(rawBooking)) {
    try {
      bookingUrl = new URL(rawBooking).toString();
    } catch {
      bookingUrl = null;
    }
  }
  return {
    company: COMPANY.name,
    consultantName: COMPANY.consultantName,
    phone: COMPANY.phone,
    email: env.CONTACT_EMAIL?.trim() || null,
    bookingUrl,
    fallbackText: `Contact ${COMPANY.consultantName} at ${COMPANY.phone} to schedule your Restaurant Rescue Review.`,
  };
}
