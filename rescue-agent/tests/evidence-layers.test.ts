/**
 * EVIDENCE LAYERS — what was verified, what was not tested, what was not
 * measured, said the same way on every surface.
 *
 * The Leverock's report contradicted itself about one finding, the "Order
 * Online" button that places a phone call:
 *
 *   PDF page 3   "0 verified from public evidence", the finding counted under
 *                "Inferred opportunities";
 *   PDF page 4   the finding badged STRONG EVIDENCE, "Evidence confidence:
 *                Moderate";
 *   PDF page 13  the evidence under it "verified from public evidence",
 *                "confidence: Strong";
 *   Sales brief  "strongly indicated, not yet confirmed", stated five times.
 *
 * None of it was wrong, and all of it read as a contradiction, because one
 * label stood for three different things. For this finding they are:
 *
 *   VERIFIED IN THE PAGE MARKUP  the button is a tel: link — read directly;
 *   NOT YET TESTED               nobody tapped it on a phone;
 *   NOT MEASURED                 any effect on orders or revenue.
 *
 * The finding's own state is unchanged (STRONG_EVIDENCE), so no score,
 * priority or headline moves. What changes is that every surface names the
 * three layers instead of collapsing them.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import zlib from 'node:zlib';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { resolveOrderingChannel } from '@/lib/audit/orderingChannel';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { rankOpportunities } from '@/lib/scoring/priority';
import { generateOwnerReport, type RankedOpportunity } from '@/lib/reports/owner';
import { generateSalesBrief } from '@/lib/reports/sales';
import { buildExecutiveReport, type ExecutiveReportInput } from '@/lib/reports/executive';
import { evidenceBasisFor } from '@/lib/audit/evidenceBasis';
import { FINDING_CLASSIFICATION_NOTE } from '@/lib/scoring/methodology';
import { stateForOpportunity } from '@/lib/audit/evidenceState';
import { COMPANY } from '@/lib/config';

const SITE = 'https://leverocks.example/';
const CATEGORY = 'ORDER BUTTON LABEL MISMATCH';
const FILLER = `<footer><p>${'Fresh Gulf seafood since 1948, served on Pasadena Avenue. '.repeat(12)}</p></footer>`;

/** The Leverock's homepage, with the phone "Order" button under "ORDER ONLINE". */
const LEVEROCKS =
  '<html><head><title>Leverock\'s Great Seafood | St. Petersburg, FL</title>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
  '<h1>Leverock\'s</h1><p>Call <a href="tel:+17273674588">(727) 367-4588</a></p>' +
  '<p>Hours: Mon–Sun 11:30 AM – 9:00 PM</p><p>840 Pasadena Avenue South, St. Petersburg, FL 33707</p>' +
  '<a href="/st-petersburg-leverock-s-great-seafood-food-menu">Menu</a>' +
  '<a href="/-party?source=pop_up&amp;spot_id=78550&amp;destination=private_parties">Book your party</a>' +
  '<section class="order"><h2>ORDER ONLINE</h2><a class="btn" href="tel:+17273674588">Order</a></section>' +
  '<div data-ordering-url="https://tmt.spotapps.co/ordering-menu/?spot_id="></div>' +
  '<p>Email us: <a href="mailto:leverocksgreatseafood@gmail.com">leverocksgreatseafood@gmail.com</a></p>' +
  '<form><h3>Join our email list</h3><input type="email" name="email"><button>Sign up</button></form>' +
  `<a href="/gift-cards">Gift Cards</a>${FILLER}</body></html>`;

