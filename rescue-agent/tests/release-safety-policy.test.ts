/**
 * RELEASE SAFETY POLICY — reviews of 1e2c271, ca3be50 and 9b4329e.
 *
 * Driven through the real loader (loadExecutiveReport over a database double),
 * the real web report page and the real PDF route. The stored audit is the
 * Leverock's local verification audit (tests/fixtures/leverocks-stored-
 * audit.json): unaltered, every observation in it publishes with provenance.
 * Each test then poisons stored text the way a tampered or legacy record
 * would carry it:
 *
 *  - directly in an observation field: an evidence fact or supporting
 *    context, a journey finding, a finding's title, description and impact, a
 *    score explanation;
 *  - inside a real template's interpolated slot (the homepage title), where
 *    the frame has provenance and the slot text must assert nothing;
 *  - moved to another evidence type, or under a changed journey status, where
 *    the wording is real but its context is not;
 *  - in the AI summary, the recommended solutions and the tier rationale.
 *
 * Observations are PUBLISHED (observationPublication.ts): facts must be an
 * instance of an audited engine template for their evidence type with
 * claim-free slots; findings, journey and score text are regenerated from the
 * audit's own evidence and matched in context; anything else is neutral.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import levFixture from './fixtures/leverocks-local-audit-opportunities.json';
import storedFixture from './fixtures/leverocks-stored-audit.json';
import {
  ADVERSARIAL_NARRATIVE,
  ENDORSEMENTS,
  REPORTED_1E2C271,
  REPORTED_9B4329E,
  LEGITIMATE_9B4329E,
  WRONG_ENTITY,
} from './fixtures/narrative-policy-cases';
import { assessNarrative, isClaimFree } from '@/lib/reports/narrativePolicy';
import { NEUTRAL_FACT, publishAuditObservations } from '@/lib/reports/observationPublication';
import { auditedSolutionsFor, presentFindingRecommendation } from '@/lib/reports/recommendationTemplates';
import { authorisePilotImplementation, NO_PILOT_RECORDS, type PilotRecords } from '@/lib/reports/pilotAuthorization';
import { buildExecutiveReport, type ExecutiveReportDTO, type ExecutiveReportInput } from '@/lib/reports/executive';

(globalThis as { React?: typeof React }).React = React;

type Opp = ExecutiveReportInput['opportunities'][number];
const lev = (levFixture as { opportunities: Opp[] }).opportunities;
type Stored = typeof storedFixture;
const PHONE_PRODUCT = 'AI Front Desk & Missed-Call Text Back';
const AUDIT_ID = 'cmvrelease000000000000001';
/** The audited restaurant (Audit.restaurantId): a different id from the audit's. */
const RESTAURANT_ID = 'cmvrestaurantleverocks001';
const TITLE_FACT_ID = storedFixture.evidence.find((e) => e.evidenceType === 'BUSINESS_IDENTITY')!.id;
const FAQ_FACT_ID = storedFixture.evidence.find((e) => e.evidenceType === 'FAQ_SIGNAL')!.id;
const CLICK_FACT = storedFixture.evidence.find((e) => e.evidenceType === 'CLICK_TO_CALL')!;

// ── The stored audit, as the database returns it ───────────────────────────

interface Poison {
  summary?: string;
  solution?: string;
  rationale?: string;
  tier?: string;
  /** Written as is into every observation field. */
  observation?: string;
  /** Written into the homepage-title slot of a real evidence template. */
  titleSlot?: string;
  /** Any other edit to the stored copy. */
  edit?: (s: Stored) => void;
}
let poison: Poison = {};
const writes: string[] = [];

