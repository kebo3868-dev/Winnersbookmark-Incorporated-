/**
 * THE INTERNAL SALES BRIEF NEVER TELLS A REP TO RECOMMEND AN AUTOMATION.
 *
 * Reviews of 5764862 and 1e2c271. The brief's free text was screened sentence
 * by sentence, so "The AI Front Desk is available. It should be installed."
 * passed (its second sentence names nothing), and buyerPersona and
 * likelyObjection were shown as stored without any check.
 *
 * Now (salesData.ts) stored brief text is never shown: every narrative field
 * is regenerated from the stored audit data by the audited generator
 * (sales.ts) and checked, field by field and in context across sentences,
 * against the shared narrative policy (narrativePolicy.ts). For a product tier
 * the next step is "do not recommend … on this call", proposing it only as a
 * limited, monitored pilot after documented demand in the restaurant's own
 * records, completed readiness and safety validation and explicit owner
 * approval. Stored records are not changed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import levFixture from './fixtures/leverocks-local-audit-opportunities.json';
import storedFixture from './fixtures/leverocks-stored-audit.json';
import { ADVERSARIAL_NARRATIVE, LEGITIMATE_9B4329E, MIXED_CLAUSE, REPORTED_9B4329E, SAFE_NARRATIVE } from './fixtures/narrative-policy-cases';
import { publishAuditObservations } from '@/lib/reports/observationPublication';
import { isClaimFree } from '@/lib/reports/narrativePolicy';
import { generateSalesBrief } from '@/lib/reports/sales';
import type { RankedOpportunity } from '@/lib/reports/owner';
import {
  SALES_AUTOMATION_GATE,
  SALES_AUTOMATION_OBJECTION,
  SALES_WITHHELD_NOTICE,
  presentSalesField,
  salesAutomationObjectionStrategy,
  salesNextStepFor,
  unauthorisedSalesSentences,
} from '@/lib/reports/salesWording';

(globalThis as { React?: typeof React }).React = React;

let storedBrief: Record<string, unknown> | null = null;
vi.mock('@/lib/db', () => ({
  prisma: { salesIntelligence: { findUnique: async () => (storedBrief ? structuredClone(storedBrief) : null) } },
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
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  storedBrief = null;
});

const lev = (levFixture as { opportunities: RankedOpportunity[] }).opportunities;
const brief = (tier: string, topLeaks = lev.slice(0, 3)) =>
  generateSalesBrief({ restaurantName: "Leverock's Great Seafood", overallScore: 84, coverageScore: 80, topLeaks, journey: [], evidence: [], recommendedTier: tier });

const NARRATIVE = ['buyerPersona', 'bestSalesAngle', 'topDiscoveryQuestion', 'discoveryQuestions', 'likelyObjection', 'objectionStrategy', 'recommendedOffer', 'outreachAngle', 'emailOpener', 'callOpener', 'talkTrack', 'followUpAngle'] as const;
const textOf = (value: unknown) => (Array.isArray(value) ? value.join('\n') : String(value));
const AUDIT_ID = 'cmvhistsales000000000001';

type Stored = typeof storedFixture;
const ORDER_FACT_ID = storedFixture.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.id;

/** What may be written into the stored audit the brief is regenerated from. */
interface AuditPoison {
  /** Written as is into every observation field (facts, journey findings, finding text). */
  observation?: string;
  /** Quoted as the button label in the real ordering-channel template, which the brief quotes as its verified hook. */
  labelSlot?: string;
  opportunities?: (o: Stored['opportunities'][number], i: number) => Stored['opportunities'][number];
}

