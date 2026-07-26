'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LEAD_STATUSES } from '@/lib/leads/status';

const STATUS_STYLES: Record<string, string> = {
  NEW: 'text-gold border-gold/40',
  CONTACTED: 'text-amber-300 border-amber-300/40',
  QUALIFIED: 'text-emerald-400 border-emerald-400/40',
  WON: 'text-emerald-400 border-emerald-400/40',
  LOST: 'text-ivory-faint border-obsidian-line',
};

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onChange(next: string) {
    const previous = value;
    setValue(next); // optimistic
    setError(false);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('update failed');
      startTransition(() => router.refresh());
    } catch {
      setValue(previous); // roll back so the UI never claims a save that did not happen
      setError(true);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Lead status"
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-transparent text-[10px] uppercase tracking-wider border rounded px-2 py-1 cursor-pointer disabled:opacity-50 ${STATUS_STYLES[value] ?? ''}`}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-obsidian text-ivory normal-case">
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] uppercase tracking-wider text-red-300">not saved</span>}
    </div>
  );
}
