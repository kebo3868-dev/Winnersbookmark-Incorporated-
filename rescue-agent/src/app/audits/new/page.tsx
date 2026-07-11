'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewAuditPage() {
  const router = useRouter();
  const [form, setForm] = useState({ websiteUrl: '', restaurantName: '', city: '', state: '', knownConcern: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          websiteUrl: form.websiteUrl,
          restaurantName: form.restaurantName || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          knownConcern: form.knownConcern || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'AUDIT COULD NOT START');
        setSubmitting(false);
        return;
      }
      router.push(`/audits/${data.auditId}`);
    } catch {
      setError('AUDIT COULD NOT START');
      setSubmitting(false);
    }
  }

  async function runDemo() {
    setError(null);
    setDemoLoading(true);
    try {
      const res = await fetch('/api/audits/demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'AUDIT COULD NOT START');
        setDemoLoading(false);
        return;
      }
      router.push(`/audits/${data.auditId}`);
    } catch {
      setError('AUDIT COULD NOT START');
      setDemoLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <p className="label mb-2">New Restaurant Audit</p>
        <h1 className="font-display text-3xl">Run a Restaurant Rescue Audit</h1>
        <p className="text-ivory-dim text-sm mt-2">
          Only the website URL is required. The agent analyzes publicly accessible pages — it never bypasses logins, captchas, or bot protection.
        </p>
      </div>

      <form onSubmit={submit} className="card p-8 space-y-5">
        <div>
          <label className="label block mb-2">Restaurant Website URL — required</label>
          <input required value={form.websiteUrl} onChange={set('websiteUrl')} placeholder="https://example-restaurant.com" />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="label block mb-2">Restaurant Name</label>
            <input value={form.restaurantName} onChange={set('restaurantName')} placeholder="Optional" />
          </div>
          <div>
            <label className="label block mb-2">City</label>
            <input value={form.city} onChange={set('city')} placeholder="Optional" />
          </div>
          <div>
            <label className="label block mb-2">State</label>
            <input value={form.state} onChange={set('state')} placeholder="Optional" />
          </div>
        </div>
        <div>
          <label className="label block mb-2">Known Business Concern</label>
          <textarea rows={3} value={form.knownConcern} onChange={set('knownConcern')} placeholder="Optional — e.g. 'owner says the phone rings off the hook at lunch'" />
        </div>

        {error && (
          <div className="border border-red-400/40 text-red-300 rounded-md px-4 py-3 text-sm uppercase tracking-wide">{error}</div>
        )}

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button type="submit" disabled={submitting} className="btn-gold disabled:opacity-50">
            {submitting ? 'Starting Audit…' : 'Run Restaurant Rescue Audit'}
          </button>
          <button type="button" onClick={runDemo} disabled={demoLoading} className="btn-outline disabled:opacity-50">
            {demoLoading ? 'Building Demo…' : 'Run Demo (Fictional Data)'}
          </button>
        </div>
      </form>
    </div>
  );
}
