'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface QueueItem {
  menuItemName: string;
  quantity: number;
  preparation: string | null;
  sides: string[];
  modifiers: string[];
  specialRequests: string[];
  allergyNote: string | null;
  flags: string[];
}

export interface QueueDraft {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  time: string;
  status: string;
  customerConfirmed: boolean;
  allergyFlag: boolean;
  aiConfidence: number | null;
  reviewFlags: string[];
  estimatedValue: number | null;
  items: QueueItem[];
}

export default function DraftQueue({ drafts }: { drafts: QueueDraft[] }) {
  if (drafts.length === 0) {
    return (
      <div className="card p-10 text-center text-ivory-faint text-sm">
        No draft orders awaiting review. Captured to-go orders will appear here for staff to accept or call back.
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {drafts.map((d) => (
        <DraftCard key={d.id} draft={d} />
      ))}
    </div>
  );
}

function DraftCard({ draft }: { draft: QueueDraft }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function act(status: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/draft-orders/${draft.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setDone(status);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card p-5 ${draft.allergyFlag ? 'border-red-400/50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-ivory font-medium">{draft.customerName ?? 'Unknown caller'}</p>
          <p className="text-ivory-faint text-xs">{draft.customerPhone ?? 'No callback number'} · {draft.time}</p>
        </div>
        <div className="text-right">
          {draft.estimatedValue != null && (
            <p className="font-display text-gold text-lg">${draft.estimatedValue.toFixed(2)}</p>
          )}
          <p className="label">Est. value</p>
        </div>
      </div>

      {draft.allergyFlag && (
        <p className="mt-3 text-[11px] uppercase tracking-wider text-red-300 border border-red-400/40 rounded px-2 py-1 inline-block">
          Allergy flag — do not fulfill without staff review
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {draft.items.map((it, i) => (
          <li key={i} className="text-sm border-t border-obsidian-line pt-2 first:border-0 first:pt-0">
            <div className="flex justify-between gap-3">
              <span className="text-ivory">
                {it.quantity}× {it.menuItemName}
              </span>
              {it.flags.length > 0 && (
                <span className="text-[10px] uppercase tracking-wider text-amber-300 shrink-0">{it.flags.join(', ')}</span>
              )}
            </div>
            <div className="text-ivory-faint text-xs mt-0.5 space-x-2">
              {it.preparation && <span>Prep: {it.preparation}</span>}
              {it.sides.length > 0 && <span>Sides: {it.sides.join(', ')}</span>}
              {it.modifiers.length > 0 && <span>Mods: {it.modifiers.join(', ')}</span>}
            </div>
            {it.specialRequests.length > 0 && (
              <p className="text-ivory-dim text-xs mt-0.5">Special: {it.specialRequests.join('; ')}</p>
            )}
            {it.allergyNote && <p className="text-red-300 text-xs mt-0.5">Allergy note: {it.allergyNote}</p>}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between text-xs text-ivory-faint">
        <span>{draft.customerConfirmed ? 'Customer confirmed' : 'Awaiting customer confirmation'}</span>
        <span>AI confidence: {draft.aiConfidence != null ? `${draft.aiConfidence}%` : '—'}</span>
      </div>

      {done ? (
        <p className="mt-4 text-center text-sm text-emerald-400 uppercase tracking-wider">{done.replace(/_/g, ' ')}</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button disabled={busy} onClick={() => act('ACCEPTED')} className="btn-gold text-xs py-2 px-2 disabled:opacity-50">
            Accept
          </button>
          <button disabled={busy} onClick={() => act('REQUIRES_CALLBACK')} className="btn-outline text-xs py-2 px-2 disabled:opacity-50">
            Call back
          </button>
          <button disabled={busy} onClick={() => act('REJECTED')} className="btn-outline text-xs py-2 px-2 disabled:opacity-50">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
