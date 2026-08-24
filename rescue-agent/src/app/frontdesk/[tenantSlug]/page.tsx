import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authorize, resolveActor } from '@/lib/frontdesk/auth/actor';
import { buildCompletenessReport } from '@/lib/frontdesk/config/completeness';
import { startOfLocalDay, tenantTimezone } from '@/lib/frontdesk/knowledge/hours';
import { formatCurrency } from '@/lib/frontdesk/leads';
import {
  listNotifications,
  listOpenFailures,
  listStalledEscalations,
  listUndeliveredEscalations,
} from '@/lib/frontdesk/notify/store';
import { maskNumber } from '@/lib/frontdesk/notify/provider';
import {
  getTenantBySlug,
  getTodaySummary,
  listEscalationsForTenant,
  listLeadsForTenant,
} from '@/lib/frontdesk/store';
import { listReviewRequestsForConversations } from '@/lib/frontdesk/reviews/store';
import { LeadStatusControl } from './LeadStatusControl';
import { ReviewRequestControl } from './ReviewRequestControl';

export const dynamic = 'force-dynamic';

/**
 * TODAY — the owner's primary screen (§XIV).
 *
 * Two presentation rules are load-bearing rather than cosmetic:
 *
 * 1. Estimated values are labelled ESTIMATED everywhere they appear, and sit
 *    visually apart from counts of things that actually happened. An owner who
 *    later discovers "revenue" was a projection stops trusting the product.
 * 2. Metric tiles wrap into a 2-up grid on a 375px phone and never truncate,
 *    because this screen is read on a phone between services (§XXVII).
 */
