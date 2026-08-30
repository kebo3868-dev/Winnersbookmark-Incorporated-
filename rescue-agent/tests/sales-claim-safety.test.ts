import { describe, expect, it } from 'vitest';
import { generateSalesBrief, selectLeadFinding } from '@/lib/reports/sales';
import type { RankedOpportunity } from '@/lib/reports/owner';
import type { EvidenceRecordLike, JourneyStageResult } from '@/types/audit';
import {
  containsDefinitiveFailureLanguage,
  inheritState,
  mayStateDefinitively,
  stateForOpportunity,
  stateRank,
} from '@/lib/audit/evidenceState';

/**
 * CRITICAL 3 — SALES BRIEF CLAIM SAFETY
 *
 * The brief is read into a phone call. It is the last place a hedge can be lost
 * and the first place where losing one costs a relationship: the audit says
 * "requires manual validation", the brief says "their ordering is broken", the
 * rep says that to an owner whose ordering works.
 *
 * A weaker evidence state must never be promoted into a stronger sales claim.
 */

const leak = (over: Partial<RankedOpportunity> = {}): RankedOpportunity => ({
  category: 'ONLINE ORDERING FAILURE RISK',
  title: 'A transaction link on the website is failing',
  problem: 'A linked destination failed when tested.',
  businessImpact: 'Lost orders.',
  customerJourneyStage: 'ORDERING',
  evidenceIds: ['e1'],
  impactScore: 90,
  urgencyScore: 90,
  confidenceScore: 55,
  aiFitScore: 20,
  rescuePriorityScore: 88,
  recommendedSolution: 'Fix the link.',
  manualValidationRequired: true,
  ...over,
});

const journey: JourneyStageResult[] = [
  { stage: 'PHONE', status: 'FRICTION', finding: 'x', confidence: 70, manualValidationRequired: true, evidenceIds: [] },
  { stage: 'FOLLOW_UP', status: 'RISK', finding: 'y', confidence: 60, manualValidationRequired: true, evidenceIds: [] },
];

const evidence: EvidenceRecordLike[] = [
  { id: 'e1', evidenceType: 'BROKEN_LINK', fact: 'The linked ordering destination is failing.', supportingContext: null, confidence: 55 },
  { id: 'e2', evidenceType: 'MOBILE_SIGNAL', fact: 'Homepage lacks a mobile viewport meta tag.', supportingContext: null, confidence: 90 },
];

const brief = (topLeaks: RankedOpportunity[]) =>
  generateSalesBrief({
    restaurantName: "Leverock's Great Seafood",
    overallScore: 66,
    coverageScore: 70,
    topLeaks,
    journey,
    evidence,
    recommendedTier: 'AI Front Desk',
  });

describe('the claim hierarchy', () => {
  it('orders the five states', () => {
    expect(stateRank('VERIFIED')).toBeGreaterThan(stateRank('STRONG_EVIDENCE'));
    expect(stateRank('STRONG_EVIDENCE')).toBeGreaterThan(stateRank('INFERRED'));
    expect(stateRank('INFERRED')).toBeGreaterThan(stateRank('MANUAL_VALIDATION_REQUIRED'));
    expect(stateRank('MANUAL_VALIDATION_REQUIRED')).toBeGreaterThan(stateRank('INSUFFICIENT_DATA'));
  });

  it('inheritState always takes the weakest input — a claim can never be promoted', () => {
    expect(inheritState('VERIFIED', 'MANUAL_VALIDATION_REQUIRED')).toBe('MANUAL_VALIDATION_REQUIRED');
    expect(inheritState('VERIFIED', 'VERIFIED')).toBe('VERIFIED');
    expect(inheritState('STRONG_EVIDENCE', 'INFERRED', 'VERIFIED')).toBe('INFERRED');
    expect(inheritState()).toBe('INSUFFICIENT_DATA');
  });

  it('only VERIFIED licenses definitive language', () => {
    expect(mayStateDefinitively('VERIFIED')).toBe(true);
    for (const state of ['STRONG_EVIDENCE', 'INFERRED', 'MANUAL_VALIDATION_REQUIRED', 'INSUFFICIENT_DATA'] as const) {
      expect(mayStateDefinitively(state), state).toBe(false);
    }
  });

  it('a manual-validation flag beats any confidence score', () => {
    expect(stateForOpportunity({ manualValidationRequired: true, confidenceScore: 99 })).toBe('MANUAL_VALIDATION_REQUIRED');
  });
});

