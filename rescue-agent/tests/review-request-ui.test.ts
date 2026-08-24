import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canSubmitReviewRequest,
  describeExistingReviewRequest,
  describeReviewOutcome,
  unavailableReason,
  type ReviewActionPhase,
} from '@/lib/frontdesk/reviews/presentation';

/**
 * REVIEW REQUEST UI — Command Center.
 *
 * The UI decides nothing. The server runs eligibility; this surface offers a
 * button and renders the answer. So the tests that matter are not about pixels:
 *
 *   1. SUCCESS IS SHOWN ONLY WHEN THE SERVER SAID IT SENT. The endpoint answers
 *      HTTP 200 for a refusal as well as a send, so `response.ok` is not a send
 *      check. Treating it as one would tell an owner a customer was asked when
 *      nothing left the building — the same "HTTP 200 means it works" mistake
 *      the Rescue Agent spent a cycle removing from the audit.
 *
 *   2. AN UNRECOGNISED REFUSAL RENDERS VERBATIM. A backend reason nobody
 *      updated the copy for must read as a refusal with its code on screen,
 *      never as silence and never as success.
 *
 *   3. NOTHING HERE CAN OVERRIDE A SERVER DECISION, enable reviews, or send in
 *      bulk. Asserted against the source, because these are absences and a
 *      behavioural test cannot see an absent code path.
 *
 * There is no React renderer in this project (no jsdom, no testing-library, and
 * the suite is `tests/**\/*.test.ts` under the node environment). Rather than
 * add that dependency for one control, every decision lives in the pure module
 * and is tested directly here; the component is a thin renderer over it, and
 * source assertions pin the parts that are structural.
 */

const SOURCE = 'src/lib/frontdesk/reviews/presentation.ts';
const COMPONENT = 'src/app/frontdesk/[tenantSlug]/ReviewRequestControl.tsx';
const PAGE = 'src/app/frontdesk/[tenantSlug]/page.tsx';

