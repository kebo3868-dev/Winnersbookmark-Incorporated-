import type { Lead, Audit, AppSettings, AuditResult, EmailDraftResult, ScoreLabel } from '../types';
import { getScoreLabel, clamp } from '../utils/scoring';
import { BOTTLENECK_AUDIT_SYSTEM_PROMPT, buildAuditUserPrompt } from '../prompts/bottleneckAuditPrompt';
import { EMAIL_DRAFT_SYSTEM_PROMPT, buildEmailUserPrompt } from '../prompts/emailDraftPrompt';

// ─── MOCK AI (works without API keys) ────────────────────────────────────────

function generateMockAudit(lead: Lead): AuditResult {
  let digital = 55;
  let friction = 50;
  let revenue = 45;
  let aiOpp = 65;

  const bottlenecks: string[] = [];
  const missing: string[] = [];

  if (!lead.website) {
    digital -= 25;
    missing.push('Website URL');
    bottlenecks.push('No website found — guests cannot find hours, menu, or contact info online');
  } else {
    digital += 10;
  }

  if (lead.has_online_ordering !== 'yes') {
    revenue -= 20;
    aiOpp += 5;
    bottlenecks.push('No online ordering detected — potential revenue loss during off-hours and late nights');
  }

  if (lead.has_reservations !== 'yes') {
    revenue -= 15;
    friction += 15;
    aiOpp += 8;
    bottlenecks.push('No reservation system — guests may call during busy hours or abandon the booking attempt');
  }

  if (lead.has_catering_page !== 'yes') {
    revenue -= 18;
    aiOpp += 10;
    bottlenecks.push('No catering or private party inquiry page — high-value events may not be captured');
  }

  if (lead.has_contact_form !== 'yes') {
    digital -= 8;
    aiOpp += 5;
    if (!bottlenecks.find(b => b.includes('contact'))) {
      bottlenecks.push('No contact form — guests have no easy way to reach out outside of calling');
    }
  }

  if (!lead.phone) {
    missing.push('Phone number');
    friction += 15;
  }

  if (!lead.email) {
    missing.push('Business email address');
    digital -= 5;
  }

  if (!lead.rating) {
    missing.push('Google rating');
  }

  if (!lead.cuisine) {
    missing.push('Cuisine type');
  }

  if (lead.rating && lead.rating >= 4.5 && (lead.review_count || 0) > 200) {
    aiOpp += 8;
    if (!bottlenecks.some(b => b.includes('peak'))) {
      bottlenecks.push('High-volume restaurant likely experiencing missed guest inquiries during peak hours');
    }
  }

  digital = clamp(digital);
  friction = clamp(friction);
  revenue = clamp(revenue);
  aiOpp = clamp(aiOpp);

  const bottleneckScore = Math.round((digital + friction + revenue + aiOpp) / 4);
  const scoreLabel = getScoreLabel(bottleneckScore);

  let tier: 'Essential' | 'Pro' | 'Anchor' = 'Essential';
  if (bottleneckScore >= 65) tier = 'Pro';
  if (bottleneckScore >= 80) tier = 'Anchor';

  return {
    restaurant_name: lead.restaurant_name,
    bottleneck_score: bottleneckScore,
    score_label: scoreLabel,
    digital_presence_score: digital,
    customer_friction_score: friction,
    revenue_capture_score: revenue,
    ai_opportunity_score: aiOpp,
    top_bottlenecks: bottlenecks.slice(0, 3),
    main_revenue_leak: bottlenecks[0] || 'Guest inquiry response time during peak hours',
    recommended_ai_solution: tier === 'Essential'
      ? 'AI Front Desk System with missed-call text-back and FAQ chatbot'
      : tier === 'Pro'
      ? 'AI Front Desk + catering inquiry capture + review response assistant'
      : 'Full AI Operations Partner — custom workflow, multi-location, staff assistant',
    recommended_pricing_tier: tier,
    suggested_outreach_angle: `Offer a free bottleneck audit focused on capturing more guest inquiries and reducing front-desk pressure at ${lead.restaurant_name}`,
    audit_summary: `${lead.restaurant_name} shows ${scoreLabel.toLowerCase()} opportunity for AI automation. Key areas include improving guest communication speed${lead.has_reservations !== 'yes' ? ', capturing online reservations' : ''}${lead.has_catering_page !== 'yes' ? ', adding a catering/private party inquiry page' : ''}, and reducing front-desk pressure during peak hours. ${missing.length > 0 ? `Additional info needed: ${missing.join(', ')}.` : 'Good data available for outreach.'}`,
    confidence_level: missing.length >= 3 ? 'Low' : missing.length >= 1 ? 'Medium' : 'High',
    missing_information: missing,
    next_best_action: 'Send a free bottleneck audit offer email to introduce the AI Front Desk System',
  };
}

