import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guardVoiceTool } from '@/lib/voice/guard';
import { getActiveRestaurant, getMenuForValidation } from '@/lib/voice/restaurant';
import { validateDraftOrder, type CapturedItem } from '@/lib/voice/draftOrder';
import { ORDER_SUBMITTED_LINE } from '@/lib/voice/config';

export const dynamic = 'force-dynamic';

const itemSchema = z.object({
  menuItemName: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(50).optional(),
  preparation: z.string().max(120).nullish(),
  sides: z.array(z.string().max(120)).max(10).optional(),
  modifiers: z.array(z.string().max(120)).max(10).optional(),
  specialRequests: z.array(z.string().max(300)).max(10).optional(),
  allergyNote: z.string().max(300).nullish(),
});

const bodySchema = z.object({
  callId: z.string().max(60).optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(40).optional(),
  customerConfirmed: z.boolean().optional(),
  aiConfidence: z.number().int().min(0).max(100).optional(),
  items: z.array(itemSchema).min(1).max(25),
});

/**
 * Voice tool: create_draft_order.
 *
 * Captures a to-go order REQUEST. Server-side validation against verified menu
 * data flags anything uncertain; the draft always requires human review. This
 * endpoint NEVER produces a confirmed kitchen order — it produces a draft for
 * the staff queue.
 */
export async function POST(request: Request) {
  const denied = guardVoiceTool(request);
  if (denied) return denied;

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid order details.', detail: parsed.error.flatten() }, { status: 400 });
  }

  const restaurant = await getActiveRestaurant();
  if (!restaurant) return NextResponse.json({ error: 'No restaurant configured.' }, { status: 404 });

  const menu = await getMenuForValidation(restaurant.id);
  const captured: CapturedItem[] = parsed.data.items;
  const validated = validateDraftOrder(captured, menu);

  const status = parsed.data.customerConfirmed ? 'AWAITING_STAFF_REVIEW' : 'AWAITING_CUSTOMER_CONFIRMATION';

  const draft = await prisma.draftOrder.create({
    data: {
      restaurantProfileId: restaurant.id,
      callId: parsed.data.callId ?? null,
      customerName: parsed.data.customerName ?? null,
      customerPhone: parsed.data.customerPhone ?? null,
      status: status as never,
      customerConfirmed: parsed.data.customerConfirmed ?? false,
      requiresHumanReview: validated.requiresHumanReview,
      reviewReason: validated.reviewReason,
      reviewFlags: validated.reviewFlags,
      allergyFlag: validated.allergyFlag,
      aiConfidence: parsed.data.aiConfidence ?? null,
      estimatedValue: validated.estimatedValue,
      items: {
        create: validated.items.map((i) => ({
          menuItemId: i.menuItemId,
          menuItemName: i.menuItemName,
          quantity: i.quantity,
          preparation: i.preparation,
          sides: i.sides,
          modifiers: i.modifiers,
          specialRequests: i.specialRequests,
          allergyNote: i.allergyNote,
          itemFlags: i.flags,
          unitPrice: i.unitPrice,
        })),
      },
    },
    include: { items: true },
  });

  if (parsed.data.callId) {
    await prisma.callEvent
      .create({
        data: {
          callId: parsed.data.callId,
          eventType: 'DRAFT_ORDER_CREATED',
          metadata: { draftOrderId: draft.id, estimatedValue: validated.estimatedValue, flags: validated.reviewFlags },
        },
      })
      .catch(() => {
        /* call may not exist yet; the draft is still valid */
      });
  }

  return NextResponse.json(
    {
      draftOrderId: draft.id,
      status: draft.status,
      requiresHumanReview: draft.requiresHumanReview,
      allergyFlag: draft.allergyFlag,
      reviewFlags: validated.reviewFlags,
      estimatedValue: validated.estimatedValue,
      // The exact line the agent should say — never "confirmed".
      agentLine: ORDER_SUBMITTED_LINE,
    },
    { status: 201 },
  );
}
