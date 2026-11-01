/**
 * FINAL REPORT QA — the Leverock's audit, read as a client reads it.
 *
 * Builds on ordering-report-cleanup.test.ts (one concise ordering finding).
 * This pass covers what remained across the whole report:
 *
 *   1. no diagnostic identifier in any client text; the operator page keeps
 *      them on its diagnostics line;
 *   2. ordering explained once per section, with every evidence record, its
 *      context and its confidence kept;
 *   3. phone ordering kept apart from online checkout — nothing says online
 *      ordering is broken, unavailable or absent;
 *   4. the unlinked SpotHopper address with an empty spot_id presented as
 *      technical context, not a customer-facing failure;
 *   5. confidence in the observed HTML/link evidence separated from customer
 *      outcomes, which no finding measures;
 *   6. a rating typed at intake distinguished from a verified Google rating,
 *      and from review excerpts on the restaurant's own site;
 *   7. the web report, the PDF and the operator page saying the same thing.
 *
 * Scores, findings and evidence classifications are pinned unchanged.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { analyzeOwnerReviews, reviewEvidence } from '@/lib/audit/reviews';
import { presentReputationText } from '@/lib/audit/reputationWording';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { rankOpportunities } from '@/lib/scoring/priority';
import { CONFIDENCE_EXPLANATION, scoringMethodology } from '@/lib/scoring/methodology';
import {
  buildExecutiveReport,
  CUSTOMER_OUTCOME_LABEL,
  presentEvidenceRecord,
  type ExecutiveReportInput,
} from '@/lib/reports/executive';
import { COMPANY } from '@/lib/config';

const SITE = 'https://leverocks.example/';
const MARKUP = 'https://tmt.spotapps.co/ordering-menu/?spot_id=';
const MENU = `${SITE}st-petersburg-leverock-s-great-seafood-food-menu`;
const CATEGORY = 'ORDER BUTTON LABEL MISMATCH';
const FILLER = `<footer><p>${'Fresh Gulf seafood since 1948, served on Pasadena Avenue. '.repeat(12)}</p></footer>`;
const HTML =
  '<html><head><title>Leverock\'s Great Seafood | St. Petersburg, FL</title>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
  '<h1>Leverock\'s</h1><p>Call <a href="tel:+17273674588">(727) 367-4588</a></p>' +
  '<p>Hours: Mon–Sun 11:30 AM – 9:00 PM</p><p>840 Pasadena Avenue South, St. Petersburg, FL 33707</p>' +
  '<a href="/st-petersburg-leverock-s-great-seafood-food-menu">Menu</a>' +
  '<section class="order"><h2>ORDER ONLINE</h2><a class="btn" href="tel:+17273674588">Order</a></section>' +
  `<div data-ordering-url="${MARKUP}"></div>` +
  `<a href="/gift-cards">Gift Cards</a>${FILLER}</body></html>`;
const menuOk: ProbeResult = { url: MENU, category: 'menu', ok: true, httpStatus: 200, note: 'HTTP 200', exposedInCustomerJourney: true };
const markup404: ProbeResult = {
  url: MARKUP, category: 'ordering', ok: false, httpStatus: 404, note: 'HTTP 404', failureKind: 'HTTP', exposedInCustomerJourney: false,
};

function pipeline({ rating = null as number | null, reviewCount = null as number | null, probes = [menuOk, markup404] } = {}) {
  const inputs = normalizeEvidence({ pages: [extractPage(SITE, SITE, 200, 'text/html', HTML)], failures: [], probes });
  // As the orchestrator does: intake review data becomes evidence before the journey runs.
  const review = { rating, reviewCount, googleBusinessUrl: null };
  inputs.push(...reviewEvidence(review, analyzeOwnerReviews(review)));
  const evidence = inputs.map((e, i) => ({
    id: `q${i}`, evidenceType: e.evidenceType, fact: e.fact, supportingContext: e.supportingContext ?? null,
    confidence: e.confidence, sourceUrl: e.sourceUrl ?? null,
  }));
  const journey = analyzeJourney(evidence);
  const leaks = rankOpportunities(detectRevenueLeaks({ evidence, journey }));
  const categories = calculateCategoryScores(journey, evidence);
  const overall = calculateOverallScore(categories);
  const input: ExecutiveReportInput = {
    auditId: 'cqa0000001', restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: 'St. Petersburg, FL',
    auditDate: '2026-11-01', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: COMPANY.name, consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: overall.overallScore, coverageScore: overall.coverageScore,
    sourcesCollected: 1, sourcesFailed: 0, evidence, opportunities: leaks, journey, categoryScores: categories,
    storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
  };
  const dto = buildExecutiveReport(input);
  return { evidence, journey, leaks, categories, overall, input, dto };
}

type Dto = ReturnType<typeof buildExecutiveReport>;

/** Every string the client web report and PDF render from the DTO. */
function clientText(dto: Dto): string {
  return [
    dto.executiveSummary,
    ...dto.snapshot.priorities.flatMap((p) => [p.title, p.summary, p.validationRequired]),
    ...dto.findings.flatMap((f) => [
      f.title, f.problem, f.whyItMatters, f.commercialEffect, ...f.whatWeKnow, f.whatWeDoNotKnow, f.recommendedAction,
      ...Object.values(f.labels),
    ]),
    ...dto.journeyMap.flatMap((s) => [s.label, s.status, s.note, s.limitation ?? '']),
    ...dto.thirtyDayPlan.flatMap((p) => p.actions),
    ...dto.methodologyAndLimitations,
    ...dto.appendix.flatMap((e) => [e.evidenceLabel, e.fact, e.supportingContext ?? '', e.confidenceLabel]),
  ].join('\n');
}

