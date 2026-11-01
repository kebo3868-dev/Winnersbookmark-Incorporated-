/**
 * THE 30-DAY PLAN NEVER RECOMMENDS AUTOMATION AHEAD OF ITS GATES.
 *
 * Review of PR #77 (REQUEST CHANGES): Days 8–14 ("fix the highest-priority
 * digital issue") printed whatever the top findings recommended. With no
 * low-AI-fit finding it fell back to the automation findings, and printed
 * "…the Winnersbookmark AI Front Desk … is the matched fix"; the catering
 * finding (AI fit 60) printed "…AI-assisted intake … is the matched fix" even
 * without the fallback. Both opened by repeating the Days 1–7 record pull, and
 * neither was gated on the system's own readiness testing.
 *
 * The rules pinned here:
 *  - Days 8–14 lists only verified, direct website fixes; with none, it says
 *    validation continues and no automation change is authorized.
 *  - Days 8–14 never names an automation, never calls anything "the matched
 *    fix", and never repeats a Days 1–7 step.
 *  - Days 15–21 considers an automation only if the records show the demand,
 *    and only after the system passes its own readiness and safety checks
 *    (named for that automation) — then a limited, monitored pilot; otherwise
 *    no automation change.
 */
import { describe, expect, it } from 'vitest';
import levFixture from './fixtures/leverocks-local-audit-opportunities.json';
import { buildExecutiveReport, directFixesFor, type ExecutiveReportInput } from '@/lib/reports/executive';
import { ORDER_BUTTON_CATEGORY } from '@/lib/audit/orderButtonFinding';

type Opp = ExecutiveReportInput['opportunities'][number];
const lev = (levFixture as { opportunities: Opp[] }).opportunities;
const levBy = (category: string) => lev.find((o) => o.category === category)!;

const opp = (category: string, aiFitScore: number, manual: boolean, priority: number, recommendedSolution: string): Opp => ({
  category, title: `${category.toLowerCase()} finding`, problem: 'OBSERVED: something on the public site.', businessImpact: 'Why it matters.',
  customerJourneyStage: 'WEBSITE', evidenceIds: [], impactScore: 50, urgencyScore: 40, confidenceScore: manual ? 55 : 85,
  aiFitScore, rescuePriorityScore: priority, recommendedSolution, manualValidationRequired: manual,
});

// Recommended-solution texts exactly as the engine writes them (leaks.ts; the
// order-button, phone, catering and CTA texts come from the stored Leverock's
// audit in the fixture).
const ORDER_BUTTON = { ...levBy(ORDER_BUTTON_CATEGORY), rescuePriorityScore: 90 };
const PHONE = { ...levBy('PHONE-DEPENDENT CUSTOMER JOURNEY'), rescuePriorityScore: 85 };
const CATERING = { ...levBy('CATERING LEAD CAPTURE OPPORTUNITY'), rescuePriorityScore: 70 };
const CTA_MANUAL = { ...levBy('CONFUSING CTA HIERARCHY'), rescuePriorityScore: 60 };
const RETENTION = opp('CUSTOMER RETENTION — NO PUBLIC OPT-IN ROUTE', 85, true, 80,
  'First check whether a list already exists in your POS or reservation system — if it does, this is a publishing gap, not a data gap. ' +
  'If it does not, a visible email/SMS capture offer is the starting point, and an AI Reactivation Campaign only becomes worth discussing once there is a list to reactivate.');
const BROKEN_LINK = opp('BROKEN CUSTOMER PATHWAY', 20, false, 75, 'Fix the broken link(s) immediately. This is a direct website repair, not an AI project.');
const TECHNICAL = opp('WEBSITE TECHNICAL FOUNDATION', 10, false, 65, 'Fix hosting/SSL and mobile viewport configuration. Direct web work — no AI required.');
const CONTACT_MANUAL = opp('CONTACT PATH FRICTION', 40, true, 55,
  'Publish hours and address in the site header/footer as text (not images). Verify manually — this information may exist in a format collection could not read.');

