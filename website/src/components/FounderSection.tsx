import Link from 'next/link';
import { BookmarkNotch, LogoMark } from './Logo';
import { company, founderPhoto, founderPhotoAlt } from '@/data/site';

/**
 * FOUNDER SECTION
 *
 * Built entirely from existing primitives — `surface`, `eyebrow`, the display
 * scale, `btn-secondary`, `BookmarkNotch` — so it inherits the design system
 * rather than introducing a parallel one. No new tokens, no new patterns.
 *
 * WHAT THIS COPY DELIBERATELY DOES NOT DO
 *
 * There is no verifiable biographical information about the founder anywhere
 * in this repository — no career history, no prior roles, no industry
 * background. So this section makes NO claim about his experience. It does not
 * say he ran a restaurant, worked in hospitality, or spent years in anything.
 *
 * Instead it substantiates the heading the only way it honestly can: by
 * describing the problem precisely and stating the operating principle the
 * company demonstrably follows. Understanding is evidenced by the description
 * being accurate, not by an assertion of credentials.
 *
 * TO STRENGTHEN THIS SECTION: one or two real biographical facts — what Keith
 * did before this, or what he saw that led him to start it — would do more for
 * credibility than any further design work. That copy should replace the
 * middle paragraph below.
 */
export default function FounderSection() {
  return (
    /**
     * Explicit grid placement rather than `order` utilities.
     *
     * Mobile reads in source order: heading, portrait, copy. Leading a phone
     * screen with the portrait — a PLACEHOLDER, until a real photo exists —
     * shows the reader an empty frame before telling them what the section is.
     *
     * From `lg` up, the three children are placed into a two-column, two-row
     * grid: the portrait occupies the left column across both rows, with the
     * heading and copy stacked in the right. Same markup, one h2, no
     * duplication.
     */
    <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-6">
      {/* ── Heading ──────────────────────────────────────────────────────── */}
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">
        <p className="eyebrow mb-5">The founder</p>
        <h2 className="text-display-2 text-text-bright">
          Built by someone who understands the problem.
        </h2>
      </div>

      {/* ── Portrait ─────────────────────────────────────────────────────── */}
      <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:self-center">
        {/* Constrained on mobile so the portrait does not dominate a phone
            screen before the copy has said anything. */}
        <div className="mx-auto w-full max-w-[280px] sm:max-w-[320px] lg:max-w-none">
          <div className="surface relative overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
            {founderPhoto ? (
              // Explicit dimensions plus object-cover: the frame reserves its
              // space before the file loads, so adding a photo later cannot
              // introduce layout shift.
              <img
                src={founderPhoto}
                alt={founderPhotoAlt}
                width={800}
                height={1000}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              /* PLACEHOLDER — brand geometry, not a stock person or a generic
                 avatar silhouette. It reads as a reserved frame rather than a
                 missing asset. */
              <div className="absolute inset-0">
                <div aria-hidden="true" className="absolute inset-0 bg-grid opacity-60" />
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse 70% 55% at 50% 22%, rgba(36,84,235,0.16), transparent 70%)',
                  }}
                />
                <div className="relative flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
                  <LogoMark size={44} />
                  <div>
                    <p className="font-mono text-[1.75rem] font-semibold tracking-[0.12em] text-text-secondary">
                      KW
                    </p>
                    <p className="mt-2 text-[0.6875rem] uppercase tracking-[0.16em] text-text-faint">
                      Portrait to follow
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Nameplate — sits over the photo or the placeholder alike. */}
            <div className="absolute inset-x-0 bottom-0 border-t border-ink-line bg-ink-void/85 px-4 py-3 backdrop-blur-sm">
              <p className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text-bright">
                {company.founder}
              </p>
              <p className="mt-0.5 text-[0.6875rem] leading-snug text-text-muted">
                Founder, {company.legalName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Copy ─────────────────────────────────────────────────────────── */}
      <div className="min-w-0 lg:col-start-2 lg:row-start-2">
        <div className="space-y-4 text-body text-text-secondary">
          <p>
            {company.legalName} was created to answer a question most technology companies skip:
            what is actually costing this business money right now?
          </p>
          <p>
            Restaurants and local service businesses lose revenue in places nobody is watching —
            calls that ring out during a rush, ordering paths that break silently, inquiries that
            arrive somewhere no one checks, and the same questions answered by staff all day. None
            of it appears on a report. All of it is measurable if someone looks.
          </p>
          <p>
            So we look first. Every engagement starts by establishing what is going wrong and
            showing the evidence for it. Only then do we talk about what to build — and if the
            honest answer is a fix to your website or a change to how something is handled rather
            than an AI system, that is what we will tell you.
          </p>
        </div>

        {/* Signature line — reinforces attribution without a fabricated quote. */}
        <div className="mt-7 flex items-center gap-3 border-t border-ink-line pt-6">
          <BookmarkNotch size={13} className="text-cobalt-core" />
          <div>
            <p className="text-[0.875rem] font-semibold text-text-primary">{company.founder}</p>
            <p className="text-[0.75rem] text-text-muted">Founder, {company.legalName}</p>
          </div>
        </div>

        <Link href="/about" className="btn-secondary mt-8">
          About Winners Bookmark
        </Link>
      </div>
    </div>
  );
}
