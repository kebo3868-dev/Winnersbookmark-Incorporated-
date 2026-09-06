import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection, LegalList } from '@/components/LegalPage';
import { company, contact } from '@/data/site';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: `The terms that apply to using the ${company.legalName} website.`,
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

/**
 * TERMS OF USE
 *
 * Scoped deliberately to USE OF THIS WEBSITE — not to client engagements.
 * Those are governed by whatever is signed with each customer, and a website
 * terms page that purported to set the terms of a paid engagement would be
 * both wrong and unenforceable.
 *
 * As with the privacy policy, no governing law, venue, company registration
 * number, or postal address is asserted, because none of those facts is in
 * this repository. They must be added by the company before this page carries
 * legal weight in a specific jurisdiction.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="September 2026"
      intro={`These terms apply to your use of this website. They do not govern any paid engagement with ${company.legalName} — that is set out in whatever agreement we sign with you.`}
    >
      <LegalSection heading="Using this site">
        <p>
          You are welcome to read this website, share links to it, and contact us through it. In
          return, please do not attempt to breach its security, extract data from it by automated
          means at a rate that degrades it for others, or use it to send unlawful or abusive
          content.
        </p>
      </LegalSection>

      <LegalSection heading="What the information here is, and is not">
        <p>
          The content on this site is provided for general information about our services. It is
          <strong> not professional advice</strong>, and it is not a guarantee of any particular
          business result.
        </p>
        <p>
          We are careful about this. You will not find a projected revenue figure or a recovery
          percentage anywhere on this website, because we have no customer outcome data that would
          make one honest. Where we show an example of our work, it is labeled as an example.
        </p>
      </LegalSection>

      <LegalSection heading="Availability of our systems">
        <p>
          Each AI system described on this site carries its real status — live, in private pilot,
          in development, or coming soon — and individual capabilities carry their own status
          where they differ.
        </p>
        <p>
          <strong>A system marked as in development or coming soon is not available to
          purchase</strong>, and nothing on this site should be read as an offer to supply it.
          Descriptions of planned systems are statements of intent, not commitments to a feature
          or a date.
        </p>
      </LegalSection>

      <LegalSection heading="Contacting us">
        <p>
          Submitting the contact form does not create a contract, a client relationship, or any
          obligation on either side. It is an inquiry. We aim to reply to every genuine one,
          usually within one business day, but we do not guarantee a reply or an engagement.
        </p>
        <p>
          Information you send us is handled as described in our{' '}
          <Link href="/privacy">Privacy Policy</Link>. Please do not send confidential material
          through the form before we have an agreement in place.
        </p>
      </LegalSection>

      <LegalSection heading="Our content">
        <p>
          The text, design, code, diagrams and branding on this site belong to {company.legalName}
          {' '}unless stated otherwise. You may quote or link to it with attribution. You may not
          reproduce it wholesale, or present it as your own.
        </p>
      </LegalSection>

      <LegalSection heading="Links to other sites">
        <p>
          Where we link to a third-party site, we do so because we think it is useful. We do not
          control those sites and are not responsible for their content or their handling of your
          information.
        </p>
      </LegalSection>

      <LegalSection heading="Limits">
        <p>
          This website is provided as it is. We work to keep it accurate and available, but we do
          not warrant that it will be uninterrupted, error-free, or current at every moment.
        </p>
        <LegalList
          items={[
            'We are not liable for decisions taken solely on the basis of general information published here.',
            'Nothing in these terms limits liability that cannot lawfully be limited — including for fraud, or for death or personal injury caused by negligence.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          We may update these terms as the business changes. The current version is always the one
          on this page, with its date at the top.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          {company.legalName}, founded by {company.founder}. Questions about these terms go to{' '}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