function report(opportunities: Opp[]) {
  const input: ExecutiveReportInput = {
    auditId: 'cplan00001', restaurantName: "Leverock's Great Seafood", websiteUrl: 'https://leverocks.example/', location: 'St. Petersburg, FL',
    auditDate: '2026-11-01', auditStatus: 'COMPLETED', demoMode: false,
    contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null, avgTicket: null, overallScore: 84, coverageScore: 80, sourcesCollected: 8, sourcesFailed: 0,
    evidence: [], opportunities,
    journey: [{ stage: 'RESERVATION', status: 'UNKNOWN', finding: 'Not resolved.', manualValidationRequired: true }],
    categoryScores: [], storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null,
  };
  const dto = buildExecutiveReport(input);
  const phase = (p: string) => dto.thirtyDayPlan.find((x) => x.phase === p)!;
  return { dto, validate: phase('DAYS 1–7'), fix: phase('DAYS 8–14'), decide: phase('DAYS 15–21') };
}

/** Anything in Days 8–14 that recommends, names or schedules an automation. */
const AUTOMATION_IN_FIX =
  /matched fix|AI Front Desk|AI-assisted|AI Reactivation|Reactivation|AI FAQ|chatbot|voice answering|missed-call text-back|\bpilot\b|\bdeploy|implement (the|an|any) (AI|automation)/i;
/** Days 1–7 data collection, restated. */
const VALIDATION_STEP_IN_FIX = /pull 30 days|before any system|collect acknowledgment records|call records|phone records/i;

function expectDays8to14Safe(r: ReturnType<typeof report>) {
  const text = r.fix.actions.join(' ');
  expect(text, 'Days 8–14 names or recommends an automation').not.toMatch(AUTOMATION_IN_FIX);
  expect(text, 'Days 8–14 repeats Days 1–7 data collection').not.toMatch(VALIDATION_STEP_IN_FIX);
  for (const step of r.validate.actions) expect(r.fix.actions, `repeats Days 1–7: ${step}`).not.toContain(step);
}

const READINESS: Record<string, RegExp> = {
  'AI Front Desk & Missed-Call Text Back': /answers on hours, menu and ordering checked against the restaurant's own information; missed-call text-back and transfer to staff tested/,
  'Customer Reactivation & Follow-Up Automation': /consent and opt-out handling checked for every guest contact; message content and sending frequency approved by the owner/,
  'Lead Capture & Inquiry Automation': /intake questions and acknowledgment wording approved by the owner; every inquiry verified to route to a named staff member; human escalation tested/,
};

function expectDays15to21Gated(r: ReturnType<typeof report>, candidates: string[]) {
  const actions = r.decide.actions;
  expect(r.decide.heading).toBe('DECIDE & PILOT IF READY');
  expect(actions.join(' ')).not.toMatch(/\bdeploy/i);
  if (candidates.length === 0) {
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatch(/If they show repetitive demand, consider a limited, monitored pilot .* only after it passes its own readiness and safety checks; otherwise make no automation change/);
    return;
  }
  expect(actions[0]).toBe('Review the operational evidence collected in Days 1–7 before choosing any automation.');
  const pilots = actions.slice(1, -1);
  expect(pilots).toHaveLength(candidates.length);
  pilots.forEach((line, i) => {
    // 1. demand shown by the records  2. own readiness and safety checks  3. only then a limited, monitored pilot
    expect(line).toMatch(/^If (the|a) .+: consider a limited, monitored pilot of /);
    expect(line).toContain(`pilot of ${candidates[i]} — only after the proposed system passes its own readiness and safety checks for this restaurant (`);
    expect(line).toMatch(READINESS[candidates[i]]);
    expect(line).toMatch(/\) and the owner approves the pilot\. Set success metrics and human escalation before it starts\.$/);
  });
  // 4. otherwise, no automation change
  expect(actions[actions.length - 1]).toMatch(/^If the records do not show that demand, or the system has not passed those checks, make no automation change — /);
}

