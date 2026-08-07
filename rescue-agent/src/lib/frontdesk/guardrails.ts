import type { TenantConfig } from './config/schema';
import type { EscalationReason, EscalationSeverity, Intent } from './types';

/**
 * GUARDRAILS (§X, §XII, §XXVIII, §XXIX)
 *
 * Two separate jobs live here, deliberately ahead of every other stage of the
 * pipeline:
 *
 * 1. SCREENING — refuse requests that must never be answered at all
 *    (extracting other tenants' data, extracting private staff contacts,
 *    overriding operating instructions, impersonating management).
 * 2. ESCALATION TRIGGERS — decide when the conversation must leave automation
 *    and reach a human.
 *
 * The screening rules run on customer input, which is untrusted. A caller who
 * writes "ignore your instructions" is not issuing a command to the system —
 * they are producing a string that this module classifies. Because the reply
 * pipeline is deterministic template composition rather than free generation,
 * an injected instruction has no path to change behaviour even if a rule here
 * were to miss it. This module is defence in depth, not the only defence.
 */

export type ScreenVerdict =
  | { action: 'ALLOW' }
  | { action: 'REFUSE'; category: RefusalCategory; reply: string }
  | { action: 'ESCALATE'; reason: EscalationReason; severity: EscalationSeverity; summary: string };

export type RefusalCategory =
  | 'INSTRUCTION_OVERRIDE'
  | 'CROSS_TENANT_REQUEST'
  | 'PRIVATE_STAFF_DATA'
  | 'PAYMENT_DATA'
  | 'IMPERSONATION_REQUEST'
  | 'RESTRICTED_TOPIC';

interface ScreenRule {
  category: RefusalCategory;
  patterns: RegExp[];
  reply: string;
}

