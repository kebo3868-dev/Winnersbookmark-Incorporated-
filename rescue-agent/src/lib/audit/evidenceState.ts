/**
 * CANONICAL EVIDENCE STATE AND THE LANGUAGE IT LICENSES
 *
 * Every surface the audit produces — the Customer Journey, the Revenue Leaks,
 * the Executive Report, the PDF and the Internal Sales Brief — says something
 * about how sure the audit is. Before this module each of them decided that for
 * itself, and they drifted. A finding the journey called "requires manual
 * validation" reached the sales brief as a flat "their reservation system is
 * broken", because the brief only ever saw a title and a priority score.
 *
 * There is now exactly one ladder, and one rule about climbing it.
 *
 * ── THE LADDER ──────────────────────────────────────────────────────────────
 *
 *   VERIFIED                    The audit observed the customer-facing failure
 *                               or capability itself. Definitive language is
 *                               permitted here and ONLY here.
 *   STRONG_EVIDENCE             Public evidence is consistent and high
 *                               confidence, but the customer flow was not
 *                               completed end to end. Confident, qualified.
 *   INFERRED                    A pattern in public signals suggests an
 *                               opportunity. Describe the opportunity, never a
 *                               confirmed defect.
 *   MANUAL_VALIDATION_REQUIRED  Something real was seen and could not be
 *                               resolved. Say what a human must check.
 *   INSUFFICIENT_DATA           Nothing was observed. Not a finding, and not a
 *                               penalty unless the scoring model says so.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 * A claim may be WEAKER than its evidence. It may never be stronger. Every
 * transition between layers runs through `inheritState`, which takes the
 * weakest input — so a sales angle built on a manual-validation finding is a
 * manual-validation claim, no matter how compelling it would read otherwise.
 */

export type EvidenceState =
  | 'VERIFIED'
  | 'STRONG_EVIDENCE'
  | 'INFERRED'
  | 'MANUAL_VALIDATION_REQUIRED'
  | 'INSUFFICIENT_DATA';

/**
 * Strength ordering. Higher is a stronger claim.
 *
 * MANUAL_VALIDATION_REQUIRED sits BELOW INFERRED deliberately. An inference
 * from consistent public signals is a claim the audit is willing to make;
 * "we saw something and could not resolve it" is an open question, and an open
 * question must never outrank an answer.
 */
const RANK: Record<EvidenceState, number> = {
  VERIFIED: 4,
  STRONG_EVIDENCE: 3,
  INFERRED: 2,
  MANUAL_VALIDATION_REQUIRED: 1,
  INSUFFICIENT_DATA: 0,
};

export function stateRank(state: EvidenceState): number {
  return RANK[state];
}

/**
 * The strongest claim a set of inputs supports: the WEAKEST of them.
 *
 * This is the promotion guard. Any surface deriving a claim from upstream
 * findings passes every contributing state through here, so a strong-sounding
 * conclusion cannot be assembled out of weak parts.
 */
export function inheritState(...states: EvidenceState[]): EvidenceState {
  if (states.length === 0) return 'INSUFFICIENT_DATA';
  return states.reduce((weakest, s) => (RANK[s] < RANK[weakest] ? s : weakest));
}

/** True only for VERIFIED. The gate on "broken", "failing", "unavailable", "dead end". */
export function mayStateDefinitively(state: EvidenceState): boolean {
  return state === 'VERIFIED';
}

/**
 * Words the audit refuses to use about anything short of VERIFIED.
 *
 * Exported so tests can assert the prohibition directly against generated copy
 * rather than trusting that each call site remembered it.
 */
export const DEFINITIVE_FAILURE_TERMS = [
  'is broken',
  'are broken',
  'is failing',
  'are failing',
  'is unavailable',
  'are unavailable',
  'is dead',
  'dead end',
  'does not work',
  'do not work',
  'cannot be used',
  'is down',
];

/**
 * True when copy makes a definitive failure claim.
 *
 * Used by the claim-safety tests: any string produced for a non-VERIFIED
 * finding must not match, whatever surface produced it.
 */
export function containsDefinitiveFailureLanguage(text: string): boolean {
  const haystack = text.toLowerCase();
  return DEFINITIVE_FAILURE_TERMS.some((term) => haystack.includes(term));
}

/** Short label for badges and report headings. */
export const STATE_LABEL: Record<EvidenceState, string> = {
  VERIFIED: 'VERIFIED FINDING',
  STRONG_EVIDENCE: 'STRONG EVIDENCE',
  INFERRED: 'INFERRED OPPORTUNITY',
  MANUAL_VALIDATION_REQUIRED: 'MANUAL VALIDATION REQUIRED',
  INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
};