describe('Days 8–14 when every top finding is an automation candidate', () => {
  // The review's reproduction: phone (fit 95), retention (85) and catering (60).
  const r = report([PHONE, RETENTION, CATERING]);

  it('lists no automation and no fallback — it says no website fix is confirmed and no automation change is authorized', () => {
    expect(r.fix.heading).toBe('COMPLETE VALIDATION — NO AUTOMATION CHANGE');
    expect(r.fix.actions).toEqual([
      'No website fix is confirmed by the public evidence. Use this week to finish the Days 1–7 validation and to correct anything it confirms.',
      'No automation change is authorized in this phase; any automation is decided in Days 15–21, under the conditions set out there.',
    ]);
    expectDays8to14Safe(r);
  });

  it('Days 15–21 carries the automations, each behind demand, its own readiness checks, then a monitored pilot', () => {
    // All three, catering included at AI fit 60, and none dropped by a cap.
    expectDays15to21Gated(r, ['AI Front Desk & Missed-Call Text Back', 'Customer Reactivation & Follow-Up Automation', 'Lead Capture & Inquiry Automation']);
    expect(r.decide.actions.at(-1)).toMatch(/continue with the validated findings\.$/);
  });
});

describe('Days 8–14 with direct website fixes and automation opportunities together', () => {
  const r = report([ORDER_BUTTON, PHONE, BROKEN_LINK, CATERING, TECHNICAL, CTA_MANUAL]);

  it('lists only the verified direct fixes, highest priority first', () => {
    expect(r.fix.heading).toBe('FIX THE HIGHEST-PRIORITY DIGITAL ISSUE');
    expect(r.fix.actions).toEqual([ORDER_BUTTON.recommendedSolution, BROKEN_LINK.recommendedSolution, TECHNICAL.recommendedSolution]);
    expectDays8to14Safe(r);
  });

  it('the catering finding (AI fit 60) is not a website fix: its "AI-assisted intake … is the matched fix" stays out', () => {
    expect(CATERING.aiFitScore).toBeLessThan(70);
    expect(CATERING.recommendedSolution).toMatch(/AI-assisted intake .* is the matched fix/);
    expect(r.fix.actions.join(' ')).not.toContain('AI-assisted');
  });

  it('Days 15–21 gates the AI Front Desk and catering intake, and points back to the website fixes otherwise', () => {
    expectDays15to21Gated(r, ['AI Front Desk & Missed-Call Text Back', 'Lead Capture & Inquiry Automation']);
    expect(r.decide.actions.at(-1)).toMatch(/put the time into the website fixes above\.$/);
  });
});

describe('Days 8–14 when no direct digital fix is confirmed', () => {
  // Direct-fix categories that still need owner data are not confirmed fixes;
  // they are walked in Days 1–7 ("each finding marked manual validation required").
  const r = report([CTA_MANUAL, CONTACT_MANUAL, PHONE]);

  it('says validation continues and no automation change is authorized', () => {
    expect(r.fix.heading).toBe('COMPLETE VALIDATION — NO AUTOMATION CHANGE');
    expect(r.fix.actions.join(' ')).toMatch(/No website fix is confirmed .* No automation change is authorized in this phase/);
    expect(r.fix.actions.join(' ')).not.toContain(CTA_MANUAL.recommendedSolution);
    expect(r.validate.actions).toContain('Walk each finding marked "manual validation required" against your own operating data.');
    expectDays8to14Safe(r);
  });

  it('with no findings at all, both phases still hold', () => {
    const empty = report([]);
    expect(empty.fix.heading).toBe('COMPLETE VALIDATION — NO AUTOMATION CHANGE');
    expectDays8to14Safe(empty);
    expectDays15to21Gated(empty, []);
  });
});

