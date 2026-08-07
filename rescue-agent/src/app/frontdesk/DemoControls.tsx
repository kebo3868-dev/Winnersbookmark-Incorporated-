'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Demo mode controls (§XXI). Creating demo restaurants is safe and repeatable;
 * removing them is destructive, so it asks first and says exactly what it
 * deleted afterwards rather than silently succeeding.
 */
export function DemoControls({ hasDemoTenants }: { hasDemoTenants: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'seed' | 'purge' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function seed() {
    setBusy('seed');
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/frontdesk/demo', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Request failed');
      setMessage(`Demo restaurants ready: ${data.slugs.join(', ')}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create demo restaurants');
    } finally {
      setBusy(null);
    }
  }

  async function purge() {
    const confirmed = window.confirm(
      'Remove all demo restaurants and every conversation, lead and escalation marked as demo data?\n\nThis cannot be undone. Real restaurant data is not affected.',
    );
    if (!confirmed) return;

    setBusy('purge');
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/frontdesk/demo?confirm=true', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Request failed');
      setMessage(
        `Removed ${data.tenantsDeleted} restaurant(s), ${data.conversationsDeleted} conversation(s), ${data.leadsDeleted} lead(s), ${data.escalationsDeleted} escalation(s).`,
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove demo data');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full sm:w-auto">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={seed} disabled={busy !== null} className="btn-outline disabled:opacity-50">
          {busy === 'seed' ? 'Creating…' : 'Create demo restaurants'}
        </button>
        {hasDemoTenants && (
          <button
            type="button"
            onClick={purge}
            disabled={busy !== null}
            className="btn-outline border-red-500/40 text-red-300 hover:border-red-400 hover:text-red-200 disabled:opacity-50"
          >
            {busy === 'purge' ? 'Removing…' : 'Remove demo data'}
          </button>
        )}
      </div>
      {message && <p className="text-xs text-emerald-400/90 mt-2 max-w-xs">{message}</p>}
      {error && <p className="text-xs text-red-300 mt-2 max-w-xs">{error}</p>}
    </div>
  );
}
