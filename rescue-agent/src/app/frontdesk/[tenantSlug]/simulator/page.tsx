import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authorize, resolveActor } from '@/lib/frontdesk/auth/actor';
import { getTenantBySlug } from '@/lib/frontdesk/store';
import { Simulator } from './Simulator';

export const dynamic = 'force-dynamic';

export default async function SimulatorPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  // Same tenant-scoped check as the dashboard. The simulator writes real
  // conversations and leads against this restaurant, so it is not a lesser
  // surface — an unauthorised actor gets the same 404 as a fake slug.
  const authz = authorize(await resolveActor(), tenant.id, 'tenant:read');
  if (!authz.ok) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href={`/frontdesk/${tenant.slug}`} className="label hover:text-gold transition-colors">
          ← {tenant.config.restaurantName}
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl">Front desk simulator</h1>
        <p className="text-ivory-dim text-sm max-w-2xl">
          This talks to the live engine on the real API route and writes real conversations, leads and escalations
          against this restaurant. Each reply shows which verified source it came from.
        </p>
      </header>

      <Simulator
        tenantSlug={tenant.slug}
        restaurantName={tenant.config.restaurantName}
        greeting={tenant.config.brandVoice.greeting ?? null}
        demoMode={tenant.demoMode}
      />
    </div>
  );
}
