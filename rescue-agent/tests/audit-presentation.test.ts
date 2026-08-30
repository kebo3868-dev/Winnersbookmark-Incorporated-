import { describe, expect, it } from 'vitest';
import { presentFailure, shortRunId } from '@/lib/audit/failurePresentation';
import { displayDomain } from '@/lib/validation/urlSanitize';

/**
 * MEDIUM 8 / MEDIUM 9 — AUDIT HISTORY AND FAILED-AUDIT PRESENTATION
 *
 * Repeated audits of one restaurant were indistinguishable, and a failed one
 * presented itself as its raw URL:
 *
 *     https://leverocks.com/%E2%81%A0   FAILED
 *
 * which is unreadable, explains nothing, and — because the percent-encoded noise
 * is the widest thing on the row — makes the failure look like the restaurant's
 * fault rather than a paste artifact.
 */

describe('failed audits read as English', () => {
  it('translates the failure states an operator actually sees', () => {
    expect(presentFailure('Website validation failed: INVALID WEBSITE URL').state).toBe('Invalid website address');
    expect(presentFailure('Website validation failed: UNSAFE URL DESTINATION').state).toBe('Blocked destination');
    expect(presentFailure('Primary website could not be collected (UNAVAILABLE): HTTP 404').state).toBe('Page not found');
    expect(presentFailure('Primary website could not be collected (TIMEOUT): Timed out').state).toBe('Website did not respond in time');
    expect(presentFailure('Primary website could not be collected (BLOCKED): bot protection').state).toBe('Blocked by the website');
    expect(presentFailure('AUDIT COULD NOT START OR COMPLETE due to an internal error.').state).toBe('Audit error');
  });

  it('gives a next step wherever there is a sensible one', () => {
    expect(presentFailure('Website validation failed: INVALID WEBSITE URL').nextStep).toMatch(/Re-enter the URL/i);
    expect(presentFailure('Primary website could not be collected (UNAVAILABLE): HTTP 404').nextStep).toMatch(
      /stray characters/i,
    );
  });

  it('never invents a cause for a reason it does not recognise', () => {
    const unknown = presentFailure('something entirely unexpected happened');
    expect(unknown.state).toBe('Audit did not complete');
    expect(unknown.reason).toMatch(/stopped before it could produce findings/i);
  });

  it('handles a missing reason without throwing', () => {
    expect(presentFailure(null).state).toBe('Audit did not complete');
    expect(presentFailure(undefined).state).toBe('Audit did not complete');
  });

  it('the 404-from-an-invisible-character case gets a useful next step', () => {
    // This is the exact production failure. The operator needs to know to check
    // the pasted URL, not to conclude the restaurant's site is down.
    const failure = presentFailure('Primary website could not be collected (UNAVAILABLE): HTTP 404. No analysis was performed');
    expect(failure.state).toBe('Page not found');
    expect(failure.nextStep).toMatch(/stray characters in the pasted URL/i);
  });
});

describe('what a history row shows instead of a raw URL', () => {
  it('shows a readable domain even for the invisible-character URL', () => {
    expect(displayDomain('https://leverocks.com/%E2%81%A0')).toBe('leverocks.com');
  });

  it('a short run ID distinguishes repeated audits of the same restaurant', () => {
    const a = shortRunId('clx1a2b3c4d5e6f7g8h9abcdef');
    const b = shortRunId('clx1a2b3c4d5e6f7g8h9abcxyz');
    expect(a).toHaveLength(6);
    expect(a).toBe('ABCDEF');
    expect(a).not.toBe(b);
  });
});
