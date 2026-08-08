import Link from 'next/link';
import { LeadStatusSelect } from './LeadStatusSelect';
import { DeleteLeadButton } from './DeleteLeadButton';

/**
 * Mobile presentation of a lead. The desktop table has eight columns, which on
 * a phone clipped values mid-word and forced horizontal scrolling inside the
 * card to reach Status or the audit link — unusable on the device a demo is
 * most likely to happen on. Below `md` each lead becomes a stacked card
 * instead; the table is kept for wider screens where it reads better.
 */
export interface LeadCardData {
  id: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  consent: boolean;
  status: string;
  restaurant: { name: string };
  audit: { id: string; overallScore: number | null; demoMode: boolean };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="label text-[10px] mb-1">{label}</p>
      <p className="text-ivory-dim text-sm break-words">{value}</p>
    </div>
  );
}

export function LeadCard({ lead }: { lead: LeadCardData }) {
  return (
    <div className="px-5 py-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ivory text-base break-words">{lead.contactName ?? '—'}</p>
          <p className="text-ivory-dim text-sm mt-1 break-words">
            {lead.restaurant.name}
            {lead.audit.demoMode && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-dim border border-gold-dim/50 rounded px-1.5 py-0.5 whitespace-nowrap">
                Demo
              </span>
            )}
          </p>
          {lead.consent && (
            <span className="inline-block mt-2 text-[10px] uppercase tracking-wider text-emerald-400/80">consent ✓</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="label text-[10px] mb-1">Score</p>
          <p className="font-display text-2xl text-gold leading-none">{lead.audit.overallScore ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* break-all so a long address wraps instead of overflowing the card */}
        <Field label="Email" value={<span className="break-all">{lead.email ?? '—'}</span>} />
        <Field label="Phone" value={lead.phone ?? '—'} />
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <LeadStatusSelect leadId={lead.id} status={lead.status} />
        <Link href={`/audits/${lead.audit.id}`} className="text-gold hover:underline text-xs">
          View audit
        </Link>
        <span className="ml-auto">
          <DeleteLeadButton leadId={lead.id} contactLabel={lead.contactName ?? lead.email ?? 'this lead'} />
        </span>
      </div>
    </div>
  );
}