function generateMockEmail(
  emailType: string,
  lead: Lead,
  audit: Audit | null,
  settings: AppSettings
): EmailDraftResult {
  const name = lead.owner_name || 'Restaurant Owner';
  const restaurant = lead.restaurant_name;
  const bottleneck = audit?.top_bottlenecks?.[0] || 'front-desk response time and guest inquiry capture';

  const sig = `${settings.founder_name || 'Keith Warren'}
Founder, ${settings.company_name || 'Winners Bookmark Agency'}
${settings.phone || '[Phone Number]'}
${settings.website || '[Website]'}
${settings.business_address || '[Business Mailing Address]'}`;

  const optOut = settings.compliance_footer || 'If you prefer not to receive future emails from me, reply "opt out" and I will remove you from my list.';

  const address = settings.business_address || '';

  let subject = '';
  let body = '';

  if (emailType === 'Free Bottleneck Audit Offer') {
    subject = `Quick AI bottleneck audit for ${restaurant}`;
    body = `Hi ${name},

My name is ${settings.founder_name || 'Keith Warren'}, founder of ${settings.company_name || 'Winners Bookmark Agency'}.

I help local restaurants capture missed revenue using simple AI systems that support the front desk, phone line, online inquiries, reservations, and private-party requests.

I took a quick look at ${restaurant} and noticed a few areas where an AI Front Desk System may be able to help reduce friction and support your team.

The main areas I usually look for are:

- Missed calls during busy hours
- Slow replies to guest questions
- Reservation or party inquiry friction
- Catering and private-event leads falling through the cracks
- Online ordering confusion
- Review response and follow-up opportunities

I'd like to send you a free Restaurant AI Bottleneck Audit showing 3 areas where AI could help ${restaurant} capture more guest inquiries without hiring more staff.

No pressure. Just a simple audit.

Would you like me to send it over?

${sig}

${optOut}`;
  } else if (emailType === '14-Day Pilot Offer') {
    subject = `14-day AI Front Desk Pilot for ${restaurant}`;
    body = `Hi ${name},

I wanted to follow up with a practical offer.

I'm currently offering a limited 14-day AI Front Desk Pilot for a few Tampa Bay restaurants.

The pilot is designed to show how AI can help with:

- Answering common guest questions
- Capturing missed calls
- Collecting reservation and party inquiries
- Routing serious requests to your team
- Creating a weekly missed-opportunity report

The goal is not to replace your staff.

The goal is to help your team respond faster, reduce front-desk pressure, and stop small revenue leaks from falling through the cracks.

After the pilot, if it makes sense, the full system starts at:

Essential AI Front Desk:
$997 setup + $750/month

If not, no pressure.

Would you be open to a quick 10-minute call this week?

${sig}

${optOut}`;
  } else if (emailType === 'Final Follow-Up') {
    subject = `Should I close this out?`;
    body = `Hi ${name},

I don't want to keep following up if this is not useful.

I reached out because I help restaurants use AI to capture missed calls, improve guest response time, collect reservation and private-party inquiries, and reduce front-desk pressure.

For ${restaurant}, I believe there may be an opportunity to improve response speed and capture more guest inquiries without adding more staff.

Should I close this out, or would you like me to send the free AI Bottleneck Audit?

${sig}

${optOut}`;
  } else {
    subject = `Following up — AI audit for ${restaurant}`;
    body = `Hi ${name},

Just following up on my previous message about the AI Front Desk opportunity for ${restaurant}.

I noticed there may be an opportunity around ${bottleneck}.

Would you have 10 minutes this week for a quick call? I'd love to walk you through what a simple AI system could do for your team.

${sig}

${optOut}`;
  }

  return {
    subject,
    body,
    email_type: emailType,
    cta: 'Reply to this email or book a 10-minute call',
    compliance_checks: {
      has_truthful_subject: true,
      has_opt_out: !!optOut,
      has_business_address: !!address,
      has_respectful_language: true,
      has_no_false_claims: true,
    },
  };
}

