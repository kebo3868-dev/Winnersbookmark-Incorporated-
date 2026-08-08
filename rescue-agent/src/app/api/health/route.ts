import { NextResponse } from 'next/server';
import { prisma, resolveDatabaseUrlSource } from '@/lib/db';
import { checkBasicAuth, resolveAuthMode } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Liveness/readiness probe. Exempt from the app-wide middleware so an
 * orchestrator can reach it, and therefore reachable by anyone.
 *
 * Public callers get liveness only: `status` and `database`. The deployment
 * diagnostic block — names and states, never values — is returned only to a
 * caller presenting the operator credential:
 * - auth "missing" in production means every other route serves 503 by design.
 * - databaseSource shows which env var the runtime connection came from.
 */
export async function GET(request: Request) {
  // Liveness is public because an orchestrator has to reach it. The diagnostic
  // block is NOT, and used to be.
  //
  // It never contained a secret value, but "auth: MISSING" told an
  // unauthenticated caller that every route was currently unprotected, and
  // `databaseSource` named the variable holding the connection string. That is
  // a reconnaissance feed an attacker can poll: wait for the deploy that
  // reports MISSING, then walk in. Configuration state is now shown only to a
  // caller who already holds the operator credential.
  // No configured credential means nobody can be authorised, so the block is
  // withheld from everyone. That is deliberately strictest in the state it
  // would be most damaging to disclose: a deployment with auth MISSING never
  // announces it.
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  const authorised = Boolean(
    user && password && checkBasicAuth(request.headers.get('authorization'), user, password),
  );

  const config = authorised ? diagnosticConfig() : undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'up', ...(config ? { config } : {}) });
  } catch {
    return NextResponse.json(
      { status: 'degraded', database: 'down', ...(config ? { config } : {}) },
      { status: 503 },
    );
  }
}

/** Names and states only — never a value. Only ever served to an operator. */
function diagnosticConfig() {
  const authMode = resolveAuthMode({
    BASIC_AUTH_USER: process.env.BASIC_AUTH_USER,
    BASIC_AUTH_PASSWORD: process.env.BASIC_AUTH_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
  });
  return {
    auth:
      authMode === 'required'
        ? 'configured'
        : authMode === 'open'
          ? 'open (non-production)'
          : 'MISSING — all routes serve 503 until BASIC_AUTH_USER/BASIC_AUTH_PASSWORD are set',
    databaseSource: resolveDatabaseUrlSource() ?? 'NONE — no database env var found',
    migrationSourceAvailable: Boolean(
      process.env.RESCUE_DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING,
    ),
    aiNarrative:
      process.env.AI_PROVIDER && process.env.ANTHROPIC_API_KEY ? 'configured' : 'disabled (deterministic reports)',
  };
}
