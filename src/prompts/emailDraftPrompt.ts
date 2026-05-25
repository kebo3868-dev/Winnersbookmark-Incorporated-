export const EMAIL_DRAFT_SYSTEM_PROMPT = `You are writing a professional B2B outreach email from Keith Warren, founder of Winners Bookmark Agency, to a restaurant owner or manager.

Goal: Offer a free Restaurant AI Bottleneck Audit or a 14-day AI Front Desk Pilot.

Rules:
- Be respectful, specific, and concise.
- Mention the restaurant by name.
- Do not exaggerate or make false claims.
- Do not insult the business or say they are failing.
- Include a clear CTA.
- Include Keith's signature (filled with real data from settings).
- Include opt-out language at the end.
- Include business mailing address in the signature.
- Do not send the email automatically — this is a draft only.

Never say:
- "Your restaurant is doing bad"
- "Your reviews are terrible"
- "Your business is failing"
- "You are losing customers"

Say instead:
- "I noticed a few areas where AI could help reduce front-desk pressure."
- "There may be missed revenue hiding in calls, reservations, online ordering, and private-party inquiries."
- "This is designed to help your team capture more guest inquiries without adding extra staff."

Return JSON only. No markdown. No explanation outside the JSON.

{
  "subject": "string",
  "body": "string",
  "email_type": "string",
  "cta": "string",
  "compliance_checks": {
    "has_truthful_subject": true,
    "has_opt_out": true,
    "has_business_address": true,
    "has_respectful_language": true,
    "has_no_false_claims": true
  }
}`;

export function buildEmailUserPrompt(
  emailType: string,
  lead: Record<string, unknown>,
  audit: Record<string, unknown> | null,
  settings: Record<string, unknown>
): string {
  const auditSection = audit
    ? `Audit Data:
Top Bottlenecks: ${(audit.top_bottlenecks as string[] | undefined)?.join(', ') || 'See audit'}
Main Revenue Leak: ${audit.estimated_revenue_leak || audit.main_revenue_leak || 'Not specified'}
Recommended Solution: ${audit.recommended_solution || 'AI Front Desk System'}
Outreach Angle: ${audit.outreach_angle || 'Response speed and guest inquiry capture'}`
    : 'No audit data yet. Use general framing.';

  return `Write a "${emailType}" email for this restaurant.

Restaurant: ${lead.restaurant_name}
Owner/Manager: ${lead.owner_name || 'Restaurant Owner'}
City: ${lead.city || 'Tampa Bay'}
Cuisine: ${lead.cuisine || 'Restaurant'}
Website: ${lead.website || 'Not found'}

${auditSection}

Sender Settings:
Name: ${settings.founder_name || 'Keith Warren'}
Company: ${settings.company_name || 'Winners Bookmark Agency'}
Phone: ${settings.phone || '[Phone Number]'}
Website: ${settings.website || '[Website]'}
Address: ${settings.business_address || '[Business Mailing Address]'}
Opt-out line: ${settings.compliance_footer || 'If you prefer not to receive future emails from me, reply "opt out" and I will remove you from my list.'}

Return JSON only.`;
}

export const EMAIL_TEMPLATES = {
  'Free Bottleneck Audit Offer': {
    subject: 'Quick AI bottleneck audit for [Restaurant Name]',
    description: 'Introduce yourself and offer a free AI Bottleneck Audit.',
  },
  '14-Day Pilot Offer': {
    subject: '14-day AI Front Desk Pilot for [Restaurant Name]',
    description: 'Offer the 14-day free pilot to a qualified lead.',
  },
  'Follow-Up 1': {
    subject: 'Following up — AI audit for [Restaurant Name]',
    description: 'Friendly follow-up 2 days after initial outreach.',
  },
  'Follow-Up 2': {
    subject: 'One more thought for [Restaurant Name]',
    description: 'Second follow-up 5 days after initial outreach.',
  },
  'Final Follow-Up': {
    subject: 'Should I close this out?',
    description: 'Final touch — give them an easy out or a clear next step.',
  },
  'Discovery Call Confirmation': {
    subject: 'Confirmed — our call this [Day]',
    description: 'Confirm a booked discovery call and set expectations.',
  },
  'Trial Conversion Email': {
    subject: 'Your AI Front Desk trial results + next steps',
    description: 'Convert a completed trial to a paid client.',
  },
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