function storedAudit() {
  const s: Stored = structuredClone(storedFixture);
  const o = poison.observation;
  if (o) {
    for (const e of s.evidence) if (e.id === FAQ_FACT_ID) e.fact = o;
    for (const e of s.evidence) if (e.id === TITLE_FACT_ID) e.supportingContext = o;
    for (const j of s.journeyStages) j.finding = o;
    for (const op of s.opportunities) Object.assign(op, { title: o, problem: o, businessImpact: o });
    for (const sc of s.scores) sc.explanation = o;
  }
  if (poison.titleSlot !== undefined) for (const e of s.evidence) if (e.id === TITLE_FACT_ID) e.fact = `Homepage title: "${poison.titleSlot}".`;
  if (poison.solution) for (const op of s.opportunities) op.recommendedSolution = poison.solution;
  poison.edit?.(s);
  return {
    id: AUDIT_ID, restaurantId: RESTAURANT_ID, status: 'COMPLETED', demoMode: false,
    createdAt: new Date('2026-11-01T12:00:00Z'), completedAt: new Date('2026-11-01T12:05:00Z'),
    avgTicketInput: null, overallScore: s.overallScore, coverageScore: s.coverageScore,
    restaurant: { name: "Leverock's Great Seafood", websiteUrl: 'https://127.0.0.1:3443/', city: 'St. Petersburg', state: 'FL' },
    sources: s.sources,
    evidence: s.evidence,
    opportunities: s.opportunities,
    journeyStages: s.journeyStages,
    scores: s.scores,
    reports: [{
      content: {
        executiveSummary: poison.summary ?? 'Stored summary.',
        aiNarrativeUsed: Boolean(poison.summary),
        recommendation: { tier: poison.tier ?? 'AI DISCOVERY AUDIT', rationale: poison.rationale ?? 'unknown rationale' },
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
    evidence: { update: async () => { writes.push('evidence.update'); throw new Error('write'); } },
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
/** Letters and digits only, lower-cased: line breaks and unmapped PDF glyphs cannot hide or fake a match. */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const everywhere = (p: string): Poison => ({ summary: p, solution: p, rationale: p, observation: p, titleSlot: p });

// ── Provenance: the unaltered audit publishes in full ──────────────────────

describe('the unaltered Leverock’s audit publishes every observation with provenance', () => {
  it('no fact, finding, journey stage or score falls back; one marketing-copy context is withheld', () => {
    const s = storedFixture;
    const p = publishAuditObservations({
      evidence: s.evidence.map((e) => ({ ...e, sourceUrl: null })),
      journey: s.journeyStages,
      opportunities: s.opportunities,
      scores: s.scores,
    });
    expect(p.report).toEqual({
      evidence: { total: 26, factFallbacks: 0, contextOmitted: 1 },
      journey: { total: 10, fallbacks: 0 },
      opportunities: { total: 4, fallbacks: 0 },
      scores: { total: 9, fallbacks: 0 },
    });
    // The withheld context is the restaurant's own marketing copy, which asserts things the audit did not observe.
    const withheld = p.evidence.find((e) => e.provenance.supportingContext === 'FALLBACK')!;
    expect(withheld.evidenceType).toBe('BUSINESS_IDENTITY');
    expect(isClaimFree(storedFixture.evidence.find((e) => e.id === withheld.id)!.supportingContext!)).toBe(false);
    for (const e of p.evidence) expect(e.fact, e.evidenceType).toBe(storedFixture.evidence.find((x) => x.id === e.id)!.fact);
  });

  it('the loaded report shows every stored fact as written', async () => {
    const dto = await loadDto();
    expect(dto.appendix.map((e) => e.fact)).not.toContain(NEUTRAL_FACT);
    expect(writes).toEqual([]);
  });
});

// ── 1 (High): unsupported endorsements, wherever they are stored ───────────

describe('review of 9b4329e: the reported endorsements never reach the report, web or PDF', () => {
  for (const phrase of REPORTED_9B4329E) {
    it(`"${phrase}"`, async () => {
      expect(isClaimFree(phrase)).toBe(false);
      poison = everywhere(phrase);
      const dto = await loadDto();
      expect(squash(JSON.stringify(dto))).not.toContain(squash(phrase));
      for (const text of [await webText(), await pdfText()]) expect(squash(text)).not.toContain(squash(phrase));
      expect(writes).toEqual([]);
    }, 60_000);
  }

  it('in the homepage-title slot of a real template, the frame has provenance but the claim does not: neutral fact', async () => {
    for (const phrase of REPORTED_9B4329E) {
      poison = { titleSlot: phrase };
      const dto = await loadDto();
      expect(dto.appendix.map((e) => e.fact), phrase).toContain(NEUTRAL_FACT);
      expect(squash(JSON.stringify(dto)), phrase).not.toContain(squash(phrase));
    }
  });

  it('mixed-clause and multi-sentence attacks fail on the clause that claims or proposes', async () => {
    for (const phrase of [
      'The AI Front Desk is not a good fit, but buy it anyway.',
      'Repair the chatbot and install an AI Front Desk.',
      'The existing chatbot was detected, but the AI Front Desk is a great upgrade.',
      'The AI Front Desk was not discussed. It represents a quantum leap.',
    ]) {
      expect(assessNarrative(phrase).safe, phrase).toBe(false);
      poison = { titleSlot: phrase, observation: phrase };
      expect(squash(JSON.stringify(await loadDto())), phrase).not.toContain(squash(phrase));
    }
  });

  it('earlier reported bypasses and the adversarial corpus, stored everywhere, are absent from the loaded report and the web page', async () => {
    for (const phrase of [...REPORTED_1E2C271, ...ENDORSEMENTS, ...ADVERSARIAL_NARRATIVE]) {
      poison = everywhere(phrase);
      expect(squash(JSON.stringify(await loadDto())), phrase).not.toContain(squash(phrase));
      expect(squash(await webText()), phrase).not.toContain(squash(phrase));
    }
  }, 180_000);

  it('and from the PDF, for a sample across every category', async () => {
    for (const phrase of [...REPORTED_1E2C271, ...ADVERSARIAL_NARRATIVE].filter((_, i) => i % 8 === 0)) {
      poison = everywhere(phrase);
      expect(squash(await pdfText()), phrase).not.toContain(squash(phrase));
    }
  }, 180_000);
});

// ── 4 (Medium): legitimate negative evidence and repairs stay visible ──────

describe('legitimate negative assessments and repairs are published where they are supported', () => {
  it('each passes the policy and the claim-free check', () => {
    for (const phrase of LEGITIMATE_9B4329E) {
      expect(assessNarrative(phrase), phrase).toEqual({ safe: true, violations: [] });
      expect(isClaimFree(phrase), phrase).toBe(true);
    }
  });

  it('quoted in a real evidence template, each appears in the loaded report, the web report and the PDF', async () => {
    for (const phrase of LEGITIMATE_9B4329E) {
      poison = { titleSlot: phrase };
      const dto = await loadDto();
      expect(dto.appendix.map((e) => e.fact), phrase).toContain(`Homepage title: "${phrase}".`);
      expect(squash(await webText()), phrase).toContain(squash(phrase));
      expect(squash(await pdfText()), phrase).toContain(squash(phrase));
    }
  }, 120_000);

  it('the same statements, stored directly in an observation field with no provenance, are not published', async () => {
    poison = { observation: LEGITIMATE_9B4329E[0] };
    const dto = await loadDto();
    expect(dto.findings.map((f) => f.title)).not.toContain(LEGITIMATE_9B4329E[0]);
  });
});

// ── Provenance is contextual, not textual ──────────────────────────────────

describe('provenance is validated in context, not by matching text', () => {
  it('a real fact moved to another evidence type does not publish', async () => {
    poison = { edit: (s) => { for (const e of s.evidence) if (e.id === FAQ_FACT_ID) e.fact = CLICK_FACT.fact; } };
    const dto = await loadDto();
    expect(dto.appendix.find((e) => e.evidenceType === 'FAQ_SIGNAL')!.fact).toBe(NEUTRAL_FACT);
    expect(dto.appendix.filter((e) => e.fact === CLICK_FACT.fact)).toHaveLength(1);
  });

  it('a journey finding whose stored status the evidence does not support gets neutral wording; the stored status is kept', async () => {
    poison = { edit: (s) => { for (const j of s.journeyStages) if (j.stage === 'PHONE') { j.status = 'FRICTION'; j.finding = 'Calls are answered by an AI receptionist that is a great upgrade.'; } } };
    const dto = await loadDto();
    const json = JSON.stringify(dto);
    expect(json).not.toContain('great upgrade');
    expect(dto.journeyMap.find((s) => s.stage === 'PHONE')?.status ?? 'FRICTION').toBe('FRICTION');
  });

  it('a finding title is regenerated from evidence, not read: a real engine title from another category does not move', async () => {
    const otherTitle = storedFixture.opportunities.find((o) => o.category === 'CONFUSING CTA HIERARCHY')!.title;
    poison = { edit: (s) => { for (const o of s.opportunities) if (o.category === 'PHONE-DEPENDENT CUSTOMER JOURNEY') o.title = otherTitle; } };
    const dto = await loadDto();
    const phone = dto.findings.find((f) => f.category === 'PHONE-DEPENDENT CUSTOMER JOURNEY')!;
    expect(phone.title).not.toBe(otherTitle);
  });
});

// ── 2 (Medium): the phone-impact wording ───────────────────────────────────

describe('the phone finding’s impact is the evidence-backed sentence, never the old speculative one', () => {
  const NEW = "Call volume, unanswered calls, and repetitive questions require the restaurant's own records.";
  it('the engine writes the new sentence; the stored speculative sentence is not published', async () => {
    const stored = storedFixture.opportunities.find((o) => o.category === 'PHONE-DEPENDENT CUSTOMER JOURNEY')!.businessImpact;
    expect(stored).toMatch(/answering those calls automatically is worth measuring/);
    const dto = await loadDto();
    const json = JSON.stringify(dto);
    expect(json).not.toMatch(/answering those calls automatically/);
    expect(json).toContain(NEW);
    for (const text of [await webText(), await pdfText()]) {
      expect(squash(text)).not.toContain(squash('answering those calls automatically'));
      expect(squash(text)).toContain(squash(NEW));
    }
  }, 60_000);

  it('no sentence-based allowlist remains: the old sentence is rejected by the policy wherever it appears', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/lib/reports/recommendationTemplates.ts'), 'utf8');
    expect(src).not.toMatch(/AUDITED_ENGINE_OBSERVATION_SENTENCES/);
    expect(assessNarrative('If call volume turns out to be high and largely repetitive, answering those calls automatically is worth measuring.').safe).toBe(false);
  });
});

// ── Recommendations, tier and summary: audited templates ───────────────────

describe('recommendations are audited templates; unknown stored text is not shown', () => {
  it('unknown stored text — even harmless-looking — is replaced with the category template, for every category', async () => {
    poison = { solution: 'Call us to discuss options for the phones.' };
    const dto = await loadDto();
    for (const f of dto.findings) expect(f.recommendedAction, f.category).not.toContain('Call us to discuss');
  });

  it('a tier rationale is an audited template; an unknown tier is shown as the validation step', async () => {
    poison = { tier: 'AI FRONT DESK SYSTEM', rationale: REPORTED_9B4329E[0] };
    let dto = await loadDto();
    expect(dto.recommendation.body).toMatch(/AI FRONT DESK SYSTEM/);
    expect(squash(dto.recommendation.body)).not.toContain(squash('boon'));
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
  });

  it('historical phone and catering wording is presented in its audited form', () => {
    const phone = presentFindingRecommendation({
      category: 'PHONE-DEPENDENT CUSTOMER JOURNEY', aiFitScore: 95,
      recommendedSolution: 'Winnersbookmark AI Front Desk System: AI voice receptionist, missed-call text-back, FAQ automation, and after-hours lead capture. Validate call volume in a discovery call first.',
    });
    expect(phone).toMatch(/may be worth a limited, monitored pilot — only after/);
    expect(auditedSolutionsFor('PHONE-DEPENDENT CUSTOMER JOURNEY').length).toBeGreaterThan(0);
  });
});

// ── Web and PDF parity ─────────────────────────────────────────────────────

describe('the web report and the PDF print the same summary, recommendations and evidence', () => {
  it('clean, poisoned and legitimate-slot stored data alike', async () => {
    for (const p of [{}, everywhere(REPORTED_9B4329E[0]), { titleSlot: LEGITIMATE_9B4329E[2] }]) {
      poison = p;
      const dto = await loadDto();
      const [web, pdf] = [squash(await webText()), squash(await pdfText())];
      for (const text of [web, pdf]) {
        expect(text).toContain(squash(dto.executiveSummary.slice(0, 120)));
        for (const f of dto.findings) expect(text, f.category).toContain(squash(f.recommendedAction.slice(0, 80)));
        for (const e of dto.appendix) expect(text, e.evidenceType).toContain(squash(e.fact.slice(0, 60)));
      }
    }
  }, 120_000);
});

// ── Authorisation bound to restaurant identity and evidence ────────────────

describe('implementation is authorised only by structured records bound to this restaurant and this product', () => {
  // In-memory records only: none are written anywhere, and the loader passes none.
  const target = { restaurantId: RESTAURANT_ID, product: PHONE_PRODUCT };
  const valid: PilotRecords = {
    demand: [{ restaurantId: RESTAURANT_ID, product: PHONE_PRODUCT, source: 'RESTAURANT_OPERATING_RECORDS', measurableDemand: true, verifiedByOperator: true }],
    readiness: [{ restaurantId: RESTAURANT_ID, product: PHONE_PRODUCT, readinessTest: 'PASSED', safetyTest: 'PASSED' }],
    approvals: [{ restaurantId: RESTAURANT_ID, product: PHONE_PRODUCT, approverRole: 'OWNER', decision: 'APPROVED', scope: 'LIMITED_MONITORED_PILOT' }],
  };
  const keyedTo = (id: string): PilotRecords => ({
    demand: valid.demand.map((r) => ({ ...r, restaurantId: id })),
    readiness: valid.readiness.map((r) => ({ ...r, restaurantId: id })),
    approvals: valid.approvals.map((r) => ({ ...r, restaurantId: id })),
  });

  it('all three bound records authorise; nothing less does; no identity authorises nothing', () => {
    expect(authorisePilotImplementation(target, valid)).toEqual({ implementationAuthorised: true, missing: [] });
    expect(authorisePilotImplementation(target, NO_PILOT_RECORDS)).toEqual({ implementationAuthorised: false, missing: ['demand', 'readiness', 'approval'] });
    expect(authorisePilotImplementation({ restaurantId: null, product: PHONE_PRODUCT }, valid))
      .toEqual({ implementationAuthorised: false, missing: ['restaurant', 'demand', 'readiness', 'approval'] });
  });

  const WRONG: [string, PilotRecords][] = [
    ["another restaurant's demand", { ...valid, demand: [{ ...valid.demand[0], restaurantId: 'cmvharborgrill00000000001' }] }],
    ['industry data as demand', { ...valid, demand: [{ ...valid.demand[0], source: 'INDUSTRY_DATA' }] }],
    ["another product's readiness tests", { ...valid, readiness: [{ ...valid.readiness[0], product: 'Customer Reactivation & Follow-Up Automation' }] }],
    ['readiness test failed', { ...valid, readiness: [{ ...valid.readiness[0], readinessTest: 'FAILED' }] }],
    ['vendor approval', { ...valid, approvals: [{ ...valid.approvals[0], approverRole: 'VENDOR' }] }],
    ['approval withheld', { ...valid, approvals: [{ ...valid.approvals[0], decision: 'WITHHELD' }] }],
    ["another restaurant's owner", { ...valid, approvals: [{ ...valid.approvals[0], restaurantId: 'cmvharborgrill00000000001' }] }],
    ['every record keyed to the audit id instead of the restaurant id', keyedTo(AUDIT_ID)],
  ];
  for (const [label, records] of WRONG) {
    it(`not authorised: ${label}`, () => {
      expect(authorisePilotImplementation(target, records).implementationAuthorised).toBe(false);
    });
  }

  it('the report binds to the restaurant id; stored text never authorises; the loader passes no records', async () => {
    poison = { summary: WRONG_ENTITY[1], solution: WRONG_ENTITY[0], rationale: WRONG_ENTITY[2], titleSlot: WRONG_ENTITY[3] };
    const dto = await loadDto();
    for (const card of dto.rankedAiOpportunities.filter((c) => !c.exploratory)) {
      expect(card.pilotAuthorisation, card.solutionCategory).toEqual({ implementationAuthorised: false, missing: ['demand', 'readiness', 'approval'] });
    }
    const input = (records: PilotRecords, restaurantId: string | undefined = RESTAURANT_ID): ExecutiveReportInput => ({
      auditId: AUDIT_ID, restaurantId, restaurantName: "Leverock's Great Seafood", websiteUrl: 'https://leverocks.example/', location: null, auditDate: '2026-11-01',
      auditStatus: 'COMPLETED', demoMode: false,
      contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call.' },
      bookingQrDataUrl: null, avgTicket: null, overallScore: 84, coverageScore: 80, sourcesCollected: 1, sourcesFailed: 0, evidence: [], opportunities: lev,
      journey: [], categoryScores: [], storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null, pilotRecords: records,
    });
    const phoneCard = (records: PilotRecords, id?: string) =>
      buildExecutiveReport(input(records, id)).rankedAiOpportunities.find((c) => c.solutionCategory === PHONE_PRODUCT)!;
    expect(phoneCard(valid).pilotAuthorisation.implementationAuthorised).toBe(true);
    for (const [label, records] of WRONG) expect(phoneCard(records).pilotAuthorisation.implementationAuthorised, label).toBe(false);
    expect(phoneCard(valid, undefined as unknown as string).pilotAuthorisation.implementationAuthorised).toBe(true);
    expect(buildExecutiveReport({ ...input(valid), restaurantId: null }).rankedAiOpportunities.find((c) => c.solutionCategory === PHONE_PRODUCT)!.pilotAuthorisation.implementationAuthorised).toBe(false);
    const src = fs.readFileSync(path.join(__dirname, '../src/lib/reports/executiveData.ts'), 'utf8');
    expect(src).toMatch(/restaurantId: audit\.restaurantId,/);
    expect(src).not.toMatch(/pilotRecords/);
  });
});

// ── Preservation ───────────────────────────────────────────────────────────

describe('scores, statuses, classifications and confidence labels are unchanged by poisoned text', () => {
  it('only the shown text differs; nothing is written', async () => {
    const clean = await loadDto();
    poison = everywhere(REPORTED_9B4329E[1]);
    const poisoned = await loadDto();
    expect(poisoned.score).toEqual(clean.score);
    expect(poisoned.findings.map((f) => [f.category, f.classification, f.labels, f.internalScores]))
      .toEqual(clean.findings.map((f) => [f.category, f.classification, f.labels, f.internalScores]));
    expect(poisoned.thirtyDayPlan.map((p) => [p.phase, p.actions.length])).toEqual(clean.thirtyDayPlan.map((p) => [p.phase, p.actions.length]));
    expect(poisoned.appendix.map((e) => [e.evidenceType, e.confidence, e.confidenceLabel])).toEqual(clean.appendix.map((e) => [e.evidenceType, e.confidence, e.confidenceLabel]));
    expect(writes).toEqual([]);
  });

  it('the stored records the loader read are unchanged', async () => {
    const before = JSON.stringify(storedFixture);
    poison = everywhere(REPORTED_9B4329E[2]);
    await loadDto();
    expect(JSON.stringify(storedFixture)).toBe(before);
  });
});
