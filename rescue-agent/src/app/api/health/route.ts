import { NextResponse } from 'next/server';
import { prisma, resolveDatabaseUrlSource } from '@/lib/db';
import { resolveAuthMode } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Liveness/readiness probe (exempt from auth). Also reports deployment
 * configuration state — names only, never values — so a misconfigured deploy
 * can be diagnosed from this endpoint alone:
 * - auth "missing" in production means every other route serves 503 by design.
 * - databaseSource shows which env var the runtime connection came from.
 */
export async function GET() {
  const authMode = resolveAuthMode({
    BASIC_AUTH_USER: process.env.BASIC_AUTH_USER,
    BASIC_AUTH_PASSWORD: process.env.BASIC_AUTH_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
  });
  const config = {
    auth: authMode === 'required' ? 'configured' : authMode === 'open' ? 'open (non-production)' : 'MISSING — all routes serve 503 until BASIC_AUTH_USER/BASIC_AUTH_PASSWORD are set',
    databaseSource: resolveDatabaseUrlSource() ?? 'NONE — no database env var found',
    migrationSourceAvailable: Boolean(process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING),
    aiNarrative: process.env.AI_PROVIDER && process.env.ANTHROPIC_API_KEY ? 'configured' : 'disabled (deterministic reports)',
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'up', config });
  } catch {
    return NextResponse.json({ status: 'degraded', database: 'down', config }, { status: 503 });
  }
}
