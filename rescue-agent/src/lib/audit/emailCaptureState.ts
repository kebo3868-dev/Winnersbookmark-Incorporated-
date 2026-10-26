/**
 * The EMAIL_CAPTURE record for a signup form whose own wording does not settle
 * whether it adds visitors to an ongoing email list.
 *
 * It is neither capture nor evidence that none exists, and three readers would
 * each misread it from wording alone: the journey would count it as an opt-in
 * route, and the retention rule — or a future rewording — could read it as an
 * absence. They recognise it by this one predicate instead.
 */
export const UNVERIFIED_SIGNUP_FACT =
  'Whether a signup form on the analyzed pages adds visitors to an email list could not be established.';

export const isUnverifiedSignup = (fact: string): boolean =>
  /^Whether a signup form .* could not be established/i.test(fact);
