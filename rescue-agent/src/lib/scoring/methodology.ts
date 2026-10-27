/**
 * HOW THE RESCUE SCORE IS CALCULATED, IN THE WORDS THE CLIENT READS.
 *
 * The score, the coverage figure and the confidence labels were all computed
 * correctly and explained nowhere. A number between 0 and 100 under the words
 * "Rescue Score" invites exactly one reading — that something about the
 * business's performance has been measured — and nothing in the report said
 * otherwise. This module is the single documented answer, exported so the
 * interface, the PDF and the tests all quote the same text instead of each
 * paraphrasing the arithmetic.
 *
 * Everything here describes `calculateOverallScore` and
 * `calculateCategoryScores` in rescueScore.ts. If the arithmetic changes, this
 * file changes with it, and the tests in tests/scoring-explainability.test.ts
 * fail if the weights quoted here stop matching SCORE_WEIGHTS.
 */

import { SCORE_WEIGHTS, type ScoreCategory } from '@/types/audit';

/** Higher is better, on a fixed 0–100 scale. Stated because a "leak score" would run the other way. */
export const SCORE_DIRECTION =
  'The Rescue Score runs from 0 to 100 and higher is better. 100 means every signal this audit checks was ' +
  'present and working as far as a public page can show; 0 means none of them were.';

/**
 * What the number is a measurement OF. This is the sentence the report was
 * missing: the score is a measurement of the audit's own checklist, and of
 * nothing else.
 */
export const SCORE_MEANING =
  'The Rescue Score measures the defined set of public signals listed below — what a visitor to your website and ' +
  'public pages can find and do. It is not a measurement of revenue, profit, guest counts, call volume or any other ' +
  'financial or operational performance. None of those is observable from a public page, and none of them is in this ' +
  'number. A low score means specific public signals are missing or could not be verified; it does not mean the ' +
  'business is losing a measured amount of money, and a high score does not mean it is not.';

/** The weights, quoted from SCORE_WEIGHTS so the text cannot drift from the code. */
export const CATEGORY_WEIGHTS: [ScoreCategory, number, string][] = [
  ['DIGITAL_CUSTOMER_JOURNEY', SCORE_WEIGHTS.DIGITAL_CUSTOMER_JOURNEY, 'Discovery, website, menu and contact stages together'],
  ['WEBSITE_CONVERSION', SCORE_WEIGHTS.WEBSITE_CONVERSION, 'Whether the website moves a visitor towards an action'],
  ['PHONE_RESPONSE_READINESS', SCORE_WEIGHTS.PHONE_RESPONSE_READINESS, 'What the public pages show about reaching you by phone'],
  ['RESERVATION_EXPERIENCE', SCORE_WEIGHTS.RESERVATION_EXPERIENCE, 'The public booking pathway, where one exists'],
  ['ONLINE_ORDERING_EXPERIENCE', SCORE_WEIGHTS.ONLINE_ORDERING_EXPERIENCE, 'The public ordering pathway, where one exists'],
  ['REVIEW_REPUTATION_SYSTEM', SCORE_WEIGHTS.REVIEW_REPUTATION_SYSTEM, 'Owner-reported rating only — review platforms are never scraped'],
  ['LOCAL_DIGITAL_PRESENCE', SCORE_WEIGHTS.LOCAL_DIGITAL_PRESENCE, 'Name, address, phone and hours visible on your own pages'],
  ['CUSTOMER_RETENTION', SCORE_WEIGHTS.CUSTOMER_RETENTION, 'Public routes by which a guest can opt in or be invited back'],
  ['AI_AUTOMATION_READINESS', SCORE_WEIGHTS.AI_AUTOMATION_READINESS, 'Whether your public information is structured enough to automate against'],
];

export const WEIGHTS_EXPLANATION =
  'Each category carries a fixed weight, shown below, and each is scored from the journey stages and evidence that ' +
  'belong to it. The overall score is the weighted average of the categories that could be scored — see coverage.';

/**
 * The denominator, spelled out. This is the part most likely to be misread: a
 * coverage figure below 100% does not lower the Rescue Score, and a category
 * that could not be assessed is removed from BOTH sides of the average rather
 * than scored zero.
 */
export const COVERAGE_EXPLANATION =
  'Coverage is the share of the total weight that could actually be scored: the weights of the categories with ' +
  'sufficient public evidence, divided by the weights of all nine categories. It answers "how much of the intended ' +
  'audit ran", which is a different question from "how good were the results". A category without enough evidence is ' +
  'left out of the Rescue Score entirely — it is not scored zero — so it lowers coverage and leaves the score itself ' +
  'untouched. Read the two together: a high score at low coverage is a confident statement about a small part of the ' +
  'picture.';

/**
 * UNKNOWN is not a failing grade. The distinction the whole report rests on.
 *
 * A journey stage with status UNKNOWN contributes no number at all. RISK — the
 * status for something observed to be broken — scores 30. Collapsing the two
 * would turn "we could not see this" into "this is broken", which is the error
 * this audit exists to avoid.
 */
