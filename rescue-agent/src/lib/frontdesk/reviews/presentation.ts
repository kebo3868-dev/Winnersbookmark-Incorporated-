/**
 * REVIEW REQUEST — OPERATOR PRESENTATION (§XIII, §XIV)
 *
 * Turns what the server said into what an operator reads. Pure: no React, no
 * fetch, no database. The component that uses it is a thin renderer, so the
 * rules below are unit-testable rather than only inspectable in a browser.
 *
 * ── THE RULE THIS FILE EXISTS TO ENFORCE ─────────────────────────────────────
 *
 *   SUCCESS IS SHOWN ONLY WHEN THE SERVER SAID IT SENT.
 *
 * The review endpoint answers HTTP 200 for a REFUSAL as well as a send — a
 * suppression is a successful, recorded decision, not a server error. So an
 * `response.ok` check is not a send check, and treating it as one would tell an
 * owner their customer was asked for a review when nothing left the building.
 *
 * That is the same mistake the Rescue Agent spent a cycle removing from the
 * audit: an HTTP 200 read as "this works". It is repeated here because the
 * shape of the error is identical and the cost is the same — a confident
 * report of something that did not happen.
 *
 * ── AND THE COROLLARY ────────────────────────────────────────────────────────
 *
 * An outcome or reason this file does not recognise is displayed VERBATIM as a
 * refusal, never mapped to success and never silently dropped. A future backend
 * reason nobody updated this file for must read as "the server refused, and
 * here is what it said" — an unfamiliar code on screen is a small annoyance,
 * while a swallowed one is an operator believing a message was sent.
 *
 * Nothing here re-implements eligibility. `checkReviewEligibility` runs on the
 * server and is the only thing that decides; this file cannot grant, override
 * or predict it, and a test asserts it holds no eligibility rules of its own.
 */

export type ReviewOutcomeTone = 'SUCCESS' | 'PENDING' | 'REFUSED' | 'ERROR';

export interface ReviewOutcomeView {
  tone: ReviewOutcomeTone;
  headline: string;
  detail: string;
  /**
   * True ONLY when the server confirmed a message was queued for sending.
   * The single field the UI is allowed to treat as success.
   */
  sent: boolean;
  /** The server's own code, surfaced so an operator can quote it in support. */
  code: string;
}

/** Operator-facing copy for each refusal the backend can return. */
const REFUSALS: Record<string, { headline: string; detail: string }> = {
  // --- eligibility (§XIII) --------------------------------------------------
  REVIEWS_DISABLED: {
    headline: 'Review requests are switched off',
    detail: 'This restaurant has not turned review requests on. Nothing was sent.',
  },
  NO_REVIEW_LINK: {
    headline: 'No review destination configured',
    detail:
      'This restaurant has no review link set, and one is never guessed. Add the restaurant’s own review URL to its configuration first.',
  },
  ESCALATED: {
    headline: 'This interaction escalated',
    detail:
      'The customer raised something that went to a person — a complaint, an allergy concern or a manager request. They are owed follow-up, not a request to rate the visit. This cannot be overridden here.',
  },
  OPTED_OUT: {
    headline: 'Customer opted out',
    detail: 'This number replied STOP. No message may be sent to it.',
  },
  ALREADY_REQUESTED: {
    headline: 'Already requested',
    detail: 'This customer has already been asked about this visit. They are not asked twice.',
  },
  COOLDOWN: {
    headline: 'Asked too recently',
    detail: 'This customer was asked for a review within the cooldown window, so they are not asked again yet.',
  },
  DEMO_TENANT: {
    headline: 'Demo restaurant — nothing sent',
    detail: 'Demo customers are simulated. No real message is ever sent on their behalf.',
  },

  // --- channel and destination ---------------------------------------------
  CHANNEL_UNAVAILABLE: {
    headline: 'Channel not available',
    detail: 'This restaurant’s review channel is not SMS, and SMS is the only channel implemented today.',
  },
  NO_DESTINATION: {
    headline: 'No customer phone number',
    detail: 'This conversation has no usable phone number to message.',
  },
  CONVERSATION_NOT_FOUND: {
    headline: 'Conversation not found',
    detail: 'This lead has no conversation on this restaurant, so there is nobody to ask.',
  },

  // --- gates shared with every other outbound message -----------------------
  TENANT_BUDGET_RESERVED: {
    headline: 'Held back to protect alerts',
    detail:
      'This restaurant is close to its hourly message limit. The remaining messages are reserved for staff alerts and customer replies, so the review request was not sent.',
  },
  NO_CONSENT: {
    headline: 'No basis to message this number',
    detail: 'We have no prior contact from this number, so there is no basis to message it.',
  },
  FOLLOW_UP_CAP: {
    headline: 'Follow-up limit reached',
    detail: 'This customer has already been messaged since they last replied.',
  },
  RATE_LIMIT_NUMBER: {
    headline: 'Rate limit — this number',
    detail: 'This number has received its limit of messages this hour.',
  },
  RATE_LIMIT_TENANT: {
    headline: 'Rate limit — this restaurant',
    detail: 'This restaurant has sent its limit of messages this hour.',
  },
  SMS_UNAVAILABLE: {
    headline: 'SMS is not available',
    detail: 'SMS is switched off for this restaurant, or no sending number is configured.',
  },
  INVALID_NUMBER: {
    headline: 'Unusable phone number',
    detail: 'The customer’s number on this conversation is not a number we can send to.',
  },

  // --- the server could not complete ---------------------------------------
  ERROR: {
    headline: 'Could not be processed',
    detail: 'The server could not complete the request. It has been recorded for an operator to look at.',
  },
};

