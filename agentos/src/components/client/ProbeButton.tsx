'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorText, postJson } from './post';

/** Runs one real, minimal provider call and records the result. */
export function ProbeButton({ agentId, disabled }: { agentId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        data-testid={`probe-${agentId}`}
        disabled={busy || disabled}
        className="btn-ghost w-full"
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const result = await postJson(`/api/agents/${agentId}/probe`);
          setBusy(false);
          if (!result.ok) setMessage(errorText(result));
          else if (result.data.recorded === false) setMessage(String(result.data.reason));
          router.refresh();
        }}
      >
        {busy ? 'Checking…' : 'Check connection'}
      </button>
      {message && <p className="text-xs text-slate-400">{message}</p>}
    </div>
  );
}
