'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Erases a lead's record. Destructive and irreversible, so it confirms first.
 * This is the operator's answer to "delete my details" — see
 * src/lib/leads/retention.ts for the automatic expiry path.
 */
export function DeleteLeadButton({ leadId, contactLabel }: { leadId: string; contactLabel: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  async function erase() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setConfirming(false);
      startTransition(() => router.refresh());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Erase lead ${contactLabel}`}
        className="text-ivory-faint hover:text-red-300 text-xs underline underline-offset-2"
      >
        Erase
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <button type="button" onClick={erase} disabled={busy} className="text-red-300 hover:underline text-xs disabled:opacity-50">
        {busy ? 'Erasing…' : 'Confirm'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="text-ivory-faint hover:underline text-xs">
        Cancel
      </button>
      {error && <span className="text-[10px] uppercase tracking-wider text-red-300">failed</span>}
    </span>
  );
}
