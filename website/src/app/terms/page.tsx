import type { Metadata } from 'next';
import { contact } from '@/data/site';
export const metadata: Metadata = { title: 'Terms & AI Disclosure', alternates: { canonical: '/terms' } };
export default function TermsPage() {
  return <article className="shell max-w-4xl py-16 sm:py-24"><p className="eyebrow">WBI / TERMS</p><h1 className="mt-5 text-display-lg font-bold text-snow">Terms & AI Disclosure</h1><p className="lede mt-5">Last updated September 24, 2026.</p>
    <div className="mt-10 space-y-9 text-snow-dim leading-relaxed">
      <section><h2 className="text-xl font-bold text-snow">Website information</h2><p className="mt-3">This site describes possible services and provides general information. An inquiry, diagnostic result, or audit request does not create a service agreement. Work, scope, pricing, and responsibilities are set out in a separate written proposal or agreement.</p></section>
      <section><h2 className="text-xl font-bold text-snow">AI analysis and evidence</h2><p className="mt-3">AI-generated analysis can be incomplete or mistaken and may require human review. Public-data audits reflect what was accessible at the time of analysis. Operational conclusions and financial impact require relevant internal data. No outcome or revenue increase is guaranteed.</p></section>
      <section><h2 className="text-xl font-bold text-snow">System availability</h2><p className="mt-3">A “pilot,” “in development,” or “coming soon” label describes availability, not a commitment to deliver a particular feature. Integrations and automations depend on the agreed scope and the tools a business uses.</p></section>
      <section><h2 className="text-xl font-bold text-snow">Contact</h2><p className="mt-3">Questions about these terms can be sent to <a className="text-electric-light underline" href={`mailto:${contact.email}`}>{contact.email}</a>.</p></section>
    </div>
  </article>;
}