describe('best sales angle selection', () => {
  it('an uncertain transaction-link finding cannot outrank a stronger validated one', () => {
    // The exact production shape: the broken-link finding scores 88 on priority
    // (impact 90 × urgency 90) but is MANUAL_VALIDATION_REQUIRED, while the
    // verified technical finding scores lower. Raw priority put the rep's
    // opening line on the one claim they could not defend.
    const uncertainTransaction = leak({ rescuePriorityScore: 88, manualValidationRequired: true, confidenceScore: 55 });
    const validatedOpportunity = leak({
      category: 'WEBSITE TECHNICAL FOUNDATION',
      title: 'Foundational technical problems undermine mobile customers',
      rescuePriorityScore: 71,
      manualValidationRequired: false,
      confidenceScore: 90,
      evidenceIds: ['e2'],
    });

    const chosen = selectLeadFinding([uncertainTransaction, validatedOpportunity]);
    expect(chosen?.leak.title).toBe(validatedOpportunity.title);
    expect(chosen?.state).toBe('VERIFIED');

    expect(brief([uncertainTransaction, validatedOpportunity]).bestSalesAngle).toContain(validatedOpportunity.title);
  });

  it('breaks ties within a strength band by priority score', () => {
    const lower = leak({ title: 'Lower', manualValidationRequired: false, confidenceScore: 90, rescuePriorityScore: 60 });
    const higher = leak({ title: 'Higher', manualValidationRequired: false, confidenceScore: 90, rescuePriorityScore: 80 });
    expect(selectLeadFinding([lower, higher])?.leak.title).toBe('Higher');
  });

  it('returns null when there is nothing to lead with', () => {
    expect(selectLeadFinding([])).toBeNull();
  });
});

describe('language inherits the evidence state', () => {
  it('a MANUAL_VALIDATION_REQUIRED lead never produces a definitive failure claim', () => {
    const content = brief([leak()]);
    for (const [field, text] of Object.entries(content)) {
      if (typeof text !== 'string') continue;
      expect(containsDefinitiveFailureLanguage(text), `${field}: ${text}`).toBe(false);
    }
  });

  it('says explicitly what still needs validating', () => {
    const content = brief([leak()]);
    expect(content.bestSalesAngle).toMatch(/MANUAL_VALIDATION_REQUIRED/);
    expect(content.bestSalesAngle).toMatch(/not confirmed|NOT confirmed/i);
    expect(content.bestSalesAngle).toMatch(/complete the customer flow|ask the owner/i);
  });

  it('uses hedged vocabulary the requirement names', () => {
    const content = brief([leak()]);
    const combined = `${content.bestSalesAngle} ${content.emailOpener} ${content.callOpener} ${content.talkTrack}`;
    expect(combined).toMatch(/public evidence suggests|appears|\bmay\b|requires validation|could not (confirm|check)/i);
  });

  it('the talk track carries an explicit evidence-discipline instruction', () => {
    const content = brief([leak()]);
    expect(content.talkTrack).toMatch(/EVIDENCE DISCIPLINE/);
    expect(content.talkTrack).toMatch(/never as a confirmed defect/i);
    // The instruction itself must not quote the banned vocabulary — a rep
    // skimming the track should not find those words anywhere on the page.
    expect(containsDefinitiveFailureLanguage(content.talkTrack)).toBe(false);
  });

  it('labels each finding in the talk track with the strength it was established at', () => {
    const content = brief([
      leak({ title: 'Confirmed thing', manualValidationRequired: false, confidenceScore: 95 }),
      leak({ title: 'Unconfirmed thing' }),
    ]);
    expect(content.talkTrack).toMatch(/"Confirmed thing" — VERIFIED, state it plainly/);
    expect(content.talkTrack).toMatch(/"Unconfirmed thing" — MANUAL_VALIDATION_REQUIRED, ask about it, do not assert it/);
  });
});

describe('a VERIFIED finding is still stated plainly', () => {
  const verified = leak({
    title: 'A transaction link on the website is failing',
    manualValidationRequired: false,
    confidenceScore: 95,
  });

  it('does not hedge what the audit actually observed', () => {
    const content = brief([verified]);
    expect(content.bestSalesAngle).toMatch(/verified/i);
    expect(content.bestSalesAngle).toMatch(/State it plainly/);
    expect(content.bestSalesAngle).not.toMatch(/NOT confirmed/i);
  });

  it('omits the evidence-discipline warning when everything is verified', () => {
    expect(brief([verified]).talkTrack).not.toMatch(/EVIDENCE DISCIPLINE/);
  });
});

describe('no findings at all', () => {
  it('produces a clean-audit brief without inventing a problem', () => {
    const content = brief([]);
    expect(content.bestSalesAngle).toMatch(/clean audit/i);
    expect(containsDefinitiveFailureLanguage(content.bestSalesAngle)).toBe(false);
    expect(containsDefinitiveFailureLanguage(content.emailOpener)).toBe(false);
  });
});
