import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Proof & Method',
  description: 'How Winners Bookmark separates public evidence, hypotheses, pilots, and verified client outcomes.',
  alternates: { canonical: '/proof' },
};

const stages = [
  { label: '01 / OBSERVE', heading: 'A specific customer journey', body: 'We document what a visitor can access at the time of review: pages, menus, contact routes, ordering links, and booking paths.' },
  { label: '02 / INTERPRET', heading: 'A possible business consequence', body: 'We explain how that friction could affect a customer. We label this as a hypothesis unless client data supports the outcome.' },
  { label: '03 / RECOMMEND', heading: 'A proportionate next step', body: 'We suggest the smallest useful fix, whether that is clearer website copy, a workflow change, or a pilot AI system.' },
  { label: '04 / MEASURE', heading: 'Results after implementation', body: 'When a pilot runs, response and inquiry metrics can be compared with a baseline. Results appear publicly only with client approval.' },
];

export default function ProofPage() {
  return <>
    <section className="border-b border-night-line bg-night-soft"><div className="shell py-16 sm:py-24"><p className="eyebrow">PROOF / METHOD / ACCOUNTABILITY</p><h1 className="mt-5 max-w-4xl text-display-lg font-bold text-snow">Show the work. Then show the results.</h1><p className="lede mt-5 max-w-3xl">WBI is building its client record. Until approved pilot outcomes are available, this page explains our evidence standard rather than presenting fictional testimonials or performance numbers.</p><Link href="/audit" className="btn-primary mt-8">Request your audit ↗</Link></div></section>
    <section className="wbi-section"><div className="shell"><p className="eyebrow">OUR EVIDENCE STANDARD</p><h2 className="mt-5 text-display-md font-bold text-snow">A finding has a source.<br />A claim has a label.</h2><div className="mt-10 grid gap-4 md:grid-cols-2">{stages.map(stage => <article key={stage.label} className="card p-7"><span className="eyebrow">{stage.label}</span><h3 className="mt-5 text-xl font-bold text-snow">{stage.heading}</h3><p className="mt-3 leading-relaxed text-snow-dim">{stage.body}</p></article>)}</div></div></section>
    <section className="wbi-section border-y border-night-line bg-night-soft"><div className="shell grid gap-12 lg:grid-cols-2"><div><p className="eyebrow">ILLUSTRATIVE SCENARIO</p><h2 className="mt-5 text-display-md font-bold text-snow">A guest wants to order. The path gets confusing.</h2><p className="lede mt-5">This is a fictional example of the report format, not an audit of a named business.</p></div><div className="card p-7"><dl className="space-y-6"><div><dt className="eyebrow">OBSERVATION TO VERIFY</dt><dd className="mt-2 text-snow">The mobile site presents multiple ordering links with different destinations.</dd></div><div><dt className="eyebrow">POSSIBLE CONSEQUENCE</dt><dd className="mt-2 text-snow">Some guests may hesitate or abandon the journey.</dd></div><div><dt className="eyebrow">PRACTICAL FIX</dt><dd className="mt-2 text-snow">Clarify the primary action and test the full flow on mobile.</dd></div><div><dt className="eyebrow">METRIC TO TRACK</dt><dd className="mt-2 text-snow">Ordering link starts and completed orders, if the business can provide that data.</dd></div></dl></div></div></section>
    <section className="wbi-section"><div className="shell max-w-4xl"><p className="eyebrow">PILOT RECORD</p><h2 className="mt-5 text-display-md font-bold text-snow">Client-approved case studies will live here.</h2><p className="lede mt-5">A case study will include context, public findings, implemented workflow, baseline, outcome, and explicit permission to publish. No Leverock’s internal data or testimonial is published here.</p><Link href="/contact?interest=ai-business-audit" className="btn-primary mt-8">Discuss a pilot ↗</Link></div></section>
  </>;
}
