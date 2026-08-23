import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REVIEW_COOLDOWN_DAYS,
  checkReviewEligibility,
  reviewRequestBody,
  type ReviewEligibilityInput,
} from '@/lib/frontdesk/reviews/eligibility';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import type { TenantConfig } from '@/lib/frontdesk/config/schema';

/**
 * MILESTONE 7c — review request workflow (§XIII).
 *
 * The feature is small. The compliance property is the substance:
 *
 *   ELIGIBILITY MUST NOT DEPEND ON HOW THE CONVERSATION WENT.
 *
 * Asking only the customers who seemed pleased is review gating. Google and
 * Yelp prohibit it, it is what makes review counts meaningless, and it is the
 * single most tempting thing to build here — "only ask the happy ones" sounds
 * like common sense.
 *
 * Two tests below assert the ABSENCE of a sentiment input, one of them by
 * reading the source. That is unusual, and deliberate: a normal test cannot
 * catch a parameter that was added later and quietly consulted, and this is a
 * property where the violation ships silently and the damage is to a client's
 * standing on a platform they do not control.
 */

const config = (overrides: Partial<TenantConfig> = {}): TenantConfig =>
  ({
    ...demoTenantConfig,
    restaurantName: "Leverock's",
    reviewLink: 'https://g.page/r/leverocks/review',
    reviews: { enabled: true, channel: 'SMS' },
    ...overrides,
  }) as TenantConfig;

const input = (overrides: Partial<ReviewEligibilityInput> = {}): ReviewEligibilityInput => ({
  config: config(),
  escalated: false,
  consentStatus: 'IMPLIED',
  alreadyRequestedForInteraction: false,
  lastRequestedAt: null,
  now: new Date('2026-09-01T12:00:00Z'),
  demoMode: false,
  ...overrides,
});

describe('review gating is impossible by construction', () => {
  it('takes no sentiment, rating or satisfaction input', () => {
    // Asserted against the source because a parameter added later and consulted
    // quietly would pass every behavioural test while violating platform policy.
    const source = readFileSync(
      join(process.cwd(), 'src/lib/frontdesk/reviews/eligibility.ts'),
      'utf8',
    );
    const sentimentInput = /(sentiment|satisfaction|rating|happiness|mood|positive|negative)\s*[?:]/i;
    expect(sentimentInput.test(source), 'eligibility must take no sentiment-like input').toBe(false);
  });

  it('gives the identical verdict regardless of how the conversation went', () => {
    // The only conversation-derived input is `escalated`. Two customers with
    // the same escalation state must be treated the same, whatever was said.
    const a = checkReviewEligibility(input());
    const b = checkReviewEligibility(input());
    expect(a).toEqual(b);
    expect(a.eligible).toBe(true);
  });

  it('excludes escalated interactions protectively, not selectively', () => {
    const result = checkReviewEligibility(input({ escalated: true }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toBe('ESCALATED');
      // The wording matters: this is about owing someone follow-up, not about
      // hiding an unhappy customer from the review page.
      expect(result.detail).toMatch(/owed follow-up/i);
    }
  });

  it('asks for honest feedback and offers nothing in exchange', () => {
    const body = reviewRequestBody(config(), 'https://g.page/r/leverocks/review');
    expect(body).toMatch(/honest feedback/i);
    expect(body).not.toMatch(/5[- ]star|five[- ]star|positive review|good review/i);
    // Incentivising is the same violation as gating, wearing a friendlier face.
    expect(body).not.toMatch(/discount|free|voucher|reward|coupon|in exchange/i);
    expect(body).toMatch(/STOP/);
  });
});

describe('a request is never sent without a configured destination', () => {
  it('refuses when no review link is configured, and never guesses one', () => {
    const result = checkReviewEligibility(input({ config: config({ reviewLink: undefined }) }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe('NO_REVIEW_LINK');
  });

  it('refuses when the restaurant has not enabled review requests', () => {
    const result = checkReviewEligibility(
      input({ config: config({ reviews: { enabled: false, channel: 'SMS' } }) }),
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe('REVIEWS_DISABLED');
  });

  it('defaults to disabled, so receiving this code starts no messaging', () => {
    const parsed = config({ reviews: undefined as never });
    // A deployment that merely gains this feature must not begin soliciting.
    const result = checkReviewEligibility(input({ config: parsed }));
    expect(result.eligible).toBe(false);
  });
});

describe('customers are not pressured', () => {
  it('respects an opt-out', () => {
    const result = checkReviewEligibility(input({ consentStatus: 'OPTED_OUT' }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe('OPTED_OUT');
  });

  it('asks once per interaction', () => {
    const result = checkReviewEligibility(input({ alreadyRequestedForInteraction: true }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe('ALREADY_REQUESTED');
  });

  it('enforces a cooldown between visits', () => {
    const recent = new Date('2026-08-20T12:00:00Z'); // 12 days earlier
    const result = checkReviewEligibility(input({ lastRequestedAt: recent }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe('COOLDOWN');
  });

  it('allows a request again after the cooldown has passed', () => {
    const old = new Date('2026-09-01T12:00:00Z');
    old.setDate(old.getDate() - (REVIEW_COOLDOWN_DAYS + 1));
    expect(checkReviewEligibility(input({ lastRequestedAt: old })).eligible).toBe(true);
  });
});

describe('demo tenants never solicit', () => {
  it('refuses a demo tenant before any other check', () => {
    // Simulated customers carry fictional numbers; a real message to one would
    // be both useless and, at a carrier, a genuine error.
    const result = checkReviewEligibility(input({ demoMode: true }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe('DEMO_TENANT');
  });

  it('ships demo fixtures with reviews disabled', () => {
    expect(demoTenantConfig.reviews.enabled).toBe(false);
  });
});

describe('M7a and M7b behaviour is untouched', () => {
  it('preserves the reservation confirmation rule', async () => {
    const { leadStatusForBooking } = await import('@/lib/frontdesk/reservations/provider');
    expect(leadStatusForBooking({ status: 'ACCEPTED_PENDING', providerName: 'mock' })).toBe('NEW');
  });

  it('preserves provider-aware ordering routing', async () => {
    const { routeOrdering } = await import('@/lib/frontdesk/ordering/routing');
    const route = routeOrdering(
      { enabled: true, url: 'https://www.toasttab.com/leverocks' } as never,
      'takeout',
    );
    expect(route?.operator).toBe('Toast');
    expect(route?.url).toBe('https://www.toasttab.com/leverocks');
  });
});
