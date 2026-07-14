/**
 * Intent taxonomy + escalation matrix for the voice receptionist.
 *
 * The classifier itself lives in the voice provider (Retell/Vapi). This module
 * is the deterministic, testable policy layer: it defines the canonical intent
 * set and, given a caller utterance, decides whether the call must be escalated
 * to a human — independent of any LLM. The voice agent calls these rules so the
 * escalation decision is never left to model discretion alone.
 */

export const CORE_INTENTS = [
  'GET_HOURS',
  'GET_DIRECTIONS',
  'MENU_QUESTION',
  'PRICE_QUESTION',
  'FRESH_FISH_AVAILABILITY',
  'SPECIALS_QUESTION',
  'DRINK_QUESTION',
  'PLACE_TO_GO_ORDER',
  'MODIFY_DRAFT_ORDER',
  'CANCEL_DRAFT_ORDER',
  'ORDER_STATUS',
  'RESERVATION_QUESTION',
  'LARGE_PARTY',
  'PRIVATE_EVENT',
  'GIFT_CARD_QUESTION',
  'ALLERGY_OR_DIETARY_CONCERN',
  'CUSTOMER_COMPLAINT',
  'REFUND_REQUEST',
  'INCORRECT_ORDER',
  'VENDOR_CALL',
  'EMPLOYEE_CALL',
  'MEDIA_INQUIRY',
  'MANAGER_REQUEST',
  'HUMAN_REQUEST',
  'EMERGENCY',
  'UNKNOWN',
] as const;

export type CoreIntent = (typeof CORE_INTENTS)[number];

/** Intents that must always hand off to a human, and the role to route them to. */
export const ESCALATION_INTENTS: Partial<Record<CoreIntent, EscalationTarget>> = {
  ALLERGY_OR_DIETARY_CONCERN: { role: 'MANAGER_ON_DUTY', severity: 'HIGH' },
  CUSTOMER_COMPLAINT: { role: 'MANAGER_ON_DUTY', severity: 'HIGH' },
  REFUND_REQUEST: { role: 'MANAGER_ON_DUTY', severity: 'HIGH' },
  INCORRECT_ORDER: { role: 'MANAGER_ON_DUTY', severity: 'HIGH' },
  VENDOR_CALL: { role: 'MANAGER_ON_DUTY', severity: 'NORMAL' },
  EMPLOYEE_CALL: { role: 'MANAGER_ON_DUTY', severity: 'NORMAL' },
  MEDIA_INQUIRY: { role: 'GENERAL_MANAGER', severity: 'NORMAL' },
  MANAGER_REQUEST: { role: 'MANAGER_ON_DUTY', severity: 'NORMAL' },
  HUMAN_REQUEST: { role: 'HOST_STAND', severity: 'NORMAL' },
  EMERGENCY: { role: 'EMERGENCY_ESCALATION', severity: 'EMERGENCY' },
  GIFT_CARD_QUESTION: { role: 'MANAGER_ON_DUTY', severity: 'NORMAL' },
  PRIVATE_EVENT: { role: 'EVENTS_CONTACT', severity: 'NORMAL' },
};

export type StaffRole =
  | 'HOST_STAND'
  | 'MANAGER_ON_DUTY'
  | 'GENERAL_MANAGER'
  | 'TO_GO_STATION'
  | 'EVENTS_CONTACT'
  | 'EMERGENCY_ESCALATION';

export type EscalationSeverity = 'NORMAL' | 'HIGH' | 'EMERGENCY';

export interface EscalationTarget {
  role: StaffRole;
  severity: EscalationSeverity;
}

export interface EscalationDecision {
  escalate: boolean;
  reason: string;
  target: EscalationTarget | null;
  /** The exact line the agent should say before handing off, when applicable. */
  script?: string;
}

const ALLERGY_TERMS = [
  'allerg', // allergy, allergic, allergen
  'anaphyla',
  'epipen',
  'epi pen',
  'gluten',
  'celiac',
  'coeliac',
  'peanut',
  'shellfish allerg',
  'seafood allerg',
  'intoleran',
];

const EMERGENCY_TERMS = [
  'emergency',
  '911',
  'choking',
  'heart attack',
  'not breathing',
  'unconscious',
  'call an ambulance',
  'someone collapsed',
  'there is a fire',
  "there's a fire",
  'bleeding',
];

const HUMAN_REQUEST_TERMS = [
  'talk to a person',
  'speak to a person',
  'real person',
  'talk to someone',
  'speak to someone',
  'talk to a human',
  'speak to a human',
  'talk to a manager',
  'speak to a manager',
  'get me a manager',
  'representative',
];

const ALLERGY_SCRIPT =
  "Thank you for telling me. Because this involves an allergy or medical dietary concern, I don't want to give you incomplete or unsafe information. Let me connect you with the restaurant team.";

const EMERGENCY_SCRIPT =
  "If this is a life-threatening emergency, please hang up and dial 9 1 1 right now. I'm alerting the restaurant team immediately.";

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Deterministic safety gate over a caller utterance. Runs BEFORE and
 * independently of any LLM intent classification. Emergency and allergy are
 * detected from language directly so a misclassification can never suppress a
 * safety escalation.
 */
export function classifyEscalation(utterance: string): EscalationDecision {
  const text = (utterance || '').toLowerCase();

  if (containsAny(text, EMERGENCY_TERMS)) {
    return {
      escalate: true,
      reason: 'EMERGENCY',
      target: { role: 'EMERGENCY_ESCALATION', severity: 'EMERGENCY' },
      script: EMERGENCY_SCRIPT,
    };
  }

  if (containsAny(text, ALLERGY_TERMS)) {
    return {
      escalate: true,
      reason: 'ALLERGY_OR_DIETARY_CONCERN',
      target: { role: 'MANAGER_ON_DUTY', severity: 'HIGH' },
      script: ALLERGY_SCRIPT,
    };
  }

  if (containsAny(text, HUMAN_REQUEST_TERMS)) {
    return {
      escalate: true,
      reason: 'HUMAN_REQUEST',
      target: { role: 'HOST_STAND', severity: 'NORMAL' },
    };
  }

  return { escalate: false, reason: '', target: null };
}

/** Escalation decision for an already-classified intent (used after the LLM classifies). */
export function escalationForIntent(intent: CoreIntent): EscalationDecision {
  const target = ESCALATION_INTENTS[intent];
  if (!target) return { escalate: false, reason: '', target: null };
  return {
    escalate: true,
    reason: intent,
    target,
    script: intent === 'ALLERGY_OR_DIETARY_CONCERN' ? ALLERGY_SCRIPT : intent === 'EMERGENCY' ? EMERGENCY_SCRIPT : undefined,
  };
}

/**
 * After two failed clarification attempts the call must escalate rather than
 * loop. The voice agent passes its running count of low-confidence turns.
 */
export function shouldEscalateAfterClarification(clarificationAttempts: number): boolean {
  return clarificationAttempts >= 2;
}
