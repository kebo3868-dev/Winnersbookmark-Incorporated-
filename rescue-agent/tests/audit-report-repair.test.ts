/**
 * TARGETED AUDIT REPORT REPAIR — regression tests for the six issues found in
 * the Leverock's report.
 *
 *   1. Headlines follow the evidence ("Top Revenue Leaks" only when verified).
 *   2. A private-party link is not evidence that inquiries are handled by hand.
 *   3. A job-listing link whose callback_url names a menu page is not a menu.
 *   4. A present mechanism with unknown results is not customer FRICTION, and
 *      every surface uses the same word for the same stage.
 *   5. The executive report invents no missed-call or conversion quantities.
 *   6. Section headings stay with their content; the brand is "Winnersbookmark".
 *
 * Fixtures are taken from the Leverock's site where the issue came from.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { categorizeLink, extractPage } from '@/lib/web/collector';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { calculateCategoryScores } from '@/lib/scoring/rescueScore';
import {
  buildExecutiveReport,
  journeyStatusLabel,
  reportHeadlines,
  type ExecutiveReportInput,
} from '@/lib/reports/executive';
import { COMPANY } from '@/lib/config';
import type { EvidenceRecordLike } from '@/types/audit';

const SITE = 'https://leverocks.example/';
const pageOf = (body: string, url = SITE) =>
  extractPage(url, url, 200, 'text/html', `<html><head><title>Leverock's Great Seafood</title></head><body>${body}</body></html>`);
const recordsFor = (body: string): EvidenceRecordLike[] =>
  normalizeEvidence({ pages: [pageOf(body)], failures: [], probes: [] }).map((e, i) => ({
    id: `r${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    supportingContext: e.supportingContext ?? null,
    confidence: e.confidence,
  }));
const cats = (href: string, text = '') => categorizeLink(new URL(href, SITE), text);

// Verbatim from the Leverock's food-menu and drink-menu pages.
const JOB_LISTING =
  'https://tmt.spotapps.co/job-listings?spot_id=78550&callback_url=http://leverocks.com/st-petersburg-leverock-s-great-seafood-food-menu';
const PRIVATE_PARTY = '/-party?source=pop_up&spot_id=78550&destination=private_parties&promotion=holiday_party';

// ── 3. MENU DESTINATION CLASSIFICATION ──────────────────────────────────────

describe('3. a link is classified by its own destination, not by a return URL it carries', () => {
  it('a job-listing link whose callback_url is a menu page is a careers link, not a menu link', () => {
    const c = cats(JOB_LISTING, 'Jobs');
    expect(c).not.toContain('menu');
    expect(c).toContain('careers');
  });

  it('ignores every common return-URL parameter, not only callback_url', () => {
    for (const key of ['callback_url', 'redirect', 'redirect_uri', 'return_url', 'returnTo', 'next', 'continue']) {
      const c = cats(`https://jobs.example/apply?${key}=https://leverocks.example/food-menu`, 'Apply');
      expect(c, key).not.toContain('menu');
    }
  });

  it('a return parameter does not hide the link\'s own menu destination', () => {
    expect(cats('/menu?redirect=/order', 'Menu')).toContain('menu');
  });

  it('an unlabelled ordering endpoint is ordering evidence, not menu evidence', () => {
    // data-ordering-url="https://tmt.spotapps.co/ordering-menu/?spot_id=" on the
    // Leverock's homepage: "menu" appears only as part of the ordering path.
    const c = cats('https://tmt.spotapps.co/ordering-menu/?spot_id=', '');
    expect(c).toContain('ordering');
    expect(c).not.toContain('menu');
  });

  it('preserves genuinely shared menu-and-ordering links', () => {
    expect(cats('https://order.toasttab.com/online/probe-grill', 'View Menu and Order')).toEqual(
      expect.arrayContaining(['menu', 'ordering']),
    );
    expect(cats('/menu', 'Order Online')).toEqual(expect.arrayContaining(['menu', 'ordering']));
  });

  it('preserves the restaurant\'s own menu pages', () => {
    expect(cats('/st-petersburg-leverock-s-great-seafood-food-menu', 'Menu')).toContain('menu');
    expect(cats('/st-petersburg-leverock-s-great-seafood-drink-menu', 'Drinks')).toContain('menu');
  });

  it('the job-listing link is not counted as a menu pathway in the evidence', () => {
    const body =
      '<a href="/st-petersburg-leverock-s-great-seafood-food-menu">Menu</a>' +
      `<a href="${JOB_LISTING.replace(/&/g, '&amp;')}">Jobs</a>`;
    const menuAccess = recordsFor(body).filter((e) => e.evidenceType === 'MENU_ACCESS');
    const linked = menuAccess.find((e) => /menu pathway is publicly linked/i.test(e.fact));
    expect(linked?.fact).toMatch(/\(1 link\(s\) found\)/);
    expect(JSON.stringify(menuAccess)).not.toContain('job-listings');
  });
});

// ── 2. PRIVATE-EVENT INQUIRIES ──────────────────────────────────────────────

describe('2. a private-party link does not establish how inquiries are handled', () => {
  const body = `<h1>Leverock's</h1><p>Call (727) 367-4588</p><a href="${PRIVATE_PARTY.replace(/&/g, '&amp;')}">Book your party</a>`;
  const records = recordsFor(body);
  const leaks = detectRevenueLeaks({ evidence: records, journey: analyzeJourney(records) });
  const leak = leaks.find((l) => /CATERING|PRIVATE/i.test(l.category));

  it('states that handling requires validation, and nothing about manual handling', () => {
    expect(leak, 'the private-party pathway should still be reported').toBeDefined();
    expect(leak!.title).toBe('Private-event inquiry handling requires validation');
    const text = `${leak!.title} ${leak!.problem} ${leak!.businessImpact} ${leak!.recommendedSolution}`;
    expect(text).not.toMatch(/depend(s)? on manual|manual (response|handling|follow-up)|handled manually/i);
    expect(leak!.problem).toMatch(/NOT OBSERVED:/);
    expect(leak!.manualValidationRequired).toBe(true);
  });

  it('asks for acknowledgment, response-time and booking records before recommending automation', () => {
    expect(leak!.problem).toMatch(/acknowledgment records, response times and booking records/i);
    expect(leak!.recommendedSolution).toMatch(/^Before recommending any automation, collect acknowledgment records, response times and booking records/);
    expect(leak!.recommendedSolution).toMatch(/if they do not, no automation is needed/i);
  });

  it('is not promoted to an AI recommendation on the strength of a link', () => {
    expect(leak!.aiFitScore).toBeLessThan(70);
    const dto = buildExecutiveReport(reportInput(leaks, analyzeJourney(records)));
    expect(dto.rankedAiOpportunities.map((o) => o.solutionCategory)).not.toContain('Lead Capture & Inquiry Automation');
    const finding = dto.findings.find((f) => /Private-event/.test(f.title))!;
    expect(finding.commercialEffect).not.toMatch(/manual handling/i);
    expect(finding.whatWeDoNotKnow).toMatch(/acknowledgment records, response times and booking records/i);
    const validate = dto.thirtyDayPlan[0].actions.join(' ');
    expect(validate).toMatch(/acknowledgment records, response times and booking records/i);
  });
});

// ── 4. JOURNEY LABELS AND SCORING ───────────────────────────────────────────

describe('4. observed friction and unmeasured performance are different words', () => {
  const ONE_SIGNUP = '<h1>Leverock\'s</h1><form><h3>Join our email list</h3><input type="email" name="email"><button>Sign up</button></form>';

  it('one opt-in route and one repeat-visit mechanism are present, not FRICTION', () => {
    const journey = analyzeJourney(recordsFor(ONE_SIGNUP));
    const followUp = journey.find((s) => s.stage === 'FOLLOW_UP')!;
    const ret = journey.find((s) => s.stage === 'RETURN')!;
    expect(followUp.finding).toMatch(/one public retention signal/i);
    expect(followUp.status).toBe('RESOLVED_UNVERIFIED');
    expect(ret.status).toBe('RESOLVED_UNVERIFIED');
    expect(journeyStatusLabel(followUp.status)).toBe('MANUAL VALIDATION');
  });

  it('a guest with no way to opt in at all still meets FRICTION', () => {
    const journey = analyzeJourney(recordsFor('<h1>Leverock\'s</h1><p>Call (727) 367-4588</p>'));
    expect(journey.find((s) => s.stage === 'FOLLOW_UP')!.status).toBe('FRICTION');
    expect(journey.find((s) => s.stage === 'RETURN')!.status).toBe('FRICTION');
  });

  it('SCORING CHANGE: customer retention rises from 60 to 70 when a mechanism is present but unmeasured', () => {
    // Reported, not hidden: FOLLOW_UP and RETURN were FRICTION (60) on the
    // assumption that an unmeasured mechanism is friction. As
    // RESOLVED_UNVERIFIED (70) they sit between friction and proven-healthy.
    const records = recordsFor(ONE_SIGNUP);
    const retention = calculateCategoryScores(analyzeJourney(records), records).find((c) => c.category === 'CUSTOMER_RETENTION')!;
    expect(retention.score).toBe(70);
    expect(retention.explanation).toMatch(/FOLLOW_UP=RESOLVED_UNVERIFIED, RETURN=RESOLVED_UNVERIFIED/);
  });

  it('an unshared review rating is unknown, not friction', () => {
    const journey = analyzeJourney([
      { id: 'r1', evidenceType: 'REVIEW_SIGNAL', fact: 'Owner-provided review profile: https://g.page/x', supportingContext: null, confidence: 50 },
    ]);
    expect(journey.find((s) => s.stage === 'REVIEW')!.status).toBe('UNKNOWN');
  });

  it('maps every engine status onto one client-facing word', () => {
    expect(journeyStatusLabel('HEALTHY')).toBe('HEALTHY');
    expect(journeyStatusLabel('FRICTION')).toBe('FRICTION');
    expect(journeyStatusLabel('RISK')).toBe('RISK');
    expect(journeyStatusLabel('RESOLVED_UNVERIFIED')).toBe('MANUAL VALIDATION');
    expect(journeyStatusLabel('UNKNOWN')).toBe('INSUFFICIENT DATA');
  });

  it('the journey map, the detailed scorecard and the legend agree', () => {
    const journey = [
      { stage: 'PHONE', status: 'FRICTION', finding: 'Observed: no FAQ page.', manualValidationRequired: true },
      { stage: 'FOLLOW_UP', status: 'RESOLVED_UNVERIFIED', finding: 'Observed: one route.', manualValidationRequired: true },
      { stage: 'REVIEW', status: 'UNKNOWN', finding: 'Not in scope.', manualValidationRequired: true },
    ];
    const dto = buildExecutiveReport({ ...reportInput([], []), journey });
    const map = Object.fromEntries(dto.journeyMap.map((s) => [s.stage, s.status]));
    const card = Object.fromEntries(dto.journeyScorecard.map((s) => [s.stage, s.status]));
    // FRICTION with a manual-validation flag used to read MANUAL VALIDATION in
    // the report while the internal page printed FRICTION.
    expect(map).toEqual({ PHONE: 'FRICTION', FOLLOW_UP: 'MANUAL VALIDATION', REVIEW: 'INSUFFICIENT DATA' });
    expect(card).toEqual(map);
    expect(dto.journeyLegend.map(([label]) => label).sort()).toEqual(['FRICTION', 'INSUFFICIENT DATA', 'MANUAL VALIDATION']);
  });

  it('the internal audit page prints the same word through the same function', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/app/audits/[auditId]/page.tsx'), 'utf8');
    expect(src).toMatch(/journeyStatusLabel\(s\.status\)/);
    expect(src).not.toMatch(/>\{s\.status\}</);
  });
});

// ── 1. HEADLINES ─────────────────────────────────────────────────────────────

describe('1. headlines follow the evidence', () => {
  it('no verified finding → "Priority Opportunities to Validate"', () => {
    expect(reportHeadlines(['MANUAL VALIDATION REQUIRED', 'INFERRED OPPORTUNITY'])).toEqual({
      snapshot: 'Executive Snapshot',
      findings: 'Priority Opportunities to Validate',
    });
    expect(reportHeadlines([]).findings).toBe('Priority Opportunities to Validate');
  });

  it('all verified → "Top Revenue Leaks" is preserved', () => {
    expect(reportHeadlines(['VERIFIED FINDING', 'VERIFIED FINDING'])).toEqual({
      snapshot: 'Executive Revenue Snapshot',
      findings: 'Top Revenue Leaks',
    });
  });

  it('mixed → names both, and never relabels the verified finding', () => {
    expect(reportHeadlines(['VERIFIED FINDING', 'MANUAL VALIDATION REQUIRED']).findings).toBe('Revenue Leaks and Opportunities to Validate');
  });

  it('the summary does not call unverified findings revenue opportunities', () => {
    const dto = buildExecutiveReport(reportInput([opp({ manualValidationRequired: true, confidenceScore: 55 })], []));
    expect(dto.headlines.findings).toBe('Priority Opportunities to Validate');
    expect(dto.executiveSummary).toMatch(/No revenue loss was verified from public evidence\. The priority opportunities to validate are:/);
    expect(dto.executiveSummary).not.toMatch(/revenue opportunities identified/i);
  });

  it('a verified finding keeps its classification and the revenue-leak headline', () => {
    const dto = buildExecutiveReport(reportInput([opp({ manualValidationRequired: false, confidenceScore: 90 })], []));
    expect(dto.findings[0].classification).toBe('VERIFIED FINDING');
    expect(dto.headlines.findings).toBe('Top Revenue Leaks');
    expect(dto.executiveSummary).toMatch(/The verified revenue leaks identified are/);
  });

  it('the PDF prints the same headline as the screen', async () => {
    const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
    const dto = buildExecutiveReport(reportInput([opp({ manualValidationRequired: true, confidenceScore: 55 })], []));
    const text = treeStrings(React.createElement(ExecutivePdf, { dto })).join('\u0000');
    expect(text).toContain('Priority Opportunities to Validate');
    expect(text).toContain('Executive Snapshot');
    expect(text).not.toContain('Top Revenue Leaks');
    expect(text).not.toContain('Executive Revenue Snapshot');
  }, 60_000);
});

// ── 5. SCENARIOS ─────────────────────────────────────────────────────────────

describe('5. the executive report invents no quantities', () => {
  it('no finding, calculator or snapshot carries a count or dollar figure the user did not enter', () => {
    const dto = buildExecutiveReport(
      reportInput([opp({ category: 'PHONE-DEPENDENT CUSTOMER JOURNEY' }), opp({ category: 'CONFUSING CTA HIERARCHY', title: 'CTA' })], []),
    );
    const serialized = JSON.stringify({ f: dto.findings, c: dto.scenarioCalculators, s: dto.snapshot, e: dto.executiveSummary });
    expect(serialized).not.toMatch(/\$\s?\d|about \$|missed calls per day"?:\s*\d|5 missed|3 lost/i);
    for (const c of dto.scenarioCalculators) expect(c.prefill).toEqual({});
  });
});

// ── 6. LAYOUT AND BRANDING ───────────────────────────────────────────────────

describe('6. export layout', () => {
  // Several summary lengths move every later heading up and down the page, so
  // between them each heading lands near a page foot at least once.
  it.each([0, 6, 12, 18])('no page ends on a section heading (summary × %i)', async (repeats) => {
    const pages = await renderedPages(buildExecutiveReport(layoutInput(repeats)));
    // Every heading must be found, or the check below is vacuous.
    const kickers = pages.flat().filter((t) => /^(SECTION\d\d|APPENDIX|ATAGLANCE)$/.test(norm(t)));
    expect(kickers.length).toBeGreaterThanOrEqual(10);
    for (const [i, runs] of pages.entries()) {
      const kickerAt = runs.findLastIndex((t) => /^(SECTION\d\d|APPENDIX|ATAGLANCE)$/.test(norm(t)));
      if (kickerAt === -1) continue;
      // After the kicker: the title rule plus at least one line of content,
      // excluding the two running-footer runs.
      const after = runs.slice(kickerAt + 1).filter((t) => !/^DESIGNEDBY|^PAGE\d+OF\d+$/.test(norm(t)));
      expect(after.length, `page ${i + 1} ends with heading "${runs[kickerAt]}"`).toBeGreaterThan(2);
    }
  }, 120_000);

  it('a long finding is labelled "continued" only on later pages', async () => {
    let labelled = 0;
    for (const repeats of [0, 6, 12, 18]) {
    const dto = buildExecutiveReport(layoutInput(repeats));
    const pages = await renderedPages(dto);
    for (const f of dto.findings) {
      // The card's own heading: number, title, badge, then its stage line — the
      // Executive Snapshot repeats the title, so the title alone is not enough.
      const title = norm(`${f.number}. ${f.title}`);
      const openingKey = `${title}${norm(f.classification)}CUSTOMERJOURNEYSTAGE`;
      const perPage = pages.map((runs) => {
        const text = norm(runs.join(' '));
        return { label: text.split(`${title}CONTINUED`).length - 1, opening: text.split(openingKey).length - 1 };
      });
      const opening = perPage.findIndex((p) => p.opening > 0);
      expect(opening, `finding ${f.number} opening page not found`).toBeGreaterThan(-1);
      perPage.forEach((p, i) => {
        if (p.label === 0) return;
        labelled++;
        expect(i, `finding ${f.number} labelled continued on its own opening page`).toBeGreaterThan(opening);
      });
    }
    }
    // Across these layouts at least one card must continue — otherwise this
    // test would pass without checking anything.
    expect(labelled).toBeGreaterThan(0);
  }, 120_000);
});

describe('6. branding', () => {
  it('the app and the PDF footer say "Winnersbookmark", without "Incorporated"', () => {
    expect(COMPANY.footer).toBe('Designed by Winnersbookmark');
    expect(COMPANY.name).toBe('Winnersbookmark');
    const dto = buildExecutiveReport(reportInput([], []));
    expect(dto.cover.footer).toBe('Designed by Winnersbookmark');
  });

  it('no user-visible string in the app spells the brand any other way', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|css)$/.test(entry.name)) {
          fs.readFileSync(full, 'utf8').split('\n').forEach((line, n) => {
            const code = line.trim();
            // Comments may name the company however they like; strings may not.
            if (/^(\/\/|\*|\/\*|\{\/\*)/.test(code)) return;
            if (/Winners Bookmark|WINNERS BOOKMARK|Winnersbookmark Incorporated|Bookmark Incorporated/.test(code)) {
              offenders.push(`${path.relative(process.cwd(), full)}:${n + 1}: ${code.slice(0, 100)}`);
            }
          });
        }
      }
    };
    walk(path.join(__dirname, '../src'));
    expect(offenders).toEqual([]);
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────

type Opp = ExecutiveReportInput['opportunities'][number];

function opp(over: Partial<Opp> = {}): Opp {
  return {
    category: 'PHONE-DEPENDENT CUSTOMER JOURNEY',
    title: 'Phone demand is unmeasured',
    problem: 'OBSERVED: no dedicated FAQ page was found. REQUIRES YOUR DATA: call records.',
    businessImpact: 'Unmeasured.',
    customerJourneyStage: 'PHONE',
    evidenceIds: [],
    impactScore: 40,
    urgencyScore: 30,
    confidenceScore: 55,
    aiFitScore: 95,
    rescuePriorityScore: 50,
    recommendedSolution: 'Pull 30 days of call records.',
    manualValidationRequired: true,
    ...over,
  };
}

function reportInput(
  opportunities: Opp[] | ReturnType<typeof detectRevenueLeaks>,
  journey: { stage: string; status: string; finding: string; manualValidationRequired: boolean }[],
): ExecutiveReportInput {
  return {
    auditId: 'crepair0001',
    restaurantName: "Leverock's Great Seafood",
    websiteUrl: SITE,
    location: 'St. Petersburg, FL',
    auditDate: '2026-10-26',
    auditStatus: 'COMPLETED',
    demoMode: false,
    contact: { company: COMPANY.name, consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null,
    avgTicket: null,
    overallScore: 78,
    coverageScore: 80,
    sourcesCollected: 8,
    sourcesFailed: 0,
    evidence: [],
    opportunities: opportunities.map((o) => ({ ...o, evidenceIds: o.evidenceIds ?? [] })) as Opp[],
    journey,
    categoryScores: [],
    storedSummary: null,
    storedSummaryWasAiEnhanced: false,
    storedRecommendation: null,
  };
}

/** Three long findings (each may span a page) and a full journey: the Leverock's shape. */
function layoutInput(summaryRepeats: number): ExecutiveReportInput {
  const long = (n: number, category: string, stage: string) =>
    opp({
      category,
      title: `Finding ${n} with a descriptive title`,
      customerJourneyStage: stage,
      problem: 'OBSERVED: something specific on the public site. NOT OBSERVED: what it costs. '.repeat(9),
      businessImpact: 'Whether that is happening here is unmeasured. '.repeat(3),
      recommendedSolution: 'Before any system: pull 30 days of records and compare. '.repeat(3),
      rescuePriorityScore: 60 - n,
    });
  return {
    ...reportInput([long(1, 'PHONE-DEPENDENT CUSTOMER JOURNEY', 'PHONE'), long(2, 'CATERING LEAD CAPTURE OPPORTUNITY', 'CONTACT'), long(3, 'CONFUSING CTA HIERARCHY', 'WEBSITE')], [
      { stage: 'DISCOVERY', status: 'HEALTHY', finding: 'Core identity signals present.', manualValidationRequired: false },
      { stage: 'WEBSITE', status: 'HEALTHY', finding: 'The website loaded.', manualValidationRequired: false },
      { stage: 'MENU', status: 'HEALTHY', finding: 'A menu is linked.', manualValidationRequired: false },
      { stage: 'PHONE', status: 'FRICTION', finding: 'Observed: no FAQ page. Not assessed: call volume.', manualValidationRequired: true },
      { stage: 'RESERVATION', status: 'UNKNOWN', finding: 'Not resolved.', manualValidationRequired: true },
      { stage: 'ORDERING', status: 'FRICTION', finding: 'Ordering is by telephone.', manualValidationRequired: true },
      { stage: 'CONTACT', status: 'HEALTHY', finding: 'Contact details visible.', manualValidationRequired: false },
      { stage: 'FOLLOW_UP', status: 'RESOLVED_UNVERIFIED', finding: 'Observed: one route. Not assessed: use.', manualValidationRequired: true },
      { stage: 'REVIEW', status: 'UNKNOWN', finding: 'Not in scope.', manualValidationRequired: true },
      { stage: 'RETURN', status: 'RESOLVED_UNVERIFIED', finding: 'Observed: one mechanism. Not assessed: use.', manualValidationRequired: true },
    ]),
    evidence: Array.from({ length: 26 }, (_, i) => ({
      id: `e${i + 1}`,
      evidenceType: 'CTA_SIGNAL',
      fact: `Evidence item ${i + 1}: something factual observed on the analyzed pages.`,
      supportingContext: 'Supporting context for the item.',
      confidence: 80,
      sourceUrl: SITE,
    })),
    storedSummary: 'Summary sentence that pads the executive summary section. '.repeat(summaryRepeats) || null,
    storedSummaryWasAiEnhanced: summaryRepeats > 0,
  };
}

