/**
 * PR #77 INDEPENDENT REVIEW AT 5764862 — FINDING 4 (MEDIUM): the internal Sales
 * Brief told a rep, unconditionally, to "recommend AI FRONT DESK SYSTEM and
 * explain exactly why the evidence points there" (sales.ts), listed the tier as
 * the "Recommended WBI Offer", and answered the busy-owner objection with
 * "being too busy is exactly the problem the system is built for".
 *
 * Now an automation may be proposed only as a limited, monitored pilot, and
 * only after the restaurant's own records document measurable demand, the
 * system has completed its readiness and safety validation, and the owner has
 * explicitly approved the pilot. New briefs are written that way; stored
 * briefs are presented that way (salesData.ts) without being rewritten.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import levFixture from './fixtures/leverocks-local-audit-opportunities.json';
import { REJECTED, SAFE_NON_AUTOMATION } from './fixtures/ai-summary-adversarial';
import { generateSalesBrief } from '@/lib/reports/sales';
import type { RankedOpportunity } from '@/lib/reports/owner';
import {
  SALES_AUTOMATION_GATE,
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
const brief = (tier: string) =>
  generateSalesBrief({ restaurantName: "Leverock's Great Seafood", overallScore: 84, coverageScore: 80, topLeaks: lev.slice(0, 3), journey: [], evidence: [], recommendedTier: tier });

const SCREENED = ['bestSalesAngle', 'topDiscoveryQuestion', 'discoveryQuestions', 'objectionStrategy', 'recommendedOffer', 'outreachAngle', 'emailOpener', 'callOpener', 'talkTrack', 'followUpAngle'] as const;
const textOf = (value: unknown) => (Array.isArray(value) ? value.join('\n') : String(value));

describe('new briefs: no unconditional automation instruction', () => {
  for (const tier of ['AI FRONT DESK SYSTEM', 'AI REACTIVATION CAMPAIGN']) {
    it(`${tier}: the next step, the offer and the objection all carry the conditions`, () => {
      const b = brief(tier);
      expect(b.talkTrack).not.toMatch(new RegExp(`Next step: recommend ${tier}`));
      expect(b.talkTrack).toContain(`Next step: do not recommend the ${tier} on this call. It may be proposed only as a limited, monitored pilot, ${SALES_AUTOMATION_GATE}.`);
      expect(b.recommendedOffer).toBe(`${tier} — conditional, not a recommendation. It may be proposed only as a limited, monitored pilot, ${SALES_AUTOMATION_GATE}.`);
      expect(b.objectionStrategy).toBe(salesAutomationObjectionStrategy());
      expect(b.objectionStrategy).not.toMatch(/exactly the problem|before anything is installed|80%/);
      for (const field of SCREENED) expect(unauthorisedSalesSentences(textOf(b[field])), field).toEqual([]);
    });
  }

  it('a freshly written brief passes its own presentation unchanged, for every tier and every subset of findings', () => {
    const subsets: RankedOpportunity[][] = [[]];
    for (const o of lev) for (const existing of [...subsets]) if (existing.length < 3) subsets.push([...existing, o]);
    for (const tier of ['AI FRONT DESK SYSTEM', 'AI REACTIVATION CAMPAIGN', 'AI DISCOVERY AUDIT', 'BASIC OPTIMIZATION']) {
      for (const topLeaks of subsets) {
        const b = generateSalesBrief({ restaurantName: "Leverock's Great Seafood", overallScore: 84, coverageScore: 80, topLeaks, journey: [], evidence: [], recommendedTier: tier });
        for (const field of SCREENED) {
          const value = b[field];
          const shown = Array.isArray(value) ? value.map((v) => presentSalesField(field, v)) : presentSalesField(field, String(value));
          expect(shown, `${tier} / ${topLeaks.map((l) => l.category).join(', ')} / ${field}`).toEqual(value);
        }
      }
    }
  });

  it('a validation tier is still recommended as the next step, as before', () => {
    const b = brief('AI DISCOVERY AUDIT');
    expect(b.talkTrack).toContain('Next step: recommend AI DISCOVERY AUDIT and explain exactly why the evidence points there.');
    expect(b.recommendedOffer).toBe('AI DISCOVERY AUDIT');
  });

  it('the conditions are the full set: own records, measurable demand, readiness and safety validation, explicit owner approval, limited monitored pilot', () => {
    expect(SALES_AUTOMATION_GATE).toBe(
      "only after the restaurant's own records document measurable demand, the system has completed its readiness and safety validation for this restaurant, and the owner has explicitly approved the pilot",
    );
    expect(salesNextStepFor('AI FRONT DESK SYSTEM')).toMatch(/limited, monitored pilot/);
  });
});

describe('9. unconditional Sales Brief automation recommendations are rejected', () => {
  const UNCONDITIONAL = [
    'MINUTE 16–20 — Next step: recommend AI FRONT DESK SYSTEM and explain exactly why the evidence points there.',
    'Pitch the AI Front Desk on this call.',
    'Close on the AI receptionist before hanging up.',
    'Position automatic call answering as the fix for their phones.',
    'Recommend the AI Front Desk once the owner seems interested.',
    'Offer a digital telephone attendant as the next step.',
    'The AI FRONT DESK SYSTEM is the right fit for them.',
    'Agree — being too busy is exactly the problem the system is built for. Reframe: the AI is designed to take the repetitive questions.',
    // The gate's words, but not the approved sentence: keywords do not authorise.
    `Recommend the AI FRONT DESK SYSTEM as a limited, monitored pilot, ${SALES_AUTOMATION_GATE}, but pitch it today anyway.`,
    `Do not recommend the AI FRONT DESK SYSTEM on this call, then sell it in the follow-up.`,
    // Automation described in other words (review of 449470c).
    'Route incoming calls through a speech engine.',
    'Let a speech engine field the dinner rush.',
    'Use a synthetic voice operator for reservations.',
    'Tell the owner a speech engine could field the dinner rush.',
    'Suggest sending overflow calls to a voice model.',
    'Explain that reservations can be confirmed by a voice program.',
  ];
  it('each is flagged', () => {
    for (const text of UNCONDITIONAL) expect(unauthorisedSalesSentences(text).length, text).toBeGreaterThan(0);
  });
  it('and withheld when shown', () => {
    for (const text of UNCONDITIONAL) expect(presentSalesField('followUpAngle', text), text).toBe(SALES_WITHHELD_NOTICE);
  });
  it('every alternative automation description (speech engine, synthetic voice, voice model, outsourcing the phones …) is flagged and withheld', () => {
    for (const text of REJECTED['9. automation described in other words (review of 449470c)']) {
      expect(unauthorisedSalesSentences(text).length, text).toBeGreaterThan(0);
      expect(presentSalesField('talkTrack', `MINUTE 16–20 — ${text}`), text).toBe(SALES_WITHHELD_NOTICE);
    }
  });
  it('safe non-automation statements are not flagged', () => {
    for (const text of SAFE_NON_AUTOMATION) expect(unauthorisedSalesSentences(text), text).toEqual([]);
  });
  it('the owner\'s quoted objection is shown as stored; it is not an instruction', () => {
    const quoted = '"We\'re too busy to set up new systems, and AI sounds complicated / impersonal for a restaurant."';
    expect(presentSalesField('likelyObjection', quoted)).toBe(quoted);
  });
});

describe('historical stored briefs: presented with the conditions, never rewritten', () => {
  const HISTORICAL = {
    id: 'si1', auditId: 'cmvhistsales000000000001', leadQualityScore: 70, salesOpportunityScore: 80, painLevel: 'HIGH',
    buyerPersona: 'Independent restaurant owner-operator.',
    bestSalesAngle: 'Lead with the audit evidence: "No dedicated FAQ page was found". State it plainly.',
    topDiscoveryQuestion: 'How many calls go unanswered in a week?',
    discoveryQuestions: ['How many calls go unanswered in a week?', 'Do you currently have an automated system for following up with customers after they visit or order?'],
    likelyObjection: '"We\'re too busy to set up new systems, and AI sounds complicated / impersonal for a restaurant."',
    objectionStrategy: 'Agree — being too busy is exactly the problem the system absorbs. Reframe: the AI handles the repetitive 80% (hours, directions, FAQs, after-hours inquiries) so staff handle the human 20%. Offer the 15-minute review as zero-commitment proof, walking through their own audit evidence.',
    recommendedOffer: 'AI FRONT DESK SYSTEM',
    outreachAngle: 'Reference the specific finding with its evidence. Evidence first, product second.',
    emailOpener: 'Subject: Found something\n\nI ran a digital audit.',
    callOpener: '"Hi, this is [name] with Winnersbookmark."',
    talkTrack: 'MINUTE 0–2 — Frame: "I audited the public digital presence."\nMINUTE 16–20 — Next step: recommend AI FRONT DESK SYSTEM and explain exactly why the evidence points there. If their answers changed the picture, say that instead. Book the follow-up before hanging up.',
    followUpAngle: 'If no response in 4–5 days, push the AI Front Desk in a one-line follow-up.',
    priority: 'HOT', createdAt: new Date('2026-06-01T00:00:00Z'),
    audit: { demoMode: false, restaurant: { name: "Leverock's Great Seafood" } },
  };

  async function load() {
    const { checkOperator } = await import('@/lib/operatorAuth');
    const { loadSalesBrief } = await import('@/lib/reports/salesData');
    const check = checkOperator(AUTH);
    if (!check.ok) throw new Error('operator refused');
    return (await loadSalesBrief(check.operator, 'cmvhistsales000000000001')) as unknown as typeof HISTORICAL;
  }

  it('known historical wording is shown in the current, conditional wording; unknown unconditional text is withheld', async () => {
    storedBrief = HISTORICAL;
    const shown = await load();
    expect(shown.talkTrack).toContain(`MINUTE 16–20 — ${salesNextStepFor('AI FRONT DESK SYSTEM')}`);
    expect(shown.talkTrack).toContain('MINUTE 0–2 — Frame:');
    expect(shown.talkTrack).not.toMatch(/Next step: recommend AI FRONT DESK SYSTEM/);
    expect(shown.recommendedOffer).toMatch(/^AI FRONT DESK SYSTEM — conditional, not a recommendation\./);
    expect(shown.objectionStrategy).toBe(salesAutomationObjectionStrategy());
    expect(shown.followUpAngle).toBe(SALES_WITHHELD_NOTICE);
    // Untouched: fields that recommend nothing, and the owner's quoted objection.
    expect(shown.bestSalesAngle).toBe(HISTORICAL.bestSalesAngle);
    expect(shown.discoveryQuestions).toEqual(HISTORICAL.discoveryQuestions);
    expect(shown.likelyObjection).toBe(HISTORICAL.likelyObjection);
    expect(shown.leadQualityScore).toBe(70);
    expect(shown.salesOpportunityScore).toBe(80);
    expect(shown.priority).toBe('HOT');
    for (const field of SCREENED) expect(unauthorisedSalesSentences(textOf(shown[field])), field).toEqual([]);
  });

  it('the stored record itself is not modified (presentation only, no database write)', async () => {
    storedBrief = structuredClone(HISTORICAL);
    const before = JSON.stringify(storedBrief);
    await load();
    expect(JSON.stringify(storedBrief)).toBe(before);
  });

  it('the Sales Brief page shows the presented wording', async () => {
    storedBrief = HISTORICAL;
    const Page = (await import('@/app/audits/[auditId]/sales/page')).default;
    const html = renderToStaticMarkup((await Page({ params: Promise.resolve({ auditId: 'cmvhistsales000000000001' }) })) as React.ReactElement)
      .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    expect(html).not.toMatch(/Next step: recommend AI FRONT DESK SYSTEM/);
    expect(html).not.toMatch(/exactly the problem the system/);
    expect(html).toContain('do not recommend the AI FRONT DESK SYSTEM on this call');
    expect(html).toContain('AI FRONT DESK SYSTEM — conditional, not a recommendation.');
  });
});
