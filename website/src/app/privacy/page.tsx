import type { Metadata } from 'next';
import { LegalPage, LegalSection, LegalList } from '@/components/LegalPage';
import { company, contact } from '@/data/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${company.legalName} handles the information you submit through this website.`,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

/**
 * PRIVACY POLICY
 *
 * Written from the code, not from a template. Every statement below describes
 * something this site verifiably does or does not do:
 *
 *  - The contact form fields are exactly those in contactFormSchema.
 *  - Submissions are forwarded server-to-server to the Restaurant Rescue
 *    Agent's ingest endpoint and stored in its MarketingLead table.
 *  - The founder notification is a single email, sent only when an email
 *    provider is configured.
 *  - There is no analytics package, no advertising pixel, no third-party
 *    script, and no cookie set by this site. Fonts are self-hosted through
 *    next/font, so loading a page makes no request to Google.
 *
 * WHAT IS DELIBERATELY ABSENT: a governing-law clause, a company registration
 * number, a postal address, and a fixed retention period. Those are facts
 * about the business that are not in this repository, and inventing them in a
 * legal document would be worse than omitting them. They should be added
 * before this page is relied on for compliance in any specific jurisdiction.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 2026"
      intro={`This policy explains what ${company.legalName} collects when you use this website, why we collect it, and what we do with it. It is written in plain English and describes what the site actually does.`}
    >
      <LegalSection heading="The short version">
        <p>
          This website has <strong>no analytics, no advertising trackers, no third-party
          scripts, and sets no cookies</strong>. The only information we receive is what you
          type into the contact form and choose to send us. We use it to reply to you. We do not
          sell it, and we do not add you to a mailing list.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect">
        <p>We collect information in one place only: the contact form. When you submit it, we receive:</p>
        <LegalList
          items={[
            <><strong>Your name and email address</strong> — required, so we can reply.</>,
            <><strong>Your business name, phone number, and website address</strong> — optional. The website address is what an audit needs to begin.</>,
            <><strong>What your inquiry is about</strong> — the option you select from the list.</>,
            <><strong>Your message</strong> — whatever you choose to tell us.</>,
            <><strong>Which page you submitted from</strong> — so we know what you were reading.</>,
          ]}
        />
        <p>
          We do not collect anything else. There is no hidden field gathering data about you, with
          one exception described below.
        </p>
      </LegalSection>

      <LegalSection heading="The spam field">
        <p>
          The form contains one field hidden from people and visible to automated bots. If it is
          filled in, the submission is <strong>flagged for review rather than deleted</strong> —
          because silently discarding a real customer inquiry is a worse outcome than a person
          glancing at a suspected bot. It collects nothing about you.
        </p>
      </LegalSection>

      <LegalSection heading="What we do with it">
        <LegalList
          items={[
            <>Your submission is stored in our own database, hosted on infrastructure we control.</>,
            <>A notification is emailed to the founder so your inquiry is seen promptly.</>,
            <>We use it to reply to you and, if you become a customer, to carry out the work you asked for.</>,
          ]}
        />
        <p>
          That is the whole list. Your details are not used for advertising, not shared with data
          brokers, and not sold under any circumstances.
        </p>
      </LegalSection>

      <LegalSection heading="Who else can see it">
        <p>
          Your information is handled by {company.founder} and anyone working directly on your
          inquiry. Beyond that, it passes through service providers we use to run the site:
        </p>
        <LegalList
          items={[
            <><strong>Our hosting provider</strong>, which serves this website and runs our application.</>,
            <><strong>Our database provider</strong>, which stores the submission.</>,
            <><strong>Our email provider</strong>, which delivers the notification to us.</>,
          ]}
        />
        <p>
          These providers process the data on our behalf in order to operate the service. They are
          not permitted to use it for their own purposes.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies and tracking">
        <p>
          <strong>This site sets no cookies and runs no analytics.</strong> There is no Google
          Analytics, no advertising pixel, no session recording, and no cross-site tracking. Our
          typefaces are served from our own domain, so simply loading a page does not contact any
          third party.
        </p>
        <p>
          Our hosting provider keeps standard server logs, which may include IP addresses, for
          security and reliability. We do not use those logs to build a profile of you.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>
          We keep inquiries for as long as we may reasonably need them to respond to you and to
          keep a record of our business dealings. If you would like your information deleted, ask
          us and we will delete it — see below.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <p>You can ask us at any time to:</p>
        <LegalList
          items={[
            'Tell you what information we hold about you',
            'Correct anything that is wrong',
            'Delete your information entirely',
            'Stop contacting you',
          ]}
        />
        <p>
          Email <a href={`mailto:${contact.email}`}>{contact.email}</a> and we will action it.
          You do not need to give a reason, and there is no cost. Depending on where you live,
          you may have additional statutory rights; asking us is the fastest route regardless.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          This is a business-to-business website and is not directed at children. We do not
          knowingly collect information from anyone under 16.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          If we change how we handle your information, we will update this page and change the
          date at the top. Material changes will be described here rather than made quietly.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          {company.legalName}, founded by {company.founder}. For any question about this policy or
          about information we hold, email <a href={`mailto:${contact.email}`}>{contact.email}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
