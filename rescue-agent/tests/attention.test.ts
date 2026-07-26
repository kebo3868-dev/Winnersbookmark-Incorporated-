import { describe, expect, it } from 'vitest';
import { classifyAudit, ATTENTION_STATUSES } from '@/lib/audit/attention';

describe('classifyAudit', () => {
  it('says nothing about healthy audits', () => {
    expect(classifyAudit({ status: 'COMPLETED', failureReason: null })).toBeNull();
    expect(classifyAudit({ status: 'RUNNING', failureReason: null })).toBeNull();
    expect(classifyAudit({ status: 'PENDING', failureReason: null })).toBeNull();
  });

  it('surfaces a failed audit with the recorded reason', () => {
    const item = classifyAudit({ status: 'FAILED', failureReason: 'Primary website could not be collected (TIMEOUT).' });
    expect(item?.level).toBe('FAILED');
    expect(item?.headline).toBe('Audit failed');
    expect(item?.detail).toContain('TIMEOUT');
  });

  it('never leaves a failure unexplained when no reason was recorded', () => {
    for (const reason of [null, '', '   ']) {
      const item = classifyAudit({ status: 'FAILED', failureReason: reason });
      expect(item?.level).toBe('FAILED');
      expect(item?.detail.length).toBeGreaterThan(0);
      expect(item?.detail).toMatch(/no reason was recorded/i);
    }
  });

  it('flags partial completion as a coverage gap, not an error', () => {
    const item = classifyAudit({ status: 'PARTIALLY_COMPLETED', failureReason: null });
    expect(item?.level).toBe('PARTIAL');
    expect(item?.headline).toBe('Completed with gaps');
    expect(item?.detail).toMatch(/coverage is incomplete/i);
  });

  it('prefers a specific recorded reason over the generic partial wording', () => {
    const item = classifyAudit({ status: 'PARTIALLY_COMPLETED', failureReason: '3 target(s) were not examined.' });
    expect(item?.detail).toBe('3 target(s) were not examined.');
  });

  it('queries exactly the statuses it knows how to classify', () => {
    for (const status of ATTENTION_STATUSES) {
      expect(classifyAudit({ status, failureReason: null })).not.toBeNull();
    }
  });
});
