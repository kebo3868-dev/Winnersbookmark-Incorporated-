'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { submitContactForm } from './actions';
import type { SubmitResult } from '@/lib/leads';
import { contact } from '@/data/site';

const INTEREST_OPTIONS = [
  { value: 'general', label: 'General enquiry' },
  { value: 'restaurant-rescue-agent', label: 'Restaurant Rescue Agent' },
  { value: 'ai-front-desk', label: 'AI Front Desk' },
  { value: 'ai-business-audit', label: 'AI Business Audit' },
  { value: 'consulting', label: 'AI Consulting' },
  { value: 'ai-sales-agent', label: 'AI Sales Agent (not yet available)' },
  { value: 'gigi', label: 'Gigi (in development)' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? 'Sending…' : 'Send Enquiry'}
    </button>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-message" role="alert">
      {message}
    </p>
  );
}

export default function ContactForm() {
  const searchParams = useSearchParams();
  const presetInterest = searchParams.get('interest') ?? 'general';

  const [state, formAction] = useActionState<SubmitResult | null, FormData>(
    submitContactForm,
    null,
  );

  const errors = state && !state.ok && state.kind === 'validation' ? state.fieldErrors : {};
  const unavailable = state && !state.ok && state.kind === 'unavailable' ? state : null;

  /* ── SUCCESS ──────────────────────────────────────────────────────────── */
  if (state?.ok) {
    return (
      <div className="surface p-7 sm:p-9" role="status" aria-live="polite">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-signal-live/40 bg-signal-live/10 text-xl text-signal-live">
          ✓
        </div>
        <h2 className="mt-6 text-display-3 font-bold text-text-bright">Enquiry received.</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          Your enquiry has been recorded and Keith has been notified. You can expect a reply
          within one business day.
        </p>

        <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.12em] text-text-muted">
          What happens next
        </h3>
        <ol className="mt-4 space-y-3">
          {[
            'Keith reads your enquiry personally — this is a small company, not a queue.',
            'You get a reply with an honest first read on whether we can help.',
            'If it looks like a fit, we book a call and go deeper. If not, we will tell you that too.',
          ].map((step, i) => (
            <li key={step} className="flex gap-3 text-sm leading-relaxed text-text-secondary">
              <span
                aria-hidden="true"
                className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded border border-cobalt-core/40 bg-cobalt-core/10 font-mono text-[10px] font-bold text-cobalt-light"
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        {/* No scheduling link is invented here. `hasBooking` only becomes true
            when NEXT_PUBLIC_BOOKING_URL is actually configured, so this block
            cannot render a dead CTA. */}
        {contact.hasBooking && contact.bookingUrl && (
          <a
            href={contact.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-8"
          >
            Book your call now
          </a>
        )}
      </div>
    );
  }

  /* ── FORM ─────────────────────────────────────────────────────────────── */
  return (
    <form action={formAction} className="surface p-6 sm:p-8" noValidate>
      <input type="hidden" name="sourcePath" value="/contact" />

      {/* Honeypot. Hidden from people, harvested by bots. A submission that
          fills it is stored and FLAGGED upstream rather than discarded —
          silently deleting a real customer enquiry is the worse error. */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor="botField">Leave this field empty</label>
        <input id="botField" name="botField" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {unavailable && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 sm:p-5"
        >
          <p className="text-sm font-semibold text-red-300">
            Your enquiry was not sent.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {unavailable.message} Nothing was recorded, so please email us directly at{' '}
            <a
              href={`mailto:${contact.email}`}
              className="font-semibold text-cobalt-light underline underline-offset-4 hover:text-white"
            >
              {contact.email}
            </a>{' '}
            — or try again in a few minutes.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="name" className="field-label">
            Your name <span className="text-cobalt-light">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            className={`field-input ${errors.name ? 'field-error' : ''}`}
            placeholder="Jane Doe"
          />
          <FieldError id="name-error" message={errors.name} />
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="email" className="field-label">
            Email address <span className="text-cobalt-light">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={`field-input ${errors.email ? 'field-error' : ''}`}
            placeholder="you@yourbusiness.com"
          />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="company" className="field-label">Business name</label>
          <input
            id="company"
            name="company"
            type="text"
            autoComplete="organization"
            className="field-input"
            placeholder="The Golden Anchor"
          />
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="phone" className="field-label">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            className="field-input"
            placeholder="(555) 013-7788"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="websiteUrl" className="field-label">Your website</label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            autoComplete="url"
            inputMode="url"
            className="field-input"
            placeholder="https://yourbusiness.com"
          />
          <p className="field-hint">
            If you want an audit, this is the only thing we need to get started.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="interest" className="field-label">What is this about?</label>
          <select
            id="interest"
            name="interest"
            defaultValue={presetInterest}
            className="field-input"
          >
            {INTEREST_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className="field-label">
            What is not working? <span className="text-cobalt-light">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={5}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'message-error' : 'message-hint'}
            className={`field-input resize-y ${errors.message ? 'field-error' : ''}`}
            placeholder="We miss a lot of calls during the dinner rush and I do not know how many customers we are losing."
          />
          <FieldError id="message-error" message={errors.message} />
          {!errors.message && (
            <p id="message-hint" className="field-hint">
              Plain English is fine. You do not need to know what you want built.
            </p>
          )}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
        <SubmitButton />
        <p className="text-xs leading-relaxed text-text-muted">
          We use your details to reply to this enquiry. We do not sell them or add you to a
          mailing list.
        </p>
      </div>
    </form>
  );
}
