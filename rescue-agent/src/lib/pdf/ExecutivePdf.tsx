import React from 'react';
import { Document, Font, Page, Text, View, Image, Link, StyleSheet } from '@react-pdf/renderer';
import { classificationCounters, classificationIntro, type ExecutiveReportDTO } from '@/lib/reports/executive';
import { evidenceBasisRows } from '@/lib/audit/evidenceBasis';
import { pdfHyphenation, wrapAddressesDeep, wrapLongAddresses } from '@/lib/pdf/hyphenation';

/**
 * The link target for an address printed in the PDF: the recorded value itself
 * when it is an absolute http(s) address, otherwise null (printed, not linked).
 * Never rewritten — no scheme is added or changed, so a link opens exactly the
 * address the audit recorded.
 */
export function webHref(value: string | null | undefined): string | null {
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}
/**
 * CHARACTERS THE PDF FONTS CANNOT DRAW, REPLACED FOR PRINT ONLY.
 *
 * The PDF uses the standard Helvetica and Times faces, which have no arrow. The
 * audit records example links as 'Example link text: "Menu" → https://…', and
 * in the export the arrow printed as a stray mark ('"Menu" ' https://…') on
 * every such appendix line — 276 times across the 85 locally stored audits,
 * and the only undrawable character found in them. The web report draws the
 * arrow and keeps it; the stored evidence is not changed.
 */
const PDF_SUBSTITUTES: [RegExp, string][] = [
  [/\u2192/g, '->'],
  [/\u2190/g, '<-'],
];
export function pdfDrawableDeep<T>(value: T): T {
  if (typeof value === 'string') return PDF_SUBSTITUTES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value as string) as T;
  if (Array.isArray(value)) return value.map((item) => pdfDrawableDeep(item)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, pdfDrawableDeep(item)])) as T;
  }
  return value;
}
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

