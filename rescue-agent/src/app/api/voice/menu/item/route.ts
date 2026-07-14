import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guardVoiceTool } from '@/lib/voice/guard';
import { getActiveRestaurant } from '@/lib/voice/restaurant';
import { toSafeMenuItem } from '@/lib/voice/menuView';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ slug: z.string().min(1).max(120) });

/** Voice tool: get_menu_item_options / lookup_menu_item. */
export async function GET(request: Request) {
  const denied = guardVoiceTool(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ slug: url.searchParams.get('slug') ?? '' });
  if (!parsed.success) return NextResponse.json({ error: 'Missing slug.' }, { status: 400 });

  const restaurant = await getActiveRestaurant();
  if (!restaurant) return NextResponse.json({ error: 'No restaurant configured.' }, { status: 404 });

  const item = await prisma.menuItem.findFirst({
    where: { restaurantProfileId: restaurant.id, slug: parsed.data.slug, isActive: true },
    include: { category: { select: { name: true } } },
  });
  if (!item) return NextResponse.json({ error: 'Item not found.' }, { status: 404 });

  return NextResponse.json({
    item: {
      ...toSafeMenuItem(item),
      prepOptions: item.prepOptions,
      sideOptions: item.sideOptions,
      modifierOptions: item.modifierOptions,
      requiredSideCount: item.requiredSideCount,
      requiresStaffConfirmation: item.requiresStaffConfirmation,
      allergenEscalationRequired: item.allergenEscalationRequired,
    },
  });
}
