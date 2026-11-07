/**
 * WHAT A FINDING RESTS ON, IN THREE LAYERS.
 *
 * A finding's evidence state is one label for the whole claim. For some
 * findings that label hides a split the reader needs: part of the claim was
 * read directly from the website and is verified, part of it needs a person to
 * try it, and its effect on the business is not measured by a public audit at
 * all. Printed as one "STRONG EVIDENCE" badge next to evidence marked
 * "verified", it read as a contradiction — the report said zero findings were
 * verified while showing the verified markup underneath.
 *
 * This is the one place those layers are written, so the Executive Report, the
 * PDF, the internal audit page and the Sales Brief cannot describe the same
 * finding three different ways. It is keyed by finding category and read when
 * a report is rendered, so an audit stored before it existed gets the same
 * wording. It changes no state, score or priority.
 *
 * Only finding types whose layers are actually known are listed. Writing a
 * "verified" line for a finding that did not earn one would be the overclaim
 * this exists to prevent.
 */
export interface EvidenceBasis {
  /** What the automated audit read directly from the website. Verified. */
  verified: string;
  /**
   * What a person has to try by hand. The automated audit never does it, and
   * a manual check is documented separately — so this says neither that it
   * was done nor that no one has done it.
   */
  manualCheck: string;
  /** What a public audit cannot measure. */
  notMeasured: string;
  /** The three layers in one line, for a status a rep reads aloud. */
  summary: string;
  /** The observation in words for the owner, completing "one thing on your website stood out: …". */
  ownerObservation: string;
  /** What was and was not done, in words for the owner — the one caveat an email carries. */
  ownerCaveat: string;
  /** The single check that would confirm it, as an instruction to the rep. */
  nextCheck: string;
  /**
   * What was observed, for the report's Diagnosis — completing "Observed in the
   * page markup: …". It is the established part of the finding, stated without
   * any claim about what customers did.
   */
  diagnosisObserved: string;
  /**
   * What only the owner can confirm, for the report's Diagnosis — completing
   * "Requires owner confirmation: …". It is the unverified business outcome,
   * kept out of the observed sentence so the strong markup evidence is not read
   * as evidence of an effect on the business.
   */
  ownerConfirmation: string;
}

const BASIS_BY_CATEGORY: Record<string, EvidenceBasis> = {
  'ORDER BUTTON LABEL MISMATCH': {
    verified:
      'Read from the page markup: the ordering button in the section labelled as online ordering is a telephone (tel:) link. ' +
      'The automated audit reads links; it does not tap buttons.',
    // A tap test on a phone may well have been done — by hand, and recorded
    // outside the audit. "No one tapped the button" would contradict it.
    manualCheck:
      'Tapping the button on a phone is a manual check, separate from this automated audit. Any result is documented ' +
      'separately and is not part of these automated findings.',
    notMeasured: 'Any effect on orders or revenue — that needs order and call records.',
    summary:
      'the page markup was read automatically; a tap test on a phone is a separate manual check, not part of the ' +
      'automated audit; any effect on orders is not measured',
    // Generic on purpose: the button and section wording differ by site, and
    // a quote the owner cannot find on their own page undoes the point.
    ownerObservation: 'the ordering button in your online-ordering section is set up as a phone link rather than an online checkout',
    ownerCaveat: 'My audit read that from the page itself rather than tapping it, and I am not assuming what it costs you',
    nextCheck:
      'Tap the button on a phone (or use the separately documented tap test), or ask the owner, before describing what customers experience.',
    diagnosisObserved:
      'the ordering button in the section labelled as online ordering is a telephone (tel:) link, not a link to an online checkout',
    ownerConfirmation:
      'whether ordering by phone is the intended method, what customers do after selecting the button, and any effect on ' +
      'orders or revenue — which needs order and call records',
  },
};

/** The three-layer basis for a finding category, or null when none is defined. */
export function evidenceBasisFor(category: string): EvidenceBasis | null {
  return BASIS_BY_CATEGORY[category] ?? null;
}

/**
 * The layers as labelled rows, in the order every surface prints them. The
 * labels separate what the automated audit established from a manual check
 * it cannot perform, so no surface implies the audit tapped anything.
 */
export function evidenceBasisRows(basis: EvidenceBasis): [string, string][] {
  return [
    ['Automated finding', basis.verified],
    ['Manual check', basis.manualCheck],
    ['Not measured', basis.notMeasured],
  ];
}