function pipeline(html = LEVEROCKS) {
  const evidence = normalizeEvidence({ pages: [extractPage(SITE, SITE, 200, 'text/html', html)], failures: [], probes: [] }).map(
    (e, i) => ({ id: `l${i}`, evidenceType: e.evidenceType, fact: e.fact, supportingContext: e.supportingContext ?? null, confidence: e.confidence, sourceUrl: e.sourceUrl ?? null }),
  );
  const journey = analyzeJourney(evidence);
  const leaks = rankOpportunities(detectRevenueLeaks({ evidence, journey }));
  const categories = calculateCategoryScores(journey, evidence);
  const overall = calculateOverallScore(categories);
  const owner = generateOwnerReport({
    restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: null, auditStatus: 'COMPLETED', demoMode: false,
    overallScore: overall.overallScore, coverageScore: overall.coverageScore, scoreExplanation: 'x', categories, journey, topLeaks: leaks, evidence,
  });
  const sales = generateSalesBrief({
    restaurantName: "Leverock's Great Seafood", overallScore: overall.overallScore, coverageScore: overall.coverageScore,
    topLeaks: leaks, journey, evidence, recommendedTier: owner.recommendation.tier,
  });
  const input: ExecutiveReportInput = {
    auditId: 'clayers0001', restaurantName: "Leverock's Great Seafood", websiteUrl: SITE, location: 'St. Petersburg, FL',
    auditDate: '2026-10-26', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: COMPANY.name, consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: overall.overallScore, coverageScore: overall.coverageScore,
    sourcesCollected: 1, sourcesFailed: 0, evidence, opportunities: leaks, journey, categoryScores: categories,
    storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
  };
  return { evidence, journey, leaks, categories, overall, sales, input, executive: buildExecutiveReport(input) };
}