/** A stored brief and its audit (the Leverock's stored-audit fixture), as the database would return them. */
function storedRecord(tier: string, poison: string | null, audit: AuditPoison = {}) {
  const text = (fallback: string) => poison ?? fallback;
  const s: Stored = structuredClone(storedFixture);
  if (audit.observation) {
    for (const e of s.evidence) e.fact = audit.observation;
    for (const j of s.journeyStages) j.finding = audit.observation;
    for (const o of s.opportunities) Object.assign(o, { title: audit.observation, problem: audit.observation, businessImpact: audit.observation });
  }
  if (audit.labelSlot !== undefined) {
    for (const e of s.evidence) if (e.id === ORDER_FACT_ID) e.fact = e.fact.replace('The "Order" button', `The "${audit.labelSlot}" button`);
  }
  if (audit.opportunities) s.opportunities = s.opportunities.map(audit.opportunities);
  return {
    id: 'si1', auditId: AUDIT_ID, leadQualityScore: 70, salesOpportunityScore: 80, painLevel: 'HIGH', priority: 'HOT',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    buyerPersona: text('Independent restaurant owner-operator.'),
    bestSalesAngle: text('Lead with the audit evidence.'),
    topDiscoveryQuestion: text('How many calls go unanswered in a week?'),
    discoveryQuestions: [text('How many calls go unanswered in a week?')],
    likelyObjection: text('"We are too busy."'),
    objectionStrategy: text('Agree — being too busy is exactly the problem the system absorbs.'),
    recommendedOffer: text(tier),
    outreachAngle: text('Reference the finding.'),
    emailOpener: text('Subject: hello'),
    callOpener: text('"Hi."'),
    talkTrack: text(`MINUTE 16–20 — Next step: recommend ${tier} and explain exactly why the evidence points there.`),
    followUpAngle: text('Follow up.'),
    audit: {
      demoMode: false, overallScore: s.overallScore, coverageScore: s.coverageScore,
      restaurant: { name: "Leverock's Great Seafood", websiteUrl: 'https://leverocks.example/' },
      opportunities: s.opportunities,
      journeyStages: s.journeyStages,
      evidence: s.evidence,
      reports: [{ content: { recommendation: { tier, rationale: 'x' } } }],
    },
  };
}

async function load() {
  const { checkOperator } = await import('@/lib/operatorAuth');
  const { loadSalesBrief } = await import('@/lib/reports/salesData');
  const check = checkOperator(AUTH);
  if (!check.ok) throw new Error('operator refused');
  return (await loadSalesBrief(check.operator, AUDIT_ID)) as unknown as Record<string, unknown>;
}
async function page(): Promise<string> {
  const Page = (await import('@/app/audits/[auditId]/sales/page')).default;
  return renderToStaticMarkup((await Page({ params: Promise.resolve({ auditId: AUDIT_ID }) })) as React.ReactElement)
    .replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}
const squash = (s: string) => s.replace(/\s+/g, '');

describe('the brief the generator writes', () => {
  for (const tier of ['AI FRONT DESK SYSTEM', 'AI REACTIVATION CAMPAIGN']) {
    it(`${tier}: the next step, the offer and the objection carry the conditions`, () => {
      const b = brief(tier);
      expect(b.talkTrack).toContain(`Next step: do not recommend the ${tier} on this call. It may be proposed only as a limited, monitored pilot, ${SALES_AUTOMATION_GATE}.`);
      expect(b.recommendedOffer).toBe(`${tier} — conditional, not a recommendation. It may be proposed only as a limited, monitored pilot, ${SALES_AUTOMATION_GATE}.`);
      expect(b.objectionStrategy).toBe(salesAutomationObjectionStrategy());
      expect(b.likelyObjection).toBe(SALES_AUTOMATION_OBJECTION);
      for (const field of NARRATIVE) expect(unauthorisedSalesSentences(textOf(b[field])), field).toEqual([]);
    });
  }

  it('every field passes the shared policy unchanged, for every tier and every subset of findings', () => {
    const subsets: RankedOpportunity[][] = [[]];
    for (const o of lev) for (const existing of [...subsets]) if (existing.length < 3) subsets.push([...existing, o]);
    for (const tier of ['AI FRONT DESK SYSTEM', 'AI REACTIVATION CAMPAIGN', 'AI DISCOVERY AUDIT', 'BASIC OPTIMIZATION']) {
      for (const topLeaks of subsets) {
        const b = brief(tier, topLeaks);
        for (const field of NARRATIVE) {
          const value = b[field];
          const shown = Array.isArray(value) ? value.map((v) => presentSalesField(v)) : presentSalesField(String(value));
          expect(shown, `${tier} / ${topLeaks.map((l) => l.category).join(', ')} / ${field}`).toEqual(value);
        }
      }
    }
  });

  it('a validation tier is still recommended as the next step', () => {
    expect(brief('AI DISCOVERY AUDIT').talkTrack).toContain('Next step: recommend AI DISCOVERY AUDIT and explain exactly why the evidence points there.');
  });
});

