import { NextResponse, type NextRequest } from 'next/server';
import { checkBasicAuth, resolveAuthMode } from '@/lib/auth';

/**
 * WBI-ADMIN-ONLY route guard.
 *
 * Used by routes that manage the platform rather than serve a restaurant's
 * customers: issuing and revoking credentials, seeding and purging demo data.
 *
 * A tenant API key must NOT satisfy this. That is the whole point — a leaked
 * website key would otherwise be able to mint fresh keys for itself and
 * survive revocation. So a Bearer token is rejected here outright rather than
 * being evaluated, and only the operator credential is accepted.
 */
export type AdminGuard = { ok: true } | { ok: false; response: NextResponse };

export function requireAdmin(
  request: NextRequest,
  env: Record<string, string | undefined> = process.env,
): AdminGuard {
  const authorization = request.headers.get('authorization');

  if (authorization?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'THIS ACTION REQUIRES A WINNERS BOOKMARK ADMINISTRATOR' },
        { status: 403 },
      ),
    };
  }

  const mode = resolveAuthMode({
    BASIC_AUTH_USER: env.BASIC_AUTH_USER,
    BASIC_AUTH_PASSWORD: env.BASIC_AUTH_PASSWORD,
    NODE_ENV: env.NODE_ENV,
  });

  if (mode === 'misconfigured') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'ACCESS NOT CONFIGURED' }, { status: 503 }),
    };
  }

  // Local development without credentials: the app-wide middleware is already
  // open, so this guard cannot be the thing that blocks offline work.
  if (mode === 'open') return { ok: true };

  const isAdmin = checkBasicAuth(
    authorization,
    env.BASIC_AUTH_USER as string,
    env.BASIC_AUTH_PASSWORD as string,
  );
  if (isAdmin) return { ok: true };

  return {
    ok: false,
    response: NextResponse.json({ error: 'AUTHENTICATION REQUIRED' }, { status: 401 }),
  };
}
