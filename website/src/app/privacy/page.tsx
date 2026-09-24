import type { Metadata } from 'next';
import { contact } from '@/data/site';

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } };
export default function PrivacyPage() {
  return <article className="shell max-w-4xl py-16 sm:py-24"><p className="eyebrow">WBI / PRIVACY</p><h1 className="mt-5 text-display-lg font-bold text-snow">Privacy Policy</h1><p className="lede mt-5">Last updated September 24, 2026.</p>
    <div className="mt-10 space-y-9 text-snow-dim leading-relaxed">
      <section><h2 className="text-xl font-bold text-snow">Information you submit</h2><p className="mt-3">If you send an inquiry, we use the name, contact details, business details, and message you provide to assess and respond to your request. Do not include passwords, payment details, or sensitive customer records in the form.</p></section>
      <section><h2 className="text-xl font-bold text-snow">The diagnostic</h2><p className="mt-3">Diagnostic answers are assessed in your browser. They are not submitted to WBI by the diagnostic. If you choose to contact us afterward, the separate contact form sends only what you enter there.</p></section>
      <section><h2 className="text-xl font-bold text-snow">How inquiries are handled</h2><p className="mt-3">The site forwards form submissions to WBI’s lead intake service. Authorized operators may review them to reply and manage follow-up. We do not sell inquiry details or use them to add you to a mailing list from this form. Service providers handling site hosting or delivery may process the data for those purposes.</p></section>
      <section><h2 className="text-xl font-bold text-snow">Retention and requests</h2><p className="mt-3">We keep inquiry records as needed for business follow-up and legal obligations. To request access, correction, or deletion, email <a className="text-electric-light underline" href={`mailto:${contact.email}`}>{contact.email}</a>. We may need to confirm your identity before acting.</p></section>
      <section><h2 className="text-xl font-bold text-snow">Changes</h2><p className="mt-3">We may update this policy as services change. The date above identifies the current version.</p></section>
    </div>
  </article>;
}
