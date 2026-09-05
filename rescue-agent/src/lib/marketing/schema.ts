import { z } from 'zod';

/**
 * MARKETING ENQUIRY VALIDATION
 *
 * Shared shape for the public website's contact form and this app's ingest
 * endpoint. Kept deliberately permissive on everything except name, email and
 * message: each additional required field costs real enquiries, and a lead
 * with a name and an email is a lead worth having.
 */

/** Offers the marketing site can attribute an enquiry to.
 *
 *  NOT an enum in the database. The website's offers change faster than a
 *  migration cycle, and an unrecognised value must never cause a real customer
 *  enquiry to be rejected — it is normalised to null and the enquiry is kept.
 */
export const KNOWN_INTERESTS = [
  'restaurant-rescue-agent',
  'ai-front-desk',
  'ai-sales-agent',
  'gigi',
  'ai-business-audit',
  'consulting',
  'general',
] as const;

export function normaliseInterest(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return (KNOWN_INTERESTS as readonly string[]).includes(trimmed) ? trimmed : null;
}

export const marketingLeadSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120),
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address')
    .max(254)
    // Shallow on purpose. Strict RFC validation rejects addresses that work in
    // practice, and only the mail provider settles deliverability. This is here
    // to catch typos, not to adjudicate the spec.
    .regex(/^[^\s@]+@[^\s@.]+\.[^\s@]+$/, 'Enter a valid email address'),
  company: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  websiteUrl: z.string().trim().max(500).optional().nullable(),
  interest: z.string().trim().max(64).optional().nullable(),
  message: z.string().trim().min(1, 'Tell us what you need').max(5000),
  sourcePath: z.string().trim().max(200).optional().nullable(),
  /**
   * Honeypot. A field hidden from people and left empty by them; bots fill in
   * everything they find. When it is populated the submission is STORED and
   * FLAGGED rather than discarded — a false positive that silently deletes a
   * real customer enquiry is far more costly than one a human glances at.
   */
  botField: z.string().max(200).optional().nullable(),
});

export type MarketingLeadInput = z.infer<typeof marketingLeadSchema>;

/** Empty strings from an HTML form mean "not provided", not "provided as ''". */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