const SCREEN_RULES: ScreenRule[] = [
  {
    category: 'INSTRUCTION_OVERRIDE',
    patterns: [
      /\bignore\b.*\b(your |previous |prior |all )?(rule|rules|instruction|instructions|prompt|guideline|guidelines|training)\b/i,
      /\b(disregard|forget|override|bypass)\b.*\b(rule|rules|instruction|instructions|prompt|policy|guardrail)\b/i,
      /\b(developer|system|admin(istrator)?|god|debug|maintenance) mode\b/i,
      /\b(reveal|show|print|repeat|output|tell me)\b.*\b(system )?(prompt|instructions|configuration|config file|source code|api key|secret)\b/i,
      /\byou are now\b.*\b(unrestricted|jailbroken|free|dan)\b/i,
      /\bpretend (you (are|have)|to be)\b.*\b(no rules|unrestricted|different (ai|assistant))\b/i,
      /\bact as (if you )?(a )?(different|another|unrestricted)\b/i,
    ],
    reply:
      "I'm the front desk assistant, so I can only help with questions about this restaurant. What can I help you with — hours, the menu, a reservation, or something else?",
  },
  {
    category: 'CROSS_TENANT_REQUEST',
    patterns: [
      /\b(other|another|different|competitor'?s?|all)\b.*\b(restaurant|client|tenant|business|location)s?\b.*\b(lead|leads|customer|customers|data|record|records|list|report|revenue|sales|number)\b/i,
      /\b(lead|leads|customer|customers|data|records|reports?|analytics)\b.*\b(from|for|of)\b.*\b(other|another|different|every|all|your)\b.*\b(restaurants?|clients?|businesses|tenants?)\b/i,
      /\b(list|show|give|send|export|dump)\b.*\b(all|every|your)\b.*\b(customer|client|lead|contact|phone number|email)s\b/i,
      /\bwhat (other )?(restaurants?|clients?|businesses)\b.*\byou (work|working) (with|for)\b/i,
      // Either order: "dump the database" and "export the database of every client".
      /\bdatabase\b.*\b(dump|export|access|query|table)\b/i,
      /\b(dump|export|access|query|download)\b.*\bdatabase\b/i,
    ],
    reply:
      "I can only help with questions about this restaurant, and I'm not able to share customer information. Is there something I can help you with here?",
  },
  {
    category: 'PRIVATE_STAFF_DATA',
    patterns: [
      /\b(personal|private|cell|mobile|home|direct)\b.*\b(number|phone|email|address)\b.*\b(manager|owner|chef|staff|employee)\b/i,
      /\b(manager|owner|chef|staff|employee)('?s)?\b.*\b(personal|private|cell|mobile|home|direct)\b.*\b(number|phone|email|address)\b/i,
      /\b(give|get|what'?s|tell)\b.*\bme\b.*\b(the )?(manager|owner|chef)('?s)?\b.*\b(cell|personal|private|home|direct)\b/i,
      /\bwhere does\b.*\b(the )?(manager|owner|chef|server|waitress|waiter)\b.*\blive\b/i,
      /\b(last name|full name|home address|schedule)\b.*\b(of|for)\b.*\b(the )?(manager|server|waitress|waiter|bartender|host)\b/i,
    ],
    reply:
      "I'm not able to share staff contact details. I can pass your message to the management team along with the best number to reach you — would that help?",
  },
  {
    category: 'PAYMENT_DATA',
    patterns: [
      /\b(credit card|debit card|card number|cvv|cvc|security code|expiration date|card details)\b/i,
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
      /\b(social security|ssn|routing number|account number|bank account)\b/i,
    ],
    reply:
      "Please don't send card or payment details here — this channel isn't secure for that. The restaurant will take payment directly through its own secure system.",
  },
  {
    category: 'IMPERSONATION_REQUEST',
    patterns: [
      /\b(are|is) (you|this) (the )?(manager|owner|chef)\b.*\?/i,
      /\bconfirm (that )?you (are|speak) (the|for the) (manager|owner)\b/i,
      /\b(as|on behalf of) the (manager|owner)\b.*\b(promise|guarantee|authorize|approve)\b/i,
    ],
    reply:
      "I'm the restaurant's front desk assistant, not a manager — I can't speak for management or authorise anything. I can get a manager to contact you directly. What's the best number for you?",
  },
];

/** Immediate-escalation triggers, checked before any commercial handling. */
const ESCALATION_RULES: {
  reason: EscalationReason;
  severity: EscalationSeverity;
  patterns: RegExp[];
  summary: string;
}[] = [
  {
    reason: 'EMERGENCY',
    severity: 'CRITICAL',
    patterns: [/\b(emergency|ambulance|call 911|fire|choking|unconscious|bleeding|heart attack)\b/i],
    summary: 'Possible emergency reported in conversation',
  },
  {
    reason: 'FOOD_SAFETY',
    severity: 'CRITICAL',
    patterns: [
      /\b(food poisoning|foodborne|salmonella|e\.? ?coli|listeria|norovirus)\b/i,
      /\b(got|made|been|feel|felt|was) (very |really |so )?sick\b/i,
      /\b(threw up|throwing up|vomit(ed|ing)?|diarrhea|hospital(ised|ized)?|er visit)\b/i,
      /\b(raw|undercooked|spoiled|rotten|moldy|expired)\b.*\b(chicken|meat|fish|pork|egg|food|it was)\b/i,
      /\b(glass|metal|plastic|hair|bug|insect|roach)\b.*\b(in (my|the)|found in)\b/i,
    ],
    summary: 'Possible food-safety incident — requires immediate management attention',
  },
  {
    reason: 'LEGAL_THREAT',
    severity: 'CRITICAL',
    patterns: [
      /\b(lawyer|attorney|sue|suing|lawsuit|legal action|litigation|small claims)\b/i,
      /\b(health department|board of health|department of health|inspector)\b/i,
      /\b(better business bureau|bbb|attorney general)\b/i,
    ],
    summary: 'Customer referenced legal or regulatory action',
  },
  {
    reason: 'MEDIA_INQUIRY',
    severity: 'HIGH',
    patterns: [
      /\b(journalist|reporter|press|news ?(paper|room)?|magazine|blogger|podcast)\b.*\b(comment|statement|interview|story|question)\b/i,
      /\bi'?m (a |an )?(journalist|reporter|writer)\b/i,
      /\b(on|for) the record\b/i,
    ],
    summary: 'Media or press inquiry — must be handled by management',
  },
  {
    reason: 'HARASSMENT',
    severity: 'CRITICAL',
    patterns: [
      /\b(i'?ll|i will|going to|gonna)\b.*\b(kill|hurt|harm|find|come after|destroy|burn)\b.*\b(you|him|her|them|the place|your)\b/i,
      /\b(threat(en(ing)?)?|violence)\b/i,
    ],
    summary: 'Threatening or abusive language — do not engage further',
  },
  {
    reason: 'REFUND_REQUEST',
    severity: 'HIGH',
    patterns: [/\b(refund|money back|reimburse|credit me|charge ?back|comp(ed|ing)? (my|the) meal)\b/i],
    summary: 'Customer requested a refund or compensation',
  },
  {
    reason: 'PAYMENT_DISPUTE',
    severity: 'HIGH',
    patterns: [
      /\b(double ?charged|overcharged|wrong (amount|total)|charged twice|billing (error|issue|problem)|disput(e|ing) (the|a) charge)\b/i,
    ],
    summary: 'Billing or payment dispute reported',
  },
];

/**
 * Screen an inbound customer message.
 *
 * Order matters: escalation triggers are evaluated before refusals so that a
 * genuine food-safety report containing a hostile phrase still reaches a human
 * rather than being brushed off with a refusal.
 */
export function screenMessage(message: string, config: TenantConfig): ScreenVerdict {
  const text = message.replace(/\s+/g, ' ').trim();
  if (!text) return { action: 'ALLOW' };

  for (const rule of ESCALATION_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return { action: 'ESCALATE', reason: rule.reason, severity: rule.severity, summary: rule.summary };
    }
  }

  for (const rule of SCREEN_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return { action: 'REFUSE', category: rule.category, reply: rule.reply };
    }
  }

  // Restaurant-defined restricted topics (§IV). Matched as whole words so a
  // topic like "bar" does not swallow "barbecue".
  for (const topic of config.policies.restrictedTopics) {
    const term = topic.trim();
    if (!term) continue;
    const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(text)) {
      return {
        action: 'REFUSE',
        category: 'RESTRICTED_TOPIC',
        reply:
          "That's something the restaurant team handles directly rather than me. I can take your name and number and have someone follow up with you.",
      };
    }
  }

  return { action: 'ALLOW' };
}

