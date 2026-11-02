/**
 * PR #77 INDEPENDENT REVIEW AT 5764862 — CHANGES REQUIRED.
 *
 *  1 HIGH    Keyword presence was taken for satisfied conditions: a "gate" with
 *            negated demand, failed tests, withheld approval, industry records
 *            or vendor approval passed. The screen now authorises a sentence
 *            only if it parses, clause by clause, into the one affirmative
 *            gate form (or an explicit non-recommendation); anything else
 *            about automation is rejected.
 *  2 HIGH    Automation described without "AI" or "automation" ("Automatic
 *            telephone answering …", "a digital telephone attendant") passed,
 *            and a safe sentence sat beside an unsafe one. Automation is now
 *            recognised by description too, and every sentence is judged on
 *            its own.
 *  3 MEDIUM  The catering card (AI fit 60, exploratory) still carried a
 *            conditional pilot recommendation. It now recommends only
 *            understanding and improving the inquiry workflow.
 *  (4 MEDIUM, the Sales Brief, is in sales-brief-automation-gate.test.ts.)
 *
 * Every unsafe summary is rejected whole: the report shows the deterministic
 * summary, in the web report and the PDF alike, for new and stored summaries.
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import levFixture from './fixtures/leverocks-local-audit-opportunities.json';
import { buildExecutiveReport, type ExecutiveReportDTO, type ExecutiveReportInput } from '@/lib/reports/executive';
import { parseDisclaimer, parseGatedProposal, presentOpportunitySolution, screenAiSummary } from '@/lib/reports/automationWording';

const loaded: { dto: ExecutiveReportDTO | null } = { dto: null };
vi.mock('@/lib/operatorAuth', () => ({ requireOperatorPage: async () => ({ kind: 'operator' }) }));
vi.mock('@/lib/reports/executiveData', () => ({ loadExecutiveReport: async () => ({ status: 'ok', dto: loaded.dto }) }));

type Opp = ExecutiveReportInput['opportunities'][number];
const lev = (levFixture as { opportunities: Opp[] }).opportunities;
const CATERING = lev.find((o) => o.category === 'CATERING LEAD CAPTURE OPPORTUNITY')!;
const PHONE = lev.find((o) => o.category === 'PHONE-DEPENDENT CUSTOMER JOURNEY')!;

function input(extra: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput {
  return {
    auditId: 'cauthz00001', restaurantName: "Leverock's Great Seafood", websiteUrl: 'https://leverocks.example/', location: 'St. Petersburg, FL',
    auditDate: '2026-11-01', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: 84, coverageScore: 80, sourcesCollected: 8, sourcesFailed: 0,
    evidence: [], opportunities: lev, journey: [], categoryScores: [], storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
    ...extra,
  };
}
const DETERMINISTIC = buildExecutiveReport(input()).executiveSummary;
const padded = (s: string) => `Our audit analyzed 8 public pages and collected 29 evidence items. ${s} The 30-day plan sequences validation first.`;
/** A stored AI summary, as a historical report would hold it. */
const stored = (s: string) => buildExecutiveReport(input({ storedSummary: padded(s), storedSummaryWasAiEnhanced: true }));

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

import { ACCEPTED, GATED, REJECTED, pilot } from './fixtures/ai-summary-adversarial';

describe('the gate is parsed, not keyword-matched', () => {
  it('the authorised form yields exactly demand, readiness and approval', () => {
    expect(parseGatedProposal(GATED)).toEqual({ authorised: true, conditions: ['demand', 'readiness', 'approval'] });
  });

  it('each failure says which condition did not hold', () => {
    expect(parseGatedProposal(pilot('it passes its own readiness and safety tests and the owner approves it.')).reason).toBe('missing condition: demand');
    expect(parseGatedProposal(pilot("the restaurant's own call records show measurable demand, it failed its own readiness and safety tests and the owner approves it.")).reason)
      .toBe('a gate condition does not parse as an affirmative condition');
    expect(parseGatedProposal(`${GATED.replace(/\.$/, '')}, and the owner approves it.`).reason).toBe('repeated condition: approval');
    expect(parseGatedProposal('Install the AI Front Desk now.').reason).toMatch(/no single/);
  });

  it('a disclaimer is only a disclaimer when nothing else is in the sentence', () => {
    expect(parseDisclaimer('No automation change is proposed.')).toBe(true);
    expect(parseDisclaimer('No automation change is proposed; put a digital attendant in place.')).toBe(false);
    expect(parseDisclaimer("No automation change is proposed until industry records confirm the demand.")).toBe(false);
    expect(parseDisclaimer('No alternative beats the AI Front Desk.')).toBe(false);
  });
});

