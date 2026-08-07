import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { authorizePlatform, resolveActor } from '@/lib/frontdesk/auth/actor';
import { purgeFrontDeskDemoData, seedDemoTenants } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * Demo tenant lifecycle (§XXI).
 *
 * POST   → create or refresh the demo restaurants
 * DELETE → remove every demo tenant and all data marked demoMode
 *
 * Both sit behind the app-wide Basic Auth middleware. The delete is destructive
 * by design, so the UI confirms before calling it.
 */

export async function POST() {
  // Platform-admin only. Seeding and purging demo data spans every restaurant,
  // so a restaurant user must never reach it — and since a session cookie now
  // passes the operator middleware, this route has to say so itself.
  const authz = authorizePlatform(await resolveActor());
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  try {
    const result = await seedDemoTenants(prisma);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[frontdesk] demo seed failed', error);
    return NextResponse.json({ error: 'DEMO RESTAURANTS COULD NOT BE CREATED' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authz = authorizePlatform(await resolveActor());
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  // A second, explicit confirmation in the request itself, so that a stray
  // DELETE cannot wipe demo data without intent.
  const confirmed = new URL(request.url).searchParams.get('confirm') === 'true';
  if (!confirmed) {
    return NextResponse.json({ error: 'CONFIRMATION REQUIRED' }, { status: 400 });
  }

  try {
    const result = await purgeFrontDeskDemoData(prisma);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[frontdesk] demo purge failed', error);
    return NextResponse.json({ error: 'DEMO DATA COULD NOT BE REMOVED' }, { status: 500 });
  }
}
