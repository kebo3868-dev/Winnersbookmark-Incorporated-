import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guardVoiceTool } from '@/lib/voice/guard';
import { getActiveRestaurant } from '@/lib/voice/restaurant';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  callId: z.string().max(60).optional(),
  leadType: z.enum(['LARGE_PARTY', 'PRIVATE_EVENT']),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(40).optional(),
  partySize: z.number().int().min(1).max(2000).optional(),
  requestedDate: z.string().max(120).optional(),
  details: z.string().max(2000).optional(),
});

/** Voice tool: capture_large_party_lead + capture_private_event_lead. */
export async function POST(request: Request) {
  const denied = guardVoiceTool(request);
  if (denied) return denied;

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: 'Invalid lead details.' }, { status: 400 });

  const restaurant = await getActiveRestaurant();
  if (!restaurant) return NextResponse.json({ error: 'No restaurant configured.' }, { status: 404 });

  const lead = await prisma.lead.create({
    data: {
      restaurantProfileId: restaurant.id,
      callId: parsed.data.callId ?? null,
      leadType: parsed.data.leadType,
      customerName: parsed.data.customerName ?? null,
      customerPhone: parsed.data.customerPhone ?? null,
      partySize: parsed.data.partySize ?? null,
      requestedDate: parsed.data.requestedDate ?? null,
      details: parsed.data.details ?? null,
    },
  });

  if (parsed.data.callId) {
    await prisma.callEvent
      .create({ data: { callId: parsed.data.callId, eventType: 'LEAD_CAPTURED', metadata: { leadId: lead.id, leadType: lead.leadType } } })
      .catch(() => {});
  }

  return NextResponse.json(
    { leadId: lead.id, leadType: lead.leadType, message: 'Lead captured for the events team to follow up.' },
    { status: 201 },
  );
}
