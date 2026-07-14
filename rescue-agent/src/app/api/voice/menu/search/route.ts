import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guardVoiceTool } from '@/lib/voice/guard';
import { getActiveRestaurant } from '@/lib/voice/restaurant';
import { toSafeMenuItem } from '@/lib/voice/menuView';
import { PRICE_UNKNOWN_LINE } from '@/lib/voice/config';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ q: z.string().min(1).max(120) });

/** Voice tool: search_menu. Returns matching items with SAFE price handling. */
export async function GET(request: Request) {
  const denied = guardVoiceTool(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ q: url.searchParams.get('q') ?? '' });
  if (!parsed.success) return NextResponse.json({ error: 'Missing query.' }, { status: 400 });

  const restaurant = await getActiveRestaurant();
  if (!restaurant) return NextResponse.json({ error: 'No restaurant configured.' }, { status: 404 });

  const q = parsed.data.q;
  const items = await prisma.menuItem.findMany({
    where: {
      restaurantProfileId: restaurant.id,
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    include: { category: { select: { name: true } } },
    take: 8,
  });

  return NextResponse.json({
    query: q,
    count: items.length,
    items: items.map(toSafeMenuItem),
    priceGuidance: PRICE_UNKNOWN_LINE,
  });
}
