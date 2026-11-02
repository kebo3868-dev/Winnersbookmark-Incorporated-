/**
 * RELEASE SAFETY POLICY — security review of 1e2c271 (CHANGES REQUIRED).
 *
 * Driven through the real loader (loadExecutiveReport over a database double),
 * the real web report page and the real PDF route — not the filter functions
 * alone. A stored audit is poisoned in every narrative field a client report
 * reads: the AI summary, every finding's recommended solution, the tier
 * rationale, a finding's title, description and impact, a journey finding, an
 * evidence fact and a score explanation.
 *
 *  1 Guest-communication bypasses ("Calls are to be answered by a prerecorded
 *    greeter.", "A speech engine could field all of the late evening calls.")
 *  2 Cross-sentence references ("The AI Front Desk is available. It should be
 *    installed.") — here and in sales-brief-automation-gate.test.ts
 *  3 Every rendered recommendation field: audited templates, or a fallback
 *  4 Authorisation bound to the restaurant and product, from structured records
 *  5 No false positives on operational improvements and human staffing
 *  6 Fail-closed: no AI summary is shown; unknown recommendation text is not
 *    shown unchanged
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import levFixture from './fixtures/leverocks-local-audit-opportunities.json';
import { ADVERSARIAL_NARRATIVE, REPORTED_1E2C271, SAFE_NARRATIVE, WRONG_ENTITY } from './fixtures/narrative-policy-cases';
import { assessNarrative } from '@/lib/reports/narrativePolicy';
import { auditedSolutionsFor, presentFindingRecommendation } from '@/lib/reports/recommendationTemplates';
import { authorisePilotImplementation, NO_PILOT_RECORDS, type PilotRecords } from '@/lib/reports/pilotAuthorization';
import { buildExecutiveReport, type ExecutiveReportDTO, type ExecutiveReportInput } from '@/lib/reports/executive';

(globalThis as { React?: typeof React }).React = React;

type Opp = ExecutiveReportInput['opportunities'][number];
const lev = (levFixture as { opportunities: Opp[] }).opportunities;
const PHONE_PRODUCT = 'AI Front Desk & Missed-Call Text Back';
const AUDIT_ID = 'cmvrelease000000000000001';

// ── The stored audit, as the database returns it ───────────────────────────

interface Poison {
  summary?: string;
  solution?: string;
  rationale?: string;
  tier?: string;
  observation?: string;
}
let poison: Poison = {};
const writes: string[] = [];

function storedAudit() {
  const o = poison.observation;
  return {
    id: AUDIT_ID, status: 'COMPLETED', demoMode: false,
    createdAt: new Date('2026-11-01T12:00:00Z'), completedAt: new Date('2026-11-01T12:05:00Z'),
    avgTicketInput: null, overallScore: 84, coverageScore: 80,
    restaurant: { name: "Leverock's Great Seafood", websiteUrl: 'https://leverocks.example/', city: 'St. Petersburg', state: 'FL' },
    sources: [{ id: 's1', status: 'COLLECTED', url: 'https://leverocks.example/' }],
    evidence: [
      { id: 'e1', evidenceType: 'PHONE_NUMBER', fact: 'A phone number is publicly displayed: 727-555-0100.', supportingContext: null, confidence: 95, auditSourceId: 's1' },
      { id: 'e2', evidenceType: 'NOTE', fact: o ?? 'The homepage links to a private-party page.', supportingContext: null, confidence: 80, auditSourceId: 's1' },
    ],
    opportunities: lev.map((opp, i) => ({
      ...opp,
      recommendedSolution: poison.solution ?? opp.recommendedSolution,
      ...(i === lev.length - 1 && o ? { title: o, problem: o, businessImpact: o } : {}),
    })),
    journeyStages: [
      { stage: 'WEBSITE', status: 'HEALTHY', finding: 'The website loaded successfully.', manualValidationRequired: false },
      { stage: 'PHONE', status: 'FRICTION', finding: o ?? 'A phone number is displayed; call handling is not observable.', manualValidationRequired: true },
    ],
    scores: [{ category: 'PHONE', score: 60, insufficientData: false, explanation: o ?? 'Phone pathway present; volume unknown.' }],
    reports: [{
      content: {
        executiveSummary: poison.summary ?? 'Stored summary.',
        aiNarrativeUsed: Boolean(poison.summary),
        recommendation: { tier: poison.tier ?? 'AI FRONT DESK SYSTEM', rationale: poison.rationale ?? 'unknown rationale' },
      },
    }],
  };
}

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: {
      findUnique: async () => storedAudit(),
      update: async () => { writes.push('audit.update'); throw new Error('write'); },
    },
    report: { update: async () => { writes.push('report.update'); throw new Error('write'); } },
    opportunity: { update: async () => { writes.push('opportunity.update'); throw new Error('write'); } },
  },
  resolveDatabaseUrl: () => 'postgresql://localhost:5432/test',
  resolveDatabaseUrlSource: () => 'DATABASE_URL',
  RUNTIME_URL_SOURCES: ['DATABASE_URL'],
}));
const requestHeaders = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined }),
}));

const USER = 'operator';
const PASSWORD = 'operator-password-for-tests-0001';
const AUTH = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`;
const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, BASIC_AUTH_USER: USER, BASIC_AUTH_PASSWORD: PASSWORD };
  requestHeaders.set('authorization', AUTH);
  poison = {};
  writes.length = 0;
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function loadDto(): Promise<ExecutiveReportDTO> {
  const { checkOperator } = await import('@/lib/operatorAuth');
  const { loadExecutiveReport } = await import('@/lib/reports/executiveData');
  const check = checkOperator(AUTH);
  if (!check.ok) throw new Error('operator refused');
  const result = await loadExecutiveReport(check.operator, AUDIT_ID);
  if (result.status !== 'ok') throw new Error(result.status);
  return result.dto;
}
async function webText(): Promise<string> {
  const Page = (await import('@/app/audits/[auditId]/report/page')).default;
  return renderToStaticMarkup((await Page({ params: Promise.resolve({ auditId: AUDIT_ID }) })) as React.ReactElement)
    .replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}
async function pdfText(): Promise<string> {
  const { GET } = await import('@/app/api/audits/[auditId]/report/pdf/route');
  const response = await GET(new Request(`https://x.invalid/api/audits/${AUDIT_ID}/report/pdf`, { headers: { authorization: AUTH } }), {
    params: Promise.resolve({ auditId: AUDIT_ID }),
  });
  expect(response.status).toBe(200);
  const pdf = Buffer.from(await response.arrayBuffer());
  const latin = pdf.toString('latin1');
  const runs: string[] = [];
  for (const match of latin.matchAll(/stream\r?\n/g)) {
    const start = match.index! + match[0].length;
    let data = pdf.subarray(start, latin.indexOf('endstream', start));
    try { data = zlib.inflateSync(data); } catch { continue; }
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
/**
 * Letters and digits only, lower-cased: a line break, a hyphenation point or a
 * glyph the PDF text layer does not map back (an em dash, a curly quote)
 * cannot hide a match or fake a miss.
 */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const everywhere = (p: string): Poison => ({ summary: p, solution: p, rationale: p, observation: p });

