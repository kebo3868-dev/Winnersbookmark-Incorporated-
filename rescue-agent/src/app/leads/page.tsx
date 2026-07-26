import Link from 'next/link';
import { prisma } from '@/lib/db';
import { LeadStatusSelect } from './LeadStatusSelect';
import { PurgeDemoButton } from './PurgeDemoButton';
import { DeleteLeadButton } from './DeleteLeadButton';
import { redactExpiredLeads, resolveLeadRetentionDays } from '@/lib/leads/retention';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  // Retention sweep runs lazily from this read path, mirroring the stale-audit
  // sweep: serverless hosting has no daemon, so expiry is enforced whenever
  // anyone looks at the pipeline. No-op unless LEAD_RETENTION_DAYS is set.
  const retentionDays = resolveLeadRetentionDays();
  if (retentionDays !== null) {
    await redactExpiredLeads(prisma, retentionDays);
  }

  const [leads, demoAuditCount] = await Promise.all([
    prisma.auditLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        restaurant: { select: { name: true } },
        audit: { select: { id: true, status: true, overallScore: true, demoMode: true } },
      },
    }),
    prisma.audit.count({ where: { demoMode: true } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label mb-2">Sales Pipeline</p>
          <h1 className="font-display text-3xl">Leads</h1>
          <p className="text-ivory-dim text-sm mt-2">Prospects captured at audit intake. Each links to the audit that qualified them.</p>
        </div>
        {demoAuditCount > 0 && <PurgeDemoButton />}
      </div>

      <div className="card overflow-hidden">
        {leads.length === 0 ? (
          <div className="p-10 text-center text-ivory-faint text-sm">
            No leads captured yet. Contact details entered on the <Link href="/audits/new" className="text-gold hover:underline">New Audit</Link> form appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {['Contact', 'Restaurant', 'Email', 'Phone', 'Rescue Score', 'Status', 'Audit', ''].map((h, i) => (
                    <th key={h || `col-${i}`} className="label px-6 py-3 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-obsidian-line hover:bg-obsidian-soft/60">
                    <td className="px-6 py-4 text-ivory">
                      {lead.contactName ?? '—'}
                      {lead.consent && <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-400/80">consent ✓</span>}
                    </td>
                    <td className="px-6 py-4 text-ivory-dim">
                      {lead.restaurant.name}
                      {lead.audit.demoMode && <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-dim border border-gold-dim/50 rounded px-1.5 py-0.5">Demo</span>}
                    </td>
                    <td className="px-6 py-4 text-ivory-dim">{lead.email ?? '—'}</td>
                    <td className="px-6 py-4 text-ivory-dim">{lead.phone ?? '—'}</td>
                    <td className="px-6 py-4 font-display text-gold">{lead.audit.overallScore ?? '—'}</td>
                    <td className="px-6 py-4">
                      <LeadStatusSelect leadId={lead.id} status={lead.status} />
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/audits/${lead.audit.id}`} className="text-gold hover:underline text-xs">View audit</Link>
                    </td>
                    <td className="px-6 py-4">
                      <DeleteLeadButton leadId={lead.id} contactLabel={lead.contactName ?? lead.email ?? 'this lead'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
