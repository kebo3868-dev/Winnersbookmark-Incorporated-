import type { Metadata } from 'next';
import Diagnostic from './Diagnostic';

export const metadata: Metadata = {
  title: 'AI Opportunity Diagnostic',
  description: 'Answer ten practical questions to find potential gaps in customer communication, digital journeys, and follow-up.',
  alternates: { canonical: '/diagnostic' },
};

export default function DiagnosticPage() {
  return <div className="shell py-14 sm:py-20">
    <p className="eyebrow">WBI / FREE SIGNAL CHECK</p>
    <h1 className="mt-5 max-w-4xl text-display-lg font-bold text-snow">Where could customers be getting stuck?</h1>
    <p className="lede mt-5 max-w-3xl">Ten questions. An immediate opportunity profile. No account, no invented dollar estimate, and no answers sent to WBI.</p>
    <Diagnostic />
  </div>;
}
