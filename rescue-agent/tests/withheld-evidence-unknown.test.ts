/**
 * WITHHELD EVIDENCE IS UNKNOWN, NOT ABSENT — Codex review of d7f5fd2 (PR #77).
 *
 * P2 (observationPublication.ts): a stored fact that cannot be traced to an
 * audit-engine template is withheld (FALLBACK) and kept out of regeneration.
 * The engine reads facts by pattern, so a record it does not see reads as a
 * check that found nothing. With the Leverock's hours fact reworded, the
 * regenerated phone finding and the local-presence score said hours were
 * missing — a definite negative built from an observation nobody verified.
 *
 * Now a regenerated conclusion is published only when it is the same whatever
 * the withheld record said (each fact the engine can write for its type, and
 * the stored one). Otherwise the neutral wording is used. The withheld wording
 * itself, and the alternatives tried, never reach any client surface.
 *
 * P2 (recommendationTemplates.ts): a stored tier named after an Object
 * prototype property ("constructor", "toString", ...) was looked up as if it
 * were a package. It is now an unknown tier.
 *
 * Every case uses the stored Leverock's audit (tests/fixtures/leverocks-
 * stored-audit.json), driven through publication, the client-report loader,
 * the web report page, the PDF route and the Sales Brief loader.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import zlib from 'node:zlib';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import storedFixture from './fixtures/leverocks-stored-audit.json';
import { MAX_UNKNOWN_ALTERNATIVES, publishAuditObservations } from '@/lib/reports/observationPublication';
import { neutralFindingTitle } from '@/lib/reports/canonicalIdentifiers';
import { auditedTier, auditedTierRecommendation } from '@/lib/reports/recommendationTemplates';
import { EVIDENCE_TEMPLATES } from '@/lib/reports/generated/evidenceTemplates';

(globalThis as { React?: typeof React }).React = React;

type Stored = typeof storedFixture;
const AUDIT_ID = 'cmvwithheld00000000000001';
const HOURS = storedFixture.evidence.find((e) => e.evidenceType === 'HOURS_VISIBILITY')!;
/** Codex's example: true, plausible, and not a sentence the engine writes. */
const REWORDED_HOURS = 'Opening hours are displayed on the restaurant website.';
/** The sentence the engine writes when its hours check finds nothing. */
const HOURS_ABSENT = 'Business hours were not detected in the text of the analyzed pages.';
const NEUTRAL_PROBLEM = 'The stored description of this finding could not be traced to the audit evidence and is not shown; its evidence is listed in the appendix.';
const NEUTRAL_EXPLANATION = 'See the findings for this category.';
const NEUTRAL_HEALTHY = 'No friction was observed at this stage; see the evidence in the appendix.';
const PROTOTYPE_NAMES = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'];

function publish(edit: (s: Stored) => void = () => {}) {
  const s: Stored = structuredClone(storedFixture);
  edit(s);
  return publishAuditObservations({
    evidence: s.evidence.map((e) => ({ ...e, sourceUrl: null })),
    journey: s.journeyStages,
    opportunities: s.opportunities,
    scores: s.scores,
    context: { sources: s.sources, restaurant: s.restaurant },
  });
}
type Published = ReturnType<typeof publish>;
const setFact = (id: string, fact: string) => (s: Stored) => { s.evidence.find((e) => e.id === id)!.fact = fact; };
const texts = (p: Published) => [
  ...p.journey.map((j) => `J ${j.stage} ${j.finding}`),
  ...p.opportunities.flatMap((o) => [`O ${o.category} ${o.title}`, `O ${o.category} ${o.problem}`, `O ${o.category} ${o.businessImpact}`, `O ${o.category} ${o.recommendedSolution}`]),
  ...p.scores.map((s) => `S ${s.category} ${s.explanation}`),
];
const changed = (a: Published, b: Published) => texts(b).filter((t) => !texts(a).includes(t));

const BASE = publish();
/** Hours recorded in words the engine does not write: withheld, so unknown. */
const REWORDED = publish(setFact(HOURS.id, REWORDED_HOURS));
/**
 * What d7f5fd2 published for REWORDED: the engine, not seeing the hours
 * record, concluded hours were missing (reproduced before the fix).
 */
const ABSENCE_CONCLUSIONS = [
  'Common visit questions are not answered on the website',
  'The website does publish the address, the menu and how to get in',
  'Not found on the analyzed pages: opening hours',
  '(2/2 signals present)',
];
const typeFacts = (type: string) => EVIDENCE_TEMPLATES.filter((t) => t.field === 'fact' && t.types?.includes(type));

