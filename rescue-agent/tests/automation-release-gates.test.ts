/**
 * PR #77 release review at f2bd456 (REQUEST CHANGES): H1, M1, M2, M3.
 *
 *  H1  An AI-written executive summary could recommend deploying or
 *      installing an automation: only the phrase "is the matched fix" was
 *      caught. Summaries are now screened — at audit time in the orchestrator
 *      and again when any report renders — and an unsafe one is replaced by the
 *      deterministic summary. The model is fed the conditional wording.
 *  M1  Section 06 named no readiness or approval gate; it now states the whole
 *      gate in its introduction and on every card, the verified branch included.
 *  M2  Section 06 (AI fit >= 70) and Days 15–21 (by category) chose different
 *      automations; one rule (isAutomationCandidate) now feeds Section 06, the
 *      Decision box and Days 15–21.
 *  M3  With no automation candidate, Days 15–21 and the Decision box offered a
 *      pilot of "the best-fit automation"; they now say none is proposed.
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import levFixture from './fixtures/leverocks-local-audit-opportunities.json';
import { buildExecutiveReport, isAutomationCandidate, type ExecutiveReportDTO, type ExecutiveReportInput } from '@/lib/reports/executive';
import { AI_SUMMARY_AUTOMATION_RULE, presentRecommendedSolution, screenAiSummary } from '@/lib/reports/automationWording';
import { ORDER_BUTTON_CATEGORY } from '@/lib/audit/orderButtonFinding';

const loaded: { dto: ExecutiveReportDTO | null } = { dto: null };
vi.mock('@/lib/operatorAuth', () => ({ requireOperatorPage: async () => ({ kind: 'operator' }) }));
vi.mock('@/lib/reports/executiveData', () => ({ loadExecutiveReport: async () => ({ status: 'ok', dto: loaded.dto }) }));

type Opp = ExecutiveReportInput['opportunities'][number];
const lev = (levFixture as { opportunities: Opp[] }).opportunities;
const levBy = (category: string) => lev.find((o) => o.category === category)!;
const ORDER_BUTTON = levBy(ORDER_BUTTON_CATEGORY);
const PHONE = levBy('PHONE-DEPENDENT CUSTOMER JOURNEY');
const CATERING = levBy('CATERING LEAD CAPTURE OPPORTUNITY');
const CTA = levBy('CONFUSING CTA HIERARCHY');
const RETENTION: Opp = {
  category: 'CUSTOMER RETENTION — NO PUBLIC OPT-IN ROUTE', title: 'No public opt-in route was found', problem: 'OBSERVED: no signup form.',
  businessImpact: 'Repeat visits matter.', customerJourneyStage: 'RETURN', evidenceIds: [], impactScore: 45, urgencyScore: 35,
  confidenceScore: 60, aiFitScore: 85, rescuePriorityScore: 52, manualValidationRequired: true,
  recommendedSolution: 'First check whether a list already exists in your POS or reservation system — if it does, this is a publishing gap, not a data gap. If it does not, a visible email/SMS capture offer is the starting point, and an AI Reactivation Campaign only becomes worth discussing once there is a list to reactivate.',
};
const BROKEN: Opp = { ...CTA, category: 'BROKEN CUSTOMER PATHWAY', title: 'A customer link is broken', aiFitScore: 20, rescuePriorityScore: 45, manualValidationRequired: false, confidenceScore: 85, recommendedSolution: 'Fix the broken link(s) immediately. This is a direct website repair, not an AI project.' };

function input(opportunities: Opp[], extra: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput {
  return {
    auditId: 'cgates0001', restaurantName: "Leverock's Great Seafood", websiteUrl: 'https://leverocks.example/', location: 'St. Petersburg, FL',
    auditDate: '2026-11-01', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: 84, coverageScore: 80, sourcesCollected: 8, sourcesFailed: 0,
    evidence: [], opportunities, journey: [], categoryScores: [], storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
    ...extra,
  };
}

function pdfStrings(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || node === false) return out;
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out; }
  if (Array.isArray(node)) { for (const c of node) pdfStrings(c, out); return out; }
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof el.type === 'function') return pdfStrings((el.type as (p: unknown) => unknown)(el.props ?? {}), out);
  if (el.props && 'children' in el.props) pdfStrings(el.props.children, out);
  return out;
}
async function pdfText(dto: ExecutiveReportDTO): Promise<string> {
  const { ExecutivePdf } = await import('@/lib/pdf/ExecutivePdf');
  return pdfStrings(React.createElement(ExecutivePdf, { dto })).join('\n').replace(/\s+/g, ' ');
}
async function webText(dto: ExecutiveReportDTO): Promise<string> {
  loaded.dto = dto;
  (globalThis as { React?: typeof React }).React = React;
  const Page = (await import('@/app/audits/[auditId]/report/page')).default;
  const element = await Page({ params: Promise.resolve({ auditId: dto.valueSignals.auditId }) });
  return renderToStaticMarkup(element as React.ReactElement).replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

// ── H1 ──────────────────────────────────────────────────────────────────────

const UNSAFE_SUMMARIES = [
  'We recommend deploying the Winnersbookmark AI Front Desk to capture missed calls immediately.',
  'The AI Front Desk is the right fix for this restaurant and should be installed.',
  'Installing AI-assisted intake will stop private-event inquiries from going unanswered.',
  'The AI Front Desk will stop missed calls.',
  "Leverock's should adopt an AI voice receptionist.",
  'A chatbot is the best solution for the FAQ gap.',
  'Implementing automation now will recover lost orders.',
  'The Winnersbookmark AI Front Desk is the matched fix.',
  'Rolling out an AI reactivation campaign is the natural next step.',
  'The restaurant needs to use an AI system for phone calls and should launch it this month.',
];
const ACCEPTABLE_SUMMARIES = [
  "Our audit analyzed 8 public pages of Leverock's Great Seafood and collected 29 evidence items.",
  'The online ordering button uses a telephone link instead of an online checkout; whether this is intended needs the owner.',
  'If call records confirm high, repetitive demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests and the owner approves it.',
  "No automation change is proposed until the restaurant's records confirm the demand.",
  'Phone demand is unmeasured; answering those calls automatically is worth measuring, but whether that is the case here is an open question.',
  'Winnersbookmark recommends an AI Discovery Audit as the next step to validate these findings against internal records.',
];
const padded = (s: string) => `Our audit analyzed 8 public pages and collected 29 evidence items. ${s} The 30-day plan sequences validation first.`;

describe('H1 — AI-written summaries are screened, and an unsafe one is replaced', () => {
  it('flags deploy, install, adopt, launch, roll out, "is the right fix", "the matched fix" and promised outcomes', () => {
    for (const s of UNSAFE_SUMMARIES) {
      const screen = screenAiSummary(padded(s));
      expect(screen.safe, s).toBe(false);
      expect(screen.unsafe, s).toEqual([s]);
    }
  });

  it('passes factual and properly gated conditional summaries', () => {
    for (const s of ACCEPTABLE_SUMMARIES) expect(screenAiSummary(padded(s)), s).toEqual({ safe: true, unsafe: [] });
  });

  it('a stored unsafe AI summary is not shown: the deterministic summary is, and the report is not marked AI-enhanced', () => {
    const deterministic = buildExecutiveReport(input(lev));
    for (const s of UNSAFE_SUMMARIES) {
      const dto = buildExecutiveReport(input(lev, { storedSummary: padded(s), storedSummaryWasAiEnhanced: true }));
      expect(dto.executiveSummary, s).toBe(deterministic.executiveSummary);
      expect(dto.summaryWasAiEnhanced, s).toBe(false);
    }
  });

  it('a stored acceptable AI summary is shown as written', () => {
    const s = padded(ACCEPTABLE_SUMMARIES[2]);
    const dto = buildExecutiveReport(input(lev, { storedSummary: s, storedSummaryWasAiEnhanced: true }));
    expect(dto.executiveSummary).toBe(s);
    expect(dto.summaryWasAiEnhanced).toBe(true);
  });

  it('neither the PDF nor the web page prints a rejected summary', async () => {
    const dto = buildExecutiveReport(input(lev, { storedSummary: padded(UNSAFE_SUMMARIES[0]), storedSummaryWasAiEnhanced: true }));
    expect(await pdfText(dto)).not.toContain('We recommend deploying');
    expect(await webText(dto)).not.toContain('We recommend deploying');
  }, 60_000);

  it('the audit pipeline screens the summary before storing it, and feeds the model the conditional wording', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/lib/audit/orchestrator.ts'), 'utf8');
    expect(src).toMatch(/AI_SUMMARY_AUTOMATION_RULE/);
    expect(src).toMatch(/recommendation: presentRecommendedSolution\(l\.category, l\.recommendedSolution\)/);
    expect(src).not.toMatch(/recommendation: l\.recommendedSolution/);
    const screenAt = src.indexOf('screenAiSummary(aiNarrative.executiveSummary)');
    expect(screenAt).toBeGreaterThan(-1);
    expect(src.indexOf('aiNarrative = null;', screenAt)).toBeGreaterThan(screenAt);
    expect(screenAt).toBeLessThan(src.indexOf('generateOwnerReport({'));
    // What the model now sees for the Leverock's findings.
    for (const o of lev) expect(presentRecommendedSolution(o.category, o.recommendedSolution)).not.toMatch(/matched fix/);
    expect(AI_SUMMARY_AUTOMATION_RULE).toMatch(/never call one the fix or the solution/);
  });
});

// ── H1 (re-review of 6b0b068): adversarial wording ──────────────────────────
//
// The independent re-review found carriesGate() accepted a "gate" with no
// demand in the records, and probing found split, passive, softened and
// back-referenced recommendations passing too. Each case here passed the
// 6b0b068 screen and must now be rejected — whole — with the deterministic
// summary shown instead.

const GATED =
  'If call records confirm the demand, the AI Front Desk could be considered as a limited, monitored pilot only after it passes its own readiness and safety tests and the owner approves it.';

const ADVERSARIAL: Record<string, string[]> = {
  'readiness, safety, approval and pilot — but no measurable demand in the records': [
    'The AI Front Desk should be installed as a limited, monitored pilot only after it passes its own readiness and safety tests and the owner approves it.',
    'Consider a limited, monitored pilot of AI-assisted intake only after it passes its own readiness and safety tests and the owner approves it.',
    'If demand seems high, a limited, monitored pilot of the AI Front Desk could follow, but only after its readiness and safety tests pass and the owner approves.',
  ],
  'an unconditional recommendation split across sentences': [
    "The AI Front Desk is ready for this restaurant. Leverock's should install it this month.",
    'An AI receptionist suits this restaurant well. Put it in place before the summer season.',
    'Private-event inquiries are high-value. AI-assisted intake is available. The owner should set it up now.',
  ],
  'passive-voice and softened installation': [
    'An AI voice receptionist would be put in place to answer calls.',
    'The AI Front Desk ought to be brought on for the dinner rush.',
    'An AI Front Desk would likely solve the phone problem.',
    'AI-assisted intake could help reduce missed inquiries.',
    "Leverock's could switch to an AI receptionist.",
    "Leverock's would benefit from an AI Front Desk.",
    'An AI Front Desk would be a smart investment for the restaurant.',
    'Start a pilot of the AI Front Desk next week.',
  ],
  'synonyms a verb list misses (review of 6b0b068 and probing of a257232)': [
    'We recommend the AI Front Desk.',
    "Leverock's should switch to the AI Front Desk.",
    'We suggest the AI Front Desk for phone coverage.',
    'Our advice is to go with the AI Front Desk.',
    "Leverock's could opt for an AI receptionist.",
    'The best move is to choose the AI Front Desk.',
    'The team should rely on an AI receptionist after hours.',
    'An AI receptionist is what this restaurant needs.',
    'The AI Front Desk is recommended.',
    'The AI Front Desk is the answer to the phone gap.',
    'AI-assisted intake makes sense here.',
    'Onboard the AI Front Desk this month.',
  ],
  'softened and absolute outcome claims': [
    'The AI Front Desk would likely solve missed calls.',
    'With the AI Front Desk, no call would go unanswered.',
    'Getting the AI Front Desk would help with missed calls.',
    'AI-assisted intake is likely to reduce missed inquiries.',
  ],
  'a gated recommendation followed by an unconditional one': [
    `${GATED} Either way, they should install it this quarter.`,
    `${GATED} The AI Front Desk will stop missed calls.`,
    `${GATED} In practice, the restaurant should simply adopt the AI Front Desk.`,
  ],
};

const ACCEPTABLE_FULL_SUMMARY =
  "Leverock's Great Seafood scored 84 out of 100, with 80% of the audit scope covered by public evidence. " +
  'The strongest areas are discovery, the website, the menu and contact details. ' +
  'The most important issue is the online ordering button, which uses a telephone link instead of an online checkout; the owner should confirm which experience is intended and update the button or the section label. ' +
  "Phone demand and private-event inquiry handling cannot be measured from public pages and need the restaurant's own records. " +
  GATED;

describe('H1 (re-review) — adversarial AI-summary wording is rejected whole', () => {
  const deterministic = buildExecutiveReport(input(lev)).executiveSummary;

  for (const [kind, cases] of Object.entries(ADVERSARIAL)) {
    it(`unsafe: ${kind}`, () => {
      for (const c of cases) {
        expect(screenAiSummary(padded(c)).safe, c).toBe(false);
        const dto = buildExecutiveReport(input(lev, { storedSummary: padded(c), storedSummaryWasAiEnhanced: true }));
        expect(dto.executiveSummary, c).toBe(deterministic);
        expect(dto.summaryWasAiEnhanced, c).toBe(false);
      }
    });
  }

  it('the gate needs every part: removing any one — demand in the records, readiness and safety, approval, the monitored pilot, "only after" — makes it unsafe', () => {
    expect(screenAiSummary(GATED).safe).toBe(true);
    const withoutPart: [string, string][] = [
      ['demand in the records', GATED.replace('If call records confirm the demand, ', '')],
      ['records (demand alone)', GATED.replace('call records confirm the demand', 'the demand seems high')],
      ['readiness and safety', GATED.replace(' it passes its own readiness and safety tests and', '')],
      ['approval', GATED.replace(' and the owner approves it', '')],
      ['limited, monitored pilot', GATED.replace('a limited, monitored pilot', 'a rollout')],
      ['"limited" (a monitored pilot of any size)', GATED.replace('a limited, monitored pilot', 'a monitored pilot')],
      ['measurable demand (records without demand)', GATED.replace('call records confirm the demand', 'call records are reviewed')],
      ['"only after"', GATED.replace('only after', 'once')],
    ];
    for (const [part, sentence] of withoutPart) {
      expect(sentence, part).not.toBe(GATED);
      expect(screenAiSummary(sentence).safe, `without ${part}: ${sentence}`).toBe(false);
    }
  });

  it('acceptable: a correctly gated conditional recommendation, alone and inside a realistic summary, is shown as written', () => {
    const NON_RECOMMENDATION = "No automation change is proposed until the restaurant's own records confirm the demand.";
    const SELF_DESCRIPTION = 'This AI-enhanced summary was generated at audit time from the validated findings.';
    for (const text of [GATED, padded(GATED), ACCEPTABLE_FULL_SUMMARY, padded(NON_RECOMMENDATION), padded(SELF_DESCRIPTION)]) {
      expect(screenAiSummary(text), text).toEqual({ safe: true, unsafe: [] });
      const dto = buildExecutiveReport(input(lev, { storedSummary: text, storedSummaryWasAiEnhanced: true }));
      expect(dto.executiveSummary).toBe(text);
      expect(dto.summaryWasAiEnhanced).toBe(true);
    }
  });

  it('PDF and web page show the deterministic summary for a split recommendation', async () => {
    const dto = buildExecutiveReport(input(lev, { storedSummary: padded(ADVERSARIAL['an unconditional recommendation split across sentences'][0]), storedSummaryWasAiEnhanced: true }));
    for (const text of [await pdfText(dto), await webText(dto)]) {
      expect(text).not.toContain('should install it this month');
      expect(text).toContain(deterministic.slice(0, 60));
    }
  }, 60_000);
});

// ── H1 (review of f53ffd1): disguised endorsements and decoy gates ──────────
//
// Defect A: any "no"/"not" made a sentence a disclaimer, so "No alternative
// beats the AI Front Desk." passed. Only an explicit non-recommendation is a
// disclaimer now, and never one that also endorses, directs or hurries.
// Defect B: a sentence carrying the full gate passed even when the gate
// qualified something else ("Install the AI Front Desk now, while a different
// automation may be considered only after …"). A gated sentence now passes
// only if the gate governs it: no directive, no immediacy, no contrast joining
// a second instruction, no endorsement.

const DISGUISED_ENDORSEMENTS = [
  'No alternative beats the AI Front Desk.',
  'No other system comes close to the AI Front Desk.',
  'There is no better option than the AI Front Desk.',
  'Not having an AI Front Desk is the biggest risk here.',
  'No automation is proposed yet, but the AI Front Desk is the best choice.',
  'No restaurant should be without an AI receptionist.',
  'Nothing beats the AI Front Desk.',
];
const DECOY_GATES = [
  'Install the AI Front Desk now, while a different automation may be considered only after call records show measurable demand, its readiness and safety tests pass, and the owner approves a limited, monitored pilot.',
  'The owner approves a limited, monitored pilot only after call records show measurable demand and its readiness and safety tests pass, so install the AI Front Desk today.',
  'The AI Front Desk is the ideal solution and could be considered as a limited, monitored pilot only after call records confirm the demand, it passes its own readiness and safety tests and the owner approves it.',
  'Set up the AI Front Desk this week, treating it as a limited, monitored pilot only after call records confirm the demand, its readiness and safety tests pass and the owner approves.',
  'AI-assisted intake may be considered as a limited, monitored pilot only after inquiry records confirm the demand, its readiness and safety tests pass and the owner approves it; however, the AI Front Desk should go live immediately.',
];
const LEGITIMATE = [
  GATED,
  'If call records confirm the demand, the AI Front Desk could be considered as a limited, monitored pilot, but only after it passes its own readiness and safety tests and the owner approves it.',
  "No automation change is proposed until the restaurant's own records confirm the demand.",
  'Catering automation is not recommended until inquiry records show demand.',
  'We do not recommend any automation until the call records confirm the demand.',
];

describe('H1 (review of f53ffd1) — disclaimers must disclaim, gates must govern', () => {
  const deterministic = buildExecutiveReport(input(lev)).executiveSummary;

  it('Defect A: a negation that endorses is not a disclaimer — rejected whole, deterministic summary shown', () => {
    for (const c of DISGUISED_ENDORSEMENTS) {
      expect(screenAiSummary(padded(c)).safe, c).toBe(false);
      const dto = buildExecutiveReport(input(lev, { storedSummary: padded(c), storedSummaryWasAiEnhanced: true }));
      expect(dto.executiveSummary, c).toBe(deterministic);
      expect(dto.summaryWasAiEnhanced, c).toBe(false);
    }
  });

  it('Defect B: a full gate attached to something else does not qualify an unconditional recommendation', () => {
    for (const c of DECOY_GATES) {
      expect(screenAiSummary(padded(c)).safe, c).toBe(false);
      const dto = buildExecutiveReport(input(lev, { storedSummary: padded(c), storedSummaryWasAiEnhanced: true }));
      expect(dto.executiveSummary, c).toBe(deterministic);
    }
  });

  it('legitimate conditional recommendations and explicit non-recommendations still pass and are shown as written', () => {
    for (const c of LEGITIMATE) {
      expect(screenAiSummary(padded(c)), c).toEqual({ safe: true, unsafe: [] });
      const dto = buildExecutiveReport(input(lev, { storedSummary: padded(c), storedSummaryWasAiEnhanced: true }));
      expect(dto.executiveSummary, c).toBe(padded(c));
      expect(dto.summaryWasAiEnhanced, c).toBe(true);
    }
  });
});

// ── M1 ──────────────────────────────────────────────────────────────────────

const REQUIREMENTS = 'measurable demand in your own records, the product passing its own readiness and safety tests, your explicit approval, and a limited, monitored pilot first';
const INTRO_GATE = /Every automation here is a proposal only\. Before any of them is used: your own records must show measurable demand for it; the product must pass its own readiness and safety tests for this restaurant; you must approve it explicitly; and it starts as a limited, monitored pilot, not a full roll-out\./;

describe('M1 — Section 06 states the whole gate, in the introduction and on every card', () => {
  it('report data: intro, validation-branch cards and verified-branch cards', () => {
    const dto = buildExecutiveReport(input([...lev, RETENTION]));
    expect(dto.aiOpportunitiesIntro).toMatch(INTRO_GATE);
    expect(dto.rankedAiOpportunities.length).toBeGreaterThan(0);
    for (const card of dto.rankedAiOpportunities) expect(card.basis, card.solutionCategory).toContain(REQUIREMENTS);

    // A verified automation finding (no manual validation, confidence >= 80).
    const verifiedPhone = { ...PHONE, manualValidationRequired: false, confidenceScore: 90 };
    const v = buildExecutiveReport(input([verifiedPhone])).rankedAiOpportunities[0];
    expect(v.requiresValidation).toBe(false);
    expect(v.basis).toBe(`Addresses a verified public finding; its effect on revenue has not been measured. Any implementation still requires ${REQUIREMENTS}.`);
  });

  it('PDF and web page print the gate', async () => {
    const dto = buildExecutiveReport(input([...lev, RETENTION]));
    for (const text of [await pdfText(dto), await webText(dto)]) {
      expect(text).toMatch(INTRO_GATE);
      expect(text.split(REQUIREMENTS).length - 1).toBeGreaterThanOrEqual(dto.rankedAiOpportunities.length);
    }
  }, 60_000);
});

// ── M2 ──────────────────────────────────────────────────────────────────────

const pilotNames = (dto: ExecutiveReportDTO) =>
  dto.thirtyDayPlan.find((p) => p.phase === 'DAYS 15–21')!.actions.map((a) => a.match(/pilot of (.+?) —/)?.[1]).filter(Boolean) as string[];
const sorted = (xs: string[]) => [...xs].sort();

const exploratoryNames = (dto: ExecutiveReportDTO) =>
  dto.thirtyDayPlan.find((p) => p.phase === 'DAYS 15–21')!.actions.map((a) => a.match(/^(.+?) stays exploratory — no pilot is proposed/)?.[1]).filter(Boolean) as string[];

describe('M2 — Section 06, the Decision box and Days 15–21 agree; catering stays exploratory (PR #63)', () => {
  it("Leverock's: the AI Front Desk is the pilot candidate everywhere; catering is exploratory everywhere, with no pilot", () => {
    const dto = buildExecutiveReport(input(lev));
    const pilotCards = dto.rankedAiOpportunities.filter((o) => !o.exploratory).map((o) => o.solutionCategory);
    const exploratoryCards = dto.rankedAiOpportunities.filter((o) => o.exploratory).map((o) => o.solutionCategory);
    expect(pilotCards).toEqual(['AI Front Desk & Missed-Call Text Back']);
    expect(exploratoryCards).toEqual(['Lead Capture & Inquiry Automation']);
    // Days 15–21: a pilot decision only for the pilot candidate; catering named as no pilot.
    expect(pilotNames(dto)).toEqual(pilotCards);
    expect(exploratoryNames(dto)).toEqual(exploratoryCards);
    // Decision box: pilots the candidate, names catering as exploratory with no pilot.
    expect(dto.decisionBox.implement.detail).toMatch(/^Pilot AI Front Desk & Missed-Call Text Back only if /);
    expect(dto.decisionBox.implement.detail).toContain('Lead Capture & Inquiry Automation stays exploratory: no pilot proposed.');
    expect(dto.decisionBox.implement.detail).not.toMatch(/Pilot [^.]*Lead Capture/);
    // Section 06: visible, flagged, never a recommendation; owner-record validation first.
    const intake = dto.rankedAiOpportunities.find((o) => o.exploratory)!;
    expect(intake.fit).toBe('MODERATE');
    expect(intake.basis).toBe(`Exploratory only — not a recommendation, and no pilot is proposed. Public evidence alone does not establish demand for it; it could be considered only once your own records show that demand, and then only with ${REQUIREMENTS}.`);
    expect(dto.snapshot.topRecommendedAutomation).toBe('AI Front Desk & Missed-Call Text Back');
  });

  it('phone, catering and retention together: phone and retention are pilot candidates, catering exploratory — consistently, nothing capped', () => {
    const dto = buildExecutiveReport(input([ORDER_BUTTON, PHONE, CATERING, RETENTION]));
    const pilotCards = dto.rankedAiOpportunities.filter((o) => !o.exploratory).map((o) => o.solutionCategory);
    expect(sorted(pilotCards)).toEqual(['AI Front Desk & Missed-Call Text Back', 'Customer Reactivation & Follow-Up Automation']);
    expect(sorted(pilotNames(dto))).toEqual(sorted(pilotCards));
    expect(exploratoryNames(dto)).toEqual(['Lead Capture & Inquiry Automation']);
    for (const name of pilotCards) expect(dto.decisionBox.implement.detail).toContain(name);
    expect(dto.decisionBox.implement.detail).toContain('Lead Capture & Inquiry Automation stays exploratory: no pilot proposed.');
    expect(dto.findings.find((f) => f.category === CATERING.category)!.internalScores.aiFit).toBe(60);
  });

  it('catering alone: visible as exploratory in all three sections, and no automation change is proposed', () => {
    const dto = buildExecutiveReport(input([ORDER_BUTTON, CATERING]));
    expect(dto.rankedAiOpportunities.map((o) => [o.solutionCategory, o.exploratory])).toEqual([['Lead Capture & Inquiry Automation', true]]);
    const plan = dto.thirtyDayPlan.find((p) => p.phase === 'DAYS 15–21')!;
    expect(plan.heading).toBe('NO AUTOMATION PROPOSED');
    expect(pilotNames(dto)).toEqual([]);
    expect(exploratoryNames(dto)).toEqual(['Lead Capture & Inquiry Automation']);
    expect(dto.decisionBox.implement).toMatchObject({ heading: 'NO AUTOMATION PROPOSED', detail: 'No automation change is currently proposed. Lead Capture & Inquiry Automation stays exploratory until your own records show demand.' });
    expect(dto.snapshot.topRecommendedAutomation).toBeNull();
  });

  it('PDF and web page flag catering as exploratory and never as a pilot', async () => {
    const dto = buildExecutiveReport(input(lev));
    const pdf = await pdfText(dto);
    expect(pdf).toContain('EXPLORATORY · MODERATE FIT');
    const web = await webText(dto);
    expect(web).toContain('Exploratory · moderate fit');
    for (const text of [pdf, web]) {
      expect(text).toContain('Lead Capture & Inquiry Automation stays exploratory');
      expect(text).not.toMatch(/pilot of Lead Capture/);
    }
  }, 60_000);

  it('a website fix is never an automation proposal, and catering is never a pilot candidate', () => {
    for (const o of [ORDER_BUTTON, BROKEN, CTA, CATERING]) expect(isAutomationCandidate(o), o.category).toBe(false);
    expect(isAutomationCandidate(PHONE)).toBe(true);
    const dto = buildExecutiveReport(input([ORDER_BUTTON, BROKEN, CTA, PHONE]));
    expect(dto.rankedAiOpportunities.map((o) => o.solutionCategory)).toEqual(['AI Front Desk & Missed-Call Text Back']);
  });

  it('scores, AI fit, classifications and the ranking are unchanged by the shared rule', () => {
    const dto = buildExecutiveReport(input(lev));
    expect(dto.findings.map((f) => [f.category, f.internalScores, f.classification, f.labels])).toEqual(
      buildExecutiveReport(input(lev.map((o) => ({ ...o, recommendedSolution: 'x' })))).findings.map((f) => [f.category, f.internalScores, f.classification, f.labels]),
    );
    expect(dto.findings.map((f) => f.category)).toEqual(lev.map((o) => o.category));
    expect(dto.score.rescueScore).toBe(84);
  });
});

// ── M3 ──────────────────────────────────────────────────────────────────────

describe('M3 — no automation candidate, no automation pilot anywhere', () => {
  const dto = buildExecutiveReport(input([ORDER_BUTTON, BROKEN, CTA]));
  const plan = (p: string) => dto.thirtyDayPlan.find((x) => x.phase === p)!;

  it('Section 06 is empty, Days 15–21 and the Decision box say no automation is proposed', () => {
    expect(dto.rankedAiOpportunities).toEqual([]);
    expect(dto.aiOpportunities).toEqual([]);
    expect(plan('DAYS 15–21').heading).toBe('NO AUTOMATION PROPOSED');
    expect(plan('DAYS 15–21').actions).toEqual(['No automation is proposed: no finding in this audit is one an automation would address. Make no automation change — put the time into the website fixes above.']);
    expect(dto.decisionBox.implement).toEqual({
      heading: 'NO AUTOMATION PROPOSED',
      detail: 'No automation change is currently proposed: no finding in this audit is one an automation would address.',
      benefit: 'Effort stays on the website fixes and the validation steps.',
    });
    expect(JSON.stringify([dto.thirtyDayPlan, dto.decisionBox])).not.toMatch(/best-fit|highest-fit|pilot of/i);
  });

  it('the website fixes are kept', () => {
    expect(plan('DAYS 8–14').actions).toEqual([ORDER_BUTTON.recommendedSolution, BROKEN.recommendedSolution]);
  });

  it('PDF and web page print the same', async () => {
    for (const text of [await pdfText(dto), await webText(dto)]) {
      expect(text).toContain('No automation is recommended from current public evidence');
      expect(text).toContain('NO AUTOMATION PROPOSED');
      expect(text).toContain('No automation change is currently proposed');
      expect(text).not.toMatch(/best-fit automation|highest-fit automation/);
    }
  }, 60_000);
});
