import { NextResponse, type NextRequest } from 'next/server';
import { recordFailure } from '@/lib/frontdesk/notify/store';
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
    await recordFailure({
      tenantId: null,
      category: 'FAILED_INTEGRATION',
      operation: 'notifications.cron',
      detail: 'Rejected a scheduled dispatch request with a missing, weak or incorrect secret',
      lastError: 'CRON_AUTH_FAILED',
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
