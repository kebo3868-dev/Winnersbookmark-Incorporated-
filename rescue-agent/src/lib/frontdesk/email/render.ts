/**
 * STAFF EMAIL RENDERING
 *
 * Bodies for notifications sent to restaurant staff. Two rules govern
 * everything here, and both come from mistakes already made elsewhere in this
 * codebase:
 *
 *   1. NO SECRETS, EVER (§XX, §XXIV). Not an API key, not a session token, not
 *      a webhook secret. `buildSecretReport` names secrets without printing
 *      values for the same reason: a report gets screenshotted and pasted into
 *      a chat window.
 *
 *   2. NO OVER-SHARING OF CUSTOMER DATA (§VIII). A staff alert needs enough to
 *      act — who, what, how urgent, where to look. It does not need the full
 *      conversation transcript in an inbox that may be forwarded onward.
 *
 * Plain text is always produced. HTML is an alternative, never a replacement:
 * staff read these on phones, in clients that strip markup.
 */

export interface StaffAlertInput {
  restaurantName: string;
  /** Short human label, e.g. "Escalation: allergy concern". */
  subject: string;
  /** What happened, in one or two sentences. */
  summary: string;
  /** Ordered detail lines: "Customer: Jane", "Party size: 8". */
  details: { label: string; value: string }[];
  /** Where to act on it. */
  actionUrl?: string;
  /** True when the sending provider is a mock. */
  simulated?: boolean;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Anything matching these must never reach a rendered body. */
// Separators matter: the first version allowed only `_` and `-`, so the label
// "API key" — with a space, which is how a human writes it — slipped through
// and the value was rendered. Caught by its own test.
const SECRET_LIKE = /(api[\s_-]?key|secret|token|password|credential|authorization|bearer[\s:]|sk_live|sk_test)/i;

/**
 * Render a staff alert.
 *
 * Detail values that look like credentials are dropped rather than masked. A
 * masked secret still tells a reader one was present and roughly how long it
 * was; omitting the line entirely tells them nothing, which is the point.
 */
export function renderStaffAlert(input: StaffAlertInput): RenderedEmail {
  const safeDetails = input.details.filter((d) => !SECRET_LIKE.test(d.label) && !SECRET_LIKE.test(d.value));

  const prefix = input.simulated ? '[SIMULATED] ' : '';
  const subject = `${prefix}${input.restaurantName}: ${input.subject}`;

  const lines = [
    input.summary,
    '',
    ...safeDetails.map((d) => `${d.label}: ${d.value}`),
    ...(input.actionUrl ? ['', `Open: ${input.actionUrl}`] : []),
    '',
    input.simulated
      ? 'This alert was produced by a simulated provider and was not sent to anyone else.'
      : 'Sent by the Winners Bookmark AI Front Desk.',
  ];

  return { subject, text: lines.join('\n'), html: toHtml(lines) };
}

function toHtml(lines: string[]): string {
  const body = lines
    .map((line) => (line === '' ? '<br />' : `<p style="margin:0 0 8px 0">${escapeHtml(line)}</p>`))
    .join('\n');
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.5">${body}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
