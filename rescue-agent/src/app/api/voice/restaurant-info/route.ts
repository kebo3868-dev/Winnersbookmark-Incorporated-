import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { guardVoiceTool } from '@/lib/voice/guard';
import { getActiveRestaurant } from '@/lib/voice/restaurant';
import { FRESH_FISH_LINE } from '@/lib/voice/config';

export const dynamic = 'force-dynamic';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CONFIDENT = ['STAFF_CONFIRMED', 'MANAGER_CONFIRMED', 'SYSTEM_CONFIRMED'];

/**
 * Voice tool: lookup_restaurant_information + lookup_business_hours.
 * Hours are only returned as quotable when verified; otherwise the agent is
 * told they are unconfirmed so it does not read them aloud as fact.
 */
export async function GET(request: Request) {
  const denied = guardVoiceTool(request);
  if (denied) return denied;

  const restaurant = await getActiveRestaurant();
  if (!restaurant) return NextResponse.json({ error: 'No restaurant configured.' }, { status: 404 });

  const [hours, policies, faqs] = await Promise.all([
    prisma.businessHours.findMany({ where: { restaurantProfileId: restaurant.id }, orderBy: { dayOfWeek: 'asc' } }),
    prisma.restaurantPolicy.findMany({ where: { restaurantProfileId: restaurant.id } }),
    prisma.faq.findMany({ where: { restaurantProfileId: restaurant.id } }),
  ]);

  return NextResponse.json({
    name: restaurant.name,
    greeting: restaurant.greeting,
    address: restaurant.address,
    city: restaurant.city,
    state: restaurant.state,
    hoursNote: restaurant.hoursNote,
    earlyMenuNote: restaurant.earlyMenuNote,
    freshFishPolicy: restaurant.freshFishPolicy ?? FRESH_FISH_LINE,
    hours: hours.map((h) => ({
      day: DAY_NAMES[h.dayOfWeek] ?? String(h.dayOfWeek),
      serviceType: h.serviceType,
      closed: h.closed,
      opensAt: h.opensAt,
      closesAt: h.closesAt,
      note: h.note,
      quotable: CONFIDENT.includes(h.verificationStatus),
    })),
    policies: policies
      .filter((p) => CONFIDENT.includes(p.verificationStatus))
      .map((p) => ({ topic: p.topic, policy: p.policy })),
    faqs: faqs
      .filter((f) => CONFIDENT.includes(f.verificationStatus))
      .map((f) => ({ question: f.question, answer: f.answer })),
  });
}
