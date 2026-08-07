/**
 * WINNERS BOOKMARK AI FRONT DESK — shared domain types.
 *
 * These describe the *engine's* vocabulary. Nothing here knows about a
 * specific restaurant: every restaurant-specific fact arrives as a
 * TenantConfig (see config/schema.ts). That separation is what lets
 * restaurant #2 through #100 onboard by adding configuration rather than code.
 */

/** Every intent the front desk can recognise. */
export const INTENTS = [
  'HOURS',
  'LOCATION',
  'DIRECTIONS',
  'PARKING',
  'MENU',
  'PRICING',
  'DIETARY',
  'ALLERGY',
  'RESERVATION',
  'RESERVATION_CHANGE',
  'TAKEOUT',
  'DELIVERY',
  'CATERING',
  'PRIVATE_EVENT',
  'LARGE_PARTY',
  'GIFT_CARD',
  'SPECIALS',
  'EMPLOYMENT',
  'LOST_PROPERTY',
  'COMPLAINT',
  'MANAGER_REQUEST',
  'ACCESSIBILITY',
  'FAQ',
  'HUMAN_ASSISTANCE',
  'UNKNOWN',
] as const;

export type Intent = (typeof INTENTS)[number];

/**
 * Where an answer came from. Every assistant turn records one of these so an
 * operator can audit whether the front desk spoke from verified data or
 * correctly declined to. This is the anti-hallucination audit trail (§XXIX).
 */
export type AnswerSource =
  /** Answered from the restaurant's verified configuration. */
  | 'VERIFIED_CONFIG'
  /** Answered from a restaurant-approved FAQ entry. */
  | 'VERIFIED_FAQ'
  /** Handed the customer a verified pathway (ordering link, booking page). */
  | 'VERIFIED_PATHWAY'
  /** Asked the customer a question to move an intent forward. */
  | 'CLARIFYING'
  /** Data was not configured — declined to answer and offered follow-up. */
  | 'UNVERIFIED_DEFERRED'
  /** Routed to a human per escalation policy. */
  | 'ESCALATED'
  /** Refused an unsafe or out-of-bounds request. */
  | 'REFUSED';

export type Channel = 'WEB' | 'SMS' | 'VOICE';

export const LEAD_CATEGORIES = [
  'RESERVATION',
  'LARGE_PARTY',
  'CATERING',
  'PRIVATE_EVENT',
  'TAKEOUT',
  'DELIVERY',
  'GENERAL',
  'COMPLAINT_RECOVERY',
] as const;

export type LeadCategory = (typeof LEAD_CATEGORIES)[number];

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'BOOKED',
  'WON',
  'LOST',
  'CLOSED',
  'ESCALATED',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadPriority = 'STANDARD' | 'HIGH' | 'URGENT';

/**
 * Why a conversation left automation. Kept as a closed list so escalation
 * routing and reporting cannot drift apart.
 */
export const ESCALATION_REASONS = [
  'CUSTOMER_REQUESTED_HUMAN',
  'COMPLAINT',
  'FOOD_SAFETY',
  'ALLERGY_UNCERTAINTY',
  'REFUND_REQUEST',
  'PAYMENT_DISPUTE',
  'LEGAL_THREAT',
  'MEDIA_INQUIRY',
  'EMERGENCY',
  'HARASSMENT',
  'LOW_CONFIDENCE',
  'HIGH_VALUE_OPPORTUNITY',
] as const;

export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export type EscalationSeverity = 'STANDARD' | 'HIGH' | 'CRITICAL';

/** Facts the engine extracts from customer messages, accumulated per conversation. */
export interface ExtractedSlots {
  customerName: string | null;
  phone: string | null;
  email: string | null;
  partySize: number | null;
  /** ISO date (YYYY-MM-DD) when confidently resolvable, else the raw phrase. */
  requestedDate: string | null;
  requestedDateText: string | null;
  requestedTime: string | null;
}

export function emptySlots(): ExtractedSlots {
  return {
    customerName: null,
    phone: null,
    email: null,
    partySize: null,
    requestedDate: null,
    requestedDateText: null,
    requestedTime: null,
  };
}

/** A lead the engine wants captured. The persistence layer assigns ids. */
export interface LeadDraft {
  category: LeadCategory;
  intent: Intent;
  priority: LeadPriority;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  partySize: number | null;
  requestedDate: string | null;
  requestedTime: string | null;
  notes: string;
  /** ESTIMATED opportunity value in cents. Never presented as booked revenue. */
  estimatedValueCents: number | null;
}

export interface EscalationDraft {
  reason: EscalationReason;
  severity: EscalationSeverity;
  summary: string;
  customerName: string | null;
  contact: string | null;
  /** Config key of the contact this should route to, e.g. "catering". */
  routeTo: string;
}

export type TurnAction =
  | { type: 'CAPTURE_LEAD'; lead: LeadDraft }
  | { type: 'ESCALATE'; escalation: EscalationDraft }
  | { type: 'OFFER_REVIEW' };

/** One customer turn in, one front-desk turn out. */
export interface TurnResult {
  reply: string;
  intent: Intent;
  secondaryIntents: Intent[];
  answerSource: AnswerSource;
  actions: TurnAction[];
  slots: ExtractedSlots;
  /** True when the conversation should stop automating. */
  needsHuman: boolean;
  /**
   * Reservation/ordering language must never imply a booking exists.
   * REQUESTED = captured for the restaurant. CONFIRMED is only ever set by a
   * real booking integration acknowledging the booking (§V).
   */
  bookingState: 'NONE' | 'REQUESTED' | 'CONFIRMED';
}