// ── 1–3, 6: the reported bypasses, stored everywhere ───────────────────────

describe('the reported bypasses never reach the client report, web or PDF', () => {
  for (const phrase of REPORTED_1E2C271) {
    it(`"${phrase}"`, async () => {
      expect(assessNarrative(phrase).safe).toBe(false);
      poison = everywhere(phrase);
      const dto = await loadDto();
      expect(squash(JSON.stringify(dto))).not.toContain(squash(phrase));
      const [web, pdf] = [await webText(), await pdfText()];
      for (const text of [web, pdf]) expect(squash(text)).not.toContain(squash(phrase));
      expect(dto.summaryWasAiEnhanced).toBe(false);
      expect(writes).toEqual([]);
    }, 60_000);
  }
});

describe('every adversarial case, stored in every narrative field, is absent from the loaded report and the web page', () => {
  it(`${ADVERSARIAL_NARRATIVE.length} cases`, async () => {
    for (const phrase of ADVERSARIAL_NARRATIVE) {
      expect(assessNarrative(phrase).safe, phrase).toBe(false);
      poison = everywhere(phrase);
      const dto = await loadDto();
      expect(squash(JSON.stringify(dto)), phrase).not.toContain(squash(phrase));
      expect(squash(await webText()), phrase).not.toContain(squash(phrase));
    }
  }, 120_000);

  it('and from the PDF, for a sample across every category', async () => {
    const sample = ADVERSARIAL_NARRATIVE.filter((_, i) => i % 6 === 0);
    for (const phrase of sample) {
      poison = everywhere(phrase);
      expect(squash(await pdfText()), phrase).not.toContain(squash(phrase));
    }
  }, 180_000);
});