/** Every string in the PDF element tree (components rendered, render props skipped). */
function treeStrings(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || node === false) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) treeStrings(child, out);
    return out;
  }
  const element = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof element.type === 'function') return treeStrings((element.type as (p: unknown) => unknown)(element.props ?? {}), out);
  if (element.props && 'children' in element.props) treeStrings(element.props.children, out);
  return out;
}

/** Upper-case letters and digits only — robust to kerning splits and font encodings. */
const norm = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * The text runs drawn on each page, in page order and drawing order.
 *
 * Pages are read through the page tree (/Kids → /Contents), because content
 * streams are not stored in page order. Each TJ array is one run. Helvetica
 * glyphs are one byte each; Times glyphs are two, recognisable by a zero high
 * byte, which is all this needs to read headings and labels back.
 */
async function renderedPages(dto: ReturnType<typeof buildExecutiveReport>): Promise<string[][]> {
  const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
  const { renderToBuffer } = await import('@react-pdf/renderer');
  type PdfElement = Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(React.createElement(ExecutivePdf, { dto }) as unknown as PdfElement);
  const latin = pdf.toString('latin1');
  const objectAt = (n: number) => {
    const start = latin.search(new RegExp(`(^|\\n)${n} 0 obj\\b`));
    return { start, body: latin.slice(start, latin.indexOf('endobj', start)) };
  };
  const kids = [...latin.match(/\/Type \/Pages[\s\S]*?\/Kids \[([^\]]*)\]/)![1].matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));
  const pages = kids.map((kid) => {
    const contents = Number(objectAt(kid).body.match(/\/Contents (\d+) 0 R/)![1]);
    const { start, body } = objectAt(contents);
    let dataStart = start + body.indexOf('stream') + 6;
    if (latin[dataStart] === '\r') dataStart++;
    if (latin[dataStart] === '\n') dataStart++;
    let data = pdf.subarray(dataStart, latin.indexOf('endstream', dataStart));
    try {
      data = zlib.inflateSync(data);
    } catch {
      /* not deflate-compressed */
    }
    return [...data.toString('latin1').matchAll(/\[([^\]]*)\]\s*TJ/g)].map((m) => {
      const hex = [...m[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => h[1]).join('');
      const step = hex.length > 0 && /^(00[0-9a-fA-F]{2})+$/.test(hex) ? 4 : 2;
      let text = '';
      for (let i = 0; i < hex.length; i += step) text += String.fromCharCode(parseInt(hex.slice(i, i + step), 16));
      return text;
    });
  });
  return pages.slice(1); // drop the cover
}
