/**
 * CLIENT-FACING AUTOMATION WORDING IS CONDITIONAL, ON EVERY SURFACE.
 *
 * Review of PR #77 at 62ff8cf (REQUEST CHANGES): the phone and catering
 * finding cards printed the stored recommended solution word for word —
 * "…the Winnersbookmark AI Front Desk … is the matched fix", "…AI-assisted
 * intake … is the matched fix" — in the PDF (pages 6–7) and the web report,
 * while the same report's Decision box and plan allow a pilot only after
 * readiness testing. And the catering finding (AI fit 60) recommended an
 * automation that no phase of the plan ever decided.
 *
 * Pinned here: the stored texts (current and historical) are presented
 * conditionally — demand in the records, the product's own readiness and safety
 * tests, owner approval, then a limited, monitored pilot — at render time,
 * without touching stored records; on the cards, in the PDF and on the web page;
 * the observation, category, classification, confidence and scores unchanged;
 * and the catering automation decided in Days 15–21 under its own gates.
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import levFixture from './fixtures/leverocks-local-audit-opportunities.json';
import { buildExecutiveReport, type ExecutiveReportDTO, type ExecutiveReportInput } from '@/lib/reports/executive';
import { presentAutomationClaims, presentRecommendedSolution, presentTierRecommendation } from '@/lib/reports/automationWording';
import { ORDER_BUTTON_CATEGORY } from '@/lib/audit/orderButtonFinding';

// The web report page loads through the operator guard and the report loader;
// both are replaced so the page renders a report built here.
const loaded: { dto: ExecutiveReportDTO | null } = { dto: null };
vi.mock('@/lib/operatorAuth', () => ({ requireOperatorPage: async () => ({ kind: 'operator' }) }));
vi.mock('@/lib/reports/executiveData', () => ({ loadExecutiveReport: async () => ({ status: 'ok', dto: loaded.dto }) }));

type Opp = ExecutiveReportInput['opportunities'][number];
const lev = (levFixture as { opportunities: Opp[] }).opportunities;
const levBy = (category: string) => lev.find((o) => o.category === category)!;
const PHONE = levBy('PHONE-DEPENDENT CUSTOMER JOURNEY');
const CATERING = levBy('CATERING LEAD CAPTURE OPPORTUNITY');
const ORDER_BUTTON = levBy(ORDER_BUTTON_CATEGORY);
const RETENTION: Opp = {
  category: 'CUSTOMER RETENTION — NO PUBLIC OPT-IN ROUTE', title: 'No public opt-in route was found', problem: 'OBSERVED: no signup form.',
  businessImpact: 'Repeat visits matter.', customerJourneyStage: 'RETURN', evidenceIds: [], impactScore: 45, urgencyScore: 35,
  confidenceScore: 60, aiFitScore: 85, rescuePriorityScore: 52, manualValidationRequired: true,
  recommendedSolution:
    'First check whether a list already exists in your POS or reservation system — if it does, this is a publishing gap, not a data gap. ' +
    'If it does not, a visible email/SMS capture offer is the starting point, and an AI Reactivation Campaign only becomes worth discussing once there is a list to reactivate.',
};

// Stored wording from earlier engine versions (git history of leaks.ts), as
// audits saved then still carry it.
const LEGACY = {
  phone: 'Winnersbookmark AI Front Desk System: AI voice receptionist, missed-call text-back, FAQ automation, and after-hours lead capture. Validate call volume in a discovery call first.',
  phoneOldBrand: 'Winners Bookmark AI Front Desk System: AI voice receptionist, missed-call text-back, FAQ automation, and after-hours lead capture. Validate call volume in a discovery call first.',
  catering: 'AI-assisted lead capture and qualification for event inquiries (instant acknowledgment, structured intake, human handoff). Validate current response times in discovery.',
  retention: 'Add a visible email/SMS capture offer, then run an AI Reactivation Campaign once a list exists. Verify in discovery whether an internal POS database already exists.',
};

/** Wording that presents an automation as settled rather than conditional. */
const CATEGORICAL = /is the matched fix|AI Front Desk System:|then run an AI Reactivation Campaign|AI-assisted lead capture and qualification for event inquiries|\bdeploy/i;
const PHONE_GATE = /may be worth a limited, monitored pilot — only after it passes its own readiness and safety tests for this restaurant \(answers on hours, menu and ordering checked against the restaurant's own information; missed-call text-back and transfer to staff tested\) and the owner approves the pilot\./;
const CATERING_GATE = /may be worth a limited, monitored pilot — only after the owner approves the intake questions and acknowledgment wording, every inquiry is verified to reach a named staff member, and the system passes its own readiness and safety tests with human escalation in place — and the owner approves the pilot\./;

function input(opportunities: Opp[], extra: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput {
  return {
    auditId: 'cwording01', restaurantName: "Leverock's Great Seafood", websiteUrl: 'https://leverocks.example/', location: 'St. Petersburg, FL',
    auditDate: '2026-11-01', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: 84, coverageScore: 80, sourcesCollected: 8, sourcesFailed: 0,
    evidence: [], opportunities, journey: [], categoryScores: [], storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
    ...extra,
  };
}
const card = (dto: ExecutiveReportDTO, category: string) => dto.findings.find((f) => f.category === category)!;

/** Every string the PDF element tree would draw (as in report-presentation-repair.test.ts). */
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
  return pdfStrings(React.createElement(ExecutivePdf, { dto })).join('\n');
}
async function webText(dto: ExecutiveReportDTO): Promise<string> {
  loaded.dto = dto;
  // The page's JSX compiles to React.createElement in this test runtime.
  (globalThis as { React?: typeof React }).React = React;
  const Page = (await import('@/app/audits/[auditId]/report/page')).default;
  const element = await Page({ params: Promise.resolve({ auditId: dto.valueSignals.auditId }) });
  return renderToStaticMarkup(element as React.ReactElement).replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

describe('stored recommended solutions are presented conditionally', () => {
  it('the stored Leverock\'s texts are the categorical ones the review found', () => {
    expect(PHONE.recommendedSolution).toMatch(/AI Front Desk .* is the matched fix\./);
    expect(CATERING.recommendedSolution).toMatch(/AI-assisted intake .* is the matched fix;/);
  });

  it('phone: demand in the call records, the Front Desk\'s own readiness and safety tests, owner approval, a limited monitored pilot', () => {
    const out = presentRecommendedSolution(PHONE.category, PHONE.recommendedSolution);
    expect(out).not.toMatch(CATEGORICAL);
    expect(out).toMatch(/^Before any system: pull 30 days of call records — total calls, unanswered calls, and the most common reasons\. /);
    expect(out).toMatch(/If that shows high, repetitive call volume, the Winnersbookmark AI Front Desk \(voice answering, missed-call text-back, FAQ automation, after-hours capture\) /);
    expect(out).toMatch(PHONE_GATE);
    expect(out).toMatch(/If it does not, this is not a problem worth solving\.$/);
  });

  it('catering: inquiry-record demand, owner-approved intake and acknowledgment, routing to named staff, readiness and safety tests, human escalation, owner approval', () => {
    const out = presentRecommendedSolution(CATERING.category, CATERING.recommendedSolution);
    expect(out).not.toMatch(CATEGORICAL);
    expect(out).toMatch(/^Before recommending any automation, collect acknowledgment records, response times and booking records for recent private-event inquiries\. /);
    expect(out).toMatch(/If they show slow or missed responses, AI-assisted inquiry intake \(instant acknowledgment, structured intake, human handoff\) /);
    expect(out).toMatch(CATERING_GATE);
    expect(out).toMatch(/If they do not, no automation is needed here\.$/);
  });

  it('earlier stored wording (older audits) is presented the same way', () => {
    for (const legacy of [LEGACY.phone, LEGACY.phoneOldBrand]) {
      const out = presentRecommendedSolution(PHONE.category, legacy);
      expect(out).not.toMatch(CATEGORICAL);
      expect(out).toMatch(/^Before any system: pull 30 days of call records/);
      expect(out).toMatch(PHONE_GATE);
    }
    const catering = presentRecommendedSolution(CATERING.category, LEGACY.catering);
    expect(catering).not.toMatch(CATEGORICAL);
    expect(catering).toMatch(/^Before recommending any automation, collect acknowledgment records/);
    expect(catering).toMatch(CATERING_GATE);
    const retention = presentRecommendedSolution(RETENTION.category, LEGACY.retention);
    expect(retention).toBe(RETENTION.recommendedSolution);
  });

  it('wording that is already conditional, and every website fix, is returned unchanged', () => {
    expect(presentRecommendedSolution(RETENTION.category, RETENTION.recommendedSolution)).toBe(RETENTION.recommendedSolution);
    expect(presentRecommendedSolution(ORDER_BUTTON.category, ORDER_BUTTON.recommendedSolution)).toBe(ORDER_BUTTON.recommendedSolution);
    const broken = 'Fix the broken link(s) immediately. This is a direct website repair, not an AI project.';
    expect(presentRecommendedSolution('BROKEN CUSTOMER PATHWAY', broken)).toBe(broken);
  });

  it('any other "is the matched fix" — an unknown stored variant, an AI-written summary — is made conditional', () => {
    const out = presentAutomationClaims('If volume is high, a chatbot is the matched fix.');
    expect(out).not.toMatch(/matched fix/);
    expect(out).toMatch(/may be worth a limited, monitored pilot — only after the records confirm the demand, the system passes its own readiness and safety tests, and the owner approves the pilot/);
  });
});

describe('the finding cards: wording conditional, everything else unchanged', () => {
  const dto = buildExecutiveReport(input(lev));

  it('phone and catering cards carry the conditional recommendation; the order-button card is unchanged', () => {
    expect(card(dto, PHONE.category).recommendedAction).toMatch(PHONE_GATE);
    expect(card(dto, CATERING.category).recommendedAction).toMatch(CATERING_GATE);
    expect(card(dto, ORDER_BUTTON.category).recommendedAction).toBe(ORDER_BUTTON.recommendedSolution);
    for (const f of dto.findings) expect(f.recommendedAction, f.title).not.toMatch(CATEGORICAL);
  });

  it('observations, categories, classifications, confidence labels and scores are untouched', () => {
    const before = buildExecutiveReport(input(lev.map((o) => ({ ...o, recommendedSolution: 'placeholder' }))));
    expect(dto.findings.map((f) => [f.category, f.title, f.problem, f.classification, f.labels, f.internalScores, f.automationOpportunity]))
      .toEqual(before.findings.map((f) => [f.category, f.title, f.problem, f.classification, f.labels, f.internalScores, f.automationOpportunity]));
    for (const o of lev) {
      const f = card(dto, o.category);
      expect(f.internalScores.aiFit).toBe(o.aiFitScore);
      expect(f.internalScores.rescuePriority).toBe(o.rescuePriorityScore);
    }
    expect(dto.score.rescueScore).toBe(84);
  });

  it('the stored records themselves are not modified', () => {
    expect(PHONE.recommendedSolution).toMatch(/is the matched fix/);
    expect(CATERING.recommendedSolution).toMatch(/is the matched fix/);
  });
});

describe('PDF and web report print the same conditional wording', () => {
  const dto = buildExecutiveReport(input([...lev, RETENTION]));

  it('the PDF draws no categorical automation claim, and draws both conditional recommendations', async () => {
    const text = await pdfText(dto);
    expect(text).not.toMatch(CATEGORICAL);
    expect(text).toMatch(PHONE_GATE);
    expect(text).toMatch(CATERING_GATE);
  }, 60_000);

  it('the web report page renders the same', async () => {
    const text = await webText(dto);
    expect(text).toContain('Recommended next action');
    expect(text).not.toMatch(CATEGORICAL);
    expect(text.replace(/\s+/g, ' ')).toMatch(PHONE_GATE);
    expect(text.replace(/\s+/g, ' ')).toMatch(CATERING_GATE);
  }, 60_000);
});

describe('the package recommendation: a product tier is evaluated, not installed', () => {
  const FRONT_DESK_RATIONALE =
    'The public evidence raises open questions about phone and inquiry demand that the AI Front Desk System (voice receptionist, missed-call text-back, FAQ automation, lead capture) is designed for. It is a potential improvement, not a fix for a measured problem: no missed calls or lost revenue have been measured, so call and inquiry records should confirm the demand before it is installed.';
  const OLD_FRONT_DESK_RATIONALE =
    'The evidence shows a phone-dependent journey with lead-capture gaps — exactly the friction the AI Front Desk System (voice receptionist, missed-call text-back, FAQ automation, lead capture) is built to absorb.';
  const REACTIVATION_RATIONALE = 'The dominant gap is customer retention and follow-up. A reactivation campaign converts the existing customer base into repeat visits.';

  it('AI FRONT DESK SYSTEM: evaluated as a monitored pilot after demand, readiness tests and approval; never "installed"', () => {
    for (const rationale of [FRONT_DESK_RATIONALE, OLD_FRONT_DESK_RATIONALE]) {
      const dto = buildExecutiveReport(input(lev, { storedRecommendation: { tier: 'AI FRONT DESK SYSTEM', rationale } }));
      for (const text of [dto.prescription.prescription, dto.recommendation.body]) {
        expect(text).toMatch(/recommends evaluating the AI FRONT DESK SYSTEM as the next step — as a limited, monitored pilot only after your records confirm the demand, the system passes its own readiness and safety tests for this restaurant, and you approve it\./);
        expect(text).not.toMatch(/before it is installed|is built to absorb|recommends AI FRONT DESK SYSTEM as the next step/);
      }
    }
  });

  it('AI REACTIVATION CAMPAIGN: the same gate, and no claim that it converts guests', () => {
    const t = presentTierRecommendation('AI REACTIVATION CAMPAIGN', REACTIVATION_RATIONALE);
    expect(t.lead).toMatch(/^recommends evaluating the AI REACTIVATION CAMPAIGN as the next step — as a limited, monitored pilot only after/);
    expect(t.rationale).not.toMatch(/converts the existing customer base/);
  });

  it('validation tiers read as stored', () => {
    const t = presentTierRecommendation('AI DISCOVERY AUDIT', 'Discovery confirms the numbers first.');
    expect(t).toEqual({ lead: 'recommends AI DISCOVERY AUDIT as the next step', rationale: 'Discovery confirms the numbers first.' });
  });

  it('an AI-written stored summary that says "is the matched fix" is presented conditionally', () => {
    const dto = buildExecutiveReport(input(lev, { storedSummary: 'The AI Front Desk is the matched fix for this restaurant.', storedSummaryWasAiEnhanced: true }));
    expect(dto.executiveSummary).not.toMatch(/matched fix/);
  });
});

describe('phone, catering and retention together: cards and plan agree', () => {
  const dto = buildExecutiveReport(input([ORDER_BUTTON, PHONE, CATERING, RETENTION]));
  const plan = (p: string) => dto.thirtyDayPlan.find((x) => x.phase === p)!;

  it('Days 8–14 is the order-button fix alone; no automation, no Days 1–7 step', () => {
    expect(plan('DAYS 8–14').actions).toEqual([ORDER_BUTTON.recommendedSolution]);
  });

  it('every automation recommended on a card is decided in Days 15–21 — catering at AI fit 60 included, nothing capped', () => {
    expect(CATERING.aiFitScore).toBe(60);
    const decide = plan('DAYS 15–21').actions;
    const pilots = decide.filter((a) => /consider a limited, monitored pilot of/.test(a));
    // In report priority order: retention 52, phone 50, catering 49.
    expect(pilots.map((a) => a.match(/pilot of (.+?) —/)![1])).toEqual([
      'Customer Reactivation & Follow-Up Automation', 'AI Front Desk & Missed-Call Text Back', 'Lead Capture & Inquiry Automation',
    ]);
    const catering = pilots[2];
    expect(catering).toMatch(/^If the inquiry records show slow or missed responses to catering or private-event requests: /);
    expect(catering).toMatch(/intake questions and acknowledgment wording approved by the owner; every inquiry verified to route to a named staff member; human escalation tested\) and the owner approves the pilot\./);
    expect(decide.at(-1)).toMatch(/make no automation change/);
    // Each card that recommends an automation has its decision here.
    const DECIDED_AS: [RegExp, string][] = [[/AI Front Desk/, 'AI Front Desk & Missed-Call Text Back'], [/AI-assisted inquiry intake/, 'Lead Capture & Inquiry Automation'], [/Reactivation/, 'Customer Reactivation & Follow-Up Automation']];
    for (const f of dto.findings) {
      for (const [mentions, decided] of DECIDED_AS) {
        if (mentions.test(f.recommendedAction)) expect(pilots.some((a) => a.includes(`pilot of ${decided} —`)), `${f.title} → ${decided}`).toBe(true);
      }
    }
  });
});