/** All text runs of a rendered PDF, in content-stream order. */
async function pdfText(dto: ReturnType<typeof buildExecutiveReport>): Promise<string> {
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

// ── ONE DEFINITION OF THE THREE LAYERS ──────────────────────────────────────

describe('the evidence basis of the ordering-button finding', () => {
  const basis = evidenceBasisFor(CATEGORY)!;

  it('names what was verified, what was not tested and what was not measured', () => {
    expect(basis.verified).toMatch(/telephone \(tel:\) link/);
    expect(basis.notTested).toMatch(/tap/i);
    expect(basis.notMeasured).toMatch(/orders or revenue/i);
  });

  it('is defined only where the finding type earns it; other findings keep their own wording', () => {
    expect(evidenceBasisFor('PHONE-DEPENDENT CUSTOMER JOURNEY')).toBeNull();
    expect(evidenceBasisFor('CATERING LEAD CAPTURE OPPORTUNITY')).toBeNull();
  });
});

// ── SCORING AND STATE ARE NOT MOVED ─────────────────────────────────────────

describe('nothing that scores or ranks the finding changes', () => {
  const { leaks, overall, categories } = pipeline();
  const finding = leaks.find((l) => l.category === CATEGORY)!;

  it('the finding is still STRONG_EVIDENCE at the same confidence and priority inputs', () => {
    expect(stateForOpportunity(finding)).toBe('STRONG_EVIDENCE');
    expect([finding.impactScore, finding.urgencyScore, finding.confidenceScore, finding.aiFitScore, finding.manualValidationRequired]).toEqual([60, 55, 78, 15, false]);
  });

  it('category scores and the Rescue Score match the same page without the label', () => {
    const plain = pipeline(LEVEROCKS.replace('<h2>ORDER ONLINE</h2>', ''));
    expect(categories.map((c) => [c.category, c.score])).toEqual(plain.categories.map((c) => [c.category, c.score]));
    expect(overall.overallScore).toBe(plain.overall.overallScore);
  });
});

// ── THE SNAPSHOT COUNTS SAY WHAT EACH BUCKET IS ─────────────────────────────

describe('PDF page 3: the classification counters', () => {
  const { executive } = pipeline();

  it('counts a STRONG EVIDENCE finding as strong evidence, never as inferred', () => {
    expect(executive.score.strongCount).toBe(1);
    expect(executive.score.inferredCount).toBe(0);
    expect(executive.score.verifiedCount).toBe(0);
  });

  it('the four counters still add up to the findings printed', () => {
    const { verifiedCount, strongCount, inferredCount, manualValidationCount, findingsCount } = executive.score;
    expect(verifiedCount + strongCount + inferredCount + manualValidationCount).toBe(findingsCount);
  });

  it('a mixed set is split by its actual states', () => {
    const base = pipeline().input;
    const opp = (over: Partial<RankedOpportunity>): ExecutiveReportInput['opportunities'][number] => ({
      ...base.opportunities[0], category: 'BROKEN CUSTOMER PATHWAY', title: 't', evidenceIds: [], ...over,
    });
    const dto = buildExecutiveReport({
      ...base,
      opportunities: [
        opp({ confidenceScore: 95, manualValidationRequired: false, rescuePriorityScore: 90 }),
        opp({ confidenceScore: 70, manualValidationRequired: false, rescuePriorityScore: 80 }),
        opp({ confidenceScore: 62, manualValidationRequired: false, rescuePriorityScore: 70 }),
        opp({ confidenceScore: 50, manualValidationRequired: true, rescuePriorityScore: 60 }),
      ],
    });
    // 95 → verified, 70 → strong, 62 without a manual flag → inferred, manual → manual.
    expect([dto.score.verifiedCount, dto.score.strongCount, dto.score.inferredCount, dto.score.manualValidationCount]).toEqual([1, 1, 1, 1]);
  });
});

// ── THE FINDING CARD NAMES THE THREE LAYERS ─────────────────────────────────

describe('PDF page 4 / web report: the finding card', () => {
  const { executive } = pipeline();
  const card = executive.findings.find((f) => f.category === CATEGORY)!;

  it('carries the three layers alongside its STRONG EVIDENCE badge', () => {
    expect(card.classification).toBe('STRONG EVIDENCE');
    expect(card.evidenceBasis).toEqual(evidenceBasisFor(CATEGORY));
  });

  it('other findings carry no invented basis', () => {
    for (const f of executive.findings.filter((x) => x.category !== CATEGORY)) expect(f.evidenceBasis).toBeNull();
  });

  it('the label under the card says it rates the finding, not the evidence beneath it', () => {
    expect(card.labels.findingConfidence).toBe('Moderate');
    expect(card.labels).not.toHaveProperty('evidenceConfidence');
  });

  it('an audit stored before this change gets the same basis, from its category', () => {
    const { input } = pipeline();
    const stored = input.opportunities.map((o) =>
      o.category === CATEGORY
        ? { ...o, problem: 'OBSERVED AUTOMATICALLY (from the page markup): The "Order" button … MANUAL CONFIRMATION: not recorded in this audit.' }
        : o,
    );
    const dto = buildExecutiveReport({ ...input, opportunities: stored });
    expect(dto.findings.find((f) => f.category === CATEGORY)!.evidenceBasis).toEqual(evidenceBasisFor(CATEGORY));
  });
});

describe('the confidence legend separates evidence confidence from finding labels', () => {
  it('says a finding can rest on verified evidence and still not be verified as a whole', () => {
    expect(FINDING_CLASSIFICATION_NOTE).toMatch(/"Verified finding" only when the whole finding/);
    expect(FINDING_CLASSIFICATION_NOTE).toMatch(/"Strong evidence"/);
    expect(FINDING_CLASSIFICATION_NOTE).toMatch(/read directly/i);
    expect(FINDING_CLASSIFICATION_NOTE).toMatch(/end to end/i);
    expect(FINDING_CLASSIFICATION_NOTE).toMatch(/orders or revenue/i);
  });
});

describe('the exported PDF', () => {
  it('prints the new counters, the three layers and the legend note', async () => {
    const { executive } = pipeline();
    // Labels are set in capitals in the PDF, and label and text are separate runs.
    const text = await pdfText(executive);
    expect(text).toContain('1 STRONG EVIDENCE, NOT TESTED END TO END');
    expect(text).toContain('0 INFERRED OPPORTUNITIES');
    expect(text).toContain('0 VERIFIED FINDINGS');
    for (const fragment of ['Verified in the page markup', 'Not yet tested', 'Not measured', 'Finding labels are separate from evidence confidence']) {
      expect(text, fragment).toContain(fragment);
    }
    expect(text).toMatch(/FINDING CONFIDENCE (Strong|Moderate|Preliminary)/);
    expect(text).not.toMatch(/EVIDENCE CONFIDENCE (Strong|Moderate|Preliminary)/);
  }, 30000);
});

// ── STORED WORDING FOR NEW AUDITS USES THE SAME LABELS ──────────────────────

describe('new audits store the same three labels', () => {
  const { leaks, evidence } = pipeline();
  const finding = leaks.find((l) => l.category === CATEGORY)!;

  it('the finding problem reads VERIFIED IN THE PAGE MARKUP, NOT YET TESTED, NOT MEASURED, in that order', () => {
    const at = (label: string) => finding.problem.indexOf(label);
    expect(at('VERIFIED IN THE PAGE MARKUP:')).toBe(0);
    expect(at('NOT YET TESTED:')).toBeGreaterThan(0);
    expect(at('NOT MEASURED:')).toBeGreaterThan(at('NOT YET TESTED:'));
    expect(finding.problem).not.toMatch(/OBSERVED AUTOMATICALLY|MANUAL CONFIRMATION/);
  });

  it('the ordering-channel evidence uses the same words', () => {
    const channel = evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;
    expect(channel.supportingContext).toMatch(/^Verified in the page markup: /);
    expect(channel.supportingContext).toMatch(/Not yet tested: no one tapped the button on a phone during this audit/);
    const direct = resolveOrderingChannel({ phoneOrderCtas: ['ORDER'], onlineLabelledPhoneCtas: [{ text: 'ORDER', label: 'ORDER ONLINE' }], destinations: [], probes: [], widgetVendor: null });
    expect(direct.detail).toMatch(/^Verified in the page markup: /);
  });
});

// ── THE SALES BRIEF SAYS IT ONCE ────────────────────────────────────────────

describe('Sales Brief: the three layers, stated once', () => {
  const { sales, leaks } = pipeline();
  const finding = leaks.find((l) => l.category === CATEGORY)!;
  const basis = evidenceBasisFor(CATEGORY)!;

  it('the best sales angle gives the layered status instead of a generic "not yet confirmed"', () => {
    expect(sales.bestSalesAngle).toContain(`Status: ${basis.summary}`);
    expect(sales.bestSalesAngle).not.toMatch(/strongly indicated, not yet confirmed/);
    // One status, one instruction: the old angle said it was unconfirmed three times.
    expect(sales.bestSalesAngle.match(/not (yet )?confirmed|NOT confirmed|before stating it as fact/gi) ?? []).toHaveLength(0);
    expect(sales.bestSalesAngle).toMatch(/Tap the button on a phone/);
  });

  it('the email describes what the website shows and what was not done, once', () => {
    expect(sales.emailOpener).toContain(basis.ownerObservation);
    expect(sales.emailOpener).toMatch(/have not tested it on a phone/);
    expect(sales.emailOpener).not.toMatch(/could not check from the outside/);
    expect(sales.emailOpener).not.toMatch(/\blost\b|\blose\b|revenue/i);
  });

  it('the follow-up and outreach lines do not repeat the status disclaimer', () => {
    expect(sales.followUpAngle).toContain(finding.title);
    expect(sales.followUpAngle).not.toMatch(/strongly indicated|not yet confirmed/);
    expect(sales.outreachAngle).not.toMatch(/this finding is not confirmed/);
  });

  it('the talk track lists each finding once, on its own line, with one discipline instruction', () => {
    const lines = sales.talkTrack.split('\n');
    const findingLines = lines.filter((l) => l.startsWith('• '));
    expect(findingLines).toHaveLength(3);
    expect(findingLines).toContain(`• "${finding.title}" — ${basis.summary}`);
    expect(sales.talkTrack.match(/ask about it, do not assert it/g) ?? []).toHaveLength(0);
    expect(sales.talkTrack.match(/EVIDENCE DISCIPLINE/g) ?? []).toHaveLength(1);
    expect(sales.talkTrack).not.toMatch(/strongest claim this brief supports/);
    expect(sales.talkTrack).toMatch(/never as a confirmed defect/);
  });

  it('the whole brief never claims a measured loss for this finding', () => {
    const all = Object.values(sales).flat().filter((v) => typeof v === 'string').join('\n');
    expect(all).not.toMatch(/lost orders|lost revenue|revenue loss|conversion rate/i);
  });
});