/**
 * The hedge each state licenses, as a sentence prefix.
 *
 * VERIFIED returns an empty string: a verified finding is stated plainly, and
 * hedging one would be its own kind of dishonesty.
 */
export const STATE_QUALIFIER: Record<EvidenceState, string> = {
  VERIFIED: '',
  STRONG_EVIDENCE: 'Public evidence strongly indicates that ',
  INFERRED: 'Public signals suggest that ',
  MANUAL_VALIDATION_REQUIRED: 'Public evidence suggests that ',
  INSUFFICIENT_DATA: 'The audit could not observe whether ',
};

/**
 * Apply the qualifier a state licenses to a clause.
 *
 * `clause` is written in plain definitive form ("the online ordering pathway is
 * failing") and this decides how it may be said. The first letter is
 * lower-cased when a prefix is added so the sentence reads naturally.
 */
export function qualifyClaim(state: EvidenceState, clause: string): string {
  const trimmed = clause.trim();
  if (!trimmed) return '';
  if (state === 'VERIFIED') return trimmed;
  const prefix = STATE_QUALIFIER[state];
  const body = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  const sentence = `${prefix}${body}`;
  return state === 'MANUAL_VALIDATION_REQUIRED' ? `${withoutTrailingStop(sentence)}. This requires validation.` : sentence;
}

function withoutTrailingStop(text: string): string {
  return text.replace(/[.\s]+$/, '');
}

/**
 * What a human has to do before a non-VERIFIED finding can be asserted.
 *
 * MANUAL_VALIDATION_REQUIRED findings are required to state this explicitly —
 * "requires validation" with no instruction is not actionable, and an
 * unactionable caveat gets skipped by the reader.
 */
export function validationInstruction(state: EvidenceState, subject: string): string | null {
  switch (state) {
    case 'VERIFIED':
      return null;
    case 'STRONG_EVIDENCE':
      return `Confirm ${subject} end to end before stating it as fact to the owner.`;
    case 'INFERRED':
      return `Ask the owner about ${subject}; the audit inferred this from public signals rather than observing it.`;
    case 'MANUAL_VALIDATION_REQUIRED':
      return `Open ${subject} in a browser and complete the customer flow, or ask the owner for the internal data, before making any claim about it.`;
    case 'INSUFFICIENT_DATA':
      return `No public evidence about ${subject} was available. Treat it as unknown, not as a problem.`;
  }
}

// ── Derivations from existing engine outputs ────────────────────────────────
//
// The engine's own uncertainty flags are the source of truth. These functions
// translate them onto the ladder; they never add confidence the engine did not
// already record.

/**
 * State for a detected opportunity (Revenue Leak).
 *
 * Mirrors the rule the Executive Report has always used, with STRONG_EVIDENCE
 * added between VERIFIED and INFERRED so a 70–79 confidence finding is no
 * longer flattened into the same bucket as a 40.
 */
export function stateForOpportunity(opp: { manualValidationRequired: boolean; confidenceScore: number }): EvidenceState {
  if (opp.manualValidationRequired) return 'MANUAL_VALIDATION_REQUIRED';
  if (opp.confidenceScore >= 80) return 'VERIFIED';
  if (opp.confidenceScore >= 65) return 'STRONG_EVIDENCE';
  if (opp.confidenceScore > 0) return 'INFERRED';
  return 'INSUFFICIENT_DATA';
}

/**
 * State for a customer-journey stage.
 *
 * RESOLVED_UNVERIFIED maps to MANUAL_VALIDATION_REQUIRED by construction: the
 * status exists precisely to record that a destination resolved and the
 * customer action was not verified.
 */
export function stateForJourneyStage(stage: { status: string; manualValidationRequired: boolean }): EvidenceState {
  if (stage.status === 'UNKNOWN') {
    return stage.manualValidationRequired ? 'MANUAL_VALIDATION_REQUIRED' : 'INSUFFICIENT_DATA';
  }
  if (stage.status === 'RESOLVED_UNVERIFIED') return 'MANUAL_VALIDATION_REQUIRED';
  if (stage.manualValidationRequired) return 'MANUAL_VALIDATION_REQUIRED';
  return stage.status === 'RISK' || stage.status === 'HEALTHY' ? 'VERIFIED' : 'STRONG_EVIDENCE';
}
