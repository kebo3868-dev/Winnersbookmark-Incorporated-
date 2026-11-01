/**
 * HOW A RATING IS DESCRIBED, AND WHAT IT IS NOT.
 *
 * The audit never reads a review platform. The only rating it uses is the one
 * typed into the intake form, and nothing records where the person typing it
 * found the number — the Google listing itself, or the review excerpts and
 * star graphics a restaurant's own website chooses to display. The report
 * called it an "owner-reported public rating", which reads as a figure checked
 * against Google. It was not, and an excerpt a site selects is not a rating at
 * all.
 *
 * So every surface now says the same three things: the rating was entered at
 * intake and used as provided; it was not checked against Google or any review
 * platform; and review excerpts on the restaurant's own website are not treated
 * as a verified rating and are not scored.
 *
 * The stored wording keeps the "rating:" token and the "N★" figure that the
 * journey and the score read (journey.ts, rescueScore.ts), so no status or
 * score can move. `presentReputationText` rewrites wording stored before this
 * change, so an older audit reads the same as a new one.
 */

const NOT_CHECKED = 'not checked against Google or any review platform';

/** The rating record's fact. Keeps "rating:" and "N★" for the journey and the score. */
export function ratingFact(rating: number, reviewCount: number | null): string {
  const count = reviewCount !== null ? ` across ${reviewCount} review(s)` : '';
  return `Owner-reported rating: ${rating.toFixed(1)}★${count}, entered at intake — ${NOT_CHECKED}.`;
}

export const RATING_CONTEXT =
  'Provided at intake and used as provided; not independently verified against Google or any review platform. ' +
  'Review excerpts or star ratings shown on the restaurant\'s own website are content the site chooses to display: ' +
  'they are not an independently verified Google rating, and this audit does not score them.';

export function reviewCountFact(reviewCount: number): string {
  return `Owner-reported review count: ${reviewCount} review(s), entered at intake — ${NOT_CHECKED}.`;
}

export const REVIEW_COUNT_CONTEXT = 'Provided at intake and used as provided; no rating was entered.';

export const PROFILE_URL_FACT = 'A Google Business Profile URL was entered at intake.';

export const PROFILE_URL_CONTEXT =
  'Owner-reported. The audit does not open the profile or read its rating; response-pattern and recency analysis ' +
  'require direct platform access and are out of audit scope.';

/** The REVIEW journey stage when a rating was entered. */
export function ratedStageFinding(rating: number): string {
  return (
    `Owner-reported rating of ${rating.toFixed(1)}★, entered at intake and ${NOT_CHECKED}. ` +
    'Not assessed: the rating on the Google listing itself, review excerpts shown on the restaurant\'s website, and ' +
    'response patterns or recency — those need direct platform access.'
  );
}

export const UNRATED_STAGE_FINDING =
  'No rating was entered at intake, and review platforms are not scraped. Not assessed: review excerpts shown on the ' +
  'restaurant\'s website, which are not a verified rating. Enter the current rating from the Google Business Profile ' +
  'to include reputation in the audit.';

export function ratingScoreExplanation(rating: number): string {
  return (
    `Derived from an owner-reported ${rating.toFixed(1)}★ rating entered at intake, ${NOT_CHECKED}. Review excerpts ` +
    'on the restaurant\'s website are not scored. Response-pattern analysis requires direct platform access.'
  );
}

/** Wording stored before this change, and what it now reads. */
const STORED_WORDING: [RegExp, (...groups: string[]) => string][] = [
  [
    /Owner-reported public rating: (\d(?:\.\d)?)★(?: across (\d+) review\(s\))?\./g,
    (_m, rating, count) => ratingFact(parseFloat(rating), count === undefined ? null : Number(count)),
  ],
  [/Provided by the restaurant at intake; not independently verified against the review platform\./g, () => RATING_CONTEXT],
  [/Owner-reported review volume: (\d+) review\(s\)\./g, (_m, count) => reviewCountFact(Number(count))],
  [/Provided by the restaurant at intake; rating not provided\./g, () => REVIEW_COUNT_CONTEXT],
  [/A Google Business Profile URL was provided by the restaurant\./g, () => PROFILE_URL_FACT],
  [
    /Owner-reported\. Response-pattern and recency analysis require direct platform access and are out of audit scope\./g,
    () => PROFILE_URL_CONTEXT,
  ],
  [
    /Owner-reported rating of (\d(?:\.\d)?)★\. Reputation is included from provided data; response-pattern and recency analysis still require direct platform access\./g,
    (_m, rating) => ratedStageFinding(parseFloat(rating)),
  ],
  [
    /No review data was provided and public review platforms are not scraped\. Share your Google\/Yelp rating to include reputation in the audit\./g,
    () => UNRATED_STAGE_FINDING,
  ],
];

/** Reputation wording as it reads now, for text stored by any version of the audit. */
export function presentReputationText(text: string): string {
  return STORED_WORDING.reduce((out, [pattern, replace]) => out.replace(pattern, replace as (...args: string[]) => string), text);
}