describe('adversarial AI summaries are rejected whole — new and historical', () => {
  for (const [kind, cases] of Object.entries(REJECTED)) {
    it(`rejected: ${kind}`, () => {
      for (const c of cases) {
        expect(screenAiSummary(padded(c)).safe, c).toBe(false);
        const dto = stored(c);
        expect(dto.executiveSummary, c).toBe(DETERMINISTIC);
        expect(dto.summaryWasAiEnhanced, c).toBe(false);
      }
    });
  }

  it('accepted: genuinely conditional language and explicit non-recommendations are shown as written', () => {
    for (const c of ACCEPTED) {
      expect(screenAiSummary(padded(c)), c).toEqual({ safe: true, unsafe: [] });
      const dto = stored(c);
      expect(dto.executiveSummary, c).toBe(padded(c));
      expect(dto.summaryWasAiEnhanced, c).toBe(true);
    }
  });

  it('8. a historical stored summary is screened at render: the web report and the PDF both show the deterministic summary', async () => {
    const historical = [
      REJECTED['6. telephone automation recommended without being named'][0],
      REJECTED['7. a safe sentence beside an unsafe one'][0],
      REJECTED['3. withheld owner approval'][0],
    ];
    for (const c of historical) {
      const dto = stored(c);
      for (const text of [await pdfText(dto), await webText(dto)]) {
        expect(text, c).not.toContain(c.slice(0, 40));
        expect(text, c).toContain(DETERMINISTIC.slice(0, 80));
      }
    }
  }, 60_000);

  it('an accepted stored summary is printed identically by the web report and the PDF', async () => {
    const dto = stored(GATED);
    for (const text of [await pdfText(dto), await webText(dto)]) expect(text).toContain(GATED);
  }, 60_000);

  it('the audit pipeline applies the same screen before storing a new summary', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/lib/audit/orchestrator.ts'), 'utf8');
    const screenAt = src.indexOf('screenAiSummary(aiNarrative.executiveSummary)');
    expect(screenAt).toBeGreaterThan(-1);
    expect(src.indexOf('aiNarrative = null;', screenAt)).toBeGreaterThan(screenAt);
    expect(screenAt).toBeLessThan(src.indexOf('generateOwnerReport({'));
    // The render path uses the same function (executive.ts usesAiSummary).
    const exec = fs.readFileSync(path.join(__dirname, '../src/lib/reports/executive.ts'), 'utf8');
    expect(exec).toMatch(/screenAiSummary\(input\.storedSummary\)\.safe/);
  });
});

// ── 3. CATERING: EXPLORATORY EVERYWHERE ─────────────────────────────────────

describe('3. catering is exploratory everywhere: moderate fit, AI fit 60, no purchase, no pilot', () => {
  const dto = buildExecutiveReport(input());
  const card = dto.findings.find((f) => f.category === CATERING.category)!;
  const section06 = dto.rankedAiOpportunities.find((o) => o.solutionCategory === 'Lead Capture & Inquiry Automation')!;
  const days15 = dto.thirtyDayPlan.find((p) => p.phase === 'DAYS 15–21')!.actions.join(' ');
  const NO_PILOT = /no automation purchase is justified and no pilot is recommended/;
  const PILOT_WORDING = /may be worth a limited, monitored pilot|could be considered as a limited, monitored pilot|pilot of Lead Capture|matched fix|AI-assisted intake/i;

  it('scores and fit are unchanged', () => {
    expect(card.internalScores.aiFit).toBe(60);
    expect(CATERING.aiFitScore).toBe(60);
    expect(section06.fit).toBe('MODERATE');
    expect(section06.exploratory).toBe(true);
  });

  it('the finding card recommends understanding and improving the inquiry workflow, and no pilot', () => {
    expect(card.recommendedAction).toMatch(/collect acknowledgment records, response times and booking records for recent event inquiries/);
    expect(card.recommendedAction).toMatch(/improve that workflow first: a named owner for every inquiry and a consistent acknowledgment/);
    expect(card.recommendedAction).toMatch(NO_PILOT);
    expect(card.recommendedAction).not.toMatch(PILOT_WORDING);
    // Whatever was stored — current or historical wording — the card is the same.
    for (const storedText of [CATERING.recommendedSolution, 'AI-assisted lead capture and qualification for event inquiries (instant acknowledgment, structured intake, human handoff). Validate current response times in discovery.', 'Anything at all.']) {
      expect(presentOpportunitySolution({ ...CATERING, recommendedSolution: storedText })).toBe(card.recommendedAction);
    }
  });

  it('Section 06, the Decision box and Days 15–21 say the same: exploratory, no pilot', () => {
    expect(section06.basis).toMatch(NO_PILOT);
    expect(section06.basis).not.toMatch(/limited, monitored pilot first|could be considered/);
    expect(section06.implementationComplexity).toBe('Not assessed');
    expect(dto.decisionBox.implement.detail).toContain('Lead Capture & Inquiry Automation stays exploratory: no pilot proposed.');
    expect(dto.decisionBox.implement.detail).not.toMatch(/Pilot [^.]*Lead Capture/);
    expect(days15).toContain('Lead Capture & Inquiry Automation stays exploratory — no pilot is proposed');
    expect(days15).not.toMatch(/pilot of Lead Capture/);
  });

  it('the PDF and the web report print the same catering recommendation, with no pilot wording for it', async () => {
    for (const text of [await pdfText(dto), await webText(dto)]) {
      expect(text).toContain(card.recommendedAction);
      expect(text).toContain('What to check first');
      expect(text).not.toMatch(/AI-assisted inquiry intake \(instant acknowledgment, structured intake, human handoff\) may be worth a limited, monitored pilot/);
    }
  }, 60_000);

  it('the phone pilot candidate (AI fit 95) keeps its gated conditional recommendation', () => {
    const phone = dto.findings.find((f) => f.category === PHONE.category)!;
    expect(phone.recommendedAction).toMatch(/may be worth a limited, monitored pilot — only after it passes its own readiness and safety tests/);
  });
});
