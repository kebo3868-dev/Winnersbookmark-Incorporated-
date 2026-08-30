/**
 * FAILED AUDITS, READ BY A HUMAN
 *
 * A failed audit used to present itself as its raw URL:
 *
 *     https://leverocks.com/%E2%81%20A0   FAILED
 *
 * which is unreadable, tells the operator nothing about what went wrong, and —
 * because the percent-encoded noise is the widest thing on the row — makes the
 * failure look like the restaurant's fault rather than a paste artifact.
 *
 * The list now shows the restaurant and its domain, a plain failure state, and
 * one sentence a person can act on. The raw URL is not deleted; it moves to the
 * diagnostics line where it belongs.
 */

/** A stored failure reason, translated into something an operator can act on. */
export interface FailurePresentation {
  /** Short state for a badge. */
  state: string;
  /** One sentence, plain language, no jargon. */
  reason: string;
  /** What to do next, when there is a sensible next step. */
  nextStep: string | null;
}

/**
 * Patterns matched against the stored `failureReason`.
 *
 * Ordered most specific first. Each entry has to say what happened in words an
 * operator can repeat to a colleague — "UNAVAILABLE" is a status, not an
 * explanation.
 */
const PATTERNS: [RegExp, FailurePresentation][] = [
  [
    /INVALID WEBSITE URL|could not be parsed/i,
    {
      state: 'Invalid website address',
      reason: 'The address submitted is not a usable website address.',
      nextStep: 'Re-enter the URL, typing it rather than pasting it.',
    },
  ],
  [
    /CONTROL CHARACTERS/i,
    {
      state: 'Unusable characters in the address',
      reason: 'The submitted address contained characters that cannot appear in a web address.',
      nextStep: 'Re-enter the URL by typing it, or paste it into a plain-text field first.',
    },
  ],
  [
    /UNSAFE URL DESTINATION/i,
    {
      state: 'Blocked destination',
      reason: 'The address resolves to a private or internal network location, which the audit will not visit.',
      nextStep: 'Check the address; a public restaurant website should not resolve here.',
    },
  ],
  [
    /404|NOT FOUND/i,
    {
      state: 'Page not found',
      reason: 'The website answered, but there is no page at the address given.',
      nextStep: 'Audit the homepage rather than a deep link, and check for stray characters in the pasted URL.',
    },
  ],
  [
    /TIMEOUT|timed out/i,
    {
      state: 'Website did not respond in time',
      reason: 'The website did not answer within the time the audit allows.',
      nextStep: 'Re-run the audit; if it times out again the site is likely slow or blocking automated visits.',
    },
  ],
  [
    /BLOCKED|bot protection|403/i,
    {
      state: 'Blocked by the website',
      reason: 'The website refused the audit. This is usually bot protection, not a fault with the site.',
      nextStep: 'The site will need to be reviewed by hand.',
    },
  ],
  [
    /internal error/i,
    {
      state: 'Audit error',
      reason: 'The audit stopped because of an internal error. Any evidence already collected has been kept.',
      nextStep: 'Re-run the audit.',
    },
  ],
  [
    // `\bERROR\b` rather than a bare `ERROR`: the unbounded form also matched
    // the word "error" in "internal error", which is a different failure with a
    // different next step.
    /could not be collected|COULD NOT BE REACHED|UNAVAILABLE|\bERROR\b/i,
    {
      state: 'Website could not be reached',
      reason: 'The website could not be loaded, so no analysis was performed.',
      nextStep: 'Confirm the address opens in a browser, then re-run the audit.',
    },
  ],
];

const UNKNOWN: FailurePresentation = {
  state: 'Audit did not complete',
  reason: 'The audit stopped before it could produce findings.',
  nextStep: 'Re-run the audit.',
};

/**
 * Translate a stored failure reason for display.
 *
 * Deliberately never invents a cause: an unrecognised reason returns the neutral
 * fallback rather than guessing, and the original text stays available for the
 * diagnostics line.
 */
export function presentFailure(failureReason: string | null | undefined): FailurePresentation {
  if (!failureReason) return UNKNOWN;
  for (const [pattern, presentation] of PATTERNS) {
    if (pattern.test(failureReason)) return presentation;
  }
  return UNKNOWN;
}

/**
 * Short run identifier for telling repeated audits apart at a glance.
 *
 * The last six characters of the cuid: enough to distinguish two runs of the
 * same restaurant on the same afternoon, short enough to read aloud.
 */
export function shortRunId(auditId: string): string {
  return auditId.slice(-6).toUpperCase();
}