// ── The stored database double, for the end-to-end surfaces ────────────────

let edit: (s: Stored) => void = () => {};
let tier = 'AI DISCOVERY AUDIT';
function storedAudit() {
  const s: Stored = structuredClone(storedFixture);
  edit(s);
  return {
    id: AUDIT_ID, restaurantId: 'cmvrestaurantleverocks001', status: 'COMPLETED', demoMode: false,
    createdAt: new Date('2026-11-01T12:00:00Z'), completedAt: new Date('2026-11-01T12:05:00Z'),
    avgTicketInput: null, overallScore: s.overallScore, coverageScore: s.coverageScore,
    orderingUrlInput: null, reservationUrlInput: null, socialUrlInput: null, googleBusinessUrl: null,
    restaurant: { name: "Leverock's Great Seafood", websiteUrl: 'https://127.0.0.1:3443/', city: 'St. Petersburg', state: 'FL' },
    sources: s.sources, evidence: s.evidence, opportunities: s.opportunities, journeyStages: s.journeyStages, scores: s.scores,
    reports: [{ content: { executiveSummary: 'Stored summary.', aiNarrativeUsed: false, recommendation: { tier, rationale: 'unknown rationale' } } }],
  };
}
function storedBrief() {
  return {
    id: 'si1', auditId: AUDIT_ID, leadQualityScore: 70, salesOpportunityScore: 80, painLevel: 'HIGH', priority: 'HOT',
    createdAt: new Date('2026-11-01T12:05:00Z'),
    buyerPersona: 'x', bestSalesAngle: 'x', topDiscoveryQuestion: 'x', discoveryQuestions: ['x'], likelyObjection: 'x',
    objectionStrategy: 'x', recommendedOffer: 'x', outreachAngle: 'x', emailOpener: 'x', callOpener: 'x', talkTrack: 'x', followUpAngle: 'x',
    audit: storedAudit(),
  };
}
const writes: string[] = [];
vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findUnique: async () => storedAudit(), update: async () => { writes.push('audit.update'); throw new Error('write'); } },
    salesIntelligence: { findUnique: async () => storedBrief(), update: async () => { writes.push('si.update'); throw new Error('write'); } },
    report: { update: async () => { writes.push('report.update'); throw new Error('write'); } },
    opportunity: { update: async () => { writes.push('opportunity.update'); throw new Error('write'); } },
    evidence: { update: async () => { writes.push('evidence.update'); throw new Error('write'); } },
  },
  resolveDatabaseUrl: () => 'postgresql://localhost:5432/test',
  resolveDatabaseUrlSource: () => 'DATABASE_URL',
  RUNTIME_URL_SOURCES: ['DATABASE_URL'],
}));
const AUTH = `Basic ${Buffer.from('operator:operator-password-for-tests-0001').toString('base64')}`;
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name.toLowerCase() === 'authorization' ? AUTH : null) }),
  cookies: async () => ({ get: () => undefined }),
}));
const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, BASIC_AUTH_USER: 'operator', BASIC_AUTH_PASSWORD: 'operator-password-for-tests-0001' };
  edit = () => {};
  tier = 'AI DISCOVERY AUDIT';
  writes.length = 0;
});
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

async function operator() {
  const { checkOperator } = await import('@/lib/operatorAuth');
  const check = checkOperator(AUTH);
  if (!check.ok) throw new Error('operator refused');
  return check.operator;
}
async function dtoText() {
  const { loadExecutiveReport } = await import('@/lib/reports/executiveData');
  const result = await loadExecutiveReport(await operator(), AUDIT_ID);
  if (result.status !== 'ok') throw new Error(result.status);
  return { dto: result.dto, text: JSON.stringify(result.dto) };
}
const html = (el: unknown) => renderToStaticMarkup(el as React.ReactElement)
  .replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
async function webText() {
  const Page = (await import('@/app/audits/[auditId]/report/page')).default;
  return html(await Page({ params: Promise.resolve({ auditId: AUDIT_ID }) }));
}
async function salesText() {
  const { loadSalesBrief } = await import('@/lib/reports/salesData');
  const brief = await loadSalesBrief(await operator(), AUDIT_ID);
  const Page = (await import('@/app/audits/[auditId]/sales/page')).default;
  return JSON.stringify(brief) + ' ' + html(await Page({ params: Promise.resolve({ auditId: AUDIT_ID }) }));
}
async function pdfText() {
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
  return runs.join(' ');
}
/** Letters and digits only, lower-cased: line breaks and PDF glyph runs cannot hide a match. */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// ── Codex P2: an unrecognised hours fact ───────────────────────────────────

