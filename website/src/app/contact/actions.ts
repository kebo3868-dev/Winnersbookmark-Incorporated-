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
  const optional = [
    ['Industry', formData.get('industry')],
    ['Locations', formData.get('locations')],
    ['Current systems', formData.get('currentSystems')],
    ['Monthly inquiries', formData.get('monthlyInquiries')],
    ['Preferred contact', formData.get('preferredContact')],
  ].filter(([, value]) => typeof value === 'string' && value.trim());
  const context = optional.map(([label, value]) => `${label}: ${String(value).slice(0, 180)}`).join('\n');
  const message = String(formData.get('message') ?? '');
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    company: String(formData.get('company') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    websiteUrl: String(formData.get('websiteUrl') ?? ''),
    interest: String(formData.get('interest') ?? ''),
    message: context ? `${message}\n\nBusiness context:\n${context}` : message,
    botField: String(formData.get('botField') ?? ''),
  };

  const parsed = contactFormSchema.safeParse(raw);
  if (formData.get('agreementNotice') !== 'on') {
    return { ok: false, kind: 'validation', fieldErrors: { agreementNotice: 'Please acknowledge the request terms.' } };
  }
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

  const sourcePath = String(formData.get('sourcePath') ?? '/contact');
  return submitLead(parsed.data, sourcePath);
}