describe('the policy reads a field in context, across sentences', () => {
  const CROSS_SENTENCE = [
    'The AI Front Desk is available. It should be installed.',
    'A voice assistant exists for restaurants. Put one in place.',
    'There is a tool that answers calls. The restaurant would benefit from it.',
    'The AI Front Desk was reviewed. This is the right next step.',
    'Automatic answering is common now. Pitch it on the call.',
    'Tell the owner about the AI Front Desk. Then close on it.',
  ];
  it('each is flagged on the sentence that refers back', () => {
    for (const text of CROSS_SENTENCE) expect(unauthorisedSalesSentences(text).length, text).toBeGreaterThan(0);
  });
  it('a different explicit subject ends the reference', () => {
    expect(unauthorisedSalesSentences('The AI Front Desk was not discussed. The menu page is broken. It should be fixed.')).toEqual([]);
  });
});

describe('stored brief text is never shown: the loader regenerates every narrative field', () => {
  it('the three reported bypasses, stored in EVERY narrative field (buyerPersona and likelyObjection included), never reach the page', async () => {
    for (const poison of [
      'Calls are to be answered by a prerecorded greeter.',
      'A speech engine could field all of the late evening calls.',
      'The AI Front Desk is available. It should be installed.',
    ]) {
      storedBrief = storedRecord('AI FRONT DESK SYSTEM', poison);
      const shown = await load();
      for (const field of NARRATIVE) expect(squash(textOf(shown[field])), `${poison} / ${field}`).not.toContain(squash(poison));
      expect(squash(await page())).not.toContain(squash(poison));
    }
  });

  it('every adversarial case, stored in every field, never reaches the loader output or the page', async () => {
    for (const poison of ADVERSARIAL_NARRATIVE) {
      storedBrief = storedRecord('AI FRONT DESK SYSTEM', poison);
      const shown = await load();
      for (const field of NARRATIVE) expect(squash(textOf(shown[field])), `${poison} / ${field}`).not.toContain(squash(poison));
    }
    storedBrief = storedRecord('AI FRONT DESK SYSTEM', ADVERSARIAL_NARRATIVE[0]);
    expect(squash(await page())).not.toContain(squash(ADVERSARIAL_NARRATIVE[0]));
  });

  it('a stored opportunity title is never quoted as stored: the title the rep sees is regenerated from the evidence', async () => {
    const poisonedTitle = 'Calls are to be answered by a prerecorded greeter.';
    storedBrief = storedRecord('AI FRONT DESK SYSTEM', null, { opportunities: (o, i) => (i === 0 ? { ...o, title: poisonedTitle } : o) });
    const poisoned = await load();
    for (const field of NARRATIVE) expect(textOf(poisoned[field]), field).not.toContain(poisonedTitle);
    storedBrief = storedRecord('AI FRONT DESK SYSTEM', null);
    const clean = await load();
    const published = publishAuditObservations({
      evidence: storedFixture.evidence.map((e) => ({ ...e, sourceUrl: null })),
      journey: storedFixture.journeyStages, opportunities: storedFixture.opportunities, scores: [],
    });
    expect(published.report.opportunities.fallbacks).toBe(0);
    expect(textOf(clean.bestSalesAngle)).toContain(published.opportunities[0].title);
  });

  it('the regenerated brief shows the conditional next step and offer; the stored record is unchanged; stored numbers are kept', async () => {
    storedBrief = storedRecord('AI FRONT DESK SYSTEM', null);
    const before = JSON.stringify(storedBrief);
    const shown = await load();
    expect(textOf(shown.talkTrack)).toContain(salesNextStepFor('AI FRONT DESK SYSTEM'));
    expect(textOf(shown.recommendedOffer)).toMatch(/^AI FRONT DESK SYSTEM — conditional, not a recommendation\./);
    expect(textOf(shown.objectionStrategy)).not.toMatch(/exactly the problem/);
    expect([shown.leadQualityScore, shown.salesOpportunityScore, shown.painLevel, shown.priority]).toEqual([70, 80, 'HIGH', 'HOT']);
    expect(JSON.stringify(storedBrief)).toBe(before);
    const html = await page();
    expect(html).toContain('do not recommend the AI FRONT DESK SYSTEM on this call');
    expect(html).not.toMatch(/Next step: recommend AI FRONT DESK SYSTEM/);
  });

  it('an unknown stored tier is presented as the validation step', async () => {
    storedBrief = storedRecord('AI FRONT DESK INSTALL NOW', null);
    const shown = await load();
    expect(textOf(shown.recommendedOffer)).toBe('AI DISCOVERY AUDIT');
    expect(textOf(shown.talkTrack)).not.toContain('INSTALL NOW');
  });

  it('the withheld notice exists for a field the policy rejects', () => {
    expect(presentSalesField('Pitch the AI Front Desk on this call.')).toBe(SALES_WITHHELD_NOTICE);
  });
});

