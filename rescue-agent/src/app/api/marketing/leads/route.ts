import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { marketingLeadSchema, normaliseInterest, emptyToNull } from '@/lib/marketing/schema';
import { notifyFounderOfLead } from '@/lib/marketing/notify';
import { noteRejection } from '@/lib/frontdesk/security/rejections';

export const dynamic = 'force-dynamic';

/**
 * MARKETING LEAD INGEST
 *
 * The marketing website posts enquiries here, server-to-server. The browser
 * never calls this endpoint and never holds the shared secret.
 *
 * WHY INGEST RATHER THAN A SHARED DATABASE
 * ----------------------------------------
 * The obvious alternative — pointing the marketing site's own Prisma client at
 * this database — puts two applications in charge of one schema. The second app
 * to run `prisma migrate deploy` would see this app's tables as drift, and CI's
 * zero-drift assertion would be checking a schema neither app fully owns. One
 * schema, one owner; the marketing site holds no database credentials at all.
 *
 * FAILURE POSTURE
 * ---------------
 * The lead is persisted BEFORE any notification is attempted, and notification
 * failure never fails the request. Losing an alert is recoverable — the row is
 * in the database. Losing the enquiry is not.
 */

/** Constant-time comparison; a plain `===` on a secret leaks its length and
 *  prefix through timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.MARKETING_INGEST_SECRET?.trim();

  // Fail closed. Without a configured secret this endpoint does not accept
  // anything, rather than accepting everything — the same posture as the rest
  // of this application's webhooks.
  if (!expected) {
    console.error('Marketing lead ingest called but MARKETING_INGEST_SECRET is not configured.');
    return NextResponse.json({ error: 'INGEST NOT CONFIGURED' }, { status: 503 });
  }
  if (expected.length < 24) {
    console.error('MARKETING_INGEST_SECRET is too short; refusing to accept submissions.');
    return NextResponse.json({ error: 'INGEST NOT CONFIGURED' }, { status: 503 });
  }

  const provided = request.headers.get('x-wbi-ingest-secret') ?? '';
  if (!provided || !secretMatches(provided, expected)) {
    // A rejection here is not a curiosity — it is a silent outage. If the
    // shared secret is rotated on one side only, EVERY customer enquiry starts
    // returning 401 and nobody is told, because the failure happens on a
    // machine no one is watching.
    //
    // noteRejection bounds this: a caller presenting no header at all is a
    // scanner and writes nothing, while a caller presenting a WRONG one is
    // real information and is coalesced to one row per hour with a counter.
    // That is the difference between an operator seeing "the website cannot
    // submit leads" and seeing nothing.
    await noteRejection({
      tenantId: null,
      category: 'FAILED_INTEGRATION',
      operation: 'marketing.leads.ingest',
      reason: provided ? 'BAD_INGEST_SECRET' : 'NO_INGEST_SECRET',
      detail: 'Marketing lead ingest rejected an authentication attempt.',
      credentialPresented: provided !== '',
    });
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID REQUEST BODY' }, { status: 400 });
  }

  const parsed = marketingLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'VALIDATION FAILED',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const flaggedSpam = Boolean(input.botField && input.botField.trim() !== '');

  let lead;
  try {
    lead = await prisma.marketingLead.create({
      data: {
        name: input.name,
        email: input.email,
        company: emptyToNull(input.company),
        phone: emptyToNull(input.phone),
        websiteUrl: emptyToNull(input.websiteUrl),
        interest: normaliseInterest(input.interest),
        message: input.message,
        sourcePath: emptyToNull(input.sourcePath),
        flaggedSpam,
      },
    });
  } catch (error) {
    // The one failure the caller MUST be told about, because it is the only
    // one where the enquiry is genuinely lost. The website turns this into a
    // visible error and the direct email fallback — never a success message.
    console.error('Marketing lead could not be stored', error);
    return NextResponse.json({ error: 'LEAD COULD NOT BE STORED' }, { status: 500 });
  }

  // Stored. From here nothing may turn this into a failure response.
  const notification = await notifyFounderOfLead(lead).catch((error): { outcome: 'failed'; reason: string } => {
    console.error(`Marketing lead ${lead.id}: notification threw`, error);
    return { outcome: 'failed', reason: 'Notification raised an unexpected error.' };
  });

  if (notification.outcome === 'sent') {
    await prisma.marketingLead
      .update({ where: { id: lead.id }, data: { notifiedAt: new Date() } })
      .catch((e) => console.error(`Marketing lead ${lead.id}: could not record notifiedAt`, e));
  } else if (notification.outcome === 'failed') {
    await prisma.marketingLead
      .update({ where: { id: lead.id }, data: { notifyFailed: true } })
      .catch((e) => console.error(`Marketing lead ${lead.id}: could not record notifyFailed`, e));
  } else {
    // 'not_configured' is a deployment state, not an error. Logged once at
    // warn so it is visible in logs without being alarming.
    console.warn(`Marketing lead ${lead.id}: no email notification sent — ${notification.reason}`);
  }

  return NextResponse.json(
    {
      id: lead.id,
      stored: true,
      // Reported honestly so the website can tell the operator the truth if it
      // ever surfaces this. It never claims delivery — only that a provider
      // accepted the message.
      notification: notification.outcome,
    },
    { status: 201 },
  );
}