/** Refusals that are the server failing rather than deciding. */
const ERROR_CODES = new Set(['ERROR', 'HTTP_ERROR', 'NETWORK_ERROR', 'MALFORMED_RESPONSE']);

function refusalView(code: string): ReviewOutcomeView {
  const known = REFUSALS[code];
  if (known) {
    return { tone: ERROR_CODES.has(code) ? 'ERROR' : 'REFUSED', ...known, sent: false, code };
  }
  // Unrecognised. Shown as-is: an operator reading an unfamiliar code is a far
  // better outcome than one reading nothing, or reading "sent".
  return {
    tone: 'REFUSED',
    headline: 'Not sent',
    detail: `The server refused this request and gave the reason "${code}".`,
    sent: false,
    code,
  };
}

/**
 * Interpret one response from POST /api/frontdesk/[slug]/reviews/request.
 *
 * `httpStatus` and `payload` are taken separately and BOTH consulted, because
 * neither alone is sufficient: a refusal arrives as 200, and an error page
 * arrives with no usable payload.
 */
export function describeReviewOutcome(payload: unknown, httpStatus: number): ReviewOutcomeView {
  const body = (payload ?? {}) as Record<string, unknown>;

  // Transport-level failures first. These never carry an outcome.
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      tone: 'ERROR',
      headline: 'Not permitted',
      detail: 'Your account is not allowed to send review requests for this restaurant.',
      sent: false,
      code: 'NOT_PERMITTED',
    };
  }
  if (httpStatus === 409 && typeof body.error === 'string') {
    // The route's own opt-in gate, refused before it reaches the review store.
    return refusalView('REVIEWS_DISABLED');
  }

  const outcome = typeof body.outcome === 'string' ? body.outcome : null;

  if (!outcome) {
    // An error payload, an HTML error page, or a shape this build does not
    // know. Never optimistic about what happened.
    const declared = typeof body.error === 'string' ? body.error : null;
    return {
      tone: 'ERROR',
      headline: 'No answer from the server',
      detail: declared
        ? `The server replied ${httpStatus}: ${declared}`
        : `The server replied ${httpStatus} without a result. The request may or may not have been recorded — reload before trying again.`,
      sent: false,
      code: declared ?? (httpStatus >= 400 ? 'HTTP_ERROR' : 'MALFORMED_RESPONSE'),
    };
  }

  switch (outcome) {
    case 'SENT':
      // The ONLY branch that may report success, and only on a 2xx.
      if (httpStatus < 200 || httpStatus >= 300) return refusalView('MALFORMED_RESPONSE');
      return {
        tone: 'SUCCESS',
        headline: 'Review request sent',
        detail:
          'The message was queued with the SMS provider. Accepted is not the same as delivered — the customer’s handset confirms that separately.',
        sent: true,
        code: 'SENT',
      };
    case 'ALREADY_REQUESTED':
      return refusalView('ALREADY_REQUESTED');
    case 'CONVERSATION_NOT_FOUND':
      return refusalView('CONVERSATION_NOT_FOUND');
    case 'SUPPRESSED':
      return refusalView(typeof body.reason === 'string' && body.reason ? body.reason : 'ERROR');
    default:
      // An outcome added to the backend later. Refused, verbatim, never success.
      return refusalView(outcome);
  }
}

