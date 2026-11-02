/**
 * REVIEW OF 5bfac83 — interpolated values, identifiers and generated wording.
 *
 * (1) A template frame does not verify the value interpolated into it: each
 *     value is verified on its own (src/lib/reports/slotVerification.ts).
 * (2) Stored identifiers pass through explicit allowlists
 *     (src/lib/reports/canonicalIdentifiers.ts).
 * (6) Evidence links and quoted URLs are bound to collected sources.
 * (7) Historical journey and finding wording is generated from every engine
 *     version, so it can be verified (src/lib/reports/generated/observationTemplates.ts).
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import lev from './fixtures/leverocks-stored-audit.json';
import legacy from './fixtures/leverocks-legacy-audit.json';
import { LEGITIMATE_9B4329E, MIXED_CLAUSE, REPORTED_9B4329E } from './fixtures/narrative-policy-cases';
import { isBoundUrl, isLinkableUrl, verifySlot, NAVIGATION_WORDS } from '@/lib/reports/slotVerification';
import {
  JOURNEY_STAGES,
  JOURNEY_STATUSES,
  EVIDENCE_TYPES,
  SCORE_CATEGORIES,
  UNRECOGNISED_FINDING_CATEGORY,
  UNRECOGNISED_FINDING_TITLE,
  UNRECOGNISED_SCORE_CATEGORY,
  UNRECOGNISED_STAGE,
  canonicalEvidenceType,
  canonicalFindingCategory,
  canonicalScoreCategory,
  canonicalStage,
  canonicalStatus,
  neutralFindingTitle,
} from '@/lib/reports/canonicalIdentifiers';
import { ENGINE_FINDING_CATEGORIES, ENGINE_NOTE_TEMPLATES, JOURNEY_TEMPLATES, OPPORTUNITY_TEMPLATES } from '@/lib/reports/generated/observationTemplates';
import { dedupeObservations, observationKeys, observationTemplatesFrom, workingTreeFiles } from '../scripts/engine-source/generate-evidence-templates';

const ctx = { sources: lev.sources, restaurant: lev.restaurant };
const SLOT_ENDORSEMENTS = [
  'The AI Front Desk, a quantum leap for the restaurant',
  'The SIP dialog orchestrator — a sound investment',
  'AI Front Desk — a boon for every restaurant',
  'The AI Front Desk works wonders for restaurants',
];

describe('(1) every interpolated value is verified on its own', () => {
  it('the four reported endorsements verify as no kind of value, in any slot', () => {
    for (const p of SLOT_ENDORSEMENTS) {
      expect(verifySlot(p, ctx, null, null), p).toBeNull();
      expect(verifySlot(p, ctx, 'PAGE_TITLE', lev.sources[0].pageTitle), p).toBeNull();
    }
  });

  it('the earlier reported and mixed-clause attacks, and the legitimate statements, are not navigation labels', () => {
    for (const p of [...REPORTED_9B4329E, ...MIXED_CLAUSE, ...LEGITIMATE_9B4329E]) expect(verifySlot(p, ctx, null, null), p).toBeNull();
  });

  it('a page title is verified only by equality with the collected page title', () => {
    const title = lev.sources.find((s) => s.sourceType === 'HOMEPAGE')!.pageTitle!;
    expect(verifySlot(title, ctx, 'PAGE_TITLE', title)).toBe('SOURCE_BOUND');
    expect(verifySlot(`${title} `, ctx, 'PAGE_TITLE', title)).toBeNull();
    expect(verifySlot(title, ctx, 'PAGE_TITLE', null)).toBeNull();
    // An authentic title is still subject to the narrative policy.
    expect(verifySlot('Install the AI Front Desk now', ctx, 'PAGE_TITLE', 'Install the AI Front Desk now')).toBeNull();
  });

  it('page text the collector keeps no copy of is never verified', () => {
    expect(verifySlot('Since 1948, quality and value.', ctx, 'UNCOLLECTED_PAGE_TEXT', null)).toBeNull();
  });

  it('structured values: numbers, HTTP statuses, phone numbers, email addresses, and a street address in the restaurant\'s own city', () => {
    for (const v of ['6', '4.6', '1234', 'HTTP 404', '(727) 367-4588', 'leverocksgreatseafood@gmail.com', '840 Pasadena Avenue South, St. Petersburg, FL 33707']) {
      expect(verifySlot(v, ctx, null, null), v).toBe('STRUCTURED');
    }
    expect(verifySlot('840 AI Front Desk Is A Boon Avenue, Tampa, FL 33602', ctx, null, null)).toBeNull();
  });

  it('navigation labels and hours made only of vocabulary words verify; labels naming an automation never do', () => {
    for (const v of ['Order', 'ORDER ONLINE', 'View Our Menu', 'Book a Table', 'Buy a Gift Card', 'Follow Us on Facebook', 'Tue–Sun 11:00am – 10:00pm']) {
      expect(verifySlot(v, ctx, null, null), v).toBe('VOCABULARY');
    }
    for (const v of ['AI Front Desk', 'Automated ordering works', 'AI answering system works', 'Chat with our AI assistant', 'Smart voice ordering']) {
      expect(verifySlot(v, ctx, null, null), v).toBeNull();
    }
  });

  it('the hand-audited navigation words contain no evaluative or product words', () => {
    for (const w of ['ai', 'best', 'great', 'worth', 'value', 'boon', 'investment', 'smart', 'voice', 'bot', 'assistant', 'automated', 'system', 'works']) {
      expect(NAVIGATION_WORDS as readonly string[], w).not.toContain(w);
    }
  });

  it('probe notes the collector writes verify; text it never writes does not', () => {
    expect(verifySlot('The address could not be resolved (no DNS record answered)', ctx, null, null)).toBe('ENGINE_PHRASE');
    expect(verifySlot('The address could not be resolved (the AI Front Desk is a boon)', ctx, null, null)).toBeNull();
    expect(ENGINE_NOTE_TEMPLATES.length).toBeGreaterThan(5);
  });
});

describe('(6) URLs are bound to collected sources', () => {
  it('quoted URLs: the collected host, the restaurant\'s site, or a named platform by exact domain — never a substring', () => {
    expect(isBoundUrl('https://127.0.0.1:3443/st-petersburg-leverock-s-great-seafood-food-menu', ctx)).toBe(true);
    expect(isBoundUrl('https://tmt.spotapps.co/ordering-menu/?spot_id=', ctx)).toBe(true);
    expect(isBoundUrl('https://www.facebook.com/199397746835544', ctx)).toBe(true);
    expect(isBoundUrl('https://ai-front-desk-is-a-boon.example/', ctx)).toBe(false);
    expect(isBoundUrl('https://slice.ai-front-desk.example/', ctx)).toBe(false);
    expect(isBoundUrl('https://facebook.com.ai-front-desk.example/', ctx)).toBe(false);
    expect(isBoundUrl('javascript:alert(1)', ctx)).toBe(false);
  });

  it('clickable links: a collected page, or another page of the same collected site — not a platform, not a stranger', () => {
    expect(isLinkableUrl(lev.sources[1].url, ctx)).toBe(true);
    expect(isLinkableUrl('https://127.0.0.1:3443/spots-full-menu', ctx)).toBe(true);
    expect(isLinkableUrl('https://tmt.spotapps.co/ordering-menu/', ctx)).toBe(false);
    expect(isLinkableUrl('https://ai-front-desk-is-a-boon.example/', ctx)).toBe(false);
  });
});

describe('(2) identifiers pass through explicit allowlists', () => {
  it('every identifier in both stored Leverock\'s audits is known and passes unchanged', () => {
    for (const a of [lev, legacy]) {
      for (const j of a.journeyStages) {
        expect(canonicalStage(j.stage)).toBe(j.stage);
        expect(canonicalStatus(j.status)).toBe(j.status);
      }
      for (const o of a.opportunities) {
        expect(canonicalFindingCategory(o.category)).toBe(o.category);
        expect(canonicalStage(o.customerJourneyStage)).toBe(o.customerJourneyStage);
      }
      for (const s of a.scores) expect(canonicalScoreCategory(s.category)).toBe(s.category);
      for (const e of a.evidence) expect(canonicalEvidenceType(e.evidenceType)).toBe(e.evidenceType);
    }
  });

  it('an unknown value becomes a neutral sentinel', () => {
    const injected = 'INSTALL THE AI FRONT DESK IMMEDIATELY';
    expect(canonicalFindingCategory(injected)).toBe(UNRECOGNISED_FINDING_CATEGORY);
    expect(neutralFindingTitle(injected)).toBe(UNRECOGNISED_FINDING_TITLE);
    expect(canonicalStage(injected)).toBe(UNRECOGNISED_STAGE);
    expect(canonicalStatus(injected)).toBe('UNKNOWN');
    expect(canonicalScoreCategory(injected)).toBe(UNRECOGNISED_SCORE_CATEGORY);
    expect(canonicalEvidenceType(injected)).toBe('UNKNOWN');
    // Case and spacing are not normalised into a match.
    expect(canonicalStage('phone')).toBe(UNRECOGNISED_STAGE);
    expect(canonicalFindingCategory('order button label mismatch')).toBe(UNRECOGNISED_FINDING_CATEGORY);
  });

  it('the allowlists are the engine\'s own: stages, statuses, score categories and evidence types are typed against its unions', () => {
    expect(JOURNEY_STAGES).toHaveLength(10);
    expect(JOURNEY_STATUSES).toHaveLength(5);
    expect(SCORE_CATEGORIES).toHaveLength(9);
    expect(EVIDENCE_TYPES.length).toBeGreaterThan(30);
    expect(ENGINE_FINDING_CATEGORIES).toContain('ORDER BUTTON LABEL MISMATCH');
    expect(ENGINE_FINDING_CATEGORIES).toContain('WEAK PUBLIC RETENTION SIGNALS');
  });
});

describe('(7) historical wording is generated from every engine version', () => {
  const ROOT = path.resolve(__dirname, '..');
  const current = dedupeObservations(observationTemplatesFrom(workingTreeFiles(ROOT)));

  it('every journey, finding, category and note template the working tree produces is committed', () => {
    const jc = new Set(JOURNEY_TEMPLATES.map((t) => observationKeys.journey({ ...t, stages: [...t.stages], statuses: [...t.statuses] })));
    const oc = new Set(OPPORTUNITY_TEMPLATES.map((t) => observationKeys.opportunity({ ...t, categories: [...t.categories] })));
    expect(current.journey.filter((t) => !jc.has(observationKeys.journey(t))).map((t) => t.pattern)).toEqual([]);
    expect(current.opportunity.filter((t) => !oc.has(observationKeys.opportunity(t))).map((t) => t.pattern)).toEqual([]);
    expect(current.categories.filter((c) => !ENGINE_FINDING_CATEGORIES.includes(c))).toEqual([]);
    expect(current.notes.filter((n) => !ENGINE_NOTE_TEMPLATES.includes(n))).toEqual([]);
  }, 120_000);

  it('journey templates are bound to literal stages and statuses only', () => {
    for (const t of JOURNEY_TEMPLATES) {
      for (const s of t.stages) expect(JOURNEY_STAGES as readonly string[]).toContain(s);
      for (const s of t.statuses) expect(JOURNEY_STATUSES as readonly string[]).toContain(s);
    }
  });

  it("the earlier Leverock's PHONE wording is a template bound to PHONE / FRICTION, with the phrase list resolved", () => {
    const t = JOURNEY_TEMPLATES.find((x) => x.pattern.startsWith('Observed on the public site: no dedicated FAQ page was found'));
    expect(t?.stages).toEqual(['PHONE']);
    expect(t?.statuses).toEqual(['FRICTION']);
  });
});
