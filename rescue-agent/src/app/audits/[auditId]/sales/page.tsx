import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function SalesBriefPage({ params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const brief = await prisma.salesIntelligence.findUnique({
    where: { auditId },
    include: { audit: { include: { restaurant: true } } },
  });
  if (!brief) notFound();

  const rows: { label: string; value: string }[] = [
    { label: 'Pain Level', value: brief.painLevel },
    { label: 'Likely Buyer Persona', value: brief.buyerPersona },
    { label: 'Best Sales Angle', value: brief.bestSalesAngle },
    { label: 'Likely Objection', value: brief.likelyObjection },
    { label: 'Objection Response Strategy', value: brief.objectionStrategy },
    { label: 'Recommended WBI Offer', value: brief.recommendedOffer },
    { label: 'Outreach Personalization', value: brief.outreachAngle },
    { label: 'Follow-Up Angle', value: brief.followUpAngle },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="border border-red-400/50 bg-red-950/20 rounded px-4 py-3 text-center">
        <p className="text-red-300 text-xs uppercase tracking-widest font-semibold">Winners Bookmark Internal Sales Intelligence</p>
        <p className="text-red-400/80 text-[11px] uppercase tracking-widest mt-1">Confidential — Internal Use Only. Never share with the restaurant.</p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label mb-2">Sales Brief</p>
          <h1 className="font-display text-3xl">{brief.audit.restaurant.name}</h1>
          {brief.audit.demoMode && (
            <p className="mt-2 inline-block border border-gold-dim/60 text-gold-dim rounded px-3 py-1 text-xs uppercase tracking-widest">Demonstration Data</p>
          )}
        </div>
        <span className={`text-sm uppercase tracking-widest border rounded px-3 py-1.5 ${
          brief.priority === 'HOT' ? 'text-red-300 border-red-300/50' : brief.priority === 'WARM' ? 'text-amber-300 border-amber-300/50' : 'text-ivory-dim border-obsidian-line'
        }`}>{brief.priority.replace(/_/g, ' ')}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-6">
          <p className="label mb-2">Lead Quality Score</p>
          <p className="font-display text-4xl text-gold">{brief.leadQualityScore}</p>
        </div>
        <div className="card p-6">
          <p className="label mb-2">Sales Opportunity Score</p>
          <p className="font-display text-4xl text-gold">{brief.salesOpportunityScore}</p>
        </div>
      </div>

      <div className="card divide-y divide-obsidian-line">
        {rows.map((row) => (
          <div key={row.label} className="px-6 py-4">
            <p className="label mb-1">{row.label}</p>
            <p className="text-ivory-dim text-sm whitespace-pre-line">{row.value}</p>
          </div>
        ))}
      </div>

      <section className="card p-6">
        <p className="label mb-3">Five Discovery Questions</p>
        <ol className="list-decimal list-inside text-ivory-dim text-sm space-y-2">
          {brief.discoveryQuestions.map((q, i) => (
            <li key={i} className={i === 0 ? 'text-ivory' : undefined}>{q}{i === 0 && <span className="label ml-2">← top question</span>}</li>
          ))}
        </ol>
      </section>

      <section className="card p-6">
        <p className="label mb-2">Email Opener</p>
        <p className="text-ivory-dim text-sm whitespace-pre-line">{brief.emailOpener}</p>
      </section>

      <section className="card p-6">
        <p className="label mb-2">Call Opener</p>
        <p className="text-ivory-dim text-sm">{brief.callOpener}</p>
      </section>

      <section className="card p-6">
        <p className="label mb-2">15-Minute Audit Talk Track</p>
        <p className="text-ivory-dim text-sm whitespace-pre-line">{brief.talkTrack}</p>
      </section>

      <div className="text-center pb-6">
        <Link href={`/audits/${auditId}`} className="btn-outline">Back to Audit</Link>
      </div>
    </div>
  );
}