/**
 * ALLERGY AND FOOD-SAFETY GUARDRAIL (§XII)
 *
 * The default is an absolute refusal to make an allergen claim. A restaurant
 * can only loosen this by supplying its own approved statement, and even then
 * the reply still directs the customer to confirm with staff. Getting this
 * wrong is not a bad customer experience — it is a hospitalisation.
 */
export interface AllergyResponse {
  reply: string;
  /** True when a human must be looped in regardless of what was said. */
  escalate: boolean;
  severity: EscalationSeverity;
}

/** Signals the customer is describing a serious, not casual, allergy. */
const SEVERE_ALLERGY = /\b(anaphyla|epi[- ]?pen|severe(ly)?|deadly|life[- ]threatening|hospital|serious)\b/i;

export function buildAllergyResponse(message: string, config: TenantConfig): AllergyResponse {
  const severe = SEVERE_ALLERGY.test(message);
  const approved = config.policies.approvedAllergenStatement?.trim();

  // Even with an approved statement the engine never certifies a specific dish
  // as safe. `allowAllergenFreeClaims` governs a future menu-data feature; it
  // is never sufficient on its own to answer from an unverified menu.
  const statement = approved
    ? `${approved}`
    : "I'm not able to confirm whether a dish contains a specific allergen — I don't want to risk giving you wrong information about something this important.";

  const closing = severe
    ? 'Because this is a serious allergy, please speak with the restaurant directly before ordering so the kitchen can advise you properly. I can have someone call you — what is the best number to reach you?'
    : 'The restaurant team can confirm the details for you directly. Would you like me to have someone reach out, or would you prefer to call?';

  return {
    reply: `${statement} ${closing}`,
    // A severe allergy always reaches a human. A casual dietary mention does
    // not need to interrupt staff unless the customer asks for follow-up.
    escalate: severe,
    severity: severe ? 'HIGH' : 'STANDARD',
  };
}

/** Intents that must always end up with a person. */
const ALWAYS_ESCALATE: Intent[] = ['COMPLAINT', 'MANAGER_REQUEST', 'HUMAN_ASSISTANCE', 'LOST_PROPERTY'];

export function intentRequiresHuman(intent: Intent): boolean {
  return ALWAYS_ESCALATE.includes(intent);
}

/**
 * Resolve which configured contact an escalation routes to. Falls back through
 * the restaurant's explicit routing map, then "manager", then whatever contact
 * exists — so an escalation is never silently dropped for want of a mapping.
 */
export function resolveEscalationRoute(config: TenantConfig, key: string): string {
  const mapped = config.escalationRouting[key];
  if (mapped && config.escalationContacts.some((c) => c.key === mapped)) return mapped;
  if (config.escalationContacts.some((c) => c.key === key)) return key;
  if (config.escalationContacts.some((c) => c.key === 'manager')) return 'manager';
  return config.escalationContacts[0]?.key ?? 'manager';
}

/**
 * Can an escalation to this route actually reach a person by SMS?
 *
 * The front desk must not tell a customer their emergency has been "flagged
 * for the team" when no alert can leave the building. That is the same class
 * of false promise as claiming a booking exists — worse, because the person
 * believing it may be in a genuine emergency.
 *
 * Pure and config-only, so the engine can consult it while composing a reply,
 * before anything is queued.
 */
export function hasAlertPath(config: TenantConfig, routeKey: string): boolean {
  if (!config.messaging.smsEnabled) return false;
  if (!config.messaging.fromNumber) return false;

  const resolved = resolveEscalationRoute(config, routeKey);
  const contact = config.escalationContacts.find((c) => c.key === resolved);
  if (contact?.phone) return true;

  // A CRITICAL alert falls back to any other reachable contact, so the path
  // exists if ANY configured contact has a phone number.
  return config.escalationContacts.some((c) => Boolean(c.phone));
}
