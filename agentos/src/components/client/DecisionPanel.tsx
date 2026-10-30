'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorText, postJson } from './post';

/** Which parts of the work were simulated, so the warning says exactly what is not real. */
export function DecisionPanel({ approvalId, simulatedResult, simulatedReview }: { approvalId: string; simulatedResult: boolean; simulatedReview: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<null | 'approved' | 'rejected'>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(decision);
    setError(null);
    const result = await postJson(`/api/approvals/${approvalId}`, { decision, note: note || undefined });
    setBusy(null);
    if (!result.ok) setError(errorText(result));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {(simulatedResult || simulatedReview) && (
        <p data-testid="simulation-warning" className="rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/10 p-3 text-sm text-fuchsia-100">
          {simulatedResult && simulatedReview && 'Both the result and the review are simulated. No agent produced or checked this work.'}
          {simulatedResult && !simulatedReview && 'The result is simulated. No agent produced it.'}
          {!simulatedResult && simulatedReview && 'The independent review is simulated. No agent checked this result.'}
          {' '}Approving records your decision only.
        </p>
      )}
      <div>
        <label htmlFor="note" className="label">Note (optional)</label>
        <textarea id="note" rows={2} className="field" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Why you approved or rejected" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" data-testid="reject" disabled={busy !== null} className="btn-danger" onClick={() => decide('rejected')}>
          {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
        </button>
        <button type="button" data-testid="approve" disabled={busy !== null} className="btn-primary" onClick={() => decide('approved')}>
          {busy === 'approved' ? 'Approving…' : 'Approve'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