describe('Codex P2: a withheld hours fact is unknown, not missing', () => {
  it('the control: the unaltered audit states, from its evidence, that hours are published', () => {
    const published = texts(BASE).join('\n');
    expect(published).toContain('The website does publish opening hours');
    expect(published).toContain('(3/3 signals present)');
    for (const t of ABSENCE_CONCLUSIONS) expect(published, t).not.toContain(t);
    // A recorded absence is an engine sentence: it is evidence, not withheld.
    const absent = publish(setFact(HOURS.id, HOURS_ABSENT));
    expect(absent.evidence.find((e) => e.id === HOURS.id)!.provenance.fact).toBe('TEMPLATE');
    expect(absent.evidence.find((e) => e.id === HOURS.id)!.fact).toBe(HOURS_ABSENT);
  });

  it('the reworded fact is withheld, and none of the absence conclusions is published', () => {
    const hours = REWORDED.evidence.find((e) => e.id === HOURS.id)!;
    expect(hours.provenance.fact).toBe('FALLBACK');
    const published = texts(REWORDED).join('\n');
    for (const t of ABSENCE_CONCLUSIONS) expect(published, t).not.toContain(t);
    // Codex's examples, as the old code published them.
    expect(published).not.toMatch(/hours (?:were|are) not (?:detected|found|published|visible)/i);
  });

  it('only the conclusions that depend on the hours record turn neutral', () => {
    const phone = REWORDED.opportunities.find((o) => o.category === 'PHONE-DEPENDENT CUSTOMER JOURNEY')!;
    expect(phone.title).toBe(neutralFindingTitle('PHONE-DEPENDENT CUSTOMER JOURNEY'));
    expect(phone.problem).toBe(NEUTRAL_PROBLEM);
    expect(REWORDED.journey.find((j) => j.stage === 'CONTACT')!.finding).toBe(NEUTRAL_HEALTHY);
    for (const c of ['LOCAL_DIGITAL_PRESENCE', 'AI_AUTOMATION_READINESS']) {
      expect(REWORDED.scores.find((s) => s.category === c)!.explanation, c).toBe(NEUTRAL_EXPLANATION);
    }
    // Everything else is exactly as the unaltered audit publishes it.
    const neutral = new Set(['PHONE-DEPENDENT CUSTOMER JOURNEY', 'CONTACT', 'LOCAL_DIGITAL_PRESENCE', 'AI_AUTOMATION_READINESS']);
    const rest = (p: Published) => texts(p).filter((t) => !neutral.has(t.split(' ')[1]) && !t.startsWith('O PHONE-DEPENDENT'));
    expect(rest(REWORDED)).toEqual(rest(BASE));
  });

  it('scores, statuses, evidence links and stored records are unchanged', () => {
    const before = structuredClone(storedFixture);
    publish(setFact(HOURS.id, REWORDED_HOURS));
    expect(storedFixture).toEqual(before);
    expect(REWORDED.scores.map((s) => [s.category, s.score])).toEqual(BASE.scores.map((s) => [s.category, s.score]));
    expect(REWORDED.journey.map((j) => [j.stage, j.status, j.manualValidationRequired, j.evidenceIds])).toEqual(
      BASE.journey.map((j) => [j.stage, j.status, j.manualValidationRequired, j.evidenceIds]),
    );
    expect(REWORDED.opportunities.map((o) => [o.category, o.evidenceIds, o.rescuePriorityScore, o.confidenceScore])).toEqual(
      BASE.opportunities.map((o) => [o.category, o.evidenceIds, o.rescuePriorityScore, o.confidenceScore]),
    );
  });

  it('the report, web page, PDF and Sales Brief show neither the withheld wording nor any absence claim', async () => {
    edit = setFact(HOURS.id, REWORDED_HOURS);
    const { text } = await dtoText();
    expect(text).toContain(`"rescueScore":${storedFixture.overallScore}`);
    const surfaces = { dto: text, web: await webText(), pdf: await pdfText(), sales: await salesText() };
    expect(typeFacts('HOURS_VISIBILITY').length).toBeGreaterThan(0);
    for (const [surface, shown] of Object.entries(surfaces)) {
      const s = squash(shown);
      expect(s, surface).not.toContain(squash(REWORDED_HOURS));
      expect(s, surface).not.toContain(squash(HOURS_ABSENT));
      for (const t of ABSENCE_CONCLUSIONS) expect(s, `${surface}: ${t}`).not.toContain(squash(t));
    }
    expect(writes).toEqual([]);
  });

  it('the unaltered audit publishes exactly as before', () => {
    expect(BASE.report).toEqual({
      evidence: { total: 26, factFallbacks: 0, factsRedacted: 0, contextOmitted: 1, linksRemoved: 0 },
      journey: { total: 10, fallbacks: 0, historicalWithheld: 0 },
      opportunities: { total: 4, fallbacks: 0, historicalWithheld: 0 },
      scores: { total: 9, fallbacks: 0, derived: 0 },
      identifiers: { unrecognised: 0 },
    });
    expect(texts(BASE).join('\n')).toMatch(/3\/3 signals present/);
  });
});

