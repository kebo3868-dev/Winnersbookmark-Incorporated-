import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getActiveRestaurant } from '@/lib/voice/restaurant';
import LiveCallFeed, { type FeedCall } from './LiveCallFeed';
import DraftQueue, { type QueueDraft } from './DraftQueue';

export const dynamic = 'force-dynamic';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const RESOLUTION_GROUP: Record<string, FeedCall['group']> = {
  AI_RESOLVED: 'AI_RESOLVED',
  DRAFT_ORDER_CREATED: 'ORDERS',
  TRANSFERRED: 'TRANSFERS',
  LEAD_CAPTURED: 'LEADS',
  CALLBACK_REQUIRED: 'CALLBACKS',
  CUSTOMER_ABANDONED: 'FAILED',
  AI_FAILED: 'FAILED',
  TECHNICAL_FAILURE: 'FAILED',
  UNKNOWN: 'FAILED',
};

export default async function VoiceRescueDashboard() {
  const restaurant = await getActiveRestaurant();

  if (!restaurant) {
    return (
      <div className="space-y-6">
        <Header name={null} />
        <div className="card p-10 text-center text-ivory-dim text-sm">
          No restaurant is configured yet. Run the seed (<code className="text-gold">npm run db:seed</code>) to load
          Leverock&apos;s Great Seafood, then reload this page.
        </div>
      </div>
    );
  }

  const today = startOfToday();
  const rid = restaurant.id;

  const [
    callsToday,
    aiAnsweredToday,
    aiResolvedToday,
    transfersToday,
    callbacksToday,
    draftsToday,
    estValueAgg,
    largePartyLeads,
    privateEventLeads,
    recentCalls,
    queueDrafts,
  ] = await Promise.all([
    prisma.voiceCall.count({ where: { restaurantProfileId: rid, startedAt: { gte: today } } }),
    prisma.voiceCall.count({ where: { restaurantProfileId: rid, startedAt: { gte: today }, answeredAt: { not: null } } }),
    prisma.voiceCall.count({ where: { restaurantProfileId: rid, startedAt: { gte: today }, resolvedByAi: true } }),
    prisma.voiceCall.count({ where: { restaurantProfileId: rid, startedAt: { gte: today }, transferred: true } }),
    prisma.voiceCall.count({ where: { restaurantProfileId: rid, startedAt: { gte: today }, callbackRequired: true } }),
    prisma.draftOrder.count({ where: { restaurantProfileId: rid, createdAt: { gte: today } } }),
    prisma.draftOrder.aggregate({
      _sum: { estimatedValue: true },
      where: { restaurantProfileId: rid, createdAt: { gte: today } },
    }),
    prisma.lead.count({ where: { restaurantProfileId: rid, leadType: 'LARGE_PARTY' } }),
    prisma.lead.count({ where: { restaurantProfileId: rid, leadType: 'PRIVATE_EVENT' } }),
    prisma.voiceCall.findMany({ where: { restaurantProfileId: rid }, orderBy: { startedAt: 'desc' }, take: 15 }),
    prisma.draftOrder.findMany({
      where: { restaurantProfileId: rid, status: { in: ['AWAITING_STAFF_REVIEW', 'AWAITING_CUSTOMER_CONFIRMATION', 'REQUIRES_CALLBACK'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { items: true },
    }),
  ]);

  const resolutionRate = callsToday > 0 ? Math.round((aiResolvedToday / callsToday) * 100) : 0;
  const estValue = estValueAgg._sum.estimatedValue ? Number(estValueAgg._sum.estimatedValue) : 0;

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: restaurant.timezone });

  const feed: FeedCall[] = recentCalls.map((c) => ({
    id: c.id,
    time: fmtTime(c.startedAt),
    caller: c.callerName || c.callerPhone || 'Unknown caller',
    intent: (c.finalIntent || c.initialIntent || 'Unknown').replace(/_/g, ' '),
    resolution: c.resolution,
    group: RESOLUTION_GROUP[c.resolution] ?? 'FAILED',
  }));

  const drafts: QueueDraft[] = queueDrafts.map((d) => ({
    id: d.id,
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    time: fmtTime(d.createdAt),
    status: d.status,
    customerConfirmed: d.customerConfirmed,
    allergyFlag: d.allergyFlag,
    aiConfidence: d.aiConfidence,
    reviewFlags: d.reviewFlags,
    estimatedValue: d.estimatedValue ? Number(d.estimatedValue) : null,
    items: d.items.map((it) => ({
      menuItemName: it.menuItemName,
      quantity: it.quantity,
      preparation: it.preparation,
      sides: it.sides,
      modifiers: it.modifiers,
      specialRequests: it.specialRequests,
      allergyNote: it.allergyNote,
      flags: it.itemFlags,
    })),
  }));

  const metrics = [
    { label: 'Calls Today', value: callsToday },
    { label: 'AI Answered', value: aiAnsweredToday },
    { label: 'AI Resolution Rate', value: `${resolutionRate}%` },
    { label: 'Overflow Rescued', value: aiResolvedToday + draftsToday },
    { label: 'Draft Orders', value: draftsToday },
    { label: 'Est. Order Value', value: `$${estValue.toFixed(0)}`, estimated: true },
    { label: 'Human Transfers', value: transfersToday },
    { label: 'Callbacks Required', value: callbacksToday },
    { label: 'Large Party Leads', value: largePartyLeads },
    { label: 'Private Event Leads', value: privateEventLeads },
  ];

  return (
    <div className="space-y-10">
      <Header name={restaurant.name} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="card p-5">
            <p className="label mb-2">{m.label}</p>
            <p className="font-display text-3xl text-gold">{m.value}</p>
            {m.estimated && <p className="text-[10px] uppercase tracking-wider text-ivory-faint mt-1">Estimated · not confirmed</p>}
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ivory">Draft Order Queue</h2>
          <span className="label">Human review required</span>
        </div>
        <DraftQueue drafts={drafts} />
      </section>

      <LiveCallFeed calls={feed} />
    </div>
  );
}

function Header({ name }: { name: string | null }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="label mb-2">Voice Rescue · Overflow Call Recovery</p>
        <h1 className="font-display text-3xl text-ivory">{name ?? "Leverock's"} Call &amp; Order Rescue</h1>
        <p className="text-ivory-dim mt-2 max-w-xl text-sm">
          Every draft order is a request for staff review — never a confirmed kitchen order. Estimated values are modeled,
          not confirmed.
        </p>
      </div>
      <Link href="/" className="btn-outline">
        Command Center
      </Link>
    </div>
  );
}
