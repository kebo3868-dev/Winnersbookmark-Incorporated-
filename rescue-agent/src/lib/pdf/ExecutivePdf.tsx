import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { classificationCounters, classificationIntro, type ExecutiveReportDTO } from '@/lib/reports/executive';
import { evidenceBasisRows } from '@/lib/audit/evidenceBasis';
import { CONFIDENCE_EXPLANATION, FINDING_CLASSIFICATION_NOTE } from '@/lib/scoring/methodology';
import { SCENARIO_DISCLAIMER, SCENARIO_SPECS } from '@/lib/reports/scenarios';

/**
 * Executive Audit Report PDF (Phase 2.5). Deterministic generation via
 * @react-pdf/renderer (pure-JS layout — no headless browser, Vercel-safe).
 * Standard PDF fonts (Times/Helvetica); nothing fetched at runtime. Obsidian
 * cover + dark section dividers for premium feel; ivory interior for print
 * readability. No scenario dollar figure is printed; the optional calculator
 * lives in the web report and takes only the reader's own figures.
 */

const C = {
  obsidian: '#0e0c09',
  espresso: '#221812',
  brown: '#2e2014',
  gold: '#b8924a',
  goldBright: '#d4ad5c',
  goldDim: '#8a6f33',
  ivory: '#f4efe6',
  paper: '#ffffff',
  ink: '#211c15',
  stone: '#6f6758',
  muted: '#6f6758',
  line: '#ddd5c5',
  softBg: '#f7f3ea',
  goldWash: '#faf5e9',
  green: '#3e6b4f',
  amber: '#8a6d2f',
  red: '#8a3b32',
};

const s = StyleSheet.create({
  cover: { backgroundColor: C.obsidian, color: C.ivory, paddingVertical: 52, paddingHorizontal: 56, justifyContent: 'space-between' },
  // No page-level lineHeight — react-pdf 4.x won't paint render-prop page
  // numbers when the Page style sets an inherited lineHeight.
  page: { backgroundColor: C.paper, color: C.ink, paddingTop: 52, paddingBottom: 64, paddingHorizontal: 52, fontFamily: 'Helvetica', fontSize: 9.5 },
  divider: { backgroundColor: C.obsidian, color: C.ivory, justifyContent: 'center', paddingHorizontal: 56 },
  h2: { fontFamily: 'Times-Bold', fontSize: 15, color: C.ink, marginBottom: 6 },
  sectionKicker: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, letterSpacing: 2, color: C.goldDim, textTransform: 'uppercase', marginBottom: 4 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.gold, marginBottom: 12, width: 42 },
  body: { fontSize: 9.5, color: C.ink, lineHeight: 1.5 },
  mutedText: { fontSize: 8.5, color: C.muted, lineHeight: 1.4 },
  section: { marginBottom: 22 },
  footerText: { fontSize: 7, color: C.muted, letterSpacing: 1 },
  badge: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, paddingVertical: 2, paddingHorizontal: 6, borderWidth: 0.75, borderRadius: 2 },
  card: { backgroundColor: C.softBg, borderWidth: 0.5, borderColor: C.line, borderRadius: 3, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row' },
  label: { fontSize: 7, letterSpacing: 1.4, color: C.muted, textTransform: 'uppercase', marginBottom: 2 },
});

/**
 * A "— continued" line that appears only on the pages AFTER the one a block
 * started on.
 *
 * react-pdf gives a `fixed` element one thing a continuation label needs — it
 * repeats on every page its parent spans — and not the other: there is no flag
 * saying "this is not the first of them". `render` does supply the page number,
 * so the first page a given id renders on is recorded and every higher page
 * number is a continuation. Layout runs before paint, so by the time the text
 * is painted the recorded page is the true first one.
 *
 * The alternative, a label above every block after the first, put two of them
 * on one page whenever two blocks landed on the same page — which reads as a
 * mistake rather than as a continuation.
 *
 * The bookkeeping is PER RENDER, held in a Map the document creates and passes
 * down. It was module scope first, which is a bug whenever two reports render
 * at once in the same process: react-pdf's layout is async, so a second
 * document starting would clear the first one's recorded pages mid-layout and
 * its labels would come out wrong.
 */
export type ContinuationLedger = Map<string, number>;