export const UNKNOWN_EXPLANATION =
  'Unknown and broken are kept apart everywhere in this report. A stage marked unknown was not assessed — the audit ' +
  'reads public pages only, and a reservation book, a point-of-sale loyalty list or a phone log leaves no public ' +
  'trace. Unknown stages contribute nothing to the Rescue Score and are excluded from its average; they reduce ' +
  'coverage instead. They are never scored as zero and never counted as a confirmed failure. Where something was ' +
  'observed and could not be resolved, the report says what a person should check.';

/**
 * CONFIDENCE — a rubric about how a fact was obtained, not a probability.
 *
 * The report used to print a percentage per evidence item: 90% for one fact, 85%
 * for another. Nothing distinguished those two numbers. They came from a
 * hand-assigned constant per observation type, and a reader cannot act on the
 * difference between 85 and 90 — but a printed percentage invites them to try,
 * and reads as a probability the audit never calculated.
 *
 * Three labels are shown instead. Each is defined by HOW the fact was obtained,
 * which is a question with a checkable answer. The internal 0–100 scale is kept
 * because thresholds depend on it (a finding under 60 is forced to manual
 * validation), and it is no longer displayed as if it were a measurement.
 */
//
// A LABEL GRADES THE FACT IT IS ATTACHED TO — NOTHING THE FACT SAYS WAS NOT SEEN.
//
// The Moderate band once used "a published enquiry form" as its example, while
// the enquiry-form record is emitted at 85 and displayed as Strong: the web
// report and the PDF printed Strong beside guidance calling the same record
// Moderate. The score was right for what that record claims — the form is
// there, and its own wording invites general enquiries, both read directly;
// delivery is stated as not observed. So the examples now name the records
// each band actually labels, and separate the three things a form record can
// be about: that it exists, what it is for, and whether submissions arrive.
export const CONFIDENCE_BANDS: [string, string][] = [
  [
    'Strong',
    'Read directly from a page that was fetched, or from the response to a request that was made. Nothing about the ' +
      'fact depends on inference. A published enquiry form whose own wording invites general enquiries is Strong for ' +
      'exactly that: the form is there and says so. Whether a submission arrives or is answered is not part of that ' +
      'fact — the record states it was not observed, and no label covers it.',
  ],
  [
    'Moderate',
    'Observed on a public page, with part of what it describes outside public view. A published table-request form is ' +
      'Moderate: the form is visibly there, and whether a request reaches a booking system cannot be seen from ' +
      'outside. So is a form scoped to one purpose: whether the restaurant also takes other enquiries through it needs ' +
      'owner confirmation.',
  ],
  [
    'Preliminary',
    'A signal consistent with the fact that does not establish it — including the absence of something the crawl may ' +
      'simply not have reached. A starting point for a question, not a conclusion. A form whose own wording does not ' +
      'establish whether it takes general enquiries is Preliminary.',
  ],
];

export const CONFIDENCE_EXPLANATION =
  'Confidence describes how directly a fact was observed, not how likely an outcome is. It is a label, not a ' +
  'percentage: the audit has no basis for distinguishing an 85% from a 90%, so it does not print one.';

/**
 * Finding labels are not evidence confidence, and the report used one word for
 * both: evidence read straight off a page is "Strong", while a finding badged
 * STRONG EVIDENCE is one that was not confirmed end to end. Printed side by
 * side, "0 verified findings" over evidence marked "verified" read as a
 * contradiction. This says which is which, once, next to the legend.
 */
export const FINDING_CLASSIFICATION_NOTE =
  'Finding labels are separate from evidence confidence. A finding is a "Verified finding" only when the whole finding ' +
  'was established from public evidence. "Strong evidence" means the evidence behind it was read directly — for example a ' +
  'link in the page markup — but the finding has not been tested end to end, such as by tapping a button on a phone. ' +
  'No finding in this report measures an effect on orders or revenue.';

/** The whole methodology as ordered sections, for the report and the PDF to render. */
export interface MethodologySection {
  heading: string;
  body: string;
  rows?: [string, string][];
}

export function scoringMethodology(): MethodologySection[] {
  return [
    { heading: 'What the Rescue Score measures', body: `${SCORE_DIRECTION} ${SCORE_MEANING}` },
    {
      heading: 'How the categories are weighted',
      body: WEIGHTS_EXPLANATION,
      rows: CATEGORY_WEIGHTS.map(([, weight, description]) => [`${weight}%`, description] as [string, string]),
    },
    { heading: 'What coverage means', body: COVERAGE_EXPLANATION },
    { heading: 'Unknown is not a failure', body: UNKNOWN_EXPLANATION },
    {
      heading: 'What confidence means',
      body: CONFIDENCE_EXPLANATION,
      rows: CONFIDENCE_BANDS.map(([label, definition]) => [label, definition] as [string, string]),
    },
  ];
}