// ── Withholding any other record ───────────────────────────────────────────

describe('a withheld record neutralises only what depends on it', () => {
  const unrelated = (type: string) => storedFixture.evidence.find((e) => e.evidenceType === type)!;
  for (const type of ['SOCIAL_LINK', 'CONTACT_EMAIL', 'GIFT_CARD_SIGNAL']) {
    it(`${type}: nothing regenerated changes`, () => {
      const p = publish(setFact(unrelated(type).id, 'Recorded in words the engine does not write.'));
      expect(p.evidence.find((e) => e.id === unrelated(type).id)!.provenance.fact).toBe('FALLBACK');
      expect(texts(p)).toEqual(texts(BASE));
    });
  }

  it('CTA_SIGNAL: only the CTA finding is neutral', () => {
    const p = publish(setFact(unrelated('CTA_SIGNAL').id, 'Recorded in words the engine does not write.'));
    expect(changed(BASE, p).length).toBeGreaterThan(0);
    expect(changed(BASE, p).every((t) => t.startsWith('O CONFUSING CTA HIERARCHY'))).toBe(true);
    expect(p.opportunities.find((o) => o.category === 'CONFUSING CTA HIERARCHY')!.problem).toBe(NEUTRAL_PROBLEM);
  });

  it(`more alternatives than ${MAX_UNKNOWN_ALTERNATIVES}: nothing regenerated is published, and nothing throws`, () => {
    const ordering = storedFixture.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!;
    const variants = typeFacts('ORDERING_CHANNEL').length;
    expect(2 * (variants + 1)).toBeGreaterThan(MAX_UNKNOWN_ALTERNATIVES);
    const p = publish((s) => {
      for (const n of [1, 2]) s.evidence.push({ ...structuredClone(ordering), id: `cmvwithheldordering0000${n}`, fact: `Ordering is offered, in words the engine does not write (${n}).` });
    });
    expect(p.report.journey.fallbacks).toBe(p.report.journey.total);
    expect(p.report.opportunities.fallbacks).toBe(p.report.opportunities.total);
    for (const o of p.opportunities) expect(o.problem, o.category).toBe(NEUTRAL_PROBLEM);
    for (const s of p.scores) expect(s.explanation, s.category).toBe(NEUTRAL_EXPLANATION);
    expect(p.scores.map((s) => [s.category, s.score])).toEqual(BASE.scores.map((s) => [s.category, s.score]));
  });
});

// ── Codex P2: tier names that are Object prototype properties ──────────────

describe('Codex P2: a stored tier named after an Object property is an unknown tier', () => {
  for (const name of PROTOTYPE_NAMES) {
    it(`"${name}"`, () => {
      expect(auditedTier(name)).toBe('AI DISCOVERY AUDIT');
      expect(() => auditedTierRecommendation({ tier: name, rationale: 'x' })).not.toThrow();
      expect(auditedTierRecommendation({ tier: name, rationale: 'x' })).toEqual(auditedTierRecommendation({ tier: 'NO SUCH TIER', rationale: 'x' }));
    });
  }

  it('known tiers are unchanged', () => {
    for (const t of ['AI DISCOVERY AUDIT', 'AI FRONT DESK SYSTEM', 'AI REACTIVATION CAMPAIGN']) expect(auditedTier(t)).toBe(t);
  });

  it('a stored "constructor" tier: the report, PDF and Sales Brief load and show the fallback tier', async () => {
    tier = 'constructor';
    const { text } = await dtoText();
    const surfaces = { dto: text, web: await webText(), pdf: await pdfText(), sales: await salesText() };
    for (const [surface, shown] of Object.entries(surfaces)) {
      expect(shown, surface).not.toMatch(/\bconstructor\b|function Object|\[native code\]/);
      expect(squash(shown), surface).toContain(squash('AI DISCOVERY AUDIT'));
    }
    expect(writes).toEqual([]);
  });
});
