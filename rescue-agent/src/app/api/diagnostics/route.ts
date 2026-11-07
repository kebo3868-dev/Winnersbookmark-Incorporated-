import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOperatorRequest } from '@/lib/operatorAuth';
import { diagnosticConfig } from '@/lib/diagnostics';

export const dynamic = 'force-dynamic';

/**
 * Deployment diagnostics for the operator: names and states only, never a
 * value (src/lib/diagnostics.ts). Behind the middleware's counted sign-in gate
 * and this route's own operator check — unlike /api/health, which is public.
 */
export async function GET(request: Request) {
  const guard = requireOperatorRequest(request);
  if (!guard.ok) return guard.response;
  let database: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }
  return NextResponse.json({ database, config: diagnosticConfig() }, { headers: { 'cache-control': 'no-store' } });
}