const sourceOf = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
/** Source with comments stripped — absence assertions are about code. */
const codeOf = (p: string) =>
  sourceOf(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Every refusal the backend can put on the wire today. */
const BACKEND_REFUSALS = [
  // eligibility (§XIII)
  'REVIEWS_DISABLED',
  'NO_REVIEW_LINK',
  'ESCALATED',
  'OPTED_OUT',
  'ALREADY_REQUESTED',
  'COOLDOWN',
  'DEMO_TENANT',
  // channel and destination
  'CHANNEL_UNAVAILABLE',
  'NO_DESTINATION',
  // gates shared with every other outbound message
  'TENANT_BUDGET_RESERVED',
  'NO_CONSENT',
  'FOLLOW_UP_CAP',
  'RATE_LIMIT_NUMBER',
  'RATE_LIMIT_TENANT',
  'SMS_UNAVAILABLE',
  'INVALID_NUMBER',
  // the server could not complete
  'ERROR',
] as const;

describe('success is shown only when the server said it sent', () => {
  it('renders success for a confirmed send', () => {
    const view = describeReviewOutcome({ outcome: 'SENT', reviewRequestId: 'rr-1', notificationId: 'n-1' }, 200);
    expect(view.sent).toBe(true);
    expect(view.tone).toBe('SUCCESS');
    expect(view.headline).toMatch(/sent/i);
    // Accepted is not delivered — the distinction the SMS path is built on.
    expect(view.detail).toMatch(/not the same as delivered/i);
  });

  it('does NOT render success for a suppression that arrived as HTTP 200', () => {
    // The endpoint answers 200 for a refusal. This is the whole trap.
    for (const reason of BACKEND_REFUSALS) {
      const view = describeReviewOutcome({ outcome: 'SUPPRESSED', reason, detail: 'x' }, 200);
      expect(view.sent, `${reason} must not read as sent`).toBe(false);
      expect(view.tone, reason).not.toBe('SUCCESS');
    }
  });

  it('never reports sent for any non-SENT outcome, at any status code', () => {
    const outcomes = ['SUPPRESSED', 'ALREADY_REQUESTED', 'CONVERSATION_NOT_FOUND', 'SOMETHING_NEW', ''];
    for (const outcome of outcomes) {
      for (const status of [200, 201, 400, 401, 403, 404, 409, 500, 0]) {
        expect(describeReviewOutcome({ outcome }, status).sent, `${outcome}/${status}`).toBe(false);
      }
    }
  });

  it('refuses to call a SENT payload success on a non-2xx status', () => {
    // A body saying SENT under a 500 is a contradiction; believe the status.
    expect(describeReviewOutcome({ outcome: 'SENT' }, 500).sent).toBe(false);
  });

  it('never reports sent for a malformed or empty response', () => {
    for (const payload of [null, undefined, {}, [], 'nope', { error: 'boom' }, { outcome: 42 }]) {
      const view = describeReviewOutcome(payload, 200);
      expect(view.sent, JSON.stringify(payload)).toBe(false);
      expect(view.tone).toBe('ERROR');
    }
  });

  it('says plainly that a lost connection has an unknown result', () => {
    // The request may have been recorded. Guessing either way is worse.
    const view = describeReviewOutcome({ error: 'The request did not complete. Reload before trying again.' }, 0);
    expect(view.sent).toBe(false);
    expect(view.detail).toMatch(/did not complete|reload/i);
  });
});

describe('every backend refusal renders truthfully', () => {
  it('gives each known refusal its own operator-facing wording', () => {
    const headlines = new Set<string>();
    for (const reason of BACKEND_REFUSALS) {
      const view = describeReviewOutcome({ outcome: 'SUPPRESSED', reason }, 200);
      expect(view.code, reason).toBe(reason);
      expect(view.headline.length, reason).toBeGreaterThan(0);
      expect(view.detail.length, reason).toBeGreaterThan(0);
      headlines.add(view.headline);
    }
    // Distinct wording per reason — one generic "could not send" for all of
    // them would hide the difference between "opted out" and "over budget".
    expect(headlines.size).toBeGreaterThanOrEqual(BACKEND_REFUSALS.length - 1);
  });

  it('shows an unrecognised reason verbatim rather than swallowing it', () => {
    const view = describeReviewOutcome({ outcome: 'SUPPRESSED', reason: 'SOME_FUTURE_REASON' }, 200);
    expect(view.sent).toBe(false);
    expect(view.code).toBe('SOME_FUTURE_REASON');
    expect(view.detail).toContain('SOME_FUTURE_REASON');
  });

  it('shows an unrecognised OUTCOME verbatim too', () => {
    const view = describeReviewOutcome({ outcome: 'QUEUED_FOR_LATER' }, 200);
    expect(view.sent).toBe(false);
    expect(view.code).toBe('QUEUED_FOR_LATER');
  });

  it('treats a suppression with no reason as an error, not a send', () => {
    const view = describeReviewOutcome({ outcome: 'SUPPRESSED' }, 200);
    expect(view.sent).toBe(false);
    expect(view.code).toBe('ERROR');
  });

  it('reports a permission refusal as such', () => {
    for (const status of [401, 403]) {
      const view = describeReviewOutcome({ error: 'NOT PERMITTED' }, status);
      expect(view.sent).toBe(false);
      expect(view.code).toBe('NOT_PERMITTED');
      expect(view.headline).toMatch(/not permitted/i);
    }
  });

  it('maps the route’s 409 opt-in refusal to the reviews-disabled wording', () => {
    const view = describeReviewOutcome({ error: 'REVIEWS NOT ENABLED' }, 409);
    expect(view.sent).toBe(false);
    expect(view.code).toBe('REVIEWS_DISABLED');
  });

  it('explains an escalated refusal as protective, and as final', () => {
    const view = describeReviewOutcome({ outcome: 'SUPPRESSED', reason: 'ESCALATED' }, 200);
    expect(view.detail).toMatch(/owed follow-up/i);
    expect(view.detail).toMatch(/cannot be overridden/i);
  });

  it('explains a budget refusal in terms of protecting alerts', () => {
    const view = describeReviewOutcome({ outcome: 'SUPPRESSED', reason: 'TENANT_BUDGET_RESERVED' }, 200);
    expect(view.detail).toMatch(/reserved for staff alerts/i);
  });

  it('never invents a review destination when none is configured', () => {
    const view = describeReviewOutcome({ outcome: 'SUPPRESSED', reason: 'NO_REVIEW_LINK' }, 200);
    expect(view.detail).toMatch(/never guessed/i);
    expect(/google|yelp/i.test(codeOf(SOURCE)), 'no destination is hardcoded').toBe(false);
    expect(/google|yelp/i.test(codeOf(COMPONENT))).toBe(false);
  });
});

describe('displayed state is reconciled from the stored row', () => {
  it('reads a recorded send as sent', () => {
    const view = describeExistingReviewRequest({ status: 'SENT', suppressedReason: null, requestedAt: new Date() });
    expect(view?.sent).toBe(true);
  });

  it('distinguishes delivered from sent', () => {
    expect(
      describeExistingReviewRequest({ status: 'DELIVERED', suppressedReason: null, requestedAt: new Date() })?.code,
    ).toBe('DELIVERED');
  });

  it('does not call a PENDING row sent', () => {
    const view = describeExistingReviewRequest({ status: 'PENDING', suppressedReason: null, requestedAt: null });
    expect(view?.sent).toBe(false);
    expect(view?.tone).toBe('PENDING');
  });

  it('does not call a FAILED row sent', () => {
    const view = describeExistingReviewRequest({ status: 'FAILED', suppressedReason: 'carrier rejected', requestedAt: null });
    expect(view?.sent).toBe(false);
    expect(view?.tone).toBe('ERROR');
  });

  it('recovers the reason from a stored suppression', () => {
    const view = describeExistingReviewRequest({
      status: 'SUPPRESSED',
      suppressedReason: 'ESCALATED: The interaction escalated to a human; the customer is owed follow-up',
      requestedAt: null,
    });
    expect(view?.sent).toBe(false);
    expect(view?.code).toBe('ESCALATED');
  });

  it('returns nothing when there is no recorded row', () => {
    expect(describeExistingReviewRequest(null)).toBeNull();
  });

  it('reads the stored row on every render rather than caching a response', () => {
    // The page queries review requests server-side and passes them in, so a
    // reload shows the database rather than the last click's answer.
    const page = codeOf(PAGE);
    expect(page).toContain('listReviewRequestsForConversations');
    expect(codeOf(COMPONENT)).toContain('router.refresh()');
  });
});

describe('repeated clicks cannot produce a second request', () => {
  const gate = (phase: ReviewActionPhase) => ({
    reviewsEnabled: true,
    hasConversation: true,
    alreadyRecorded: false,
    phase,
  });

  it('allows exactly one submission from idle', () => {
    expect(canSubmitReviewRequest(gate('IDLE'))).toBe(true);
  });

  it('refuses while a request is in flight', () => {
    expect(canSubmitReviewRequest(gate('SUBMITTING'))).toBe(false);
  });

  it('refuses after the request has completed', () => {
    expect(canSubmitReviewRequest(gate('DONE'))).toBe(false);
  });

  it('refuses when a request is already recorded for this interaction', () => {
    expect(canSubmitReviewRequest({ ...gate('IDLE'), alreadyRecorded: true })).toBe(false);
  });

  it('guards synchronously as well as through the disabled attribute', () => {
    // A state update is asynchronous: a fast double-tap can dispatch the second
    // click before React re-renders. The ref flips inside the handler, so the
    // second call returns before it reaches fetch.
    const component = codeOf(COMPONENT);
    expect(component).toMatch(/inFlight\s*=\s*useRef\(false\)/);
    expect(component).toMatch(/if \(inFlight\.current\) return;/);
    // And the check precedes the fetch, not merely exists.
    expect(component.indexOf('inFlight.current) return')).toBeLessThan(component.indexOf('await fetch('));
    expect(component).toMatch(/disabled=\{!canSubmitReviewRequest/);
  });
});

describe('the UI cannot override a server decision', () => {
  it('holds no eligibility rules of its own', () => {
    // Duplicating eligibility in the frontend is how the two drift apart, and
    // the drift always favours sending.
    const code = codeOf(SOURCE) + codeOf(COMPONENT);
    expect(code).not.toContain('checkReviewEligibility');
    expect(/REVIEW_COOLDOWN_DAYS|cooldownDays|escalated\s*\?|\.escalated/.test(code)).toBe(false);
  });

  it('offers no force, override or retry-anyway path', () => {
    const code = codeOf(COMPONENT);
    expect(/force|override|bypass|ignoreEligibility|sendAnyway/i.test(code)).toBe(false);
  });

  it('sends only the conversation id — nothing that could steer the decision', () => {
    const body = codeOf(COMPONENT).match(/JSON\.stringify\(\{([^}]*)\}\)/);
    expect(body?.[1].trim()).toBe('conversationId');
  });

  it('carries no sentiment, rating or satisfaction input', () => {
    const code = codeOf(SOURCE) + codeOf(COMPONENT);
    expect(/sentiment|satisfaction|\brating\b|\bstars?\b|happiness|thumbs/i.test(code)).toBe(false);
  });
});

describe('reviews stay off unless the restaurant turned them on', () => {
  it('offers no button when reviews are disabled', () => {
    expect(
      canSubmitReviewRequest({ reviewsEnabled: false, hasConversation: true, alreadyRecorded: false, phase: 'IDLE' }),
    ).toBe(false);
  });

  it('explains why, rather than showing one greyed-out button for everything', () => {
    const off = unavailableReason({ reviewsEnabled: false, hasConversation: true, alreadyRecorded: false });
    expect(off?.code).toBe('REVIEWS_DISABLED');
    const noConvo = unavailableReason({ reviewsEnabled: true, hasConversation: false, alreadyRecorded: false });
    expect(noConvo?.code).toBe('CONVERSATION_NOT_FOUND');
    expect(unavailableReason({ reviewsEnabled: true, hasConversation: true, alreadyRecorded: false })).toBeNull();
  });

  it('never writes the opt-in flag', () => {
    // The control reads `reviews.enabled` to decide whether to offer a button.
    // Enabling reviews is a configuration act, not a side effect of this UI.
    const code = codeOf(COMPONENT) + codeOf(SOURCE);
    expect(/reviews\.enabled\s*=|enabled:\s*true|setReviewsEnabled/.test(code)).toBe(false);
  });

  it('reads the flag from tenant config on the server, not the client', () => {
    expect(codeOf(PAGE)).toMatch(/reviewsEnabled=\{Boolean\(tenant\.config\.reviews\?\.enabled\)\}/);
  });
});

describe('reviews stay manual', () => {
  it('adds no timer, poll, or automatic trigger', () => {
    const code = codeOf(COMPONENT) + codeOf(SOURCE);
    expect(/setInterval|setTimeout|useEffect|requestIdleCallback|cron/i.test(code)).toBe(false);
  });

  it('adds no bulk or select-all path', () => {
    const code = codeOf(COMPONENT) + codeOf(PAGE);
    expect(/askAll|sendAll|bulk|selectAll|forEach\([^)]*ask/i.test(code)).toBe(false);
  });

  it('posts to the endpoint from PR #46 rather than a new one', () => {
    expect(codeOf(COMPONENT)).toContain('/reviews/request');
    expect(codeOf(COMPONENT)).toMatch(/method: 'POST'/);
  });
});

describe('demo leads cannot produce a real send', () => {
  it('renders the server’s demo refusal without claiming a send', () => {
    const view = describeReviewOutcome({ outcome: 'SUPPRESSED', reason: 'DEMO_TENANT' }, 200);
    expect(view.sent).toBe(false);
    expect(view.detail).toMatch(/simulated|no real message/i);
  });

  it('leaves the demo decision to the server rather than hiding the button', () => {
    // The store refuses a demo tenant before every other check. The UI showing
    // the control and the server refusing it is the honest arrangement — a
    // hidden button would teach an operator a rule that is not the real one.
    const code = codeOf(COMPONENT);
    expect(code).not.toContain('demoMode');
  });
});

// --- The route contract this UI depends on ----------------------------------

const actor = { ok: true as boolean, status: 403 };
const tenantRow = {
  value: {
    id: 'tenant-a',
    slug: 'harbor-house',
    name: 'Harbor House',
    status: 'ACTIVE',
    demoMode: false,
    config: { reviews: { enabled: true, channel: 'SMS' } },
  } as unknown,
};
const storeCalls: unknown[] = [];
const storeResult = { value: { outcome: 'SENT', reviewRequestId: 'rr-1', notificationId: 'n-1' } as unknown };

vi.mock('@/lib/frontdesk/auth/actor', () => ({
  resolveActor: async () => ({ role: 'RESTAURANT_MANAGER', tenantId: 'tenant-a' }),
  authorize: () => (actor.ok ? { ok: true } : { ok: false, status: actor.status, reason: 'FORBIDDEN' }),
}));

vi.mock('@/lib/frontdesk/store', () => ({
  getTenantBySlug: async () => tenantRow.value,
}));

vi.mock('@/lib/frontdesk/reviews/store', () => ({
  requestReviewForConversation: async (...args: unknown[]) => {
    storeCalls.push(args);
    return storeResult.value;
  },
}));

const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/frontdesk/[tenantSlug]/reviews/request/route');
  const request = new Request('http://localhost/api/frontdesk/harbor-house/reviews/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(request as never, { params: Promise.resolve({ tenantSlug: 'harbor-house' }) });
};

describe('the endpoint behind the button', () => {
  beforeEach(() => {
    actor.ok = true;
    storeCalls.length = 0;
    storeResult.value = { outcome: 'SENT', reviewRequestId: 'rr-1', notificationId: 'n-1' };
    tenantRow.value = {
      id: 'tenant-a',
      slug: 'harbor-house',
      name: 'Harbor House',
      status: 'ACTIVE',
      demoMode: false,
      config: { reviews: { enabled: true, channel: 'SMS' } },
    };
  });

  it('lets an authorized operator initiate a valid request', async () => {
    const response = await post({ conversationId: 'convo-1' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(describeReviewOutcome(body, response.status).sent).toBe(true);
    expect(storeCalls).toHaveLength(1);
  });

  it('refuses an unauthorized user, and does no review work', async () => {
    actor.ok = false;
    const response = await post({ conversationId: 'convo-1' });
    expect(response.status).toBe(403);
    // The decisive assertion: refused BEFORE the review store is touched.
    expect(storeCalls).toHaveLength(0);
    expect(describeReviewOutcome(await response.json(), response.status).sent).toBe(false);
  });

  it('refuses a signed-out user the same way', async () => {
    actor.ok = false;
    actor.status = 401;
    const response = await post({ conversationId: 'convo-1' });
    expect(response.status).toBe(401);
    expect(storeCalls).toHaveLength(0);
    actor.status = 403;
  });

  it('refuses when the restaurant has not opted in, before touching the store', async () => {
    tenantRow.value = { ...(tenantRow.value as object), config: { reviews: { enabled: false, channel: 'SMS' } } };
    const response = await post({ conversationId: 'convo-1' });
    expect(response.status).toBe(409);
    expect(storeCalls).toHaveLength(0);
    expect(describeReviewOutcome(await response.json(), response.status).code).toBe('REVIEWS_DISABLED');
  });

  it('rejects a request with no conversation id', async () => {
    const response = await post({});
    expect(response.status).toBe(400);
    expect(storeCalls).toHaveLength(0);
  });

  it('returns a suppression as a recorded decision, not an error status', async () => {
    storeResult.value = { outcome: 'SUPPRESSED', reason: 'ESCALATED', detail: 'owed follow-up' };
    const response = await post({ conversationId: 'convo-1' });
    expect(response.status).toBe(200);
    const view = describeReviewOutcome(await response.json(), response.status);
    expect(view.sent).toBe(false);
    expect(view.code).toBe('ESCALATED');
  });

  it('surfaces a missing conversation as 404', async () => {
    storeResult.value = { outcome: 'CONVERSATION_NOT_FOUND' };
    const response = await post({ conversationId: 'nope' });
    expect(response.status).toBe(404);
    expect(describeReviewOutcome(await response.json(), response.status).sent).toBe(false);
  });

  it('takes exactly one conversation — there is no bulk form', async () => {
    const response = await post({ conversationId: ['a', 'b'] });
    expect(response.status).toBe(400);
    expect(storeCalls).toHaveLength(0);
  });
});

describe('the rest of the Command Center is untouched', () => {
  it('leaves the lead status control unchanged', () => {
    const control = sourceOf('src/app/frontdesk/[tenantSlug]/LeadStatusControl.tsx');
    expect(control).toContain("method: 'PATCH'");
    expect(control).toContain('/leads/');
    expect(control).not.toContain('review');
  });

  it('adds nothing to the SMS or escalation path', () => {
    const page = codeOf(PAGE);
    // The alert sections still render from the same sources.
    for (const marker of ['listUndeliveredEscalations', 'listStalledEscalations', 'listOpenFailures', 'listNotifications']) {
      expect(page, marker).toContain(marker);
    }
    expect(page).toContain('SENT means the provider accepted the message');
  });

  it('keeps the review read tenant-scoped', () => {
    const store = codeOf('src/lib/frontdesk/reviews/store.ts');
    const listing = store.slice(store.indexOf('listReviewRequestsForConversations'));
    expect(listing).toContain('where: { tenantId, conversationId: { in: ids } }');
  });

  it('issues no query when a restaurant has no conversations', () => {
    const store = codeOf('src/lib/frontdesk/reviews/store.ts');
    expect(store).toContain('if (ids.length === 0) return new Map();');
  });
});
