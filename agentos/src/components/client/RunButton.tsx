'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorText, postJson } from './post';

export function RunButton({ taskId, label }: { taskId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        data-testid="run-task"
        disabled={busy}
        className="btn-primary w-full"
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await postJson(`/api/tasks/${taskId}/run`);
          setBusy(false);
          if (!result.ok) setError(typeof result.data.error === 'string' ? result.data.error : errorText(result));
          router.refresh();
        }}
      >
        {busy ? 'Agents working… this can take a few minutes' : label}
      </button>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
