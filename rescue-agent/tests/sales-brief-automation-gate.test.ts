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
import { ADVERSARIAL_NARRATIVE, SAFE_NARRATIVE } from './fixtures/narrative-policy-cases';
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

/** A stored brief and its audit, as the database would return them. */
function storedRecord(tier: string, poison: string | null, opportunities = lev) {
  const text = (fallback: string) => poison ?? fallback;
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
      demoMode: false, overallScore: 84, coverageScore: 80,
      restaurant: { name: "Leverock's Great Seafood", websiteUrl: 'https://leverocks.example/' },
      opportunities: opportunities.map((o, i) => ({ id: `o${i}`, ...o })),
      journeyStages: [], evidence: [],
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

  it('a stored opportunity title that recommends automation is not quoted to the rep; a factual one is', async () => {
    const poisonedTitle = 'Calls are to be answered by a prerecorded greeter.';
    storedBrief = storedRecord('AI FRONT DESK SYSTEM', null, lev.map((o, i) => (i === 0 ? { ...o, title: poisonedTitle } : o)));
    const poisoned = await load();
    for (const field of NARRATIVE) expect(textOf(poisoned[field]), field).not.toContain(poisonedTitle);
    storedBrief = storedRecord('AI FRONT DESK SYSTEM', null);
    const clean = await load();
    expect(textOf(clean.bestSalesAngle) + textOf(clean.callOpener)).toMatch(new RegExp(lev[0].title.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
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

describe('legitimate rep instructions are not flagged', () => {
  it('operational improvements and human staffing pass', () => {
    for (const text of SAFE_NARRATIVE) expect(unauthorisedSalesSentences(text), text).toEqual([]);
  });
});