// ── 3, 6: recommendations are audited templates ────────────────────────────

describe('recommendations are audited templates; unknown stored text is not shown', () => {
  it("every recommendation in the Leverock's audit is an audited engine string for its category", () => {
    for (const o of lev) expect(auditedSolutionsFor(o.category).map((a) => a.replace(/\s+/g, ' ')), o.category).toContain(o.recommendedSolution.replace(/\s+/g, ' '));
  });

  it('the current engine strings are the audited ones (drift check against leaks.ts)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/lib/audit/leaks.ts'), 'utf8').replace(/'\s*\+\s*'/g, '').replace(/\s+/g, ' ');
    for (const probe of [
      'Fix the broken link(s) immediately. This is a direct website repair, not an AI project.',
      'Publish the menu as a mobile-friendly HTML page (keep the PDF as secondary). Basic optimization — no AI required.',
      'Fix hosting/SSL and mobile viewport configuration. Direct web work — no AI required.',
      'Establish one primary direct-order path and demote third-party links. Quantify commission exposure in discovery.',
    ]) {
      expect(src).toContain(probe);
      expect(auditedSolutionsFor(probe.startsWith('Fix the broken') ? 'BROKEN CUSTOMER PATHWAY' : probe.startsWith('Publish the menu') ? 'MENU ACCESS FRICTION' : probe.startsWith('Fix hosting') ? 'WEBSITE TECHNICAL FOUNDATION' : 'THIRD-PARTY ORDERING DEPENDENCY')).toContain(probe);
    }
  });

  it('unknown stored text — even harmless-looking — is replaced with the category template, for every category', async () => {
    poison = { solution: 'Call us to discuss options for the phones.' };
    const dto = await loadDto();
    for (const f of dto.findings) {
      expect(f.recommendedAction, f.category).not.toContain('Call us to discuss');
      expect(f.recommendedAction, f.category).toBe(presentFindingRecommendation({ ...f, aiFitScore: f.internalScores.aiFit, recommendedSolution: '' }));
    }
  });

  it('historical phone and catering wording is presented in its audited form', () => {
    const phone = presentFindingRecommendation({
      category: 'PHONE-DEPENDENT CUSTOMER JOURNEY', aiFitScore: 95,
      recommendedSolution: 'Winnersbookmark AI Front Desk System: AI voice receptionist, missed-call text-back, FAQ automation, and after-hours lead capture. Validate call volume in a discovery call first.',
    });
    expect(phone).toMatch(/^Before any system: pull 30 days of call records/);
    expect(phone).toMatch(/may be worth a limited, monitored pilot — only after/);
    const catering = presentFindingRecommendation({ category: 'CATERING LEAD CAPTURE OPPORTUNITY', aiFitScore: 60, recommendedSolution: 'AI-assisted intake is the matched fix.' });
    expect(catering).toMatch(/no automation purchase is justified and no pilot is recommended/);
  });

  it('a tier rationale is an audited template; an unknown tier is shown as the validation step', async () => {
    poison = { rationale: REPORTED_1E2C271[0] };
    let dto = await loadDto();
    expect(dto.recommendation.body).toMatch(/AI FRONT DESK SYSTEM/);
    expect(dto.recommendation.body).not.toContain('prerecorded');
    poison = { tier: 'AI FRONT DESK — INSTALL NOW', rationale: 'Install it.' };
    dto = await loadDto();
    expect(dto.recommendation.body).toMatch(/AI DISCOVERY AUDIT/);
    expect(dto.recommendation.body).not.toMatch(/INSTALL NOW|Install it/);
  });

  it('no AI summary is shown, however safe it looks', async () => {
    poison = { summary: 'Our audit analyzed 8 public pages. The website loads correctly.' };
    const dto = await loadDto();
    expect(dto.summaryWasAiEnhanced).toBe(false);
    expect(dto.executiveSummary).not.toBe('Our audit analyzed 8 public pages. The website loads correctly.');
    expect(dto.executiveSummary).toMatch(/^Our audit analyzed 1 public page\(s\) of the Leverock's Great Seafood digital presence/);
  });
});

// ── 5: legitimate content is kept ──────────────────────────────────────────