export default async function FrontDeskTenantPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  // AUTHORIZATION. Checked server-side on every render: a restaurant user may
  // only ever see their own restaurant, and an unauthorised actor gets the
  // same 404 as a nonexistent slug so this page cannot be used to discover
  // which restaurants are on the platform.
  const actor = await resolveActor();
  const authz = authorize(actor, tenant.id, 'tenant:read');
  if (!authz.ok) notFound();

  // "Today" means the restaurant's own day, from the actual instant its local
  // midnight occurred — not UTC midnight, which for a US tenant would start
  // counting several hours into the previous evening.
  //
  // With no configured location there is no local day to report on. Rather
  // than printing a UTC window under a heading that claims to be the
  // restaurant's own, the page falls back to a rolling 24 hours and says so.
  const timezone = tenantTimezone(tenant.config);
  const now = new Date();
  const since = timezone ? startOfLocalDay(now, timezone) : new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [summary, leads, escalations, notifications, failures, undelivered, stalled] = await Promise.all([
    getTodaySummary(tenant.id, since),
    listLeadsForTenant(tenant.id, { take: 25 }),
    listEscalationsForTenant(tenant.id, 10),
    listNotifications(tenant.id, 10),
    listOpenFailures(tenant.id, 10),
    listUndeliveredEscalations(tenant.id, 10),
    // An alert accepted by the provider more than 30 minutes ago with no
    // delivery receipt is almost always a missing status callback, which makes
    // every alert look successful. Surfaced by age because nothing else shows it.
    listStalledEscalations(tenant.id, new Date(now.getTime() - 30 * 60 * 1000), 10),
  ]);

  const report = buildCompletenessReport(tenant.config);

  // Review requests already recorded for the leads on screen. Read AFTER the
  // leads so the control renders what the database holds rather than what a
  // previous click reported — the reconciliation the action depends on.
  const reviewRequests = await listReviewRequestsForConversations(
    tenant.id,
    leads.map((lead) => lead.conversationId).filter((id): id is string => Boolean(id)),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/frontdesk" className="label hover:text-gold transition-colors">
          ← All restaurants
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl">{tenant.config.restaurantName}</h1>
            <p className="text-ivory-faint text-xs mt-1">
              {timezone ? `Today in ${timezone.replace('_', ' ')}` : 'Last 24 hours — no location timezone set'} ·
              status {tenant.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tenant.demoMode && (
              <span className="text-[10px] uppercase tracking-wider text-gold-dim border border-gold-dim/50 rounded px-2 py-1 self-start">
                Demo data
              </span>
            )}
            <Link href={`/frontdesk/${tenant.slug}/simulator`} className="btn-outline">
              Try the front desk
            </Link>
          </div>
        </div>
      </header>

      {!report.readyToActivate && (
        <section className="card border-amber-400/40 p-5">
          <p className="label text-amber-300 mb-2">Missing information report</p>
          <p className="text-sm text-ivory-dim mb-4">
            This restaurant is not ready to go live. Each gap below switches off a specific capability — nothing is
            guessed to fill it.
          </p>
          <ul className="space-y-3">
            {report.requiredGaps.map((gap) => (
              <li key={gap.field} className="text-sm">
                <p className="text-ivory">{gap.message}</p>
                <p className="text-ivory-faint text-xs mt-0.5">
                  Disabled: {gap.capabilityLost} · field <code className="text-gold-dim">{gap.field}</code>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Activity: things that actually happened -------------------- */}
      <section>
        <h2 className="label mb-3">Today</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Conversations" value={summary.conversations} />
          <Metric label="Questions answered" value={summary.aiResolved} />
          <Metric label="Deferred to staff" value={summary.deferred} />
          <Metric label="Escalations open" value={summary.openEscalations} tone={summary.openEscalations > 0 ? 'alert' : 'default'} />
          <Metric label="New leads" value={summary.newLeads} />
          <Metric label="Reservation requests" value={summary.reservations} />
          <Metric label="Catering leads" value={summary.cateringLeads} tone={summary.cateringLeads > 0 ? 'gold' : 'default'} />
          <Metric label="Private events" value={summary.privateEventLeads} tone={summary.privateEventLeads > 0 ? 'gold' : 'default'} />
        </div>
      </section>

      {/* --- Opportunity value: clearly separated and clearly labelled --- */}
      <section>
        <h2 className="label mb-3">Revenue opportunity</h2>
        <div className="card p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="label mb-1">Estimated opportunity</p>
              <p className="font-display text-2xl text-gold">{formatCurrency(summary.estimatedOpportunityCents)}</p>
              <p className="text-ivory-faint text-[11px] mt-1 uppercase tracking-wider">Estimated — not booked revenue</p>
            </div>
            <div>
              <p className="label mb-1">Booked</p>
              <p className="font-display text-2xl text-ivory">{summary.bookedLeads}</p>
              <p className="text-ivory-faint text-[11px] mt-1 uppercase tracking-wider">Confirmed by staff</p>
            </div>
            <div>
              <p className="label mb-1">High priority</p>
              <p className="font-display text-2xl text-ivory">{summary.highPriority}</p>
              <p className="text-ivory-faint text-[11px] mt-1 uppercase tracking-wider">Needs a call back</p>
            </div>
          </div>
          <p className="text-ivory-faint text-xs mt-4 pt-4 border-t border-obsidian-line">
            Estimated values are calculated from this restaurant&apos;s configured average check and minimums. They
            indicate which opportunities to call back first — they are not a claim of earned revenue.
          </p>
        </div>
      </section>

      {/* --- Escalations that reached nobody ----------------------------- */}
      {/*
        Separated from the general alert list on purpose. An escalation alert
        that was never delivered means a human was never told about a complaint,
        an allergy or a food-safety report. Buried in a list of mostly-successful
        sends, that is a line nobody reads.
      */}
      {undelivered.length > 0 && (
        <section>
          <h2 className="label mb-3 text-red-300">
            Staff alerts that reached nobody — {undelivered.length}
          </h2>
          <p className="text-sm text-ivory-dim mb-3">
            Each of these is an escalation a person was supposed to hear about and did not. Contact them another way,
            then fix the routing.
          </p>
          <div className="space-y-2">
            {undelivered.map((notification) => (
              <div key={notification.id} className="card p-4 border-l-2 border-l-red-500/60">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-ivory text-sm">
                    {maskNumber(notification.toNumber)} · {notification.status}
                    {notification.simulated && ' · SIMULATED'}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-red-300 shrink-0">
                    {notification.attempts}/{notification.maxAttempts} attempts
                  </span>
                </div>
                <p className="text-ivory-faint text-xs mt-2">
                  {notification.errorCode ?? 'No error code'}
                  {notification.errorMessage ? ` · ${notification.errorMessage}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {stalled.length > 0 && (
        <section>
          <h2 className="label mb-3 text-amber-300">
            Staff alerts with no delivery confirmation — {stalled.length}
          </h2>
          <p className="text-sm text-ivory-dim mb-3">
            Handed to the provider over 30 minutes ago with no receipt back. Usually a missing delivery-status
            callback, which makes every alert look successful whether or not it arrived.
          </p>
          <div className="space-y-2">
            {stalled.map((notification) => (
              <div key={notification.id} className="card p-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ivory">
                  {maskNumber(notification.toNumber)}
                  {notification.simulated && ' · SIMULATED'}
                </p>
                <p className="text-ivory-faint text-xs">
                  sent {notification.lastAttemptAt?.toISOString().slice(0, 16).replace('T', ' ') ?? 'unknown'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- Failure queue: never fail silently (§XVI) ------------------- */}
      {failures.length > 0 && (
        <section>
          <h2 className="label mb-3 text-red-300">Needs attention — {failures.length} unresolved</h2>
          <div className="space-y-3">
            {failures.map((failure) => (
              <div key={failure.id} className="card p-4 border-l-2 border-l-red-500/60">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-ivory text-sm">{failure.detail}</p>
                  <span className="text-[10px] uppercase tracking-wider text-red-300 shrink-0">
                    {failure.category.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-ivory-faint text-xs mt-2">
                  {failure.operation}
                  {failure.attempts > 0 ? ` · ${failure.attempts} attempt(s)` : ''}
                  {failure.lastError ? ` · ${failure.lastError}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- Alert delivery ---------------------------------------------- */}
      {notifications.length > 0 && (
        <section>
          <h2 className="label mb-3">Staff alerts</h2>
          <div className="space-y-2">
            {notifications.map((notification) => {
              const tone =
                notification.status === 'DELIVERED'
                  ? 'text-emerald-400/90'
                  : notification.status === 'ABANDONED' || notification.status === 'UNDELIVERED'
                    ? 'text-red-300'
                    : notification.status === 'SENT'
                      ? 'text-ivory-dim'
                      : 'text-amber-300/90';
              return (
                <div key={notification.id} className="card p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-ivory">
                      {maskNumber(notification.toNumber)}
                      {notification.simulated && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-dim border border-gold-dim/50 rounded px-1.5 py-0.5">
                          Simulated
                        </span>
                      )}
                    </p>
                    <p className="text-ivory-faint text-xs mt-0.5">
                      {notification.attempts}/{notification.maxAttempts} attempt(s)
                      {notification.errorCode ? ` · ${notification.errorCode}` : ''}
                      {notification.nextAttemptAt
                        ? ` · retry ${notification.nextAttemptAt.toISOString().slice(11, 16)}Z`
                        : ''}
                    </p>
                  </div>
                  <span className={`text-[11px] uppercase tracking-wider shrink-0 ${tone}`}>
                    {notification.status}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-ivory-faint text-xs mt-3">
            SENT means the provider accepted the message. Only DELIVERED confirms it reached a handset.
          </p>
        </section>
      )}

      {escalations.length > 0 && (
        <section>
          <h2 className="label mb-3">Needs a person</h2>
          <div className="space-y-3">
            {escalations.map((escalation) => (
              <div key={escalation.id} className="card p-4 border-l-2 border-l-red-500/60">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-ivory text-sm">{escalation.summary}</p>
                  <span className="text-[10px] uppercase tracking-wider text-red-300">{escalation.severity}</span>
                </div>
                <p className="text-ivory-faint text-xs mt-2">
                  {escalation.reason.replace(/_/g, ' ').toLowerCase()} · route to {escalation.routeTo}
                  {escalation.contact ? ` · ${escalation.contact}` : ' · no contact captured'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- Leads: cards on mobile, never a horizontally scrolling table --- */}
      <section>
        <h2 className="label mb-3">Leads</h2>
        {leads.length === 0 ? (
          <div className="card p-8 text-center text-ivory-faint text-sm">
            No leads captured yet.{' '}
            <Link href={`/frontdesk/${tenant.slug}/simulator`} className="text-gold hover:underline">
              Try the front desk
            </Link>{' '}
            to see one created.
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div key={lead.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ivory text-sm">
                      {lead.customerName ?? 'No name given'}
                      {lead.phone && <span className="text-ivory-dim"> · {lead.phone}</span>}
                    </p>
                    <p className="text-ivory-faint text-xs mt-1">
                      {lead.category.replace(/_/g, ' ')}
                      {lead.partySize ? ` · party of ${lead.partySize}` : ''}
                      {lead.requestedDate ? ` · ${lead.requestedDate}` : ''}
                      {lead.requestedTime ? ` at ${lead.requestedTime}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {lead.priority !== 'STANDARD' && (
                      <span className="text-[10px] uppercase tracking-wider text-gold">{lead.priority}</span>
                    )}
                    <span className="font-display text-gold text-sm">
                      {formatCurrency(lead.estimatedValueCents)}
                    </span>
                  </div>
                </div>
                {lead.notes && <p className="text-ivory-dim text-xs mt-3 line-clamp-2">{lead.notes}</p>}
                <div className="mt-3 pt-3 border-t border-obsidian-line flex flex-wrap items-center gap-3">
                  <LeadStatusControl tenantSlug={tenant.slug} leadId={lead.id} status={lead.status} />
                  {lead.demoMode && (
                    <span className="text-[10px] uppercase tracking-wider text-gold-dim">Demo</span>
                  )}
                  {/*
                    Manual, one lead at a time, and it decides nothing: the
                    server runs eligibility and this renders the answer. A demo
                    lead still shows the control, and the server still refuses
                    it — the refusal is the honest thing to show, and hiding the
                    button would teach an operator the wrong rule.
                  */}
                  <ReviewRequestControl
                    tenantSlug={tenant.slug}
                    conversationId={lead.conversationId}
                    reviewsEnabled={Boolean(tenant.config.reviews?.enabled)}
                    existing={
                      lead.conversationId ? (reviewRequests.get(lead.conversationId) ?? null) : null
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'gold' | 'alert';
}) {
  const valueColor =
    tone === 'gold' ? 'text-gold' : tone === 'alert' ? 'text-red-300' : 'text-ivory';
  return (
    <div className="card p-4">
      {/* The label wraps rather than truncating — a clipped metric name is
          worse than a two-line card on a narrow phone. */}
      <p className="label leading-tight">{label}</p>
      <p className={`font-display text-2xl mt-2 ${valueColor}`}>{value}</p>
    </div>
  );
}
