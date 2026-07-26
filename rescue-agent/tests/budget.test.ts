import { describe, expect, it } from 'vitest';
import {
  createAuditBudget,
  resolveAuditBudgetMs,
  DEFAULT_AUDIT_BUDGET_MS,
  MIN_USEFUL_REQUEST_MS,
} from '@/lib/audit/budget';

describe('resolveAuditBudgetMs', () => {
  it('defaults when AUDIT_BUDGET_MS is unset', () => {
    expect(resolveAuditBudgetMs({})).toBe(DEFAULT_AUDIT_BUDGET_MS);
  });

  it('honours a valid override', () => {
    expect(resolveAuditBudgetMs({ AUDIT_BUDGET_MS: '20000' })).toBe(20_000);
  });

  it('falls back to the default on garbage or non-positive values', () => {
    expect(resolveAuditBudgetMs({ AUDIT_BUDGET_MS: 'soon' })).toBe(DEFAULT_AUDIT_BUDGET_MS);
    expect(resolveAuditBudgetMs({ AUDIT_BUDGET_MS: '0' })).toBe(DEFAULT_AUDIT_BUDGET_MS);
    expect(resolveAuditBudgetMs({ AUDIT_BUDGET_MS: '-5000' })).toBe(DEFAULT_AUDIT_BUDGET_MS);
  });

  it('clamps absurd values into a survivable range', () => {
    expect(resolveAuditBudgetMs({ AUDIT_BUDGET_MS: '10' })).toBe(5_000);
    expect(resolveAuditBudgetMs({ AUDIT_BUDGET_MS: '99999999' })).toBe(280_000);
  });
});

describe('createAuditBudget', () => {
  const start = 1_000_000;

  it('reports remaining time and expiry against the deadline', () => {
    const b = createAuditBudget(45_000, start);
    expect(b.deadline).toBe(start + 45_000);
    expect(b.remainingMs(start)).toBe(45_000);
    expect(b.remainingMs(start + 30_000)).toBe(15_000);
    expect(b.expired(start + 30_000)).toBe(false);
    expect(b.expired(start + 45_000)).toBe(true);
  });

  it('never reports negative remaining time', () => {
    const b = createAuditBudget(10_000, start);
    expect(b.remainingMs(start + 90_000)).toBe(0);
  });

  it('passes the full cap through while there is plenty of time', () => {
    const b = createAuditBudget(45_000, start);
    expect(b.timeoutFor(15_000, start)).toBe(15_000);
  });

  it('shrinks the request timeout to the time actually left', () => {
    const b = createAuditBudget(45_000, start);
    // 6s left, but the caller wanted 15s — a request must not outlive the budget.
    expect(b.timeoutFor(15_000, start + 39_000)).toBe(6_000);
  });

  it('returns null once too little time remains to be worth starting', () => {
    const b = createAuditBudget(45_000, start);
    expect(b.timeoutFor(15_000, start + 45_000 - MIN_USEFUL_REQUEST_MS + 1)).toBeNull();
    expect(b.timeoutFor(15_000, start + 45_000)).toBeNull();
    expect(b.timeoutFor(15_000, start + 60_000)).toBeNull();
  });

  it('bounds a full collection run to the budget rather than 18 × per-request timeout', () => {
    // The failure this exists to prevent: 10 pages + 8 probes, each able to
    // spend 15s, is ~270s of wall clock — far past any serverless cap.
    const budgetMs = 45_000;
    const b = createAuditBudget(budgetMs, start);
    let now = start;
    let started = 0;
    for (let i = 0; i < 18; i++) {
      const t = b.timeoutFor(15_000, now);
      if (t === null) break;
      started += 1;
      now += t; // worst case: every request burns its whole timeout
    }
    expect(started).toBeLessThan(18); // it stops early instead of running away
    expect(now - start).toBeLessThanOrEqual(budgetMs);
  });
});
