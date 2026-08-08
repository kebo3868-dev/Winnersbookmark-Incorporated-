import { NextResponse, type NextRequest } from 'next/server';
import { noteRejection, presentedAnyCredential } from '@/lib/frontdesk/security/rejections';
import { cronSecretMatches, runDispatchCycle } from '@/lib/frontdesk/notify/worker';

export const dynamic = 'force-dynamic';

/**
 * Scheduled dispatch trigger.
 *
 * A scheduler cannot present the operator's Basic Auth credential, so this
 * route authenticates with a shared secret instead — the same pattern as the
 * delivery webhook, and exempt from the app-wide middleware for the same
 * reason: it authenticates itself and fails closed without a secret.
 *
 * `cronSecretMatches` refuses a secret shorter than 16 characters as well as a
 * missing one. An endpoint that drains a queue should not be reachable because
 * someone set CRON_SECRET=test.
 *
 * GET and POST both work: Vercel Cron issues GET, most other schedulers POST.
 */
async function handle(request: NextRequest) {
  if (!cronSecretMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    // This route answers GET as well as POST, so before this guard a plain
    // crawler hit wrote a database row. Nothing is written now unless an
    // authorization header was actually presented, and then only once an hour.
    await noteRejection({
      tenantId: null,
      category: 'FAILED_INTEGRATION',
      operation: 'notifications.cron',
      reason: 'CRON_AUTH_FAILED',
      detail:
        'Scheduled dispatch requests are being rejected: the secret is missing, weaker than 16 characters, or wrong. ' +
        'Queued alerts are not being sent while this is true.',
      credentialPresented: presentedAnyCredential(request.headers, ['authorization']),
    });
    return NextResponse.json({ error: 'AUTHENTICATION REQUIRED' }, { status: 401 });
  }

  const result = await runDispatchCycle({ workerId: 'cron' });

  if (!result.ok) {
    // NO_PROVIDER is a configuration state, not a fault: a deployment without
    // SMS keeps escalations dashboard-only and the scheduler should not treat
    // every tick as a failed job.
    const status = result.reason === 'NO_PROVIDER' ? 200 : 503;
    return NextResponse.json({ ok: false, reason: result.reason, detail: result.detail }, { status });
  }

  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
