import Link from 'next/link';
import { buildCompletenessReport } from '@/lib/frontdesk/config/completeness';
import { listTenants } from '@/lib/frontdesk/store';
import { DemoControls } from './DemoControls';

export const dynamic = 'force-dynamic';

/**
 * ADMIN CONTROL CENTER (§XXV) — the Winners Bookmark view across every client.
 *
 * Mobile-first throughout (§XXVII): this is a stack of cards at every width,
 * never a table, because an owner checking their phone between services must
 * not have to scroll sideways to read a metric.
 */
export default async function FrontDeskIndexPage() {
  const { tenants, failures } = await listTenants();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label mb-2">AI Front Desk</p>
          <h1 className="font-display text-2xl sm:text-3xl">Restaurants</h1>
          <p className="text-ivory-dim text-sm mt-2 max-w-xl">
            Every restaurant runs on the same engine with its own configuration. Adding a client means adding a
            configuration, not changing the product.
          </p>
        </div>
        <DemoControls hasDemoTenants={tenants.some((t) => t.demoMode)} />
      </div>

      {failures.length > 0 && (
        <div className="card border-red-500/40 p-4 sm:p-5">
          <p className="label text-red-300 mb-2">Misconfigured</p>
          <ul className="space-y-1 text-sm text-ivory-dim">
            {failures.map((f) => (
              <li key={f.id}>
                <span className="text-ivory">{f.name}</span> — stored configuration is invalid ({f.error})
              </li>
            ))}
          </ul>
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="card p-8 sm:p-10 text-center">
          <p className="text-ivory-dim text-sm">
            No restaurants yet. Create the demo restaurants to see the front desk working end to end.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tenants.map((tenant) => {
            const report = buildCompletenessReport(tenant.config);
            return (
              <Link
                key={tenant.id}
                href={`/frontdesk/${tenant.slug}`}
                className="card p-5 hover:border-gold-dim transition-colors block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg text-ivory truncate">{tenant.config.restaurantName}</h2>
                    <p className="text-ivory-faint text-xs mt-1 truncate">/{tenant.slug}</p>
                  </div>
                  {tenant.demoMode && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-gold-dim border border-gold-dim/50 rounded px-1.5 py-0.5">
                      Demo
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <span
                    className={
                      report.readyToActivate ? 'text-emerald-400/90' : 'text-amber-300/90'
                    }
                  >
                    {report.readyToActivate ? 'Ready to activate' : `${report.requiredGaps.length} required gap(s)`}
                  </span>
                  <span className="text-ivory-faint">Setup {report.score}%</span>
                  <span className="text-ivory-faint">
                    {tenant.config.locations.length} location{tenant.config.locations.length === 1 ? '' : 's'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
