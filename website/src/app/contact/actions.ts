'use server';

import { contactFormSchema, submitLead, type SubmitResult } from '@/lib/leads';

/**
 * Contact form server action.
 *
 * A server action rather than a client fetch, so the ingest secret stays on
 * the server and the form works without JavaScript — a progressively enhanced
 * form still submits if a script fails to load, which on a marketing site is
 * the difference between a captured lead and a lost one.
 */
export async function submitContactForm(
  _previous: SubmitResult | null,
  formData: FormData,
): Promise<SubmitResult> {
  const interest = String(formData.get('interest') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const isStrategyCall = interest === 'strategy-call';
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    company: String(formData.get('company') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    websiteUrl: String(formData.get('websiteUrl') ?? ''),
    // The ingest service recognizes consulting. Preserve the more specific
    // request in the message that the founder reads in the notification.
    interest: isStrategyCall ? 'consulting' : interest,
    message: isStrategyCall && message ? `Strategy call requested.

${message}` : message,
    botField: String(formData.get('botField') ?? ''),
  };

  const parsed = contactFormSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      // Keep the FIRST message per field. Later issues on the same field are
      // usually consequences of the first and are more confusing than helpful.
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, kind: 'validation', fieldErrors };
  }

  const sourcePath = isStrategyCall
    ? '/contact?interest=strategy-call'
    : String(formData.get('sourcePath') ?? '/contact');
  return submitLead(parsed.data, sourcePath);
}
