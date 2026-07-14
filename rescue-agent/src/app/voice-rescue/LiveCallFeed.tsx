'use client';

import { useState } from 'react';

export interface FeedCall {
  id: string;
  time: string;
  caller: string;
  intent: string;
  resolution: string;
  group: 'AI_RESOLVED' | 'ORDERS' | 'TRANSFERS' | 'LEADS' | 'CALLBACKS' | 'FAILED';
}

const FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'AI_RESOLVED', label: 'AI Resolved' },
  { key: 'ORDERS', label: 'Orders' },
  { key: 'TRANSFERS', label: 'Transfers' },
  { key: 'LEADS', label: 'Leads' },
  { key: 'CALLBACKS', label: 'Callbacks' },
  { key: 'FAILED', label: 'Failed' },
];

const RESOLUTION_STYLE: Record<string, string> = {
  AI_RESOLVED: 'text-emerald-400 border-emerald-400/30',
  DRAFT_ORDER_CREATED: 'text-gold border-gold/30',
  TRANSFERRED: 'text-amber-300 border-amber-300/40',
  LEAD_CAPTURED: 'text-sky-300 border-sky-300/40',
  CALLBACK_REQUIRED: 'text-amber-300 border-amber-300/40',
  CUSTOMER_ABANDONED: 'text-red-300 border-red-300/40',
  AI_FAILED: 'text-red-400 border-red-400/30',
  TECHNICAL_FAILURE: 'text-red-400 border-red-400/30',
  UNKNOWN: 'text-ivory-faint border-obsidian-line',
};

export default function LiveCallFeed({ calls }: { calls: FeedCall[] }) {
  const [filter, setFilter] = useState('ALL');
  const shown = filter === 'ALL' ? calls : calls.filter((c) => c.group === filter);

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-obsidian-line flex flex-wrap items-center justify-between gap-3">
        <h2 className="label">Live Call Feed</h2>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[10px] uppercase tracking-wider rounded px-2.5 py-1 border transition-colors ${
                filter === f.key ? 'border-gold text-gold' : 'border-obsidian-line text-ivory-faint hover:text-ivory-dim'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="p-10 text-center text-ivory-faint text-sm">No calls in this view yet.</div>
      ) : (
        <ul className="divide-y divide-obsidian-line">
          {shown.map((c) => (
            <li key={c.id} className="px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-ivory-faint text-xs tabular-nums w-16 shrink-0">{c.time}</span>
                <span className="text-ivory truncate w-32 shrink-0">{c.caller}</span>
                <span className="text-ivory-dim text-sm truncate">{c.intent}</span>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wider border rounded px-2 py-1 shrink-0 ${
                  RESOLUTION_STYLE[c.resolution] ?? RESOLUTION_STYLE.UNKNOWN
                }`}
              >
                {c.resolution.replace(/_/g, ' ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
