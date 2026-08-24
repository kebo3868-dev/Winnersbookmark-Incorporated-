'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  canSubmitReviewRequest,
  describeExistingReviewRequest,
  describeReviewOutcome,
  unavailableReason,
  type ExistingReviewRequest,
  type ReviewActionPhase,
  type ReviewOutcomeView,
} from '@/lib/frontdesk/reviews/presentation';

/**
 * ASK ONE CUSTOMER FOR A REVIEW (§XIII, §XIV)
 *
 * A thin renderer over the pure module beside it. Every rule — what counts as
 * success, how each refusal reads, when the button may fire — lives there and
 * is unit-tested; this file does fetch, state and markup.
 *
 * ── WHAT THIS COMPONENT DELIBERATELY CANNOT DO ───────────────────────────────
 *
 * It cannot decide eligibility. There is no copy of `checkReviewEligibility`
 * here and no prediction of what the server will say — the button is offered,
 * the server decides, and the answer is displayed. An escalated interaction is
 * refused server-side and this component has no path to override it.
 *
 * It cannot enable reviews. `reviewsEnabled` is read to decide whether to offer
 * a button at all; nothing here writes it.
 *
 * It cannot send to more than one person. One conversation, one click, one
 * request. There is no bulk action, no timer and no automatic trigger — a
 * review request happens because a person decided to ask.
 */
export function ReviewRequestControl({
  tenantSlug,
  conversationId,
  reviewsEnabled,
  existing,
}: {
  tenantSlug: string;
  /** The conversation behind this lead, or null when it has none. */
  conversationId: string | null;
  reviewsEnabled: boolean;
  /** The recorded row, read from the database on this render. */
  existing: ExistingReviewRequest | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<ReviewActionPhase>('IDLE');
  const [result, setResult] = useState<ReviewOutcomeView | null>(null);

  /**
   * The real double-submit guard.
   *
   * `disabled` on the button is the visible half, but a state update is
   * asynchronous — a fast double-tap can dispatch the second click before
   * React has re-rendered. This ref flips synchronously inside the handler, so
   * the second call returns before it can reach fetch. Asking a customer for a
   * review twice is exactly what the backend's unique constraint exists to
   * stop, and the UI should not be leaning on that to avoid a duplicate.
   */
  const inFlight = useRef(false);

  const gate = {
    reviewsEnabled,
    hasConversation: Boolean(conversationId),
    alreadyRecorded: Boolean(existing),
  };

  // What is already true, read from the stored row. The last response is only
  // shown until the page has re-read; after that this wins.
  const recorded = describeExistingReviewRequest(existing);
  const shown = result ?? recorded;
  const blocked = unavailableReason(gate);

  async function ask() {
    if (inFlight.current) return;
    if (!canSubmitReviewRequest({ ...gate, phase })) return;
    inFlight.current = true;
    setPhase('SUBMITTING');
    setResult(null);

    try {
      const response = await fetch(`/api/frontdesk/${tenantSlug}/reviews/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      const payload = await response.json().catch(() => null);
      setResult(describeReviewOutcome(payload, response.status));
      // Reconcile against the database rather than trusting what we just read.
      router.refresh();
    } catch {
      // A network failure is genuinely unknown: the request may have been
      // recorded. Say so instead of guessing in either direction.
      setResult(
        describeReviewOutcome(
          { error: 'The request did not complete. Reload before trying again.' },
          0,
        ),
      );
    } finally {
      setPhase('DONE');
      inFlight.current = false;
    }
  }

  if (blocked) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-ivory-faint">Review</span>
        <span className="text-[11px] text-ivory-faint" title={blocked.detail}>
          {blocked.headline}
        </span>
      </div>
    );
  }

  const tone =
    shown?.tone === 'SUCCESS'
      ? 'text-emerald-400/90'
      : shown?.tone === 'ERROR'
        ? 'text-red-300'
        : shown?.tone === 'PENDING'
          ? 'text-amber-300/90'
          : 'text-ivory-dim';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!existing && (
        <button
          type="button"
          onClick={ask}
          disabled={!canSubmitReviewRequest({ ...gate, phase })}
          className="btn-outline !py-1.5 !px-2.5 text-xs disabled:opacity-50"
        >
          {phase === 'SUBMITTING' ? 'Asking…' : 'Ask for a review'}
        </button>
      )}
      {shown && (
        <span className={`text-[11px] ${tone}`} title={shown.detail}>
          {shown.headline}
          {/* The server's own code, so an operator can quote it verbatim. */}
          <span className="text-ivory-faint"> · {shown.code}</span>
        </span>
      )}
      {shown?.detail && <p className="basis-full text-ivory-faint text-[11px]">{shown.detail}</p>}
    </div>
  );
}