// ─── AI PROVIDER (real API calls) ─────────────────────────────────────────────

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in Gemini response');
  return match[0];
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content || '{}';
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

const provider = import.meta.env.VITE_AI_PROVIDER || 'mock';

export async function generateAudit(lead: Lead): Promise<AuditResult> {
  if (provider === 'mock' || (!import.meta.env.VITE_GEMINI_API_KEY && !import.meta.env.VITE_OPENAI_API_KEY)) {
    await new Promise(r => setTimeout(r, 1200));
    return generateMockAudit(lead);
  }

  const userPrompt = buildAuditUserPrompt(lead as unknown as Record<string, unknown>);
  let raw: string;

  if (provider === 'gemini') {
    raw = await callGemini(BOTTLENECK_AUDIT_SYSTEM_PROMPT, userPrompt);
  } else {
    raw = await callOpenAI(BOTTLENECK_AUDIT_SYSTEM_PROMPT, userPrompt);
  }

  return JSON.parse(raw) as AuditResult;
}

export async function generateEmailDraft(
  emailType: string,
  lead: Lead,
  audit: Audit | null,
  settings: AppSettings
): Promise<EmailDraftResult> {
  if (provider === 'mock' || (!import.meta.env.VITE_GEMINI_API_KEY && !import.meta.env.VITE_OPENAI_API_KEY)) {
    await new Promise(r => setTimeout(r, 800));
    return generateMockEmail(emailType, lead, audit, settings);
  }

  const userPrompt = buildEmailUserPrompt(
    emailType,
    lead as unknown as Record<string, unknown>,
    audit as unknown as Record<string, unknown> | null,
    settings as unknown as Record<string, unknown>
  );
  let raw: string;

  if (provider === 'gemini') {
    raw = await callGemini(EMAIL_DRAFT_SYSTEM_PROMPT, userPrompt);
  } else {
    raw = await callOpenAI(EMAIL_DRAFT_SYSTEM_PROMPT, userPrompt);
  }

  return JSON.parse(raw) as EmailDraftResult;
}

export function getAIProviderLabel(): string {
  if (provider === 'gemini' && import.meta.env.VITE_GEMINI_API_KEY) return 'Gemini 1.5 Flash';
  if (provider === 'openai' && import.meta.env.VITE_OPENAI_API_KEY) return 'GPT-4o Mini';
  return 'Mock AI (demo mode)';
}

export function isAIConfigured(): boolean {
  return !!(import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY);
}

// ─── COMPLIANCE ───────────────────────────────────────────────────────────────

export interface ComplianceCheck {
  passed: boolean;
  issues: string[];
}

export function checkEmailCompliance(
  draft: { subject: string; body: string; approved_by_user: boolean },
  lead: { opt_out: boolean; crm_stage: string; email: string },
  settings: AppSettings
): ComplianceCheck {
  const issues: string[] = [];

  if (!lead.email) issues.push('No email address for this lead');
  if (lead.opt_out) issues.push('Lead has opted out — do not contact');
  if (lead.crm_stage === 'Do Not Contact') issues.push('Lead is marked Do Not Contact');
  if (!draft.subject.trim()) issues.push('Subject line is empty');
  if (!draft.body.trim()) issues.push('Email body is empty');
  if (!settings.business_address) issues.push('Business mailing address is missing in Settings');

  const hasOptOut =
    draft.body.toLowerCase().includes('opt out') ||
    draft.body.toLowerCase().includes('unsubscribe') ||
    draft.body.toLowerCase().includes('remove you from my list');
  if (!hasOptOut) issues.push('Email is missing an opt-out line');

  const badPhrases = [
    'your restaurant is failing',
    'your reviews are terrible',
    'your business is bad',
    'you are losing customers',
    'your restaurant is doing bad',
  ];
  for (const phrase of badPhrases) {
    if (draft.body.toLowerCase().includes(phrase)) {
      issues.push(`Email contains disrespectful language: "${phrase}"`);
    }
  }

  return { passed: issues.length === 0, issues };
}