describe('operational improvements, human staffing and observations are shown as written', () => {
  it('each passes the policy and appears unchanged, as a stored observation, in the loaded report, the web page and the PDF', async () => {
    for (const phrase of SAFE_NARRATIVE) expect(assessNarrative(phrase), phrase).toEqual({ safe: true, violations: [] });
    for (const phrase of SAFE_NARRATIVE.slice(0, 16)) {
      poison = { observation: phrase };
      const dto = await loadDto();
      expect(dto.appendix.map((e) => e.fact), phrase).toContain(phrase);
      expect(squash(await webText()), phrase).toContain(squash(phrase));
    }
    poison = { observation: SAFE_NARRATIVE[7] };
    expect(squash(await pdfText())).toContain(squash(SAFE_NARRATIVE[7]));
  }, 120_000);

  it('the deterministic conditional pilot decision for the audit’s own pilot candidate is kept, on the card and in Days 15–21', async () => {
    const dto = await loadDto();
    const phone = dto.findings.find((f) => /PHONE-DEPENDENT/.test(f.category))!;
    expect(phone.recommendedAction).toMatch(/may be worth a limited, monitored pilot — only after it passes its own readiness and safety tests/);
    const days15 = dto.thirtyDayPlan.find((p) => p.phase === 'DAYS 15–21')!.actions.join(' ');
    expect(days15).toMatch(new RegExp(`consider a limited, monitored pilot of ${PHONE_PRODUCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    for (const text of [await webText(), await pdfText()]) {
      expect(squash(text)).toContain(squash('may be worth a limited, monitored pilot — only after it passes its own readiness and safety tests'));
    }
  }, 60_000);
});

// ── Web and PDF parity ─────────────────────────────────────────────────────

describe('the web report and the PDF print the same summary and recommendations', () => {
  it('clean and poisoned stored data alike', async () => {
    for (const p of [{}, everywhere(REPORTED_1E2C271[1])]) {
      poison = p;
      const dto = await loadDto();
      const [web, pdf] = [squash(await webText()), squash(await pdfText())];
      for (const text of [web, pdf]) {
        expect(text).toContain(squash(dto.executiveSummary.slice(0, 120)));
        for (const f of dto.findings) expect(text, f.category).toContain(squash(f.recommendedAction.slice(0, 80)));
      }
    }
  }, 120_000);
});

// ── 4: authorisation bound to entities and evidence ────────────────────────

describe('implementation is authorised only by structured records bound to this restaurant and this product', () => {
  const target = { restaurantId: AUDIT_ID, product: PHONE_PRODUCT };
  const valid: PilotRecords = {
    demand: [{ restaurantId: AUDIT_ID, product: PHONE_PRODUCT, source: 'RESTAURANT_OPERATING_RECORDS', measurableDemand: true, verifiedByOperator: true }],
    readiness: [{ restaurantId: AUDIT_ID, product: PHONE_PRODUCT, readinessTest: 'PASSED', safetyTest: 'PASSED' }],
    approvals: [{ restaurantId: AUDIT_ID, product: PHONE_PRODUCT, approverRole: 'OWNER', decision: 'APPROVED', scope: 'LIMITED_MONITORED_PILOT' }],
  };

  it('all three bound records authorise; nothing less does', () => {
    expect(authorisePilotImplementation(target, valid)).toEqual({ implementationAuthorised: true, missing: [] });
    expect(authorisePilotImplementation(target, NO_PILOT_RECORDS)).toEqual({ implementationAuthorised: false, missing: ['demand', 'readiness', 'approval'] });
  });

  const WRONG: [string, PilotRecords][] = [
    ["another restaurant's demand", { ...valid, demand: [{ ...valid.demand[0], restaurantId: 'cmvharborgrill00000000001' }] }],
    ['industry data as demand', { ...valid, demand: [{ ...valid.demand[0], source: 'INDUSTRY_DATA' }] }],
    ['vendor data as demand', { ...valid, demand: [{ ...valid.demand[0], source: 'VENDOR_DATA' }] }],
    ['demand not measurable', { ...valid, demand: [{ ...valid.demand[0], measurableDemand: false }] }],
    ['demand not verified', { ...valid, demand: [{ ...valid.demand[0], verifiedByOperator: false }] }],
    ["another product's readiness tests", { ...valid, readiness: [{ ...valid.readiness[0], product: 'Customer Reactivation & Follow-Up Automation' }] }],
    ['readiness test failed', { ...valid, readiness: [{ ...valid.readiness[0], readinessTest: 'FAILED' }] }],
    ['safety test incomplete', { ...valid, readiness: [{ ...valid.readiness[0], safetyTest: 'INCOMPLETE' }] }],
    ['vendor approval', { ...valid, approvals: [{ ...valid.approvals[0], approverRole: 'VENDOR' }] }],
    ['staff approval', { ...valid, approvals: [{ ...valid.approvals[0], approverRole: 'STAFF' }] }],
    ['approval withheld', { ...valid, approvals: [{ ...valid.approvals[0], decision: 'WITHHELD' }] }],
    ['approval of a full roll-out, not a limited pilot', { ...valid, approvals: [{ ...valid.approvals[0], scope: 'FULL_ROLLOUT' }] }],
    ["another restaurant's owner", { ...valid, approvals: [{ ...valid.approvals[0], restaurantId: 'cmvharborgrill00000000001' }] }],
    ['approval of another product', { ...valid, approvals: [{ ...valid.approvals[0], product: 'Lead Capture & Inquiry Automation' }] }],
  ];
  for (const [label, records] of WRONG) {
    it(`not authorised: ${label}`, () => {
      expect(authorisePilotImplementation(target, records).implementationAuthorised).toBe(false);
    });
  }

  it('the report carries the decision per card: never authorised from stored text, and only for its own restaurant and product from records', async () => {
    poison = { summary: WRONG_ENTITY[1], solution: WRONG_ENTITY[0], rationale: WRONG_ENTITY[2] };
    const dto = await loadDto();
    for (const card of dto.rankedAiOpportunities) expect(card.pilotAuthorisation.implementationAuthorised, card.solutionCategory).toBe(false);
    const input = (records: PilotRecords): ExecutiveReportInput => ({
      auditId: AUDIT_ID, restaurantName: "Leverock's Great Seafood", websiteUrl: 'https://leverocks.example/', location: null, auditDate: '2026-11-01',
      auditStatus: 'COMPLETED', demoMode: false,
      contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call.' },
      bookingQrDataUrl: null, avgTicket: null, overallScore: 84, coverageScore: 80, sourcesCollected: 1, sourcesFailed: 0, evidence: [], opportunities: lev,
      journey: [], categoryScores: [], storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null, pilotRecords: records,
    });
    const phoneCard = (records: PilotRecords) => buildExecutiveReport(input(records)).rankedAiOpportunities.find((c) => c.solutionCategory === PHONE_PRODUCT)!;
    expect(phoneCard(valid).pilotAuthorisation.implementationAuthorised).toBe(true);
    for (const [label, records] of WRONG) expect(phoneCard(records).pilotAuthorisation.implementationAuthorised, label).toBe(false);
    const catering = buildExecutiveReport(input(valid)).rankedAiOpportunities.find((c) => c.exploratory)!;
    expect(catering.pilotAuthorisation.implementationAuthorised).toBe(false);
  });

  it('the loader passes no records, so no report authorises implementation in this release', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/lib/reports/executiveData.ts'), 'utf8');
    expect(src).not.toMatch(/pilotRecords/);
  });
});

// ── Preservation ───────────────────────────────────────────────────────────

describe('scores, classifications, confidence labels and the plan are unchanged by poisoned text', () => {
  it('a poisoned summary and rationale change nothing else: scores, findings, labels, recommendations and the 30-day plan are identical', async () => {
    const clean = await loadDto();
    poison = { summary: REPORTED_1E2C271[0], rationale: REPORTED_1E2C271[1] };
    const poisoned = await loadDto();
    expect(poisoned.score).toEqual(clean.score);
    expect(poisoned.executiveSummary).toBe(clean.executiveSummary);
    expect(poisoned.findings).toEqual(clean.findings);
    expect(poisoned.thirtyDayPlan).toEqual(clean.thirtyDayPlan);
    expect(writes).toEqual([]);
  });

  it('poisoned recommendation text changes only the recommendation wording (to the templates): scores, classifications, labels and the plan structure are identical', async () => {
    const clean = await loadDto();
    poison = { solution: REPORTED_1E2C271[2] };
    const poisoned = await loadDto();
    expect(poisoned.score).toEqual(clean.score);
    expect(poisoned.findings.map((f) => [f.category, f.title, f.classification, f.labels, f.internalScores]))
      .toEqual(clean.findings.map((f) => [f.category, f.title, f.classification, f.labels, f.internalScores]));
    expect(poisoned.thirtyDayPlan.map((p) => [p.phase, p.actions.length])).toEqual(clean.thirtyDayPlan.map((p) => [p.phase, p.actions.length]));
    expect(poisoned.thirtyDayPlan.slice(2)).toEqual(clean.thirtyDayPlan.slice(2));
    expect(writes).toEqual([]);
  });
});