/** A recorded review request already in the database, as the page reads it. */
export interface ExistingReviewRequest {
  status: string;
  suppressedReason: string | null;
  requestedAt: Date | string | null;
}

/**
 * What an already-recorded request should read as before anything is clicked.
 *
 * This is the reconciliation half: after any action the page re-reads the
 * database, and what it renders comes from the stored row rather than from
 * whatever the last response happened to say.
 */
export function describeExistingReviewRequest(row: ExistingReviewRequest | null): ReviewOutcomeView | null {
  if (!row) return null;

  switch (row.status) {
    case 'SENT':
      return {
        tone: 'SUCCESS',
        headline: 'Review request sent',
        detail: 'Queued with the SMS provider. Delivery is confirmed separately.',
        sent: true,
        code: 'SENT',
      };
    case 'DELIVERED':
      return {
        tone: 'SUCCESS',
        headline: 'Review request delivered',
        detail: 'The provider confirmed this reached the customer’s handset.',
        sent: true,
        code: 'DELIVERED',
      };
    case 'PENDING':
      return {
        tone: 'PENDING',
        headline: 'Review request in progress',
        detail: 'Recorded and being sent. Reload in a moment to see the outcome.',
        sent: false,
        code: 'PENDING',
      };
    case 'FAILED':
      return {
        tone: 'ERROR',
        headline: 'Review request failed',
        detail: row.suppressedReason ?? 'The provider could not send it.',
        sent: false,
        code: 'FAILED',
      };
    case 'SUPPRESSED': {
      // Stored as "CODE: human detail" by the review store.
      const code = (row.suppressedReason ?? '').split(':')[0].trim();
      return refusalView(code || 'ERROR');
    }
    default:
      return refusalView(row.status);
  }
}

export type ReviewActionPhase = 'IDLE' | 'SUBMITTING' | 'DONE';

export interface SubmitGate {
  reviewsEnabled: boolean;
  hasConversation: boolean;
  /** A request already recorded for this interaction. */
  alreadyRecorded: boolean;
  phase: ReviewActionPhase;
}

/**
 * Whether the button may fire.
 *
 * `phase === 'SUBMITTING'` is the double-click guard, and it is a rule here
 * rather than only a `disabled` attribute because a disabled attribute is a
 * rendering detail — a fast double-tap, an Enter keypress on a focused button,
 * or a re-render can outrun it. The component checks this before every fetch.
 *
 * `reviewsEnabled` is read, never written. This control cannot turn reviews on
 * for a restaurant; when it is off, the button is simply not offered.
 */
export function canSubmitReviewRequest(gate: SubmitGate): boolean {
  if (!gate.reviewsEnabled) return false;
  if (!gate.hasConversation) return false;
  if (gate.alreadyRecorded) return false;
  return gate.phase === 'IDLE';
}

/**
 * Why the control is unavailable, when it is. Distinguishes the reasons rather
 * than showing one greyed-out button for all of them.
 */
export function unavailableReason(gate: Omit<SubmitGate, 'phase'>): ReviewOutcomeView | null {
  if (!gate.reviewsEnabled) return refusalView('REVIEWS_DISABLED');
  if (!gate.hasConversation) return refusalView('CONVERSATION_NOT_FOUND');
  return null;
}