describe("the Leverock's audit", () => {
  // The four stored findings of the local Leverock's verification audit, in
  // their stored priority order.
  const r = report(lev);

  it('the fixture is the four-finding Leverock\'s shape', () => {
    expect(lev.map((o) => [o.category, o.aiFitScore, o.manualValidationRequired])).toEqual([
      [ORDER_BUTTON_CATEGORY, 15, false],
      ['PHONE-DEPENDENT CUSTOMER JOURNEY', 95, true],
      ['CATERING LEAD CAPTURE OPPORTUNITY', 60, true],
      ['CONFUSING CTA HIERARCHY', 25, true],
    ]);
  });

  it('Days 8–14 is the order-button website fix, and nothing else', () => {
    expect(r.fix.heading).toBe('FIX THE HIGHEST-PRIORITY DIGITAL ISSUE');
    expect(r.fix.actions).toEqual([ORDER_BUTTON.recommendedSolution]);
    expect(r.fix.actions[0]).toMatch(/A direct website fix, not an AI project\.$/);
    expectDays8to14Safe(r);
  });

  it('Days 15–21 gates the AI Front Desk on call records and catering intake on inquiry records, each with its own checks', () => {
    expectDays15to21Gated(r, ['AI Front Desk & Missed-Call Text Back', 'Lead Capture & Inquiry Automation']);
    expect(r.decide.actions[1]).toMatch(/^If the call records show calls going unanswered, or the same questions asked again and again: /);
    expect(r.decide.actions[2]).toMatch(/^If the inquiry records show slow or missed responses to catering or private-event requests: /);
  });

  it('no later phase repeats a Days 1–7 step, and the plan says "deploy" nowhere', () => {
    for (const later of [r.fix, r.decide]) for (const step of r.validate.actions) expect(later.actions).not.toContain(step);
    expect(JSON.stringify(r.dto.thirtyDayPlan)).not.toMatch(/\bdeploy/i);
  });
});

describe('every combination of eight representative findings', () => {
  const ALL = [ORDER_BUTTON, PHONE, RETENTION, BROKEN_LINK, CATERING, TECHNICAL, CTA_MANUAL, CONTACT_MANUAL];
  const DIRECT_VERIFIED = new Set([ORDER_BUTTON, BROKEN_LINK, TECHNICAL]);

  it('Days 8–14 is exactly the verified direct fixes (or the no-fix statement), and Days 15–21 is always gated', () => {
    for (let mask = 1; mask < 1 << ALL.length; mask++) {
      const chosen = ALL.filter((_, i) => mask & (1 << i));
      const r = report(chosen);
      const top = [...chosen].sort((a, b) => b.rescuePriorityScore - a.rescuePriorityScore).slice(0, r.dto.findings.length);
      const expectedFixes = top.filter((o) => DIRECT_VERIFIED.has(o)).slice(0, 3).map((o) => o.recommendedSolution);
      if (expectedFixes.length > 0) expect(r.fix.actions, `mask ${mask}`).toEqual(expectedFixes);
      else expect(r.fix.heading, `mask ${mask}`).toBe('COMPLETE VALIDATION — NO AUTOMATION CHANGE');
      expectDays8to14Safe(r);
      const NAME = new Map<Opp, string>([[PHONE, 'AI Front Desk & Missed-Call Text Back'], [RETENTION, 'Customer Reactivation & Follow-Up Automation'], [CATERING, 'Lead Capture & Inquiry Automation']]);
      // Every automation finding in the report, by priority — catering at fit 60 included, nothing capped.
      const candidates = top.filter((o) => NAME.has(o)).map((o) => NAME.get(o)!);
      expectDays15to21Gated(r, candidates);
    }
  });

  it('directFixesFor fails closed: unknown categories and automation wording are never fixes', () => {
    expect(directFixesFor([opp('SOME FUTURE CATEGORY', 10, false, 90, 'Change the page.')])).toEqual([]);
    expect(directFixesFor([{ ...BROKEN_LINK, recommendedSolution: 'The AI Front Desk is the matched fix.' }])).toEqual([]);
    expect(directFixesFor([{ ...BROKEN_LINK, recommendedSolution: 'Before any system: pull 30 days of call records.' }])).toEqual([]);
    expect(directFixesFor([{ ...BROKEN_LINK, aiFitScore: 75 }])).toEqual([]);
    expect(directFixesFor([{ ...BROKEN_LINK, manualValidationRequired: true }])).toEqual([]);
    expect(directFixesFor([BROKEN_LINK])).toEqual([BROKEN_LINK]);
  });
});
