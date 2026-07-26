import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { purgeDemoData } from '@/lib/audit/demoPurge';

export const dynamic = 'force-dynamic';

/**
 * Removes demonstration data (demo audits, their cascaded records and captured
 * leads, and the fictional demo restaurant). Protected by the app-wide Basic
 * Auth middleware like every route except /api/health.
 */
export async function POST() {
  try {
    const result = await purgeDemoData(prisma);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Demo purge failed', error);
    return NextResponse.json({ error: 'DEMO DATA COULD NOT BE REMOVED' }, { status: 500 });
  }
}