function ContinuedLabel({ id, text, ledger }: { id: string; text: string; ledger: ContinuationLedger }) {
  // Drawn as a slice of the card (fill and side rules, no vertical padding), so
  // on the first page, where it is empty, it has no height and draws nothing.
  return (
    <Text
      fixed
      style={{ fontSize: 6.5, letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase', backgroundColor: C.softBg, borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: C.line, paddingHorizontal: 14 }}
      render={({ pageNumber, totalPages }) => {
        // react-pdf calls this during pagination too, once per tentative page
        // split, with page numbers the block may never be placed on. Recording
        // those made the label print on the card's FIRST page ("— continued"
        // above its own opening block). Only the final pass carries
        // totalPages, so only it may touch the ledger; tentative passes return
        // the text so the line's height is reserved during layout.
        if (totalPages === undefined) return text;
        const seen = ledger.get(id);
        if (seen === undefined || pageNumber < seen) {
          ledger.set(id, pageNumber);
          return '';
        }
        return pageNumber > seen ? text : '';
      }}
    />
  );
}

/**
 * Records the page a long card opens on, in the final pagination pass only.
 *
 * The continuation label sits in the card's later blocks, which may begin a
 * page after the opening — so the label's own first appearance cannot tell it
 * whether it is a continuation. The opening block records its page here; react-
 * pdf resolves pages in order, so the record exists before any later block is
 * painted.
 */
function FirstPageMark({ id, ledger }: { id: string; ledger: ContinuationLedger }) {
  return (
    <Text
      style={{ fontSize: 1 }}
      render={({ pageNumber, totalPages }) => {
        if (totalPages !== undefined) {
          const seen = ledger.get(id);
          if (seen === undefined || pageNumber < seen) ledger.set(id, pageNumber);
        }
        return '';
      }}
    />
  );
}

/** One slice of a finding card that may span pages; stacked, the slices read as one card. */
function cardSlice(part: 'top' | 'middle' | 'bottom') {
  return {
    backgroundColor: C.softBg,
    borderColor: C.line,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderTopWidth: part === 'top' ? 0.5 : 0,
    borderBottomWidth: part === 'bottom' ? 0.5 : 0,
    borderTopLeftRadius: part === 'top' ? 3 : 0,
    borderTopRightRadius: part === 'top' ? 3 : 0,
    borderBottomLeftRadius: part === 'bottom' ? 3 : 0,
    borderBottomRightRadius: part === 'bottom' ? 3 : 0,
    paddingHorizontal: 14,
    paddingTop: part === 'top' ? 14 : 0,
    paddingBottom: part === 'bottom' ? 14 : 0,
  };
}

/** Split a list into fixed-size groups, so a page break falls between groups. */
function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

/**
 * Whether a finding card is too tall to be guaranteed a single page.
 *
 * This decides BOTH how the card is laid out and whether its blocks carry
 * continuation labels, and the two have to agree. A card that fits on a page is
 * rendered as one unbreakable block, so it never splits and needs no label. A
 * card that cannot be guaranteed a page is allowed to break between its blocks,
 * and every block after the first then names the finding it belongs to.
 *
 * Deciding the label from length alone was wrong: the first attempt let a short
 * card wrap anyway — it simply started near the foot of a page — and the
 * continuation arrived under a bare "THE BUSINESS PROBLEM" heading with nothing
 * saying which finding it belonged to. Tying the layout and the label to the
 * same predicate makes that impossible: either the card is whole, or it is
 * labelled.
 *
 * Character count, not measured height: the real height depends on font metrics
 * the layout engine computes later, and this only has to be conservative. A
 * Letter page at this type size holds roughly 1,800 characters of card body
 * plus the card's own chrome, so 1,400 leaves headroom.
 */
export function findingMaySpanPages(finding: ExecutiveReportDTO['findings'][number]): boolean {
  const text = [
    finding.title,
    finding.problem,
    finding.whyItMatters,
    finding.commercialEffect,
    finding.whatWeDoNotKnow,
    finding.recommendedAction,
    ...finding.whatWeKnow,
    ...(finding.evidenceBasis ? evidenceBasisRows(finding.evidenceBasis).flat() : []),
  ].join(' ');
  return text.length > 1400;
}

function classificationColor(classification: string): string {
  if (classification === 'VERIFIED FINDING') return C.green;
  if (classification === 'STRONG EVIDENCE') return C.green;
  if (classification === 'MANUAL VALIDATION REQUIRED') return C.amber;
  if (classification === 'INSUFFICIENT DATA') return C.muted;
  return C.goldDim;
}

function statusColor(status: string): string {
  if (status === 'HEALTHY') return C.green;
  if (status === 'RESOLVED_UNVERIFIED') return C.amber;
  if (status === 'FRICTION') return C.amber;
  if (status === 'RISK') return C.red;
  if (status === 'MANUAL VALIDATION') return C.gold;
  return C.muted;
}

const Footer = ({ dto }: { dto: ExecutiveReportDTO }) => (
  <>
    <Text style={[s.footerText, { position: 'absolute', bottom: 28, left: 52, width: 330 }]} fixed>
      {dto.cover.footer.toUpperCase()}
    </Text>
    <View style={{ position: 'absolute', bottom: 28, right: 52, width: 140 }} fixed>
      <Text style={[s.footerText, { textAlign: 'right' }]} render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`} />
    </View>
  </>
);

/**
 * PAGINATION NOTE — why nothing here carries `minPresenceAhead`.
 *
 * react-pdf only consults `minPresenceAhead` for an element that would already
 * be split across the page boundary, and when it does fire on a wrappable block
 * it advances the page WITHOUT placing the block, so the block lands one page
 * later and the page in between is emitted empty. That is what produced a PDF
 * whose "Top Revenue Leaks" page carried the heading and nothing else, with the
 * findings starting on the following page.
 *
 * Measured over 80 layout permutations (1/2/3/5 findings × short/long problem
 * text × 10 executive-summary lengths): with `minPresenceAhead` on the finding
 * cards, 4 permutations produced a blank or heading-only page; with it removed,
 * zero did. Blocks now break naturally, so a section that starts low on a page
 * continues overleaf instead of leaving one behind.
 */
/**
 * KEEPING A HEADING WITH ITS CONTENT.
 *
 * Every heading is placed in one unbreakable View together with the first
 * block of its section (`Lead`), so a heading cannot end a page with its content
 * overleaf — the whole unit moves instead. `minPresenceAhead` was tried for this
 * first and was not reliable: it is only consulted for an element with earlier
 * siblings on the same page, and in practice it still left headings stranded.
 */
const SectionHeader = ({ kicker, title }: { kicker: string; title: string }) => (
  <View>
    <Text style={s.sectionKicker}>{kicker}</Text>
    <Text style={s.h2}>{title}</Text>
    <View style={s.rule} />
  </View>
);

/** A section heading and the first block of its content, as one unit. */
const Lead = ({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) => (
  <View wrap={false}>
    <SectionHeader kicker={kicker} title={title} />
    {children}
  </View>
);

const DemoBanner = ({ dto }: { dto: ExecutiveReportDTO }) =>
  dto.cover.demoMode ? (
    <View style={{ borderWidth: 1, borderColor: C.goldDim, padding: 6, marginBottom: 14 }}>
      <Text style={{ fontSize: 8, letterSpacing: 2, color: C.goldDim, textAlign: 'center' }}>
        DEMONSTRATION DATA — THIS REPORT DESCRIBES A FICTIONAL RESTAURANT
      </Text>
    </View>
  ) : null;

const MetaStat = ({ value, label, onDark }: { value: string | number; label: string; onDark?: boolean }) => (
  <View style={{ borderWidth: 0.75, borderColor: onDark ? C.goldDim : C.line, borderRadius: 2, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', minWidth: 78 }}>
    <Text style={{ fontFamily: 'Times-Bold', fontSize: 15, color: onDark ? C.gold : C.ink }}>{value}</Text>
    <Text style={{ fontSize: 6, letterSpacing: 0.8, color: onDark ? '#9a9080' : C.muted, textTransform: 'uppercase', marginTop: 2 }}>{label}</Text>
  </View>
);

export function ExecutivePdf({ dto }: { dto: ExecutiveReportDTO }) {
  // Per-render bookkeeping for the continuation labels: one ledger per
  // document, so two reports rendering at once cannot disturb each other.
  const continuationLedger: ContinuationLedger = new Map();
  return (
    <Document
      title={`${dto.cover.productName} — ${dto.cover.restaurantName}`}
      author={dto.cover.company}
      subject={dto.cover.subtitle}
      creator={dto.cover.company}
    >
      {/* ── COVER ─────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.cover}>
        <View>
          <Text style={{ fontSize: 9, letterSpacing: 4, color: C.gold }}>WINNERSBOOKMARK</Text>
          <View style={{ borderBottomWidth: 1, borderBottomColor: C.goldDim, width: 60, marginTop: 10 }} />
        </View>
        <View>
          {dto.cover.demoMode && (
            <Text style={{ fontSize: 8, letterSpacing: 2, color: C.gold, marginBottom: 14 }}>DEMONSTRATION DATA — FICTIONAL RESTAURANT</Text>
          )}
          <Text style={{ fontFamily: 'Times-Bold', fontSize: 34, color: C.ivory, lineHeight: 1.15 }}>RESTAURANT{'\n'}RESCUE AUDIT</Text>
          <Text style={{ fontSize: 10, color: C.gold, marginTop: 10, letterSpacing: 1 }}>{dto.cover.subtitle}</Text>
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontFamily: 'Times-Bold', fontSize: 18, color: C.ivory }}>{dto.cover.restaurantName}</Text>
            <Text style={{ fontSize: 9, color: '#b8b0a2', marginTop: 4 }}>
              {dto.cover.websiteUrl}
              {dto.cover.location ? `  ·  ${dto.cover.location}` : ''}
            </Text>
            <Text style={{ fontSize: 9, color: '#b8b0a2', marginTop: 2 }}>Audit date: {dto.cover.auditDate}</Text>
            {dto.cover.auditStatus === 'PARTIALLY_COMPLETED' && (
              <Text style={{ fontSize: 8, color: C.gold, marginTop: 6, letterSpacing: 1 }}>AUDIT PARTIALLY COMPLETED — SEE METHODOLOGY & LIMITATIONS</Text>
            )}
          </View>
          {/* Cover value block */}
          <View style={[s.row, { gap: 10, marginTop: 26 }]}>
            <MetaStat onDark value={dto.score.rescueScore ?? '—'} label="Rescue Score" />
            <MetaStat onDark value={dto.score.coverage !== null ? `${dto.score.coverage}%` : '—'} label="Coverage" />
            <MetaStat onDark value={dto.score.evidenceCount} label="Evidence Items" />
            <MetaStat onDark value={dto.score.sourcesAnalyzed} label="Pages Analyzed" />
          </View>
        </View>
        <View>
          <Text style={{ fontSize: 9, color: '#b8b0a2' }}>{dto.cover.preparedBy}</Text>
          <Text style={{ fontSize: 7.5, color: '#9a9080', marginTop: 3 }}>{dto.valueSignals.confidentialityNote}</Text>
          <Text style={{ fontSize: 7, color: '#7d766a', marginTop: 8, letterSpacing: 1.5 }}>{dto.cover.footer.toUpperCase()}</Text>
        </View>
      </Page>

      {/* ── BODY ──────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page} wrap>
        <Footer dto={dto} />
        <DemoBanner dto={dto} />

        {/* EXECUTIVE REVENUE SNAPSHOT */}
        <View style={s.section}>
          <SectionHeader kicker="At a Glance" title={dto.headlines.snapshot} />
          <Text style={[s.mutedText, { marginBottom: 8 }]}>The whole audit in sixty seconds — the top priorities, the score, and the single most important thing to validate.</Text>
          {dto.snapshot.priorities.length > 0 ? (
            <View style={[s.row, { gap: 8, marginBottom: 10 }]}>
              {dto.snapshot.priorities.map((p) => (
                <View key={p.rank} style={{ flex: 1, backgroundColor: C.softBg, borderWidth: 0.5, borderColor: C.line, borderTopWidth: 2, borderTopColor: C.gold, borderRadius: 3, padding: 10 }}>
                  <Text style={{ fontSize: 6.5, letterSpacing: 1.2, color: C.goldDim, textTransform: 'uppercase' }}>Priority {String(p.rank).padStart(2, '0')}</Text>
                  <Text style={{ fontFamily: 'Times-Bold', fontSize: 10.5, color: C.ink, marginTop: 3 }}>{p.title}</Text>
                  <Text style={{ fontSize: 6.5, letterSpacing: 1, color: C.amber, textTransform: 'uppercase', marginTop: 3 }}>{p.priorityLabel}</Text>
                  <Text style={{ fontSize: 8, color: C.ink, marginTop: 5, lineHeight: 1.4 }}>{p.summary}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[s.body, { marginBottom: 10 }]}>No high-priority revenue leaks were confirmed from public evidence. The recommended next step is validating what public analysis cannot see.</Text>
          )}
          <View style={[s.card, { marginBottom: 0 }]}>
            {[
              ['Rescue Score', `${dto.snapshot.rescueScore ?? '—'}${dto.snapshot.band ? ` · ${dto.snapshot.band}` : ''}`],
              ['Coverage', dto.snapshot.coverage !== null ? `${dto.snapshot.coverage}%` : '—'],
              [dto.snapshot.topAutomationRequiresValidation ? 'Automation to Validate' : 'Top Recommended Automation', dto.snapshot.topRecommendedAutomation ?? 'Validate first — no automation recommended yet'],
              ['Primary Validation', dto.snapshot.primaryValidationRequirement],
              ['Recommended Next Step', dto.snapshot.recommendedNextStep],
            ].map(([label, value]) => (
              <View key={label} style={[s.row, { paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.line }]}>
                <Text style={{ width: 150, fontSize: 7, letterSpacing: 1, color: C.muted, textTransform: 'uppercase' }}>{label}</Text>
                <Text style={{ flex: 1, fontSize: 8.5, color: C.ink }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* EXECUTIVE SUMMARY */}
        <View style={s.section}>
          <Lead kicker="Section 01" title="Executive Summary">
            <Text style={s.body}>{dto.executiveSummary}</Text>
          </Lead>
        </View>

        {/* SCORE */}
        <View style={s.section}>
          <Lead kicker="Section 02" title="Restaurant Rescue Score">
          {/*
            * wrap={false}: the two score cards are one unit. Without it the row
            * broke across pages 2 and 3, putting the Rescue Score at the bottom
            * of one page and the Coverage figure it must be read against at the
            * top of the next. The pair fits inside one page by a wide margin,
            * so this never produces an unfillable page.
            */}
          <View style={[s.row, { gap: 14, marginBottom: 10 }]}>
            <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
              <Text style={[s.label, { marginBottom: 4 }]}>Rescue Score</Text>
              <Text style={{ fontFamily: 'Times-Bold', fontSize: 32, color: C.goldDim, marginBottom: 4 }}>
                {dto.score.rescueScore === null ? '—' : `${dto.score.rescueScore} / 100`}
              </Text>
              {dto.score.band && <Text style={{ fontSize: 7.5, color: C.muted, letterSpacing: 1 }}>{dto.score.band}</Text>}
            </View>
            <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
              <Text style={[s.label, { marginBottom: 4 }]}>Audit Coverage</Text>
              <Text style={{ fontFamily: 'Times-Bold', fontSize: 32, color: C.ink, marginBottom: 4 }}>
                {dto.score.coverage === null ? '—' : `${dto.score.coverage}%`}
              </Text>
              <Text style={{ fontSize: 7.5, color: C.muted, textAlign: 'center' }}>Share of the intended audit scope with sufficient public evidence</Text>
            </View>
          </View>
          </Lead>
          <Text style={[s.body, { marginBottom: 8 }]}>{dto.score.interpretation}</Text>
          <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
            {[
              [`${dto.score.evidenceCount}`, 'Evidence items collected'],
              [`${dto.score.sourcesAnalyzed}`, 'Pages analyzed'],
              [`${dto.score.findingsCount}`, 'Priority findings'],
            ].map(([n, label]) => (
              <View key={label} style={{ borderWidth: 0.5, borderColor: C.line, borderRadius: 2, paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.ink }}>{n}</Text>
                <Text style={{ fontSize: 6.5, letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase' }}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={[s.mutedText, { marginTop: 8, marginBottom: 5 }]}>
            {classificationIntro(dto.score.findingsCount, dto.score.evidenceCount)}
          </Text>
          <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]} wrap={false}>
            {classificationCounters(dto.score).map(([n, label]) => (
              <View key={label} style={{ borderWidth: 0.5, borderColor: C.line, borderRadius: 2, paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.ink }}>{n}</Text>
                <Text style={{ fontSize: 6.5, letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase' }}>{label}</Text>
              </View>
            ))}
          </View>

          {/*
            * HOW THE SCORE IS CALCULATED, IN THE SAME SECTION AS THE SCORE.
            *
            * The PDF printed a 0–100 figure and never said what it measured,
            * which way it ran, how the categories were weighted, what coverage
            * divided by, or that an unassessed category is dropped from the
            * average rather than scored zero. Same DTO field as the web report,
            * so the two cannot describe the arithmetic differently.
            */}
        </View>

        {/*
          * A SIBLING SECTION, NOT A NESTED BLOCK.
          *
          * Nested inside Section 02's View this cost a page: when a wrapping
          * parent View breaks, react-pdf reserves the parent's full laid-out
          * height, so the next sibling started after it — page 4 carried four
          * lines of prose and four-fifths white space. As its own section the
          * prose flows and the next section follows it on the same page. The
          * blocks deliberately carry no wrap={false}: holding each one together
          * produced the same orphaned page from the other direction.
          *
          * Neither failure trips the glyph-count floor in the pagination test,
          * which is why every page is also inspected by eye.
          */}

        {dto.scoringMethodology.map((section, i) => (
          <View key={section.heading} style={{ marginBottom: i === dto.scoringMethodology.length - 1 ? 22 : 6 }}>
            {/* A sub-heading never ends a page without the paragraph it introduces. */}
            <View wrap={false}>
              {i === 0 && <Text style={[s.label, { marginBottom: 4 }]}>How this score is calculated</Text>}
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.ink, marginBottom: 2 }}>{section.heading}</Text>
              <Text style={[s.mutedText, { marginBottom: section.rows ? 3 : 0 }]}>{section.body}</Text>
            </View>
            {section.rows?.map(([term, definition]) => (
              <Text key={term} style={[s.mutedText, { marginBottom: 1 }]}>
                <Text style={{ color: C.goldDim }}>{term}</Text>
                {` — ${definition}`}
              </Text>
            ))}
          </View>
        ))}

        {/*
          * OPTIONAL SCENARIO CALCULATOR — no figures in the export.
          *
          * This section used to print dollar scenarios computed from invented
          * quantities. A printed report cannot take the reader's own figures,
          * so it now says the calculator exists, which pathways it covers and
          * what each needs, and prints no amount. Kept in one unbreakable block
          * so the heading always travels with its content.
          */}
        {dto.scenarioCalculators.length > 0 && (
          <View style={s.section} wrap={false}>
            <SectionHeader kicker="Section 03" title="Optional Scenario Calculator" />
            <Text style={[s.body, { marginBottom: 6 }]}>
              This audit does not measure money and this export prints no dollar figures. The online version of this report includes an optional
              calculator for the pathways below; it shows a what-if only once you have entered every figure yourself.
            </Text>
            {dto.scenarioCalculators.map((c) => (
              <View key={c.kind} style={[s.row, { paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.line }]}>
                <Text style={{ width: 170, fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink }}>{c.pathwayTitle}</Text>
                <Text style={{ flex: 1, fontSize: 7.5, color: C.muted }}>Inputs you supply: {SCENARIO_SPECS[c.kind].fields.map((f) => f.label.replace(/ \((%|\$)\)$/, '').toLowerCase()).join(' · ')}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 7, color: C.goldDim, marginTop: 6 }}>{SCENARIO_DISCLAIMER}</Text>
          </View>
        )}

        {/* FINDINGS — titled by the evidence; see reportHeadlines. */}
        <View style={s.section}>
          {dto.findings.length === 0 && (
            <Lead kicker="Section 04" title={dto.headlines.findings}>
              <Text style={s.body}>
                No high-priority revenue leaks were confirmed from public evidence. Remaining risk sits in areas a public audit cannot see — phone handling, follow-up, and repeat business — which we recommend validating directly.
              </Text>
            </Lead>
          )}
          {dto.findings.map((f, fi) => {
            // PAGINATION: BREAK BETWEEN BLOCKS, NEVER INSIDE ONE.
            //
            // The card was a single wrappable View, so a page break could land
            // anywhere — between a label and the text it introduces, or between
            // a finding's title and its first sentence. Each labelled block is
            // now kept whole, so a break always falls at a boundary a reader
            // can follow.
            //
            // CONTINUATION LABELS. A card long enough to span pages repeats its
            // own number and title at the top of each later page it reaches, so
            // a block arriving there says which finding it belongs to. Short
            // cards do not carry the label, because they cannot split.
            const blocks: { key: string; node: React.ReactNode }[] = [
              // The layers sit directly under the badge, so a STRONG EVIDENCE
              // badge is never read without what was and was not verified.
              ...(f.evidenceBasis
                ? [
                    {
                      key: 'basis',
                      node: (
                        <View style={{ borderWidth: 0.5, borderColor: C.line, borderRadius: 2, padding: 6, marginBottom: 6 }}>
                          {evidenceBasisRows(f.evidenceBasis).map(([label, text]) => (
                            <Text key={label} style={[s.body, { marginBottom: 1 }]}>
                              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{label}: </Text>
                              {text}
                            </Text>
                          ))}
                        </View>
                      ),
                    },
                  ]
                : []),
              {
                key: 'problem',
                node: (
                  <>
                    <Text style={[s.label]}>The business problem</Text>
                    <Text style={[s.body, { marginBottom: 6 }]}>{f.problem}</Text>
                  </>
                ),
              },
              {
                key: 'why',
                node: (
                  <>
                    <Text style={[s.label]}>Why it matters</Text>
                    <Text style={[s.body, { marginBottom: 6 }]}>{f.whyItMatters}</Text>
                  </>
                ),
              },
              {
                key: 'effect',
                node: (
                  <>
                    <Text style={[s.label]}>Potential commercial effect</Text>
                    <Text style={[s.body, { marginBottom: 6 }]}>{f.commercialEffect}</Text>
                  </>
                ),
              },
              {
                key: 'known',
                node: (
                  <>
                    <Text style={[s.label]}>What we know</Text>
                    {f.whatWeKnow.map((k, i) => (
                      <Text key={i} style={[s.body, { marginBottom: 2 }]}>•  {k}</Text>
                    ))}
                  </>
                ),
              },
              {
                key: 'unknown',
                node: (
                  <>
                    <Text style={[s.label, { marginTop: 5 }]}>What we do not yet know</Text>
                    <Text style={[s.body, { marginBottom: 6 }]}>{f.whatWeDoNotKnow}</Text>
                  </>
                ),
              },
              {
                key: 'action',
                node: (
                  <>
                    <Text style={[s.label]}>Recommended next action</Text>
                    <Text style={[s.body, { marginBottom: 8 }]}>{f.recommendedAction}</Text>
                    {/* A pointer only: no scenario figure is printed against a finding. */}
                    {f.scenarioKind && (
                      <Text style={[s.mutedText, { marginBottom: 4 }]}>
                        An optional calculator for this pathway is described in Section 03. It uses only figures you enter and is
                        not a measured loss, a forecast or a guaranteed recovery.
                      </Text>
                    )}
                    <View style={[s.row, { gap: 14, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6, marginTop: 8 }]}>
                    {[
                      ['Business impact', f.labels.businessImpact],
                      ['Urgency', f.labels.urgency],
                      ['Finding confidence', f.labels.findingConfidence],
                      ['Automation opportunity', f.labels.automationOpportunity],
                    ].map(([label, value]) => (
                      <View key={label}>
                        <Text style={{ fontSize: 6.5, letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase' }}>{label}</Text>
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.ink }}>{value}</Text>
                      </View>
                    ))}
                    </View>
                  </>
                ),
              },
            ];
            const maySpanPages = findingMaySpanPages(f);
            const titleRow = (
              <>
                <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }]}>
                  <Text style={{ fontFamily: 'Times-Bold', fontSize: 12, color: C.ink, flex: 1, paddingRight: 8 }}>
                    {f.number}. {f.title}
                  </Text>
                  <Text style={[s.badge, { color: classificationColor(f.classification), borderColor: classificationColor(f.classification) }]}>{f.classification}</Text>
                </View>
                <Text style={[s.mutedText, { marginBottom: 6 }]}>Customer journey stage: {f.journeyStage} · Priority: {f.labels.priority}</Text>
              </>
            );
            // The section heading travels with the first finding — see Lead.
            const heading = fi === 0 ? <SectionHeader kicker="Section 04" title={dto.headlines.findings} /> : null;
            if (!maySpanPages) {
              // A card that fits a page is placed whole, so it is never continued.
              return (
                <View key={f.number} style={{ marginBottom: 14 }} wrap={false}>
                  {heading}
                  <View style={[s.card, { marginBottom: 0 }]}>
                    {titleRow}
                    {blocks.map((block) => (
                      <View key={block.key}>{block.node}</View>
                    ))}
                  </View>
                </View>
              );
            }
            // A LONG CARD IS A STACK OF CARD-STYLED BLOCKS, NOT ONE BOX.
            //
            // As a single wrapping View the card drew its own border and fill on
            // every page it touched, so a fragment emptied by a page break still
            // left a blank box behind — and the heading could not be kept with
            // the card without being drawn inside it. Now the opening (title and
            // first block) is one unbreakable unit with the heading, and each
            // later block draws its own slice of the card, so a break can only
            // fall between blocks and never leaves an empty box.
            const id = `finding-${f.number}`;
            const [first, ...rest] = blocks;
            return (
              <React.Fragment key={f.number}>
                <View wrap={false}>
                  {heading}
                  <View style={cardSlice('top')}>
                    {titleRow}
                    {first.node}
                    <FirstPageMark id={id} ledger={continuationLedger} />
                  </View>
                </View>
                <View style={{ marginBottom: 14 }}>
                  <ContinuedLabel id={id} text={`${f.number}. ${f.title} — continued`} ledger={continuationLedger} />
                  {rest.map((block, bi) => (
                    <View key={block.key} wrap={false} style={cardSlice(bi === rest.length - 1 ? 'bottom' : 'middle')}>
                      {block.node}
                    </View>
                  ))}
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* VISUAL CUSTOMER JOURNEY */}
        <View style={s.section}>
          <Lead kicker="Section 05" title="Customer Journey Map">
          <Text style={[s.mutedText, { marginBottom: 4 }]}>Where guest friction clusters across the journey, from discovery to return.</Text>
          {/* Same legend, from the same DTO field, as the web report. */}
          <View style={{ marginBottom: 8 }}>
            {dto.journeyLegend.map(([label, meaning]) => (
              <Text key={label} style={{ fontSize: 7, color: C.muted, marginTop: 1 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: statusColor(label) }}>{label}</Text>
                {` — ${meaning}`}
              </Text>
            ))}
          </View>
          </Lead>
          {dto.journeyMap.map((stage, i) => (
            <View key={stage.stage} wrap={false}>
              <View style={[s.row, { alignItems: 'center', gap: 10 }]}>
                <Text style={{ width: 118, fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, textAlign: 'center', color: statusColor(stage.status), borderWidth: 0.75, borderColor: statusColor(stage.status), borderRadius: 2, paddingVertical: 3 }}>
                  {stage.status}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.ink }}>{stage.label}</Text>
                  <Text style={{ fontSize: 7.5, color: C.muted }}>{stage.note}</Text>
                  {/* The limitation travels with the observation — see the web report. */}
                  {stage.limitation ? (
                    <Text style={{ fontSize: 7, color: C.muted, fontStyle: 'italic' }}>{stage.limitation}</Text>
                  ) : null}
                </View>
              </View>
              {i < dto.journeyMap.length - 1 && <View style={{ marginLeft: 59, height: 6, borderLeftWidth: 0.75, borderLeftColor: C.line }} />}
            </View>
          ))}
        </View>

        {/* RANKED AI OPPORTUNITIES */}
        <View style={s.section}>
          {dto.rankedAiOpportunities.length === 0 ? (
            <Lead kicker="Section 06" title="AI Automation Opportunities">
            <Text style={s.body}>
              No automation is recommended from current public evidence. The strongest next step is completing the validation items in the 30-day plan; automation should follow demand, not precede it.
            </Text>
            </Lead>
          ) : (
            dto.rankedAiOpportunities.map((opp, oi) => (
              <View key={opp.rank} wrap={false}>
              {oi === 0 && (
                <>
                  <SectionHeader kicker="Section 06" title="AI Automation Opportunities" />
                  <Text style={[s.mutedText, { marginBottom: 8 }]}>{dto.aiOpportunitiesIntro}</Text>
                </>
              )}
              <View style={s.card}>
                <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }]}>
                  <Text style={{ fontFamily: 'Times-Bold', fontSize: 11.5, color: C.ink }}>#{opp.rank} · {opp.solutionCategory}</Text>
                  <Text style={[s.badge, { color: C.goldDim, borderColor: C.goldDim }]}>AUTOMATION FIT: {opp.fit}</Text>
                </View>
                <Text style={[s.mutedText, { marginBottom: 5, color: opp.requiresValidation ? C.amber : C.muted }]}>{opp.basis}</Text>
                <Text style={s.label}>Problem addressed</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.problemAddressed}</Text>
                <Text style={s.label}>Why it fits</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.whyItFits}</Text>
                <Text style={s.label}>What it can do</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.capabilities.join(' · ')}</Text>
                <Text style={s.label}>Validation before implementation</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.validationBeforeImplementation}</Text>
                <View style={[s.row, { gap: 16, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 5 }]}>
                  <View><Text style={s.label}>Complexity</Text><Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink }}>{opp.implementationComplexity}</Text></View>
                  <View style={{ flex: 1 }}><Text style={s.label}>Measurement</Text><Text style={{ fontSize: 8, color: C.muted }}>{opp.measurement.join(' · ')}</Text></View>
                </View>
              </View>
              </View>
            ))
          )}
        </View>

        {/* WINNERS BOOKMARK PRESCRIPTION */}
        <View style={s.section}>
          {[
            ['Diagnosis', dto.prescription.diagnosis, false],
            ['Validation', dto.prescription.validation, false],
            ['Prescription', dto.prescription.prescription, true],
          ].map(([label, text, highlight], pi) => (
            <View key={label as string} wrap={false}>
              {pi === 0 && <SectionHeader kicker="Section 07" title="Winnersbookmark Prescription" />}
              <View style={[s.card, highlight ? { borderColor: C.goldDim, backgroundColor: C.goldWash } : {}]}>
                <Text style={{ fontSize: 7.5, letterSpacing: 1.4, color: highlight ? C.goldDim : C.muted, textTransform: 'uppercase', marginBottom: 3 }}>{label as string}</Text>
                <Text style={s.body}>{text as string}</Text>
              </View>
            </View>
          ))}
          <View style={s.card} wrap={false}>
            <Text style={s.label}>Expected operational role</Text>
            {dto.prescription.expectedOperationalRole.map((r, i) => (
              <Text key={i} style={[s.body, { marginTop: 2 }]}>•  {r}</Text>
            ))}
          </View>
        </View>

        {/* DECISION BOX */}
        <View style={s.section} wrap={false}>
          <SectionHeader kicker="Section 08" title="The Decision" />
          <View style={[s.row, { gap: 8 }]}>
            {[
              [dto.decisionBox.doNothing.heading, dto.decisionBox.doNothing.detail, [['Risk', dto.decisionBox.doNothing.risk]], C.muted],
              [dto.decisionBox.validate.heading, dto.decisionBox.validate.detail, [['Cost', dto.decisionBox.validate.cost], ['Benefit', dto.decisionBox.validate.benefit]], C.goldDim],
              [dto.decisionBox.implement.heading, dto.decisionBox.implement.detail, [['Benefit', dto.decisionBox.implement.benefit]], C.green],
            ].map(([heading, detail, rows, accent]) => (
              <View key={heading as string} style={{ flex: 1, backgroundColor: C.softBg, borderWidth: 0.5, borderColor: C.line, borderTopWidth: 2, borderTopColor: accent as string, borderRadius: 3, padding: 10 }}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 11, color: accent as string, marginBottom: 4 }}>{heading as string}</Text>
                <Text style={{ fontSize: 8, color: C.ink, lineHeight: 1.4, marginBottom: 4 }}>{detail as string}</Text>
                {(rows as [string, string][]).map(([k, v]) => (
                  <Text key={k} style={{ fontSize: 7.5, color: C.muted, marginTop: 2 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink }}>{k}: </Text>{v}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* 30-DAY PLAN */}
        <View style={s.section}>
          {dto.thirtyDayPlan.map((phase, pi) => (
            <View key={phase.phase} style={{ marginBottom: 10 }} wrap={false}>
              {pi === 0 && <SectionHeader kicker="Section 09" title="30-Day Restaurant Rescue Plan" />}
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1.6, color: C.goldDim }}>
                {phase.phase} — {phase.heading}
              </Text>
              {phase.actions.map((a, i) => (
                <Text key={i} style={[s.body, { marginTop: 3 }]}>•  {a}</Text>
              ))}
            </View>
          ))}
        </View>

        {/* CTA + QR */}
        <View style={s.section} wrap={false}>
          <View style={{ backgroundColor: C.obsidian, borderRadius: 4, padding: 20 }}>
            <View style={[s.row, { alignItems: 'center', gap: 18 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 15, color: C.gold, marginBottom: 5 }}>{dto.cta.headline}</Text>
                <Text style={{ fontSize: 9, color: C.ivory, lineHeight: 1.4, marginBottom: 10 }}>{dto.cta.subtext}</Text>
                <Text style={{ fontSize: 9.5, color: C.ivory, fontFamily: 'Helvetica-Bold' }}>{dto.cta.consultantName} · {dto.cta.company}</Text>
                <Text style={{ fontSize: 9, color: '#b8b0a2', marginTop: 2 }}>
                  {dto.cta.phone}{dto.cta.email ? ` · ${dto.cta.email}` : ''}
                </Text>
                {!dto.cta.qrDataUrl && dto.cta.bookingUrl && (
                  <Text style={{ fontSize: 8.5, color: C.gold, marginTop: 4 }}>{dto.cta.bookingUrl}</Text>
                )}
                {!dto.cta.qrDataUrl && !dto.cta.bookingUrl && (
                  <Text style={{ fontSize: 8.5, color: '#b8b0a2', marginTop: 6 }}>{dto.cta.fallbackText}</Text>
                )}
              </View>
              {dto.cta.qrDataUrl && (
                <View style={{ alignItems: 'center' }}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={dto.cta.qrDataUrl} style={{ width: 96, height: 96, backgroundColor: C.paper, padding: 4, borderRadius: 3 }} />
                  <Text style={{ fontSize: 6.5, letterSpacing: 1, color: '#9a9080', textTransform: 'uppercase', marginTop: 4 }}>Scan to book</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* METHODOLOGY */}
        <View style={s.section}>
          <Lead kicker="Section 10" title="Methodology & Limitations">
            {dto.methodologyAndLimitations.slice(0, 2).map((line, i) => (
              <Text key={i} style={[s.body, { marginBottom: 4 }]}>•  {line}</Text>
            ))}
          </Lead>
          {dto.methodologyAndLimitations.slice(2).map((line, i) => (
            <Text key={i} style={[s.body, { marginBottom: 4 }]}>•  {line}</Text>
          ))}
        </View>

        {/* APPENDIX */}
        <View style={s.section}>
          <Lead kicker="Appendix" title="Full Evidence Chain">
          <Text style={[s.mutedText, { marginBottom: 4 }]}>
            Every material claim in this report traces to the evidence below, collected from publicly accessible pages on the audit date.
          </Text>
          {/*
            * PROVENANCE AT THE HEAD OF THE CHAIN, NOT TRAILING AFTER IT.
            *
            * This line used to sit after the evidence list. A single short Text
            * following a variable-length list orphans: with the appendix ending
            * near a page boundary it was pushed onto a page of its own, which
            * then carried nothing but this line and the running footer. It
            * identifies the evidence chain, so the head of the chain is where
            * it belongs, and there it cannot be separated from anything.
            */}
          <Text style={{ fontSize: 6.8, color: C.muted, marginBottom: 4, letterSpacing: 0.5 }}>
            {dto.valueSignals.confidentialityNote} · Prepared for {dto.valueSignals.preparedFor} by {dto.valueSignals.preparedBy} · Audit {dto.valueSignals.auditId} · {dto.valueSignals.auditDate}
          </Text>
          {/* Same rubric as the web report, laid out the same way — one
            * introductory sentence, then the bands as their own lines. As a
            * single concatenated string it read as an unscannable block. */}
          </Lead>
          {/* The rubric is its own unit, so a heading near the foot of a page
            * needs room only for its introduction, not for the whole rubric. */}
          <View style={{ marginBottom: 8 }} wrap={false}>
            <Text style={[s.mutedText, { marginBottom: 2 }]}>{CONFIDENCE_EXPLANATION}</Text>
            {dto.confidenceBands.map(([label, definition]) => (
              <Text key={label} style={[s.mutedText, { marginTop: 1 }]}>
                <Text style={{ color: C.goldDim }}>{label}</Text>
                {` — ${definition}`}
              </Text>
            ))}
            <Text style={[s.mutedText, { marginTop: 3 }]}>{FINDING_CLASSIFICATION_NOTE}</Text>
          </View>
          {/*
            * Rows travel in groups of three.
            *
            * One row per block let the LAST row strand on a page of its own:
            * the pagination test caught a final page carrying evidence item 22
            * and the running footer, and nothing else. Grouping moves the break
            * to a group boundary, so a page that starts the tail of the
            * appendix carries several rows rather than one. Three rows is a
            * small fraction of a page, so a group never exceeds one.
            */}
          {chunk(dto.appendix, 3).map((group, gi) => (
            <View key={gi} wrap={false}>
              {group.map((e, i) => (
                <View key={i} style={{ borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 8.5, color: C.ink }}>{e.fact}</Text>
                  {e.supportingContext ? (
                    <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 2 }}>{e.supportingContext}</Text>
                  ) : null}
                  <Text style={{ fontSize: 6.8, color: C.muted, marginTop: 1 }}>
                    {e.evidenceLabel}
                    {e.sourceUrl ? ` · ${e.sourceUrl.length > 90 ? `${e.sourceUrl.slice(0, 90)}…` : e.sourceUrl}` : ''}
                    {/* Label only — see the note on the web report's appendix. */}
                    {` · confidence: ${e.confidenceLabel}`}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
