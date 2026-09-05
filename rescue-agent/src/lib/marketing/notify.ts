import { getEmailProvider, EmailProviderNotConfigured } from '@/lib/frontdesk/email/factory';
import { isPlausibleEmail, maskEmail } from '@/lib/frontdesk/email/provider';

/**
 * FOUNDER NOTIFICATION FOR A NEW WEBSITE ENQUIRY
 *
 * The backup channel: the lead is already durably stored before this runs, so
 * a failure here loses a notification, never the enquiry itself. That ordering
 * is the whole design — email is the least reliable part of this path and it is
 * deliberately not on the critical one.
 *
 * Returns a discriminated result rather than throwing, because the caller has
 * to be able to tell three states apart and report them honestly:
 *   'sent'           — a provider accepted it (accepted ≠ delivered)
 *   'not_configured' — no email provider set up; nobody was emailed
 *   'failed'         — a provider was configured and rejected or errored
 */

export type NotifyOutcome =
  | { outcome: 'sent'; providerMessageId?: string }
  | { outcome: 'not_configured'; reason: string }
  | { outcome: 'failed'; reason: string };

export interface LeadNotification {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  websiteUrl: string | null;
  interest: string | null;
  message: string;
  flaggedSpam: boolean;
  createdAt: Date;
}

function buildBody(lead: LeadNotification): { subject: string; text: string } {
  const interest = lead.interest ?? 'General enquiry';
  const subject = lead.flaggedSpam
    ? `[Possible spam] Website enquiry — ${lead.name}`
    : `New website enquiry — ${lead.name} (${interest})`;

  const lines = [
    lead.flaggedSpam
      ? 'NOTE: this submission tripped the spam honeypot. It has been stored and flagged rather than discarded, because a false positive would delete a real customer enquiry. Check before ignoring it.'
      : null,
    lead.flaggedSpam ? '' : null,
    `Name:      ${lead.name}`,
    `Email:     ${lead.email}`,
    lead.phone ? `Phone:     ${lead.phone}` : null,
    lead.company ? `Company:   ${lead.company}` : null,
    lead.websiteUrl ? `Website:   ${lead.websiteUrl}` : null,
    `Interest:  ${interest}`,
    `Received:  ${lead.createdAt.toISOString()}`,
    '',
    'Message:',
    lead.message,
    '',
    '—',
    `Lead ID: ${lead.id}`,
    'Stored in the Winners Bookmark leads database. This email is the backup notification channel; the record is the source of truth.',
  ].filter((l): l is string => l !== null);

  return { subject, text: lines.join('\n') };
}

export async function notifyFounderOfLead(lead: LeadNotification): Promise<NotifyOutcome> {
  const to = process.env.MARKETING_LEAD_NOTIFY_EMAIL?.trim();
  const from = process.env.MARKETING_LEAD_FROM_EMAIL?.trim();

  if (!to) {
    return {
      outcome: 'not_configured',
      reason: 'MARKETING_LEAD_NOTIFY_EMAIL is not set — no recipient to notify.',
    };
  }
  if (!from) {
    return {
      outcome: 'not_configured',
      reason: 'MARKETING_LEAD_FROM_EMAIL is not set — a verified sending address is required.',
    };
  }
  if (!isPlausibleEmail(to) || !isPlausibleEmail(from)) {
    return {
      outcome: 'failed',
      reason: 'Configured notification addresses are not valid email addresses.',
    };
  }

  let provider;
  try {
    provider = await getEmailProvider();
  } catch (error) {
    return {
      outcome: 'failed',
      reason:
        error instanceof EmailProviderNotConfigured
          ? error.message
          : 'Email provider could not be constructed.',
    };
  }

  if (!provider) {
    return {
      outcome: 'not_configured',
      reason: 'EMAIL_PROVIDER is not set — no email will be sent for this lead.',
    };
  }

  const { subject, text } = buildBody(lead);
  const result = await provider.send({
    to,
    from,
    subject,
    text,
    reference: `marketing-lead:${lead.id}`,
    // Derived from the lead id, so a retried request cannot produce a second
    // email for the same enquiry.
    idempotencyKey: `marketing-lead-${lead.id}`,
  });

  if (result.status === 'ACCEPTED') {
    // Masked: a recipient address is never written out in full to logs.
    console.info(`Marketing lead ${lead.id}: notification accepted for ${maskEmail(to)}`);
    return { outcome: 'sent', providerMessageId: result.providerMessageId };
  }

  console.error(
    `Marketing lead ${lead.id}: notification failed (${result.errorCode ?? 'UNKNOWN'})`,
  );
  return {
    outcome: 'failed',
    reason: result.errorCode ?? 'Provider rejected the message.',
  };
}
