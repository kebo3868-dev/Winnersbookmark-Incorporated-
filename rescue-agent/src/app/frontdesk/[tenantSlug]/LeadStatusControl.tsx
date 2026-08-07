'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LEAD_STATUSES } from '@/lib/frontdesk/types';

/**
 * Pipeline status control (§XV). The status is written through the tenant's own
 * API route, which re-checks ownership server-side — this component being
 * scoped to one restaurant is a convenience, not the security boundary.
 */
export function LeadStatusControl({
  tenantSlug,
  leadId,
  status,
}: {
  tenantSlug: string;
  leadId: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/frontdesk/${tenantSlug}/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not update');
      }
      router.refresh();
    } catch (cause) {
      // Roll back so the UI never shows a status the database does not have.
      setValue(previous);
      setError(cause instanceof Error ? cause.message : 'Could not update');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`status-${leadId}`}>
        Lead status
      </label>
      <select
        id={`status-${leadId}`}
        value={value}
        disabled={saving}
        onChange={(event) => update(event.target.value)}
        className="!w-auto !py-1.5 !px-2 text-xs disabled:opacity-50"
      >
        {LEAD_STATUSES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
    </div>
  );
}
