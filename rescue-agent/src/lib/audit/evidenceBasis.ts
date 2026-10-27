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
  /** Where the verified part was read, completing "Verified in …". */
  verifiedSource: string;
  /** What the audit read directly from the website. Verified. */
  verified: string;
  /** What a person still has to try. Not performed by the audit. */
  notTested: string;
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
}

const BASIS_BY_CATEGORY: Record<string, EvidenceBasis> = {
  'ORDER BUTTON LABEL MISMATCH': {
    verifiedSource: 'the page markup',
    verified: 'The ordering button in the section labelled as online ordering is a telephone (tel:) link, read directly from the page markup.',
    notTested: 'No one tapped the button on a phone during this audit, and whether the online ordering system is set up was not checked.',
    notMeasured: 'Any effect on orders or revenue — that needs order and call records.',
    summary: 'the page markup is verified; a tap test on a phone has not been done; any effect on orders is not measured',
    // Generic on purpose: the button and section wording differ by site, and
    // a quote the owner cannot find on their own page undoes the point.
    ownerObservation: 'the ordering button in your online-ordering section is set up as a phone link rather than an online checkout',
    ownerCaveat: 'I read that from the page itself but have not tested it on a phone, and I am not assuming what it costs you',
    nextCheck: 'Tap the button on a phone, or ask the owner, before describing what customers experience.',
  },
};

/** The three-layer basis for a finding category, or null when none is defined. */
export function evidenceBasisFor(category: string): EvidenceBasis | null {
  return BASIS_BY_CATEGORY[category] ?? null;
}

/** The layers as labelled rows, in the order every surface prints them. */
export function evidenceBasisRows(basis: EvidenceBasis): [string, string][] {
  return [
    [`Verified in ${basis.verifiedSource}`, basis.verified],
    ['Not yet tested', basis.notTested],
    ['Not measured', basis.notMeasured],
  ];
}
