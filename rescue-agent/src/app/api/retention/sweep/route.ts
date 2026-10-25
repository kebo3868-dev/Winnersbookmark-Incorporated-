import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { cronSecretMatches } from '@/lib/frontdesk/notify/worker';
import { noteRejection, presentedAnyCredential } from '@/lib/frontdesk/security/rejections';
import { previewExpiredPii, resolveLeadRetentionDays, sweepExpiredPii } from '@/lib/leads/retention';

export const dynamic = 'force-dynamic';

/**
 * SCHEDULED RETENTION SWEEP.
 *
 * Retention expiry used to run from one place only: the render of the operator
 * Leads page. That made a data-protection guarantee conditional on a human
 * opening a screen — if nobody looked for a month, personal data sat a month
 * past its window, and nothing anywhere said so.
 *
 * This endpoint exists so the sweep can be driven on a schedule instead. It
 * follows the same pattern as the notification dispatch trigger: a scheduler
 * cannot present the operator's Basic Auth credential, so the route
 * authenticates with CRON_SECRET and is exempt from the app-wide middleware for
 * that reason. `cronSecretMatches` refuses a missing secret and one weaker than
 * 16 characters, so the route fails closed rather than exposing a write.
 *
 * GET and POST both work: Vercel Cron issues GET, most other schedulers POST.
 *
 * Retention stays OFF unless LEAD_RETENTION_DAYS is set. When it is unset this
 * returns `retentionDays: null` and redacts nothing, which is the honest answer
 * — not an error, and not a silent success either.
 */
async function handle(request: NextRequest) {
  if (!cronSecretMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    // Bounded recording, same as the dispatch trigger: this route answers GET,
    // so a plain crawler hit must not write a row. Nothing is recorded unless
    // an authorization header was actually presented, and then only once an
    // hour. A silently failing retention sweep is a data-protection failure
    // that nobody would otherwise see.
    await noteRejection({
      tenantId: null,
      category: 'FAILED_INTEGRATION',
      operation: 'retention.sweep',
      reason: 'CRON_AUTH_FAILED',
      detail:
        'Scheduled retention sweeps are being rejected: the secret is missing, weaker than 16 characters, or wrong. ' +
        'Personal data on expired leads and marketing enquiries is NOT being redacted while this is true.',
      credentialPresented: presentedAnyCredential(request.headers, ['authorization']),
    });
    return NextResponse.json({ error: 'AUTHENTICATION REQUIRED' }, { status: 401 });
  }

  const retentionDays = resolveLeadRetentionDays();

  // DRY RUN FIRST, BY DESIGN.
  //
  // Redaction cannot be undone, so an operator must be able to see what a
  // window would hit before turning it on against real data. `?dryRun=1`
  // routes to a function that has no write method available to it at all.
  const dryRun = ['1', 'true', 'yes'].includes(
    (request.nextUrl.searchParams.get('dryRun') ?? '').toLowerCase(),
  );
  if (dryRun) {
    const preview = await previewExpiredPii(prisma, retentionDays);
    return NextResponse.json({
      ok: true,
      ...preview,
      note:
        retentionDays === null
          ? 'Retention is disabled, so a sweep would redact nothing. Set LEAD_RETENTION_DAYS to choose a window.'
          : `DRY RUN — nothing was changed. A real sweep would redact personal fields on ${preview.totalAffected} record(s) created before ${preview.cutoff?.toISOString()}. Field values are deliberately not returned.`,
    });
  }

  const result = await sweepExpiredPii(prisma, retentionDays);

  return NextResponse.json({
    ok: true,
    dryRun: false,
    ...result,
    note:
      retentionDays === null
        ? 'Retention is disabled. Set LEAD_RETENTION_DAYS to expire personal data on captured leads and marketing enquiries.'
        : `Personal data on leads older than ${retentionDays} day(s) is redacted; the rows themselves are kept so pipeline history survives.`,
  });
}

export const GET = handle;
export const POST = handle;
