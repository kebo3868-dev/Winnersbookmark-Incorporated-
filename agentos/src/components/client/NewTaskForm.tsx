'use client';

import { useState } from 'react';
import { errorText, postJson } from './post';

interface AgentOption {
  id: string;
  name: string;
  title: string;
  status: string;
}

export function NewTaskForm({ agents }: { agents: AgentOption[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? 'roxy');
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [reviewer, setReviewer] = useState('auto');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError(null);
        const result = await postJson('/api/tasks', {
          title: form.get('title'),
          objective: form.get('objective'),
          agentId,
          riskLevel: risk,
          reviewer,
        });
        if (result.ok) {
          const task = result.data.task as { id: string };
          window.location.href = `/tasks/${task.id}`;
          return;
        }
        setBusy(false);
        const issues = Array.isArray(result.data.issues) ? (result.data.issues as Array<{ path: string; message: string }>).map((i) => `${i.path}: ${i.message}`).join('; ') : '';
        setError(`${errorText(result)}${issues ? ` — ${issues}` : ''}`);
      }}
    >
      <div>
        <label htmlFor="title" className="label">Title</label>
        <input id="title" name="title" required minLength={3} maxLength={200} className="field" placeholder="e.g. Q1 outreach plan for independent pizzerias" />
      </div>
      <div>
        <label htmlFor="objective" className="label">Objective</label>
        <textarea id="objective" name="objective" required minLength={10} maxLength={8000} rows={6} className="field" placeholder="What the agent should produce, for whom, and what a good answer includes." />
      </div>
      <fieldset>
        <legend className="label">Assign to</legend>
        <div className="grid grid-cols-2 gap-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              data-testid={`assign-${agent.id}`}
              aria-pressed={agentId === agent.id}
              onClick={() => setAgentId(agent.id)}
              className={`rounded-xl border p-3 text-left ${agentId === agent.id ? 'border-gold bg-gold/10' : 'border-ink-line bg-ink-3'}`}
            >
              <span className="block text-sm font-bold">{agent.name}</span>
              <span className="block text-[11px] text-slate-400">{agent.title}</span>
              <span className="mt-1 block text-[11px] text-slate-500">{agent.status}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="risk" className="label">Risk</label>
          <select id="risk" className="field" value={risk} onChange={(e) => setRisk(e.target.value as typeof risk)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label htmlFor="reviewer" className="label">Reviewer</label>
          <select id="reviewer" className="field" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
            <option value="auto">Automatic</option>
            {risk !== 'high' && <option value="none">None</option>}
            {agents.filter((a) => a.id !== agentId).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Automatic: medium and high risk are checked by an independent agent; low risk is not. High risk is always reviewed.
      </p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button type="submit" data-testid="create-task" disabled={busy} className="btn-primary w-full">{busy ? 'Creating…' : 'Create task'}</button>
    </form>
  );
}