describe('review of 9b4329e: observations reach the brief only with provenance', () => {
  it('the reported endorsements, stored in every observation field and every brief field, never reach the loader or the page', async () => {
    for (const phrase of [...REPORTED_9B4329E, ...MIXED_CLAUSE]) {
      storedBrief = storedRecord('AI FRONT DESK SYSTEM', phrase, { observation: phrase });
      const shown = await load();
      for (const field of NARRATIVE) expect(squash(textOf(shown[field])), `${phrase} / ${field}`).not.toContain(squash(phrase));
      expect(squash(await page()), phrase).not.toContain(squash(phrase));
    }
  });

  it('quoted in the label slot of the real ordering-channel template, an endorsement does not reach the brief', async () => {
    for (const phrase of [...REPORTED_9B4329E, ...MIXED_CLAUSE]) {
      storedBrief = storedRecord('AI FRONT DESK SYSTEM', null, { labelSlot: phrase });
      expect(squash(JSON.stringify(await load())), phrase).not.toContain(squash(phrase));
      expect(squash(await page()), phrase).not.toContain(squash(phrase));
    }
  });

  it('the loader hands on the audit only as published: the unaltered audit keeps its ordering evidence and regenerated finding wording', async () => {
    storedBrief = storedRecord('AI FRONT DESK SYSTEM', null);
    const shown = await load();
    const audit = shown.audit as { evidence: { id: string; fact: string }[]; opportunities: { title: string }[]; reports: unknown[] };
    const fact = storedFixture.evidence.find((e) => e.id === ORDER_FACT_ID)!.fact;
    expect(audit.evidence.find((e) => e.id === ORDER_FACT_ID)!.fact).toBe(fact);
    expect(audit.evidence.map((e) => e.fact)).toEqual(storedFixture.evidence.map((e) => e.fact));
    expect(audit.opportunities[0].title).toBe('The online ordering button uses a telephone link instead of an online checkout');
    expect(audit.reports).toEqual([]);
    expect(textOf(shown.callOpener)).toContain('set up as a phone link rather than an online checkout');
  });

  it('legitimate negative assessments and repairs, quoted in that slot, keep their provenance and are handed on as written', async () => {
    for (const phrase of LEGITIMATE_9B4329E) {
      storedBrief = storedRecord('AI FRONT DESK SYSTEM', null, { labelSlot: phrase });
      const shown = await load();
      const audit = shown.audit as { evidence: { id: string; fact: string }[] };
      expect(audit.evidence.find((e) => e.id === ORDER_FACT_ID)!.fact, phrase).toContain(`The "${phrase}" button`);
      // The brief's own wording about the finding is unchanged by the quoted label.
      expect(textOf(shown.callOpener), phrase).toContain('set up as a phone link rather than an online checkout');
    }
  });

  it('as rep instructions, legitimate statements pass the shared policy unchanged; the reported ones are withheld', async () => {
    for (const phrase of LEGITIMATE_9B4329E) expect(presentSalesField(phrase), phrase).toBe(phrase);
    for (const phrase of [...REPORTED_9B4329E.slice(0, 2), ...MIXED_CLAUSE]) expect(presentSalesField(phrase), phrase).toBe(SALES_WITHHELD_NOTICE);
    // Names no recognisable automation, so the rep-instruction policy alone does
    // not reject it; it is never shown because stored brief text is never read
    // (above), and it is not claim-free, so it cannot enter through evidence.
    expect(isClaimFree(REPORTED_9B4329E[2])).toBe(false);
  });
});

describe('legitimate rep instructions are not flagged', () => {
  it('operational improvements and human staffing pass', () => {
    for (const text of SAFE_NARRATIVE) expect(unauthorisedSalesSentences(text), text).toEqual([]);
  });
});
