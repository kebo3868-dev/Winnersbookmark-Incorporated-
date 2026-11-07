/**
 * EVIDENCE TEXT IS PUBLISHED ONLY WITH PROVENANCE.
 *
 * Review of 9b4329e: stored observation text was screened for bad wording and
 * published when the screen passed it ("The AI Front Desk is detected. It is a
 * boon for the restaurant."). Now (observationPublication.ts) a fact or
 * supporting context is published only when it is an instance of a template
 * the audit engine writes, bound to the evidence type it writes it with, and
 * every value the template interpolated is claim-free. The templates are
 * generated from the engine source and its history
 * (scripts/engine-source/generate-evidence-templates.ts); this file checks the
 * committed list against the working tree, and the provenance rules on their
 * own.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import storedFixture from './fixtures/leverocks-stored-audit.json';
import { LEGITIMATE_9B4329E, MIXED_CLAUSE, REPORTED_9B4329E } from './fixtures/narrative-policy-cases';
import { EVIDENCE_TEMPLATES } from '@/lib/reports/generated/evidenceTemplates';
import { NEUTRAL_FACT, evidenceTextProvenance, publishAuditObservations, publishEvidence } from '@/lib/reports/observationPublication';
import { dedupe, templatesFrom, workingTreeFiles } from '../scripts/engine-source/generate-evidence-templates';

const ROOT = path.resolve(__dirname, '..');
const key = (t: { field: string; types: readonly string[] | null; pattern: string }) => `${t.field}|${t.types?.join(',') ?? '*'}|${t.pattern}`;
const committed = new Set(EVIDENCE_TEMPLATES.map(key));

describe('the committed templates are what the engine writes', () => {
  const files = workingTreeFiles(ROOT);
  const current = dedupe(templatesFrom(files));

  it('every template the working tree produces is committed (regenerate after changing evidence wording)', () => {
    const missing = current.filter((t) => !committed.has(key(t))).map(key);
    expect(missing).toEqual([]);
    expect(current.length).toBeGreaterThan(100);
  }, 120_000);

  it('every template is bound to the evidence types it is written with', () => {
    expect(EVIDENCE_TEMPLATES.filter((t) => !t.types || t.types.length === 0)).toEqual([]);
    expect(current.filter((t) => !t.types)).toEqual([]);
  });

  it('a template written in a loop over checks is bound per check: the FAQ wording is typed FAQ_SIGNAL only', () => {
    const faq = EVIDENCE_TEMPLATES.filter((t) => t.field === 'fact' && t.pattern === 'No public FAQ pathway was detected on the analyzed website pages\\.');
    expect(faq.map((t) => t.types)).toEqual([['FAQ_SIGNAL']]);
  });

  it('a mutation: new evidence wording in the engine is detected as uncommitted', () => {
    const rel = [...files.keys()].find((f) => /src\/lib\/audit\/.*\.ts$/.test(f) && /fact:\s*'/.test(files.get(f)!))!;
    const mutated = new Map(files);
    mutated.set(rel, files.get(rel)!.replace(/fact:\s*'/, "fact: 'The AI Front Desk is a boon for the restaurant and "));
    const added = dedupe(templatesFrom(mutated)).filter((t) => !committed.has(key(t)));
    expect(added.map((t) => t.pattern).join('\n')).toMatch(/boon for the restaurant/);
  }, 120_000);
});

describe('provenance of one evidence text', () => {
  const real = storedFixture.evidence;
  const ctx = { sources: storedFixture.sources, restaurant: storedFixture.restaurant };
  const titleOf = (e: { auditSourceId: string | null }) => storedFixture.sources.find((s) => s.id === e.auditSourceId)?.pageTitle ?? null;

  it('every fact in the unaltered stored audit has provenance for its own evidence type; the page title is bound to the collected page', () => {
    for (const e of real) {
      const p = evidenceTextProvenance(e.evidenceType, 'fact', e.fact, ctx, titleOf(e));
      expect(p, `${e.evidenceType}: ${e.fact}`).toBe(e.evidenceType === 'BUSINESS_IDENTITY' && e.fact.startsWith('Homepage title:') ? 'SOURCE_BOUND' : 'TEMPLATE');
    }
  });

  it('a real fact stored under another evidence type has none: provenance is contextual, not text matching', () => {
    const faq = real.find((e) => e.evidenceType === 'FAQ_SIGNAL')!;
    const phone = real.find((e) => e.evidenceType === 'PHONE_VISIBILITY')!;
    expect(evidenceTextProvenance(faq.evidenceType, 'fact', faq.fact, ctx)).toBe('TEMPLATE');
    expect(evidenceTextProvenance(phone.evidenceType, 'fact', faq.fact, ctx)).toBe('NONE');
    expect(publishEvidence({ ...phone, sourceUrl: null, fact: faq.fact }, ctx).fact).toBe(NEUTRAL_FACT);
  });

  it('the reported endorsements and mixed-clause attacks: no provenance alone; in a real template slot the frame matches but the value is not shown', () => {
    for (const phrase of [...REPORTED_9B4329E, ...MIXED_CLAUSE]) {
      expect(evidenceTextProvenance('FAQ_SIGNAL', 'fact', phrase, ctx), phrase).toBe('NONE');
      const text = `Homepage title: "${phrase}".`;
      const published = publishEvidence({ id: 'x', evidenceType: 'BUSINESS_IDENTITY', fact: text, supportingContext: null, confidence: 90, sourceUrl: null, auditSourceId: storedFixture.sources[0].id }, ctx);
      expect(published.provenance.fact, phrase).toBe('REDACTED');
      expect(published.fact, phrase).toBe('Homepage title: "[not verified]".');
    }
  });

  it('a real template with an endorsement appended to its fixed wording has none', () => {
    const faq = real.find((e) => e.evidenceType === 'FAQ_SIGNAL')!;
    for (const phrase of REPORTED_9B4329E) expect(evidenceTextProvenance('FAQ_SIGNAL', 'fact', `${faq.fact} ${phrase}`, ctx), phrase).toBe('NONE');
  });

  it('legitimate negative assessments and repairs are shown when supported by the collected source, and not otherwise', () => {
    for (const phrase of LEGITIMATE_9B4329E) {
      expect(evidenceTextProvenance('BUSINESS_IDENTITY', 'fact', `Homepage title: "${phrase}".`, ctx, phrase), phrase).toBe('SOURCE_BOUND');
      expect(evidenceTextProvenance('BUSINESS_IDENTITY', 'fact', `Homepage title: "${phrase}".`, ctx, titleOf(real[0])), phrase).toBe('REDACTED');
    }
  });

  it('supporting context that is only bound URLs is data; an unbound URL or free text is not', () => {
    expect(evidenceTextProvenance('MENU_ACCESS', 'supportingContext', 'https://127.0.0.1:3443/menu, https://www.facebook.com/x', ctx)).toBe('DATA');
    expect(evidenceTextProvenance('MENU_ACCESS', 'supportingContext', 'https://ai-front-desk-is-a-boon.example/', ctx)).toBe('NONE');
    expect(evidenceTextProvenance('MENU_ACCESS', 'supportingContext', 'https://127.0.0.1:3443/menu It is a boon for the restaurant.', ctx)).toBe('NONE');
  });

  it('without collected data nothing that needs it is verified: no page title, no URL', () => {
    const title = real.find((e) => e.fact.startsWith('Homepage title:'))!;
    expect(evidenceTextProvenance('BUSINESS_IDENTITY', 'fact', title.fact)).toBe('REDACTED');
    expect(evidenceTextProvenance('MENU_ACCESS', 'supportingContext', 'https://127.0.0.1:3443/menu')).toBe('NONE');
  });
});

describe('publication is deterministic and changes only text', () => {
  const stored = {
    evidence: storedFixture.evidence.map((e) => ({ ...e, sourceUrl: null })),
    journey: storedFixture.journeyStages,
    opportunities: storedFixture.opportunities,
    scores: storedFixture.scores,
  };

  it('the same stored audit always publishes the same text', () => {
    expect(JSON.stringify(publishAuditObservations(structuredClone(stored)))).toBe(JSON.stringify(publishAuditObservations(structuredClone(stored))));
  });

  it('records keep their order, ids, scores, statuses, confidence and flags; the input is not modified', () => {
    const before = JSON.stringify(stored);
    const poisoned = structuredClone(stored);
    for (const e of poisoned.evidence) e.fact = REPORTED_9B4329E[0];
    const out = publishAuditObservations(poisoned);
    expect(out.evidence.map((e) => [e.id, e.evidenceType, e.confidence])).toEqual(stored.evidence.map((e) => [e.id, e.evidenceType, e.confidence]));
    expect(out.evidence.every((e) => e.fact === NEUTRAL_FACT)).toBe(true);
    const strip = <T extends object>(xs: T[], text: (keyof T)[]) => xs.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !text.includes(k as keyof T))));
    expect(strip(out.journey, ['finding'])).toEqual(strip(stored.journey, ['finding']));
    expect(strip(out.opportunities, ['title', 'problem', 'businessImpact', 'recommendedSolution', 'evidenceBound'])).toEqual(strip(stored.opportunities, ['title', 'problem', 'businessImpact', 'recommendedSolution']));
    // With every fact untraceable, no finding's wording is bound to its evidence.
    expect(out.opportunities.map((o) => o.evidenceBound)).toEqual(stored.opportunities.map(() => false));
    expect(strip(out.scores, ['explanation'])).toEqual(strip(stored.scores, ['explanation']));
    expect(JSON.stringify(stored)).toBe(before);
  });

  it('with no traceable evidence, every regenerated item falls back to neutral wording', () => {
    const poisoned = structuredClone(stored);
    for (const e of poisoned.evidence) e.fact = REPORTED_9B4329E[0];
    const { report } = publishAuditObservations(poisoned);
    expect(report.evidence.factFallbacks).toBe(stored.evidence.length);
    expect(report.opportunities.fallbacks).toBe(stored.opportunities.length);
  });
});
