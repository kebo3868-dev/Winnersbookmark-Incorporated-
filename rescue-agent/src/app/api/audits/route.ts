import { NextResponse, after } from 'next/server';
import { z } from '@/lib/validation/zod';
import { createAudit, runAudit } from '@/lib/audit/orchestrator';
import { requireOperatorRequest } from '@/lib/operatorAuth';
import { parseIntakeNumber, type IntakeNumberField } from '@/lib/validation/intakeNumbers';

// The audit pipeline continues via after() once the response is sent; on
// serverless hosting the function must be allowed to live long enough for the
// slowest audit (page collection + probes ≈ up to ~4 minutes worst case).
// On Vercel this requires Fluid Compute (default on new projects).
export const maxDuration = 300;

const bodySchema = z.object({
  websiteUrl: z.string().min(4).max(2000),
  restaurantName: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  knownConcern: z.string().max(2000).optional(),
  // Phase 3 — optional owner-supplied intake
  reservationUrl: z.string().max(2000).optional(),
  orderingUrl: z.string().max(2000).optional(),
  socialUrl: z.string().max(2000).optional(),
  googleBusinessUrl: z.string().max(2000).optional(),
  // Read by parseIntakeNumber below, never coerced: z.coerce.number() turned a
  // null (an unreadable "4,5" from the form) into 0. See intakeNumbers.ts.
  ownerRating: z.unknown().optional(),
  ownerReviewCount: z.unknown().optional(),
  avgTicket: z.unknown().optional(),
  // Phase 3 — prospect / lead capture
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().max(320).optional(),
  contactPhone: z.string().max(60).optional(),
  contactConsent: z.coerce.boolean().optional(),
});

const NUMBER_FIELDS: IntakeNumberField[] = ['ownerRating', 'ownerReviewCount', 'avgTicket'];

/** The error for an invalid field names that field; it used to say "INVALID WEBSITE URL" for all of them. */
const FIELD_ERRORS: Record<string, string> = {
  websiteUrl: 'INVALID WEBSITE URL',
  restaurantName: 'RESTAURANT NAME IS TOO LONG (200 CHARACTERS MAXIMUM)',
  city: 'CITY IS TOO LONG (120 CHARACTERS MAXIMUM)',
  state: 'STATE IS TOO LONG (60 CHARACTERS MAXIMUM)',
  knownConcern: 'KNOWN CONCERN IS TOO LONG (2000 CHARACTERS MAXIMUM)',
  reservationUrl: 'INVALID RESERVATION URL',
  orderingUrl: 'INVALID ORDERING URL',
  socialUrl: 'INVALID SOCIAL URL',
  googleBusinessUrl: 'INVALID GOOGLE BUSINESS URL',
  contactName: 'CONTACT NAME IS TOO LONG (200 CHARACTERS MAXIMUM)',
  contactEmail: 'INVALID CONTACT EMAIL',
  contactPhone: 'INVALID CONTACT PHONE',
  contactConsent: 'INVALID CONTACT CONSENT',
};

// Very small in-memory rate limit (per server instance) to protect the collector.
const recentRequests: number[] = [];
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const guard = requireOperatorRequest(request);
  if (!guard.ok) return guard.response;
  const now = Date.now();
  while (recentRequests.length > 0 && recentRequests[0] < now - RATE_WINDOW_MS) recentRequests.shift();
  if (recentRequests.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many audit requests. Please wait a minute.' }, { status: 429 });
  }
  recentRequests.push(now);

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'INVALID REQUEST' }, { status: 400 });
  }
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? 'websiteUrl');
    return NextResponse.json({ error: FIELD_ERRORS[field] ?? 'INVALID REQUEST' }, { status: 400 });
  }
  const data = { ...parsed.data, ownerRating: undefined as number | undefined, ownerReviewCount: undefined as number | undefined, avgTicket: undefined as number | undefined };
  for (const field of NUMBER_FIELDS) {
    const number = parseIntakeNumber(parsed.data[field], field);
    if (!number.ok) return NextResponse.json({ error: number.error }, { status: 400 });
    data[field] = number.value;
  }

  try {
    const result = await createAudit(data);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // Run the pipeline after the response is sent; progress is persisted and polled.
    after(async () => {
      try {
        await runAudit(result.auditId);
      } catch (error) {
        console.error('Audit pipeline crashed', error);
      }
    });
    return NextResponse.json({ auditId: result.auditId }, { status: 201 });
  } catch (error) {
    console.error('createAudit failed', error);
    return NextResponse.json({ error: 'AUDIT COULD NOT START' }, { status: 500 });
  }
}