/** The continuation line of a finding card: a slice of the card (fill and side rules, no vertical padding). */
// Padded above and below so that, opening a page, it does not touch the top of
// the card slice or crowd the block beneath it. The padding is drawn (as card
// fill) where the label is hidden too: a single line's height is reserved for
// the label in every layout pass, so a taller label would cost every card that
// space and push pages onto further pages.
const CARD_CONTINUED_STYLE = { fontSize: 6.5, letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase' as const, backgroundColor: C.softBg, borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: C.line, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 2 };
/** The continuation line of a plain section (Methodology, Appendix): no fill, no padding. */
const SECTION_CONTINUED_STYLE = { fontSize: 6.5, letterSpacing: 1.2, color: C.goldDim, textTransform: 'uppercase' as const };

function ContinuedLabel({ id, text, ledger, variant = 'card' }: { id: string; text: string; ledger: ContinuationLedger; variant?: 'card' | 'section' }) {
  // Where it is empty (a block's first page) the section variant has no height
  // and draws nothing; the card variant keeps only its padding, as card fill.
  return (
    <Text
      fixed
      style={variant === 'card' ? CARD_CONTINUED_STYLE : SECTION_CONTINUED_STYLE}
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

/**
 * Split a list into groups of `size`, so a page break falls between groups.
 *
 * A short final group is merged into the one before it. Fixed groups of three
 * left 22 appendix rows as 7×3 + 1, and once the appendix type was enlarged
 * that single row was carried onto a page of its own. The final group now holds
 * between `size` and 2×`size`−1 rows, so the last page can never carry one.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  if (groups.length > 1 && groups[groups.length - 1].length < size) {
    const last = groups.pop()!;
    groups[groups.length - 1] = [...groups[groups.length - 1], ...last];
  }
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
/** Prescription cards: s.card with slightly less padding and spacing. */
const PRESCRIPTION_CARD = { padding: 11, marginBottom: 9 };

/**
 * Whether a 30-day plan phase is short enough to keep on one page. A short
 * phase moves whole; a long one may break between its bullets (see the plan
 * section). Characters, not measured height, for the same reason as
 * findingMaySpanPages: 700 characters is roughly eight lines of body text.
 */
/** Bullets that always travel together at the end of Methodology & Limitations. */
export const METHODOLOGY_TAIL = 3;

/**
 * Items as page-break units: one unit per item, except the last `tail`, which
 * form one unit — so a page break can never carry a single item over on its own.
 */
export function tailGroups<T>(items: T[], tail: number): T[][] {
  const tailStart = Math.max(0, items.length - tail);
  return [...items.slice(0, tailStart).map((item) => [item]), ...(tailStart < items.length ? [items.slice(tailStart)] : [])];
}

/** The methodology bullets after the two kept with the heading, as page-break units (see tailGroups). */
export function methodologyGroups(lines: string[]): string[][] {
  return tailGroups(lines, METHODOLOGY_TAIL);
}

export function planPhaseStaysWhole(phase: { actions: string[] }): boolean {
  return phase.actions.join(' ').length <= 700;
}

/**
 * FINDING CARDS: A SHORT CARD STAYS WHOLE; A TALLER ONE NEVER LEAVES A FRAGMENT.
 *
 * The decision used to be a character count (more than 1,400 characters of
 * card text), and a "long" card could break after ANY block. In the Leverock's
 * PDF the private-event finding (about 500pt on a 676pt page) was cut after its
 * first block: its title and one paragraph sat at the foot of page 6, the rest
 * opened page 7 under a continuation label, and the next card could not fit
 * beneath it, so most of page 7 was empty.
 *
 * Two simpler rules were tried on the 85 locally stored audits and rejected:
 * holding every card that fits whole (a short card followed by a tall one left
 * half a page blank; 28 reports gained a page), and breaking a card only at its
 * middle (still left 40% of a page blank where a slightly smaller first part
 * would have fitted).
 *
 * So each card's height is ESTIMATED, block by block, in points, and:
 *  - a short card (at most SHORT_CARD) is one unbreakable unit;
 *  - a taller card opens with an unbreakable unit holding its title and enough
 *    blocks to make up MIN_PART of it, and closes with an unbreakable unit of
 *    at least the same share; the blocks between may each start a new page. A
 *    page therefore never ends on a card's title and one paragraph, and never
 *    starts with a lone last block: each side of a break carries a real part
 *    of the card, and every later page names it ("— continued").
 *
 * The estimate must never fall short: an unbreakable block taller than the page
 * is not split by the layout engine, it runs off the bottom of the page and its
 * last lines are lost (react-pdf warns "can't wrap between pages and it's bigger
 * than available page height"). So every measure rounds up — wider glyphs than
 * Helvetica draws, a partly filled last line on every paragraph, a fixed
 * allowance for each label — and a unit is held together only with 40pt of the
 * page to spare; a card whose opening or closing unit would not fit falls back
 * to breaking between any blocks. Calibrated on rendered Leverock's cards
 * (actual 440–532pt; estimated 11–18% above) and held by a test that renders
 * cards either side of the boundary and fails on that warning (it fails if the
 * budget is removed).
 */
/** Usable height of a body page: Letter (792pt) less the top and bottom padding of s.page. */
export const PAGE_CONTENT_HEIGHT = 792 - 52 - 64;
/** An unbreakable unit is used only if its estimate leaves this much of the page spare. */
const UNIT_BUDGET = PAGE_CONTENT_HEIGHT - 40;
/** A card no taller than about half a page (estimated) is never broken: each part would be under a quarter page. */
export const SHORT_CARD = 340;
/** The least share of a broken card on either side of the break… */
export const MIN_PART = 0.4;
/** …and never less than this many points. */
const MIN_PART_POINTS = 180;
/** The Section 04 heading travels with the first card (SectionHeader: kicker, title, rule). */
export const SECTION_HEADER_HEIGHT = 50;
/** The continuation label over a card's second half: one line of 6.5pt type and its padding. */
const CONTINUATION_LINE = 15;
/** Text width inside a finding card: page width less page padding, card padding and borders. */
const CARD_TEXT_WIDTH = 612 - 2 * 52 - 2 * 14 - 1;

/** Lines a paragraph needs at `fontSize`, assuming wider-than-average glyphs and an underfilled last line. */
function estimatedLines(text: string, fontSize: number, width = CARD_TEXT_WIDTH, emPerChar = 0.5): number {
  const perLine = Math.max(1, Math.floor((width / (fontSize * emPerChar)) * 0.92));
  return text
    .split('\n')
    .reduce((n, paragraph) => n + Math.max(1, Math.ceil(paragraph.length / perLine)), 0);
}

type Finding = ExecutiveReportDTO['findings'][number];
/** Estimated heights of a card's parts: its head (padding, title, stage line), each block in render order, its foot. */
export interface FindingParts {
  head: number;
  blocks: { key: string; height: number }[];
  foot: number;
}

/** Estimated height in points of each part of a finding card as rendered below, rounded up on purpose. */
export function estimatedFindingParts(finding: Finding): FindingParts {
  const BODY = 9.5 * 1.5; // s.body line
  const MUTED = 8.5 * 1.4; // s.mutedText line
  const LABEL = 7 * 1.25 + 2; // s.label and its margin
  const body = (text: string) => estimatedLines(text, 9.5) * BODY;
  // Title row beside the classification badge, then the stage line.
  const badgeWidth = finding.classification.length * 7 * 0.72 + 14;
  const head =
    14 + 0.5 +
    Math.max(estimatedLines(`${finding.number}. ${finding.title}`, 12, CARD_TEXT_WIDTH - badgeWidth - 8, 0.52) * 12 * 1.25, 16) + 6 +
    estimatedLines(`Customer journey stage: ${finding.journeyStage} · Priority: ${finding.labels.priority}`, 8.5) * MUTED + 6;
  const blocks: { key: string; height: number }[] = [];
  if (finding.evidenceBasis) {
    blocks.push({
      key: 'basis',
      height: 12 + 1 + 6 + evidenceBasisRows(finding.evidenceBasis).reduce((n, [label, text]) => n + estimatedLines(`${label}: ${text}`, 9.5, CARD_TEXT_WIDTH - 13) * BODY + 1, 0),
    });
  }
  blocks.push({ key: 'problem', height: LABEL + body(finding.problem) + 6 });
  blocks.push({ key: 'why', height: LABEL + body(finding.whyItMatters) + 6 });
  if (finding.commercialEffect) blocks.push({ key: 'effect', height: LABEL + body(finding.commercialEffect) + 6 });
  if (finding.whatWeKnow.length > 0) blocks.push({ key: 'known', height: LABEL + finding.whatWeKnow.reduce((n, k) => n + body(`•  ${k}`) + 2, 0) });
  blocks.push({ key: 'unknown', height: 5 + LABEL + body(finding.whatWeDoNotKnow) + 6 });
  // Label grid: six label/value pairs that wrap, each row about 19pt plus the row gap.
  const pairs: [string, string][] = [
    ['Business impact', finding.labels.businessImpact],
    ['Urgency', finding.labels.urgency],
    ['Finding confidence', finding.labels.findingConfidence],
    ['Observed evidence', finding.labels.observedEvidence],
    ['Customer outcome', finding.labels.customerOutcome],
    ['Automation opportunity', finding.labels.automationOpportunity],
  ];
  const gridWidth = pairs.reduce((w, [label, value]) => w + Math.max(label.length * 6.5 * 0.72 + label.length * 0.8, String(value).length * 8.5 * 0.62) + 14, 0);
  blocks.push({
    key: 'action',
    height: LABEL + body(finding.recommendedAction) + 8 + (finding.scenarioKind ? 2 * MUTED + 4 : 0) + 8 + 6 + 0.5 + Math.ceil(gridWidth / CARD_TEXT_WIDTH) * 23,
  });
  return { head: Math.ceil(head), blocks: blocks.map((b) => ({ ...b, height: Math.ceil(b.height) })), foot: 14 + 1 };
}

/** Estimated height in points of a whole finding card. */
export function estimatedFindingHeight(finding: Finding): number {
  const { head, blocks, foot } = estimatedFindingParts(finding);
  return head + blocks.reduce((n, b) => n + b.height, 0) + foot;
}

/**
 * How a finding card is laid out (see the note above). `withHeading` is true
 * for the first card, which carries the Section 04 heading in its first unit.
 *  - whole: one unbreakable unit.
 *  - units: unbreakable groups of consecutive blocks, `groups` giving how many
 *    blocks each holds, in order; a page may break only between groups.
 */
export type FindingLayout = { kind: 'whole' } | { kind: 'units'; groups: number[] };

export function findingLayout(finding: Finding, withHeading = false): FindingLayout {
  const { head, blocks, foot } = estimatedFindingParts(finding);
  const heading = withHeading ? SECTION_HEADER_HEIGHT : 0;
  const card = head + blocks.reduce((n, b) => n + b.height, 0) + foot;
  if (card <= SHORT_CARD && heading + card <= UNIT_BUDGET) return { kind: 'whole' };
  const n = blocks.length;
  if (n < 2) return { kind: 'units', groups: [n] };
  const minPart = Math.max(MIN_PART_POINTS, card * MIN_PART);
  // Opening: the head and the fewest blocks that reach minPart (at least one block).
  let open = 1;
  while (open < n - 1 && head + blocks.slice(0, open).reduce((t, b) => t + b.height, 0) < minPart) open++;
  // Closing: the fewest final blocks that reach minPart, not reaching into the opening.
  let close = n - 1;
  while (close > open && blocks.slice(close).reduce((t, b) => t + b.height, 0) + foot < minPart) close--;
  const groups = [open, ...Array.from({ length: close - open }, () => 1), n - close];
  const sizes = groups.map((size, i) => {
    const start = groups.slice(0, i).reduce((t, g) => t + g, 0);
    const body = blocks.slice(start, start + size).reduce((t, b) => t + b.height, 0);
    return i === 0 ? heading + head + body : CONTINUATION_LINE + body + (i === groups.length - 1 ? foot : 0);
  });
  if (sizes.every((h) => h <= UNIT_BUDGET)) return { kind: 'units', groups };
  // An opening or closing too tall for a page: break between any blocks.
  return { kind: 'units', groups: blocks.map(() => 1) };
}

/** Whether a finding card may break across pages (anything but one unbreakable unit). */
export function findingMaySpanPages(finding: Finding, withHeading = false): boolean {
  return findingLayout(finding, withHeading).kind !== 'whole';
}

function classificationColor(classification: string): string {
  if (classification === 'VERIFIED FINDING') return C.green;
  if (classification === 'STRONG EVIDENCE') return C.green;
  if (classification === 'MANUAL VALIDATION REQUIRED' || classification === 'VALIDATION REQUIRED') return C.amber;
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

// Web and email addresses are never hyphenated: a printed hyphen changes the
// address a reader copies. See hyphenation.ts.
Font.registerHyphenationCallback(pdfHyphenation);

export function ExecutivePdf({ dto: report }: { dto: ExecutiveReportDTO }) {
  // An address longer than a line is broken after its own separators before
  // layout, so it neither runs off the page nor gains a hyphen.
  const dto = wrapAddressesDeep(pdfDrawableDeep(report));
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
              {/* The audited website, linked to the address as recorded (see webHref). */}
              {webHref(report.cover.websiteUrl) ? (
                <Link src={webHref(report.cover.websiteUrl)!} style={{ color: '#b8b0a2', textDecoration: 'none' }}>{dto.cover.websiteUrl}</Link>
              ) : (
                dto.cover.websiteUrl
              )}
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
            {/* Keyed by term AND definition: weight rows share terms ("15%" for three categories). */}
            {section.rows?.map(([term, definition]) => (
              <Text key={`${term} ${definition}`} style={[s.mutedText, { marginBottom: 1 }]}>
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
              // Omitted when empty, as on the web report: a finding whose
              // evidence layers already say "Not measured" carries no separate
              // effect section, and one with nothing further to add carries
              // no "What we know".
              ...(f.commercialEffect
                ? [
                    {
                      key: 'effect',
                      node: (
                        <>
                          <Text style={[s.label]}>Potential commercial effect</Text>
                          <Text style={[s.body, { marginBottom: 6 }]}>{f.commercialEffect}</Text>
                        </>
                      ),
                    },
                  ]
                : []),
              ...(f.whatWeKnow.length > 0
                ? [
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
                  ]
                : []),
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
                    {/* Wraps: six labels do not fit one line of a card. */}
                    <View style={[s.row, { flexWrap: 'wrap', columnGap: 14, rowGap: 4, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6, marginTop: 8 }]}>
                    {[
                      ['Business impact', f.labels.businessImpact],
                      ['Urgency', f.labels.urgency],
                      ['Finding confidence', f.labels.findingConfidence],
                      // What was observed, and what customers did, rated separately.
                      ['Observed evidence', f.labels.observedEvidence],
                      ['Customer outcome', f.labels.customerOutcome],
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
            const layout = findingLayout(f, fi === 0);
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
            if (layout.kind === 'whole') {
              // A short card is placed whole, so it is never continued.
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
            const continued = <ContinuedLabel id={id} text={`${f.number}. ${f.title} — continued`} ledger={continuationLedger} />;
            // UNBREAKABLE GROUPS OF BLOCKS (see findingLayout). The opening
            // group travels with the heading; each later group draws its own
            // slice of the card, so a break can only fall between groups and
            // never leaves an empty box; the label names the card on every page
            // after its first.
            const groupStarts = layout.groups.map((_, gi) => layout.groups.slice(0, gi).reduce((t, g) => t + g, 0));
            const [opening, ...later] = layout.groups.map((size, gi) => blocks.slice(groupStarts[gi], groupStarts[gi] + size));
            return (
              <React.Fragment key={f.number}>
                <View wrap={false}>
                  {heading}
                  <View style={cardSlice('top')}>
                    {titleRow}
                    {opening.map((block) => (
                      <View key={block.key}>{block.node}</View>
                    ))}
                    <FirstPageMark id={id} ledger={continuationLedger} />
                  </View>
                </View>
                <View style={{ marginBottom: 14 }}>
                  {continued}
                  {later.map((group, gi) => (
                    <View key={group[0].key} wrap={false} style={cardSlice(gi === later.length - 1 ? 'bottom' : 'middle')}>
                      {group.map((block) => (
                        <View key={block.key}>{block.node}</View>
                      ))}
                    </View>
                  ))}
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* VISUAL CUSTOMER JOURNEY AND AI OPPORTUNITIES: PAGE-LEVEL SIBLINGS.
          *
          * Each of these two sections sat inside its own wrapping section View.
          * When the journey map ran onto a further page, the AI Opportunities
          * section's View then started a page late (the react-pdf behaviour
          * described at Section 02): four of the 85 locally stored audits
          * printed a page holding nothing but the last journey stage. As
          * page-level siblings, with the section margin as a spacer, Section 06
          * follows the journey map on the same page.
          */}
        {(() => {
          const stageRow = (stage: (typeof dto.journeyMap)[number], i: number) => (
            <View>
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
          );
          return (
            <>
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
                  {stageRow(stage, i)}
                </View>
              ))}
              {/* The section's bottom margin, as a spacer: harmless at a page break. */}
              <View style={{ height: 22 }} />
            </>
          );
        })()}

        {/* RANKED AI OPPORTUNITIES — page-level siblings, see the note at Section 05. */}
        <>
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
                  <Text style={[s.badge, { color: C.goldDim, borderColor: C.goldDim }]}>{opp.exploratory ? `EXPLORATORY · ${opp.fit} FIT` : `AUTOMATION FIT: ${opp.fit}`}</Text>
                </View>
                <Text style={[s.mutedText, { marginBottom: 5, color: opp.requiresValidation ? C.amber : C.muted }]}>{opp.basis}</Text>
                <Text style={s.label}>Problem addressed</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.problemAddressed}</Text>
                <Text style={s.label}>Why it fits</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.whyItFits}</Text>
                <Text style={s.label}>What it can do</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.capabilities.join(' · ')}</Text>
                <Text style={s.label}>{opp.exploratory ? 'What to check first' : 'Validation before implementation'}</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.validationBeforeImplementation}</Text>
                <View style={[s.row, { gap: 16, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 5 }]}>
                  <View><Text style={s.label}>Complexity</Text><Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink }}>{opp.implementationComplexity}</Text></View>
                  <View style={{ flex: 1 }}><Text style={s.label}>Measurement</Text><Text style={{ fontSize: 8, color: C.muted }}>{opp.measurement.join(' · ')}</Text></View>
                </View>
              </View>
              </View>
            ))
          )}
        <View style={{ height: 22 }} />
        </>

        {/* WINNERS BOOKMARK PRESCRIPTION */}
        <View style={s.section}>
          {[
            ['Diagnosis', dto.prescription.diagnosis, false],
            ['Validation', dto.prescription.validation, false],
            ['Prescription', dto.prescription.prescription, true],
          ].map(([label, text, highlight], pi) => (
            <View key={label as string} wrap={false}>
              {pi === 0 && <SectionHeader kicker="Section 07" title="Winnersbookmark Prescription" />}
              {/* Slightly tighter than s.card: four stacked cards at full padding pushed the Decision box off the page. */}
              <View style={[s.card, PRESCRIPTION_CARD, highlight ? { borderColor: C.goldDim, backgroundColor: C.goldWash } : {}]}>
                <Text style={{ fontSize: 7.5, letterSpacing: 1.4, color: highlight ? C.goldDim : C.muted, textTransform: 'uppercase', marginBottom: 3 }}>{label as string}</Text>
                <Text style={s.body}>{text as string}</Text>
                {/* Observed versus requires-owner-confirmation, as separate lines. */}
                {pi === 0 && dto.prescription.diagnosisBasis.map((row) => (
                  <Text key={row.label} style={[s.body, { marginTop: 3 }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>{row.label}: </Text>
                    {row.text}
                  </Text>
                ))}
              </View>
            </View>
          ))}
          <View style={[s.card, PRESCRIPTION_CARD]} wrap={false}>
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
              <View key={heading as string} style={{ flex: 1, backgroundColor: C.softBg, borderWidth: 0.5, borderColor: C.line, borderTopWidth: 2, borderTopColor: accent as string, borderRadius: 3, paddingVertical: 8, paddingHorizontal: 10 }}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 11, color: accent as string, marginBottom: 3 }}>{heading as string}</Text>
                <Text style={{ fontSize: 8, color: C.ink, lineHeight: 1.35, marginBottom: 3 }}>{detail as string}</Text>
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
          {/*
            * A PHASE MAY BREAK BETWEEN ITS BULLETS, NOT INSIDE ONE.
            *
            * Each phase was one unbreakable block. A long Days 8–14 phase that
            * did not fit under the Decision box moved the whole plan to the
            * next page and left the bottom third of the previous one empty.
            * The section header, the phase title and its first bullet stay
            * together, so no title is stranded at the foot of a page; each
            * further bullet is its own unit, so no bullet is split. A short
            * phase stays whole, so its last bullet cannot be orphaned onto the
            * next page.
            */}
          {dto.thirtyDayPlan.map((phase, pi) => (
            <View key={phase.phase} style={{ marginBottom: pi === dto.thirtyDayPlan.length - 1 ? 0 : 10 }} wrap={!planPhaseStaysWhole(phase)}>
              <View wrap={false}>
                {pi === 0 && <SectionHeader kicker="Section 09" title="30-Day Restaurant Rescue Plan" />}
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1.6, color: C.goldDim }}>
                  {phase.phase} — {phase.heading}
                </Text>
                {phase.actions.slice(0, 1).map((a, i) => (
                  <Text key={i} style={[s.body, { marginTop: 3 }]}>•  {a}</Text>
                ))}
              </View>
              {phase.actions.slice(1).map((a, i) => (
                <View key={i} wrap={false}>
                  <Text style={[s.body, { marginTop: 3 }]}>•  {a}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* CTA + QR. The space below it is a separate spacer rather than the
          * block's own bottom margin: react-pdf counts a margin when deciding
          * whether an unbreakable block fits, so a CTA that fitted the foot of
          * a page by its own height was still moved over, leaving the page a
          * fifth empty. A spacer at a page break is harmless. */}
        <View wrap={false}>
          <View style={{ backgroundColor: C.obsidian, borderRadius: 4, paddingVertical: 16, paddingHorizontal: 20 }}>
            <View style={[s.row, { alignItems: 'center', gap: 18 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 15, color: C.gold, marginBottom: 5 }}>{dto.cta.headline}</Text>
                <Text style={{ fontSize: 9, color: C.ivory, lineHeight: 1.4, marginBottom: 7 }}>{dto.cta.subtext}</Text>
                <Text style={{ fontSize: 9.5, color: C.ivory, fontFamily: 'Helvetica-Bold' }}>{dto.cta.consultantName} · {dto.cta.company}</Text>
                <Text style={{ fontSize: 9, color: '#b8b0a2', marginTop: 2 }}>
                  {/* A tel: link, so the number can be tapped in a PDF viewer on a phone. */}
                  {dto.cta.phoneHref
                    ? <Link src={dto.cta.phoneHref} style={{ color: C.gold, textDecoration: 'none' }}>{dto.cta.phone}</Link>
                    : dto.cta.phone}
                  {dto.cta.email ? ` · ${dto.cta.email}` : ''}
                </Text>
                {!dto.cta.qrDataUrl && dto.cta.bookingUrl && (
                  <Text style={{ fontSize: 8.5, color: C.gold, marginTop: 4 }}>
                    {webHref(report.cta.bookingUrl) ? (
                      <Link src={webHref(report.cta.bookingUrl)!} style={{ color: C.gold, textDecoration: 'none' }}>{dto.cta.bookingUrl}</Link>
                    ) : (
                      dto.cta.bookingUrl
                    )}
                  </Text>
                )}
                {!dto.cta.qrDataUrl && !dto.cta.bookingUrl && (
                  <Text style={{ fontSize: 8.5, color: '#b8b0a2', marginTop: 4 }}>{dto.cta.fallbackText}</Text>
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
        <View style={{ height: 22 }} />

        {/* METHODOLOGY */}
        {/*
          * NO STRANDED BULLET, AND A CONTINUATION SAYS WHAT IT CONTINUES.
          *
          * The bullets after the first two flowed one by one, so the last
          * bullet alone could be carried over and printed above the Appendix
          * heading with nothing saying which section it belonged to (Leverock's,
          * page 13). Now the heading keeps the first two bullets, the last
          * METHODOLOGY_TAIL bullets travel as one unit, and a later page opens
          * with "Methodology & Limitations — continued". The section is not held
          * whole: as one unbreakable block it moved to the next page and left
          * the bottom of the page above it empty.
          */}
        <View style={s.section}>
          <Lead kicker="Section 10" title="Methodology & Limitations">
            {dto.methodologyAndLimitations.slice(0, 2).map((line, i) => (
              <Text key={i} style={[s.body, { marginBottom: 4 }]}>•  {line}</Text>
            ))}
            <FirstPageMark id="methodology" ledger={continuationLedger} />
          </Lead>
          {dto.methodologyAndLimitations.length > 2 && (
            <View>
              <ContinuedLabel id="methodology" text="Section 10 · Methodology & Limitations — continued" ledger={continuationLedger} variant="section" />
              {methodologyGroups(dto.methodologyAndLimitations.slice(2)).map((group, gi) => (
                <View key={gi} wrap={false}>
                  {group.map((line, i) => (
                    <Text key={i} style={[s.body, { marginBottom: 4 }]}>•  {line}</Text>
                  ))}
                </View>
              ))}
            </View>
          )}
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
          <Text style={{ fontSize: 7.5, color: C.muted, marginBottom: 4, letterSpacing: 0.5 }}>
            {dto.valueSignals.confidentialityNote} · Prepared for {dto.valueSignals.preparedFor} by {dto.valueSignals.preparedBy} · Audit {dto.valueSignals.auditId} · {dto.valueSignals.auditDate}
          </Text>
          <FirstPageMark id="appendix" ledger={continuationLedger} />
          {/* Same rubric as the web report, laid out the same way — one
            * introductory sentence, then the bands as their own lines. As a
            * single concatenated string it read as an unscannable block. */}
          </Lead>
          {/* The rubric is its own unit, so a heading near the foot of a page
            * needs room only for its introduction, not for the whole rubric. */}
          {/* Each paragraph of the rubric is its own unit, so the rubric may
            * break between paragraphs but never inside one. As one unbreakable
            * block it moved to the next page whole and left the foot of the
            * page above it empty. */}
          <View style={{ marginBottom: 8 }}>
            <Text style={[s.mutedText, { marginBottom: 2 }]} wrap={false}>{CONFIDENCE_EXPLANATION}</Text>
            {dto.confidenceBands.map(([label, definition]) => (
              <Text key={label} style={[s.mutedText, { marginTop: 1 }]} wrap={false}>
                <Text style={{ color: C.goldDim }}>{label}</Text>
                {` — ${definition}`}
              </Text>
            ))}
            <Text style={[s.mutedText, { marginTop: 3 }]} wrap={false}>{FINDING_CLASSIFICATION_NOTE}</Text>
          </View>
          {/*
            * Rows travel in groups of two (see chunk: a short final group joins
            * the one before it, so the last page always carries two or three).
            *
            * One row per block let the LAST row strand on a page of its own:
            * the pagination test caught a final page carrying evidence item 22
            * and the running footer, and nothing else. Grouping moves the break
            * to a group boundary, so a page that starts the tail of the
            * appendix carries several rows rather than one. A group is a
            * small fraction of a page, so a group never exceeds one.
            */}
          <View>
            <ContinuedLabel id="appendix" text="Appendix · Full Evidence Chain — continued" ledger={continuationLedger} variant="section" />
            {chunk(dto.appendix, 2).map((group, gi) => (
              <View key={gi} wrap={false}>
                {group.map((e, i) => {
                  // The address exactly as recorded: wrapAddressesDeep only
                  // inserted line breaks into the copy laid out on the page.
                  const recorded = e.sourceUrl ? e.sourceUrl.replace(/\n/g, '') : null;
                  const href = webHref(recorded);
                  const printed = recorded ? wrapLongAddresses(recorded) : null;
                  return (
                    <View key={i} style={{ borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 3 }}>
                      {/* Appendix type sizes: 9 / 8.5 / 7.5 (were 8.5 / 7.5 / 6.8, too small to read printed). */}
                      <Text style={{ fontSize: 9, color: C.ink, lineHeight: 1.35 }}>{e.fact}</Text>
                      {e.supportingContext ? (
                        <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 1, lineHeight: 1.3 }}>{e.supportingContext}</Text>
                      ) : null}
                      {/* Extra leading only when the address runs onto a second line, so its two lines do not touch. */}
                      <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 1, ...(printed?.includes('\n') ? { lineHeight: 1.35 } : {}) }}>
                        {e.evidenceLabel}
                        {/*
                          * THE SOURCE ADDRESS IN FULL, AND CLICKABLE.
                          *
                          * It was cut to 90 characters with an ellipsis, so a long
                          * address ("…&promotion=holiday_party") lost its end and
                          * could not be followed. It is now printed whole, broken
                          * after its own separators where it is wider than the line
                          * (no character added), and linked to the recorded address.
                          * A recorded value that is not an http(s) address is printed
                          * as text and not linked.
                          */}
                        {recorded ? ' · ' : ''}
                        {printed && href ? (
                          <Link src={href} style={{ color: C.muted, textDecoration: 'underline' }}>{printed}</Link>
                        ) : printed}
                        {/* Label only — see the note on the web report's appendix. */}
                        {` · evidence confidence: ${e.confidenceLabel}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
