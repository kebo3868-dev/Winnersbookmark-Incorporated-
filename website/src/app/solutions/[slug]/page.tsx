import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section, SectionHeading } from '@/components/Section';
import { StatusBadge, FeatureStateBadge } from '@/components/StatusBadge';
import { getAgent, agentSlugs, agentsByOrder } from '@/data/agents';
import { SITE_URL, company } from '@/data/site';

/**
 * THE AGENT PAGE TEMPLATE
 *
 * One template renders every agent in the registry — today's four and every
 * one added later. That is the modularity requirement made real: a new agent
 * needs a data entry, not a new page, and it arrives with metadata, structured
 * data, a sitemap entry and honest status badges already attached.
 *
 * Sections render conditionally on the data being present, which is how the
 * same template serves a shipped product with five workflow steps and a
 * concept with none, without either looking padded or broken.
 */

export function generateStaticParams() {
  return agentSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) return {};

  return {
    title: agent.name,
    description: agent.tagline,
    alternates: { canonical: `/solutions/${agent.slug}` },
    openGraph: {
      title: `${agent.name} | ${company.shortName}`,
      description: agent.tagline,
      url: `/solutions/${agent.slug}`,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: agent.name, description: agent.tagline },
  };
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  const others = agentsByOrder.filter((a) => a.slug !== agent.slug).slice(0, 3);
  const isAvailable = agent.status === 'LIVE' || agent.status === 'PILOT';
  const hasWorkflow = agent.workflow.length > 1;

  /**
   * Structured data. Only emitted for agents a customer can actually engage
   * with — describing an unbuilt concept as a Product with an offer would be
   * the schema-level version of the overclaiming this site avoids everywhere
   * else, and search engines treat it as exactly that.
   */
  const jsonLd = isAvailable
    ? {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: agent.name,
        description: agent.description,
        serviceType: 'AI automation for local business',
        provider: {
          '@type': 'Organization',
          name: company.legalName,
          url: SITE_URL,
        },
        url: `${SITE_URL}/solutions/${agent.slug}`,
        areaServed: 'US',
      }
    : null;

  const faqLd =
    agent.faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: agent.faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="border-b border-night-line">
        <div className="shell py-16 sm:py-24">
          <nav aria-label="Breadcrumb" className="mb-7">
            <ol className="flex flex-wrap items-center gap-x-2 text-xs text-snow-faint">
              <li><Link href="/" className="inline-block py-1.5 transition-colors hover:text-snow-dim">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href="/solutions" className="inline-block py-1.5 transition-colors hover:text-snow-dim">AI Agents</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-snow-dim">{agent.name}</li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <StatusBadge status={agent.status} />
            <h1 className="mt-5 text-display-lg font-bold text-snow">{agent.name}</h1>
            <p className="lede mt-5 max-w-2xl text-lg">{agent.tagline}</p>

            {/* The status note is prominent, not buried. A visitor should not
                have to read to the FAQ to discover something is not for sale. */}
            <div
              className={`mt-8 rounded-lg border-l-2 bg-night-card/60 p-4 sm:p-5 ${
                isAvailable ? 'border-status-live/60' : 'border-status-planned/60'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-snow-faint">
                {agent.statusLabel}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-snow-dim">{agent.statusNote}</p>
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={agent.cta.primaryHref} className="btn-primary">
                {agent.cta.primaryLabel}
              </Link>
              {agent.cta.secondaryLabel && agent.cta.secondaryHref && (
                <Link href={agent.cta.secondaryHref} className="btn-secondary">
                  {agent.cta.secondaryLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM ─────────────────────────────────────────────────── */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <SectionHeading eyebrow="The problem" title={agent.problem.headline} />
            <p className="lede mt-5">{agent.problem.body}</p>
          </div>
          <div className="card p-6 sm:p-7">
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-snow-faint">
              You might recognise this
            </h3>
            <ul className="mt-5 space-y-3.5">
              {agent.problem.symptoms.map((symptom) => (
                <li key={symptom} className="flex gap-3 text-sm leading-relaxed text-snow-dim">
                  <span aria-hidden="true" className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-electric-light" />
                  {symptom}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ── WHAT IT IS ──────────────────────────────────────────────────── */}
      <Section className="border-y border-night-line bg-night-soft/30">
        <SectionHeading eyebrow="What it is" title={`Meet the ${agent.name}`} />
        <p className="lede mt-5 max-w-prose">{agent.description}</p>

        <h3 className="mt-14 text-display-sm font-bold text-snow">Capabilities</h3>
        <p className="mt-2 text-sm text-snow-faint">
          Each capability carries its real state. Nothing here is aspirational unless it says so.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {agent.features.map((feature) => (
            <div key={feature.title} className="card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-[15px] font-semibold text-snow">{feature.title}</h4>
                <FeatureStateBadge state={feature.state} />
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-snow-dim">{feature.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      {hasWorkflow ? (
        <Section id="how-it-works">
          <SectionHeading eyebrow="How it works" title="From first contact to working system" />
          <ol className="mt-12 space-y-4">
            {agent.workflow.map((step, i) => (
              <li key={step.title} className="card flex gap-5 p-6 sm:p-7">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-electric/40 bg-electric/10 font-mono text-sm font-bold text-electric-light"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-snow">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-snow-dim">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      ) : (
        <Section id="how-it-works">
          <div className="card p-6 sm:p-8">
            <h2 className="text-display-sm font-bold text-snow">{agent.workflow[0]?.title ?? 'In development'}</h2>
            <p className="lede mt-3 max-w-prose">{agent.workflow[0]?.description}</p>
          </div>
        </Section>
      )}

      {/* ── OUTCOMES ────────────────────────────────────────────────────── */}
      {agent.outcomes.length > 0 && (
        <Section className="border-y border-night-line bg-night-soft/30">
          <SectionHeading
            eyebrow="What changes"
            title="What this actually does for the business"
            body="Capabilities, stated plainly. You will not find a recovery percentage here — we have no data that would make one honest."
          />
          <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {agent.outcomes.map((outcome) => (
              <div key={outcome} className="flex gap-3.5 border-l-2 border-electric/50 pl-5">
                <p className="text-[15px] leading-relaxed text-snow-soft">{outcome}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── PROOF ───────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading eyebrow="Results" title="Case studies" />
        {agent.caseStudies.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {agent.caseStudies.map((cs) => (
              <div key={cs.client} className="card p-6">
                <h3 className="text-base font-semibold text-snow">{cs.client}</h3>
                <p className="mt-2 text-sm leading-relaxed text-snow-dim">{cs.summary}</p>
                {cs.href && (
                  <Link href={cs.href} className="btn-ghost mt-4">
                    Read the case study <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* An empty state that tells the truth. The alternative — inventing a
             testimonial — is the single fastest way for a young company to
             become untrustworthy, and it is the thing the brief ruled out
             most explicitly. */
          <div className="card mt-8 p-6 sm:p-8">
            <p className="text-[15px] leading-relaxed text-snow-dim">
              We have not published case studies for this system yet. When we have customer
              results we are permitted to share, they will appear here with the customer named
              and the numbers attributed.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-snow-dim">
              We are not going to fill this space with an anonymous testimonial or an invented
              statistic in the meantime. If you want to talk to us about being an early customer,{' '}
              <Link href="/contact" className="font-semibold text-electric-light underline underline-offset-4 hover:text-white">
                that conversation is open
              </Link>
              .
            </p>
          </div>
        )}
      </Section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      {agent.faqs.length > 0 && (
        <Section className="border-y border-night-line bg-night-soft/30">
          <SectionHeading eyebrow="Questions" title="Frequently asked" />
          <div className="mt-10 max-w-prose space-y-3">
            {agent.faqs.map((faq) => (
              /* <details> gives keyboard operability, screen-reader semantics
                 and works without JavaScript — all for free. A custom
                 accordion would have to re-earn each of those. */
              <details key={faq.question} className="card group p-5 sm:p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-snow marker:content-none">
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-electric-light transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3.5 text-sm leading-relaxed text-snow-dim">{faq.answer}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <Section>
        <div className="card p-8 text-center sm:p-12">
          <h2 className="text-display-md font-bold text-snow">
            {isAvailable ? `Ready to put the ${agent.name} to work?` : `Want to shape where ${agent.name} goes?`}
          </h2>
          <p className="lede mx-auto mt-4 max-w-xl">
            {isAvailable
              ? 'Tell us about your business. We will tell you honestly whether this is the right system for the problem you have.'
              : 'This is not available yet. Tell us what you need from it and you will hear from us when there is something real to show.'}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={agent.cta.primaryHref} className="btn-primary">
              {agent.cta.primaryLabel}
            </Link>
            <Link href="/solutions" className="btn-secondary">See all AI agents</Link>
          </div>
        </div>
      </Section>

      {/* ── OTHER AGENTS ────────────────────────────────────────────────── */}
      <Section className="border-t border-night-line">
        <h2 className="text-display-sm font-bold text-snow">Other agents in the ecosystem</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {others.map((other) => (
            <Link
              key={other.slug}
              href={`/solutions/${other.slug}`}
              className="card card-hover p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-snow">{other.name}</h3>
                <StatusBadge status={other.status} />
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-snow-dim">{other.tagline}</p>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
