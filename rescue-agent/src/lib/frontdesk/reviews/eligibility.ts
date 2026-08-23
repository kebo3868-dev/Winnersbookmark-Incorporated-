import type { TenantConfig } from '@/lib/frontdesk/config/schema';
import type { ConsentStatus } from '@/lib/frontdesk/messaging/consent';

/**
 * REVIEW REQUEST ELIGIBILITY (§XIII)
 *
 * Decides whether a customer may be asked for a review. It decides only that —
 * nothing here sends anything.
 *
 * ── THE RULE THAT SHAPES EVERYTHING BELOW ────────────────────────────────────
 *
 * ELIGIBILITY MUST NOT DEPEND ON HOW THE CONVERSATION WENT.
 *
 * Asking only the customers who seemed pleased is review gating. Google and
 * Yelp both prohibit it, it is the practice that makes review counts
 * meaningless, and it is trivially the most tempting feature to build here —
 * "only ask the happy ones" sounds like common sense and is the whole problem.
 *
 * So sentiment is not an input to this function. There is no sentiment
 * parameter, no rating threshold, no "was the customer satisfied" flag. The
 * only conversation-derived input is whether the interaction ESCALATED, and
 * that exclusion runs the protective direction: someone who reported a
 * food-safety problem or asked for a manager is not asked to rate us. Excluding
 * an unhappy customer from being solicited is the opposite of gating — gating
 * excludes them from being *heard*.
 *
 * If a future change adds a sentiment input here, it is a policy violation
 * before it is a code change. A test asserts its absence.
 */

export type ReviewIneligibleReason =
  | 'NO_REVIEW_LINK'
  | 'REVIEWS_DISABLED'
  | 'ESCALATED'
  | 'OPTED_OUT'
  | 'ALREADY_REQUESTED'
  | 'COOLDOWN'
  | 'DEMO_TENANT';

export type ReviewEligibility =
  | { eligible: true; reviewLink: string }
  | { eligible: false; reason: ReviewIneligibleReason; detail: string };

export interface ReviewEligibilityInput {
  config: TenantConfig;
  /**
   * Did this interaction escalate to a human — complaint, allergy concern,
   * manager request, food-safety report?
   *
   * Deliberately a single boolean, not a sentiment score. Escalation is a
   * recorded fact about routing, not a judgement about mood.
   */
  escalated: boolean;
  consentStatus: ConsentStatus;
  /** A review request already sent for THIS interaction. */
  alreadyRequestedForInteraction: boolean;
  /** When this customer was last asked, across all interactions. */
  lastRequestedAt: Date | null;
  now: Date;
  /** True for demo tenants — simulated customers are never solicited. */
  demoMode: boolean;
}

/**
 * Minimum gap between asking the same customer twice.
 *
 * §XIII says do not pressure customers. Ninety days is long enough that a
 * second request follows a genuinely separate visit rather than a nudge.
 */
export const REVIEW_COOLDOWN_DAYS = 90;

export function checkReviewEligibility(input: ReviewEligibilityInput): ReviewEligibility {
  const { config, escalated, consentStatus, alreadyRequestedForInteraction, lastRequestedAt, now, demoMode } = input;

  // Demo first: a simulated customer must never be solicited, whatever else
  // passes, and a fake phone number must never receive a real message.
  if (demoMode) return no('DEMO_TENANT', 'Demo tenants never send review requests.');

  if (!config.reviews?.enabled) {
    return no('REVIEWS_DISABLED', 'The restaurant has not enabled review requests.');
  }

  const link = config.reviewLink?.trim();
  if (!link) {
    // Never invent a review destination. No link configured means no request —
    // the same rule the ordering pathway follows.
    return no('NO_REVIEW_LINK', 'No review link is configured, and one is never guessed.');
  }

  // Protective, not selective. Someone who reported a problem is owed a
  // resolution, not a request to rate us while it is unresolved.
  if (escalated) {
    return no('ESCALATED', 'The interaction escalated to a human; the customer is owed follow-up, not a review request.');
  }

  if (consentStatus === 'OPTED_OUT') {
    return no('OPTED_OUT', 'The customer has opted out of messages.');
  }

  if (alreadyRequestedForInteraction) {
    return no('ALREADY_REQUESTED', 'A review request has already been sent for this interaction.');
  }

  if (lastRequestedAt) {
    const days = (now.getTime() - lastRequestedAt.getTime()) / 86_400_000;
    if (days < REVIEW_COOLDOWN_DAYS) {
      return no('COOLDOWN', `Last asked ${Math.floor(days)} day(s) ago; the cooldown is ${REVIEW_COOLDOWN_DAYS} days.`);
    }
  }

  return { eligible: true, reviewLink: link };
}

function no(reason: ReviewIneligibleReason, detail: string): ReviewEligibility {
  return { eligible: false, reason, detail };
}

/**
 * The message body.
 *
 * Neutral by construction. It asks for a review; it does not ask for a GOOD
 * review, does not offer anything in exchange, and does not route the customer
 * differently based on what they might say. Incentivising or steering is the
 * same policy violation as gating, wearing a friendlier face.
 */
export function reviewRequestBody(config: TenantConfig, reviewLink: string): string {
  const name = config.restaurantName;
  return (
    `Thanks for choosing ${name}. If you have a moment, we'd appreciate your honest feedback: ${reviewLink}` +
    '\n\nReply STOP to opt out.'
  );
}
