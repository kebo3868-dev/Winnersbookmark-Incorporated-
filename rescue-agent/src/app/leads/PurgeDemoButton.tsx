'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Removes demonstration data. Destructive, so it asks first — and it is only
 * rendered when demo data is actually present.
 */
export function PurgeDemoButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function purge() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/demo/purge', { method: 'POST' });
      if (!res.ok) throw new Error('purge failed');
      setConfirming(false);
      startTransition(() => router.refresh());
    } catch {
      setError('Demo data could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-outline text-xs">
        Remove demo data
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-ivory-dim text-xs">Delete all demonstration audits and their leads?</span>
      <button type="button" onClick={purge} disabled={busy} className="btn-gold text-xs disabled:opacity-50">
        {busy ? 'Removing…' : 'Yes, remove'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="btn-outline text-xs">
        Cancel
      </button>
      {error && <span className="text-xs text-red-300 uppercase tracking-wide">{error}</span>}
    </div>
  );
}
