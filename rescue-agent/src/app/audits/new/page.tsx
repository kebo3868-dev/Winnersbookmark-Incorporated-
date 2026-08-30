'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sanitizeUrlInput, describeRemovals } from '@/lib/validation/urlSanitize';

const INITIAL = {
  websiteUrl: '',
  restaurantName: '',
  city: '',
  state: '',
  knownConcern: '',
  reservationUrl: '',
  orderingUrl: '',
  socialUrl: '',
  googleBusinessUrl: '',
  ownerRating: '',
  ownerReviewCount: '',
  avgTicket: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactConsent: false,
};

export default function NewAuditPage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Show the operator the URL the audit will actually use. Runs the SAME
  // sanitizer the server runs, so the preview cannot promise one thing and the
  // pipeline do another.
  const sanitizedInput = form.websiteUrl.trim() ? sanitizeUrlInput(form.websiteUrl) : null;
  const urlPreview =
    sanitizedInput?.ok && sanitizedInput.normalized !== form.websiteUrl.trim()
      ? { normalized: sanitizedInput.normalized, removed: describeRemovals(sanitizedInput.removals) }
      : null;
  const urlError = sanitizedInput && !sanitizedInput.ok ? sanitizedInput.reason : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
    const str = (v: string) => (v.trim() === '' ? undefined : v.trim());
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          websiteUrl: form.websiteUrl,
          restaurantName: str(form.restaurantName),
          city: str(form.city),
          state: str(form.state),
          knownConcern: str(form.knownConcern),
          reservationUrl: str(form.reservationUrl),
          orderingUrl: str(form.orderingUrl),
          socialUrl: str(form.socialUrl),
          googleBusinessUrl: str(form.googleBusinessUrl),
          ownerRating: num(form.ownerRating),
          ownerReviewCount: num(form.ownerReviewCount),
          avgTicket: num(form.avgTicket),
          contactName: str(form.contactName),
          contactEmail: str(form.contactEmail),
          contactPhone: str(form.contactPhone),
          contactConsent: form.contactConsent,
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
          Only the website URL is required. Everything else sharpens the audit. The agent analyzes publicly accessible pages — it never bypasses logins, captchas, or bot protection, and never scrapes review platforms.
        </p>
      </div>

      <form onSubmit={submit} className="card p-8 space-y-8">
        {/* Restaurant */}
        <fieldset className="space-y-5">
          <legend className="label text-gold mb-1">Restaurant</legend>
          <div>
            <label className="label block mb-2">Restaurant Website URL — required</label>
            <input required value={form.websiteUrl} onChange={set('websiteUrl')} placeholder="https://example-restaurant.com" />
            {/* The URL that will actually be crawled, shown only when it differs
                from what was typed. A pasted URL can carry invisible characters
                that make it 404; without this the operator sees a healthy site
                fail an audit and has nothing on screen to explain why. */}
            {urlPreview && (
              <p className="text-xs mt-2 text-amber-300/90">
                Will be audited as <span className="text-ivory break-all">{urlPreview.normalized}</span>
                {urlPreview.removed && (
                  <>
                    {' '}
                    — removed invisible characters from the pasted URL ({urlPreview.removed}).
                  </>
                )}
              </p>
            )}
            {urlError && <p className="text-xs mt-2 text-red-300">{urlError}</p>}
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
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
            <textarea rows={2} value={form.knownConcern} onChange={set('knownConcern')} placeholder="Optional — e.g. 'the phone rings off the hook at lunch'" />
          </div>
        </fieldset>

        {/* Pathways */}
        <fieldset className="space-y-5 border-t border-obsidian-line pt-6">
          <legend className="label text-gold mb-1">Booking & Ordering (optional)</legend>
          <p className="text-ivory-faint text-xs">If you know these links, we&apos;ll test them directly instead of only what we can discover on the site.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label block mb-2">Reservation URL</label>
              <input value={form.reservationUrl} onChange={set('reservationUrl')} placeholder="OpenTable / Resy / etc." />
            </div>
            <div>
              <label className="label block mb-2">Online Ordering URL</label>
              <input value={form.orderingUrl} onChange={set('orderingUrl')} placeholder="Toast / DoorDash / direct" />
            </div>
            <div>
              <label className="label block mb-2">Social Profile URL</label>
              <input value={form.socialUrl} onChange={set('socialUrl')} placeholder="Instagram / Facebook" />
            </div>
            <div>
              <label className="label block mb-2">Average Ticket ($)</label>
              <input value={form.avgTicket} onChange={set('avgTicket')} inputMode="decimal" placeholder="e.g. 45 — sharpens revenue models" />
            </div>
          </div>
        </fieldset>

        {/* Reviews */}
        <fieldset className="space-y-5 border-t border-obsidian-line pt-6">
          <legend className="label text-gold mb-1">Reputation (optional, owner-reported)</legend>
          <p className="text-ivory-faint text-xs">We never scrape review sites. Share your public numbers and we&apos;ll include reputation in the score — clearly labeled as owner-reported.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label block mb-2">Google Rating (0–5)</label>
              <input value={form.ownerRating} onChange={set('ownerRating')} inputMode="decimal" placeholder="e.g. 4.4" />
            </div>
            <div>
              <label className="label block mb-2">Review Count</label>
              <input value={form.ownerReviewCount} onChange={set('ownerReviewCount')} inputMode="numeric" placeholder="e.g. 312" />
            </div>
            <div>
              <label className="label block mb-2">Google Business URL</label>
              <input value={form.googleBusinessUrl} onChange={set('googleBusinessUrl')} placeholder="Optional" />
            </div>
          </div>
        </fieldset>

        {/* Lead capture */}
        <fieldset className="space-y-5 border-t border-obsidian-line pt-6">
          <legend className="label text-gold mb-1">Where to send the audit (optional)</legend>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label block mb-2">Your Name</label>
              <input value={form.contactName} onChange={set('contactName')} placeholder="Optional" />
            </div>
            <div>
              <label className="label block mb-2">Email</label>
              <input value={form.contactEmail} onChange={set('contactEmail')} type="email" placeholder="Optional" />
            </div>
            <div>
              <label className="label block mb-2">Phone</label>
              <input value={form.contactPhone} onChange={set('contactPhone')} placeholder="Optional" />
            </div>
          </div>
          <label className="flex items-start gap-3 text-xs text-ivory-dim">
            <input type="checkbox" checked={form.contactConsent} onChange={(e) => setForm((f) => ({ ...f, contactConsent: e.target.checked }))} className="mt-0.5 w-auto" />
            <span>I agree to be contacted by Winners Bookmark about this audit.</span>
          </label>
        </fieldset>

        {error && (
          <div className="border border-red-400/40 text-red-300 rounded-md px-4 py-3 text-sm uppercase tracking-wide">{error}</div>
        )}

        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-obsidian-line">
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
