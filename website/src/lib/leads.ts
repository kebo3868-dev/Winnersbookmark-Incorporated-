import 'server-only';
import { z } from 'zod';

/**
 * LEAD SUBMISSION — SERVER SIDE ONLY
 *
 * `server-only` is load-bearing: it makes the build fail if this module is
 * ever imported into a client component. The ingest secret lives here, and a
 * stray import would ship it to the browser.
 *
 * This site holds NO database credentials. Inquiries are forwarded
 * server-to-server to the Restaurant Rescue Agent, which owns the leads
 * schema. See its api/marketing/leads route for why the boundary is drawn
 * there.
 */

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120, 'That name is too long'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address')
    .max(254)
    .regex(/^[^\s@]+@[^\s@.]+\.[^\s@]+$/, 'Enter a valid email address'),
  company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  websiteUrl: z.string().trim().max(500).optional(),
  interest: z.string().trim().max(64).optional(),
  message: z.string().trim().min(1, 'Tell us what you need').max(5000, 'That message is too long'),
  botField: z.string().max(200).optional(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export type SubmitResult =
  | { ok: true }
  /** Per-field messages for a validation failure. */
  | { ok: false; kind: 'validation'; fieldErrors: Record<string, string> }
  /**
   * The inquiry was NOT stored. The form must show the direct email fallback
   * and must never render a success state — an inquiry that silently vanishes
   * is the single worst failure a contact form can have.
   */
  | { ok: false; kind: 'unavailable'; message: string };

const TIMEOUT_MS = 10_000;

export async function submitLead(
  values: ContactFormValues,
  sourcePath: string,
): Promise<SubmitResult> {
  const endpoint = process.env.LEADS_INGEST_URL?.trim();
  const secret = process.env.MARKETING_INGEST_SECRET?.trim();

  if (!endpoint || !secret) {
    // Refuse loudly. The alternative — pretending to accept while discarding —
    // is exactly the failure mode this whole path exists to prevent.
    console.error(
      'Lead submission attempted but LEADS_INGEST_URL and/or MARKETING_INGEST_SECRET are not configured.',
    );
    return {
      ok: false,
      kind: 'unavailable',
      message: 'Our inquiry system is not reachable right now.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wbi-ingest-secret': secret,
      },
      body: JSON.stringify({ ...values, sourcePath }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (response.ok) return { ok: true };

    // Do not leak the upstream status to the visitor — it tells them nothing
    // useful and tells an attacker something. Log it for the operator instead.
    console.error(`Lead ingest rejected the submission: HTTP ${response.status}`);
    return {
      ok: false,
      kind: 'unavailable',
      message: 'We could not record your inquiry.',
    };
  } catch (error) {
    console.error('Lead ingest was unreachable', error);
    return {
      ok: false,
      kind: 'unavailable',
      message: 'We could not reach our inquiry system.',
    };
  } finally {
    clearTimeout(timer);
  }
}