/** All text runs of a rendered PDF, in content-stream order. */
async function pdfText(dto: Dto): Promise<string> {
  const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
  const { renderToBuffer } = await import('@react-pdf/renderer');
  type PdfElement = Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(React.createElement(ExecutivePdf, { dto }) as unknown as PdfElement);
  const latin = pdf.toString('latin1');
  const runs: string[] = [];
  for (const match of latin.matchAll(/stream\r?\n/g)) {
    const start = match.index! + match[0].length;
    let data = pdf.subarray(start, latin.indexOf('endstream', start));
    try {
      data = zlib.inflateSync(data);
    } catch {
      continue;
    }
    for (const run of data.toString('latin1').matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const hex = [...run[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => h[1]).join('');
      const step = hex.length > 0 && /^(00[0-9a-fA-F]{2})+$/.test(hex) ? 4 : 2;
      let text = '';
      for (let i = 0; i < hex.length; i += step) text += String.fromCharCode(parseInt(hex.slice(i, i + step), 16));
      runs.push(text);
    }
  }
  return runs.join(' ').replace(/\s+/g, ' ');
}

const source = (rel: string) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

// ── SCORES, FINDINGS AND CLASSIFICATIONS DO NOT MOVE ─────────────────────────

describe('nothing that scores or classifies moves', () => {
  it('scores, findings and evidence classifications match the values pinned from main', () => {
    const { overall, leaks, evidence } = pipeline();
    // Pinned from main for this fixture (identical on main and this branch).
    expect([overall.overallScore, overall.coverageScore]).toEqual([80, 80]);
    expect([pipeline({ rating: 4.6, reviewCount: 1234 }).overall.overallScore, pipeline({ rating: 4.6, reviewCount: 1234 }).overall.coverageScore]).toEqual([82, 90]);
    expect(leaks.find((l) => l.category === CATEGORY)).toMatchObject({ impactScore: 60, urgencyScore: 55, confidenceScore: 78 });
    expect(evidence.filter((e) => e.evidenceType === 'BROKEN_LINK')).toEqual([]);
  });

  it('an intake rating scores and sets the journey exactly as before the wording change', () => {
    const { categories, journey } = pipeline({ rating: 4.6, reviewCount: 1234 });
    expect(categories.find((c) => c.category === 'REVIEW_REPUTATION_SYSTEM')!.score).toBe(92);
    expect(journey.find((s) => s.stage === 'REVIEW')!.status).toBe('HEALTHY');
    const low = pipeline({ rating: 3.5, reviewCount: null });
    expect(low.journey.find((s) => s.stage === 'REVIEW')!.status).toBe('RISK');
    expect(low.categories.find((c) => c.category === 'REVIEW_REPUTATION_SYSTEM')!.score).toBe(70);
  });
});

// ── 1. NO DIAGNOSTIC IDENTIFIERS IN CLIENT TEXT ─────────────────────────────

describe('1. diagnostic identifiers stay out of client text', () => {
  it('the web/PDF data and the rendered PDF carry none', async () => {
    const { dto } = pipeline({ rating: 4.6, reviewCount: 1234 });
    const codes = /\b[A-Z]{2,}(?:_[A-Z]{2,})+\b|ORDERING CHANNEL:|LABEL MISMATCH/;
    expect(clientText(dto)).not.toMatch(codes);
    expect(await pdfText(dto)).not.toMatch(codes);
  }, 30000);

  it('the operator page keeps them, on a separate diagnostics line', () => {
    const internal = source('src/app/audits/[auditId]/page.tsx');
    expect(internal).toMatch(/Technical diagnostics: \{evidenceDiagnosticCodes\(e\.fact\)\}/);
    expect(internal).toMatch(/\{presentEvidenceRecord\(e\)\.fact\}/);
  });
});

// ── 2. ORDERING EXPLAINED ONCE PER SECTION, EVIDENCE KEPT ───────────────────

describe('2. ordering is consolidated without losing evidence', () => {
  const { dto, evidence } = pipeline();

  it('the appendix keeps every evidence record, its context and its confidence', () => {
    expect(dto.appendix).toHaveLength(evidence.length);
    for (const [i, e] of evidence.entries()) {
      expect(dto.appendix[i].confidence).toBe(e.confidence);
      expect(dto.appendix[i].supportingContext === null).toBe(e.supportingContext === null);
    }
    const ordering = dto.appendix.filter((e) => /^Ordering/.test(e.evidenceLabel));
    expect(ordering.length).toBe(evidence.filter((e) => /^ORDERING_/.test(e.evidenceType)).length);
  });

  it('the web report no longer prints the journey stages a second time under the map', () => {
    const page = source('src/app/audits/[auditId]/report/page.tsx');
    expect(page).not.toMatch(/dto\.journeyScorecard\.map/);
    expect(page).not.toMatch(/<summary[^>]*>Detailed journey findings<\/summary>/);
    // The map still carries each stage with its limitation.
    const ordering = dto.journeyMap.find((s) => s.stage === 'ORDERING')!;
    expect(ordering.note).toMatch(/places a telephone call/);
    expect(ordering.limitation).toMatch(/^Not assessed:/);
  });

  it('the finding card states the observation once', () => {
    const card = dto.findings.find((f) => f.category === CATEGORY)!;
    const text = [card.problem, card.whyItMatters, card.commercialEffect, ...card.whatWeKnow, card.recommendedAction].join(' ');
    expect(text.split('places a telephone call').length - 1).toBe(1);
  });
});

// ── 3. PHONE ORDERING IS NOT ONLINE CHECKOUT, AND NEITHER IS CALLED BROKEN ──

describe('3. phone ordering and online checkout are kept apart', () => {
  const { dto } = pipeline();

  it('no client text says online ordering or checkout is broken, unavailable or absent', () => {
    expect(clientText(dto)).not.toMatch(
      /online (ordering|checkout) (is|was) (broken|unavailable|not available|down|missing)|no online ordering (exists|is available)|cannot (order|check out) online|(ordering|checkout) (page|system) (is )?broken/i,
    );
  });

  it('the recommended action does not presume the restaurant has no online ordering page', () => {
    const card = dto.findings.find((f) => f.category === CATEGORY)!;
    expect(card.recommendedAction).not.toMatch(/\bset up the online ordering page\b/);
    expect(card.recommendedAction).toMatch(/point the button at the restaurant's online ordering page — setting one up first if none exists/);
    expect(card.whatWeDoNotKnow).toMatch(/whether an online ordering system is set up/);
  });
});

// ── 4. THE UNLINKED spot_id ADDRESS IS TECHNICAL CONTEXT ────────────────────

describe('4. the unlinked SpotHopper address is technical context', () => {
  const { dto } = pipeline();
  const record = dto.appendix.find((e) => (e.supportingContext ?? '').startsWith(`${MARKUP}.`))!;

  it('is labelled and worded as technical context, with its test result, URL, reason and confidence kept', () => {
    expect(record.evidenceLabel).toBe('Ordering · technical context');
    expect(record.fact).toBe(
      'Technical context, not a customer-facing failure: an ordering address that appears only in the page code, with ' +
        'no button or link pointing to it, did not load when the audit requested it (HTTP 404).',
    );
    expect(record.supportingContext).toContain('Not reported as a failure because the destination appears only in the page markup');
    expect(record.confidenceLabel).toBe('Preliminary');
    expect(record.fact).not.toMatch(/manual validation required|broken|\bfail(ed|ing)?\b(?! *ure)/i);
  });

  it('a supplied address that failed keeps its own wording — only markup-only addresses are technical context', () => {
    const e = {
      evidenceType: 'ORDERING_PATH',
      fact: 'The ordering destination could not be verified when tested (HTTP 404) — manual validation required.',
      supportingContext: 'https://supplied.example/. Not reported as a failure because this URL was provided for this audit and was not found on the analyzed pages, so nothing here shows a customer ever reaches it.',
    };
    expect(presentEvidenceRecord(e)).toMatchObject({ evidenceLabel: 'Ordering', fact: e.fact });
  });
});

// ── 5. OBSERVED EVIDENCE VS CUSTOMER OUTCOMES ───────────────────────────────

describe('5. confidence in what was observed is separate from customer outcomes', () => {
  const { dto } = pipeline();

  it('every finding rates its observed evidence and states the customer outcome is not measured', () => {
    for (const f of dto.findings) {
      expect(['Strong', 'Moderate', 'Preliminary']).toContain(f.labels.observedEvidence);
      expect(f.labels.customerOutcome).toBe(CUSTOMER_OUTCOME_LABEL);
    }
    expect(CUSTOMER_OUTCOME_LABEL).toBe('Not measured');
    const ordering = dto.findings.find((f) => f.category === CATEGORY)!;
    expect(ordering.labels.observedEvidence).toBe('Strong'); // the tel: link, read from the markup
    expect(ordering.labels.findingConfidence).toBe('Moderate'); // unchanged
  });

  it('the legend says evidence confidence rates HTML/link observation, not customer outcomes', () => {
    expect(CONFIDENCE_EXPLANATION).toMatch(/^Evidence confidence describes how directly a fact was observed in the page HTML or a link response/);
    expect(CONFIDENCE_EXPLANATION).toMatch(/says nothing about customer outcomes/);
    expect(dto.confidenceLegend).toContain(CONFIDENCE_EXPLANATION);
  });

  it('web, PDF and operator page label item confidence as evidence confidence', async () => {
    expect(source('src/app/audits/[auditId]/report/page.tsx')).toMatch(/Evidence confidence: <span/);
    expect(source('src/app/audits/[auditId]/page.tsx')).toMatch(/Evidence confidence: \{confidenceLabel/);
    const text = await pdfText(dto);
    expect(text).toMatch(/evidence confidence: (Strong|Moderate|Preliminary)/);
    expect(text).toMatch(/OBSERVED EVIDENCE Strong/);
    expect(text).toMatch(/CUSTOMER OUTCOME Not measured/);
  }, 30000);
});

// ── 6. A RATING TYPED AT INTAKE IS NOT A VERIFIED GOOGLE RATING ─────────────

describe('6. reputation wording', () => {
  const { dto, evidence, journey } = pipeline({ rating: 4.6, reviewCount: 1234 });

  it('the rating record says it was entered at intake and not checked against Google', () => {
    const rating = evidence.find((e) => e.evidenceType === 'REVIEW_SIGNAL')!;
    expect(rating.fact).toBe('Owner-reported rating: 4.6★ across 1234 review(s), entered at intake — not checked against Google or any review platform.');
    expect(rating.supportingContext).toMatch(/Review excerpts or star ratings shown on the restaurant's own website are content the site chooses to display/);
    expect(rating.supportingContext).toMatch(/not an independently verified Google rating, and this audit does not score them/);
  });

  it('no client text calls it a "public" rating or implies Google verified it', () => {
    const text = clientText(dto);
    expect(text).not.toMatch(/public rating|Google-verified|verified by Google|verified Google rating(?! *[,.])/i);
    expect(text).toMatch(/not checked against Google/);
  });

  it('the journey map, methodology and limitations say the same thing', () => {
    const review = dto.journeyMap.find((s) => s.stage === 'REVIEW')!;
    expect(review.note).toBe('Owner-reported rating of 4.6★, entered at intake and not checked against Google or any review platform.');
    expect(review.limitation).toMatch(/^Not assessed: the rating on the Google listing itself, review excerpts shown on the restaurant's website/);
    expect(journey.find((s) => s.stage === 'REVIEW')!.finding).toContain(review.note);
    expect(scoringMethodology().map((s) => JSON.stringify(s)).join(' ')).toMatch(/not checked against Google/);
    expect(dto.methodologyAndLimitations.join(' ')).toMatch(
      /review excerpts or star ratings shown on the restaurant's own website are not treated as a verified Google rating/,
    );
  });

  it('with no rating entered, the stage says excerpts on the site are not a verified rating', () => {
    const none = pipeline();
    const review = none.dto.journeyMap.find((s) => s.stage === 'REVIEW')!;
    expect(review.note).toBe('No rating was entered at intake, and review platforms are not scraped.');
    expect(review.limitation).toMatch(/review excerpts shown on the restaurant's website, which are not a verified rating/);
  });

  it('an audit stored with the old wording renders the new wording', () => {
    const { input } = pipeline({ rating: 4.6, reviewCount: 1234 });
    const old = {
      ...input,
      evidence: input.evidence.map((e) =>
        e.evidenceType === 'REVIEW_SIGNAL'
          ? { ...e, fact: 'Owner-reported public rating: 4.6★ across 1234 review(s).', supportingContext: 'Provided by the restaurant at intake; not independently verified against the review platform.' }
          : e,
      ),
      journey: input.journey.map((s) =>
        s.stage === 'REVIEW'
          ? { ...s, finding: 'Owner-reported rating of 4.6★. Reputation is included from provided data; response-pattern and recency analysis still require direct platform access.' }
          : s,
      ),
    };
    const rendered = buildExecutiveReport(old);
    expect(rendered.appendix).toEqual(dto.appendix);
    expect(rendered.journeyMap).toEqual(dto.journeyMap);
    expect(presentReputationText('No review data was provided and public review platforms are not scraped. Share your Google/Yelp rating to include reputation in the audit.'))
      .toBe(pipeline().journey.find((s) => s.stage === 'REVIEW')!.finding);
  });

  it('the intake form asks for the rating from the Google profile, not from excerpts on the website', () => {
    const form = source('src/app/audits/new/NewAuditForm.tsx');
    expect(form).toMatch(/Copy the rating and count from the Google Business Profile itself, not from review excerpts or stars shown on the restaurant&apos;s website\./);
  });
});

// ── 7. THE SAME EXPLANATIONS ON EVERY SURFACE ───────────────────────────────

describe('7. web report, executive summary, PDF and operator page agree', () => {
  it('the PDF prints the same technical-context, reputation and ordering wording as the web data', async () => {
    const { dto } = pipeline({ rating: 4.6, reviewCount: 1234 });
    const text = await pdfText(dto);
    const squash = (s: string) => s.replace(/\s+/g, '');
    for (const fragment of [
      'Technical context, not a customer-facing failure',
      // The extractor mis-decodes the em dash, so the fragments either side of it are matched.
      'entered at intake',
      'not checked against Google or any review platform.',
      'places a telephone call instead of opening an online ordering page or checkout.',
      'Automated finding',
    ]) {
      expect(squash(text), fragment).toContain(squash(fragment));
    }
  }, 30000);

  it('the executive summary describes the finding as an observation to validate, not a confirmed loss', () => {
    const { dto } = pipeline();
    expect(dto.executiveSummary).toContain('No revenue loss was verified from public evidence.');
    expect(dto.executiveSummary).not.toMatch(/\blost\b|\bbroken\b|revenue loss (was|is) (confirmed|measured)/i);
    expect(dto.executiveSummary).toMatch(/online ordering button opens a phone call instead of an online checkout/i);
  });

  it('the operator page renders journey stages and evidence through the same presenters as the client report', () => {
    const internal = source('src/app/audits/[auditId]/page.tsx');
    expect(internal).toMatch(/presentEvidenceText\(s\.finding\)/);
    expect(internal).toMatch(/orderButtonFindingCopy\(/);
    expect(internal).toMatch(/Customer outcome \{CUSTOMER_OUTCOME_LABEL\.toLowerCase\(\)\}/);
  });
});

// ── 8. MOBILE LAYOUT, URL WRAPPING, BADGES AND PDF LABELS ───────────────────
//
// Verified in a browser at 390px and 360px and in the rendered PDFs (see the
// PR); these pin the specific layout decisions so a later edit cannot undo them.

describe('8. layout: URL wrapping, status badges and the PDF label row', () => {
  const page = source('src/app/audits/[auditId]/report/page.tsx');

  it('only the URL on the cover may break anywhere — "break-all" no longer splits "FL" into "F" / "L"', () => {
    expect(page).toMatch(/<span className="break-all">\{dto\.cover\.websiteUrl\}<\/span>/);
    expect(page).not.toMatch(/break-all">\{dto\.cover\.websiteUrl\}\{dto\.cover\.location/);
  });

  it('journey status badges stack above the stage text on a phone and sit beside it from the small breakpoint', () => {
    expect(page).toMatch(/flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4/);
    expect(page).toMatch(/shrink-0 sm:w-40 text-xs uppercase/);
  });

  it('the PDF label row wraps, so six labels never overrun a card', () => {
    expect(source('src/lib/pdf/ExecutivePdf.tsx')).toMatch(/flexWrap: 'wrap', columnGap: 14, rowGap: 4/);
  });
});
