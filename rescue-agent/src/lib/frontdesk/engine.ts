import type { TenantConfig } from './config/schema';
import {
  buildAllergyResponse,
  intentRequiresHuman,
  resolveEscalationRoute,
  screenMessage,
} from './guardrails';
import {
  CONFIDENCE_FLOOR,
  detectIntent,
  extractDate,
  extractEmail,
  extractName,
  extractPartySize,
  extractPhone,
  extractTime,
} from './intent';
import { resolveKnowledge, selectLocation } from './knowledge/resolver';
import { buildLeadDraft, isLeadGenerating } from './leads';
import {
  emptySlots,
  type Channel,
  type EscalationDraft,
  type ExtractedSlots,
  type Intent,
  type TurnAction,
  type TurnResult,
} from './types';

/**
 * THE FRONT DESK TURN ENGINE
 *
 * One customer message in, one front-desk turn out. The engine is a pure
 * function: no database, no network, no clock of its own. Everything it needs
 * arrives as arguments, which is what makes the behaviour in §II–§XII
 * testable as ordinary unit tests rather than as prompt evaluations.
 *
 * Replies are composed from templates and verified configuration values, not
 * generated. That is a deliberate MVP constraint and the main structural
 * reason the front desk cannot fabricate a price, an allergen claim or a
 * booking: there is no code path from "customer asked" to "sentence invented".
 * A later phase may pass a composed reply through a model to smooth phrasing,
 * but the facts will still come from here.
 *
 * Stage order is fixed and safety-first:
 *
 *   1. Screen the message (refuse / escalate outright)
 *   2. Detect intent
 *   3. Allergy guardrail
 *   4. Escalation intents (complaint, manager, human request)
 *   5. Revenue intents (slot filling, lead capture)
 *   6. Knowledge resolution against verified config
 *   7. Honest deferral
 */

export interface ConversationTurn {
  role: 'CUSTOMER' | 'ASSISTANT';
  body: string;
  intent?: Intent | null;
}

export interface TurnInput {
  config: TenantConfig;
  message: string;
  /** Prior turns, oldest first. Used to accumulate slots and avoid repetition. */
  history?: ConversationTurn[];
  now: Date;
  channel?: Channel;
}

/** Accumulate everything the customer has told us across the conversation. */
export function accumulateSlots(
  messages: string[],
  now: Date,
  timezone: string,
  seed: ExtractedSlots = emptySlots(),
): ExtractedSlots {
  const slots: ExtractedSlots = { ...seed };
  for (const message of messages) {
    // Later turns win: a customer correcting themselves ("actually make it 6")
    // should overwrite the earlier value rather than be ignored.
    slots.customerName = extractName(message) ?? slots.customerName;
    slots.phone = extractPhone(message) ?? slots.phone;
    slots.email = extractEmail(message) ?? slots.email;
    slots.partySize = extractPartySize(message) ?? slots.partySize;
    slots.requestedTime = extractTime(message) ?? slots.requestedTime;
    const date = extractDate(message, now, timezone);
    slots.requestedDate = date.iso ?? slots.requestedDate;
    slots.requestedDateText = date.text ?? slots.requestedDateText;
  }
  return slots;
}

type SlotName = 'partySize' | 'requestedDate' | 'requestedTime' | 'customerName' | 'phone';

/**
 * What must be collected before a lead is worth handing to staff, and the
 * order to ask in. Deliberately short — every extra question is a chance for
 * the customer to give up (§VIII: avoid unnecessary collection).
 */
const REQUIRED_SLOTS: Record<string, SlotName[]> = {
  RESERVATION: ['partySize', 'requestedDate', 'requestedTime', 'customerName', 'phone'],
  LARGE_PARTY: ['partySize', 'requestedDate', 'requestedTime', 'customerName', 'phone'],
  CATERING: ['requestedDate', 'partySize', 'customerName', 'phone'],
  PRIVATE_EVENT: ['requestedDate', 'partySize', 'customerName', 'phone'],
  TAKEOUT: ['customerName', 'phone'],
  DELIVERY: ['customerName', 'phone'],
  GENERAL: ['customerName', 'phone'],
  COMPLAINT_RECOVERY: ['customerName', 'phone'],
};

const SLOT_QUESTIONS: Record<SlotName, string> = {
  partySize: 'How many people will be joining you?',
  requestedDate: 'What date did you have in mind?',
  requestedTime: 'And what time works best?',
  customerName: 'Can I get a name for the booking?',
  phone: "What's the best phone number to reach you on?",
};

const CATERING_SLOT_QUESTIONS: Partial<Record<SlotName, string>> = {
  partySize: 'Roughly how many people are you looking to feed?',
  requestedDate: 'What date is the event?',
  customerName: 'Can I get your name?',
  phone: "What's the best number for our catering team to reach you?",
};

function nextMissingSlot(category: string, slots: ExtractedSlots): SlotName | null {
  const required = REQUIRED_SLOTS[category] ?? REQUIRED_SLOTS.GENERAL;
  for (const slot of required) {
    if (slot === 'requestedDate') {
      if (!slots.requestedDate && !slots.requestedDateText) return slot;
      continue;
    }
    if (!slots[slot]) return slot;
  }
  return null;
}

/** Wording for categories where "for the booking" would make no sense. */
const NON_BOOKING_SLOT_QUESTIONS: Partial<Record<SlotName, string>> = {
  customerName: 'Can I get your name?',
};

function questionFor(category: string, slot: SlotName): string {
  if (category === 'CATERING' || category === 'PRIVATE_EVENT') {
    return CATERING_SLOT_QUESTIONS[slot] ?? SLOT_QUESTIONS[slot];
  }
  if (category === 'TAKEOUT' || category === 'DELIVERY' || category === 'GENERAL' || category === 'COMPLAINT_RECOVERY') {
    return NON_BOOKING_SLOT_QUESTIONS[slot] ?? SLOT_QUESTIONS[slot];
  }
  return SLOT_QUESTIONS[slot];
}

/** Human-friendly echo of what we captured, for the confirmation line. */
function describeRequest(slots: ExtractedSlots): string {
  const parts: string[] = [];
  if (slots.partySize) parts.push(`${slots.partySize} ${slots.partySize === 1 ? 'person' : 'people'}`);
  const when = slots.requestedDateText ?? slots.requestedDate;
  if (when) parts.push(when);
  if (slots.requestedTime) {
    const [h, m] = slots.requestedTime.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    parts.push(`at ${m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`}`);
  }
  return parts.join(', ');
}

function escalationDraft(
  config: TenantConfig,
  slots: ExtractedSlots,
  draft: Omit<EscalationDraft, 'routeTo' | 'customerName' | 'contact'> & { routeKey: string },
): EscalationDraft {
  return {
    reason: draft.reason,
    severity: draft.severity,
    summary: draft.summary,
    customerName: slots.customerName,
    contact: slots.phone ?? slots.email,
    routeTo: resolveEscalationRoute(config, draft.routeKey),
  };
}

/** Offer the most useful verified next step without listing a menu of options. */
function offerNextStep(config: TenantConfig): string {
  if (config.reservations.enabled) return 'Would you like help with a reservation?';
  if (config.takeout.enabled || config.delivery.enabled) return 'Would you like to place an order?';
  return 'Is there anything else I can help you with?';
}

const CONTACT_ASK = 'Can I take your name and the best number to reach you, so the team can follow up?';

export function runTurn(input: TurnInput): TurnResult {
  const { config, message, now, history = [] } = input;
  const timezone = selectLocation(config, message)?.timezone ?? config.locations[0]?.timezone ?? 'UTC';

  const customerMessages = [...history.filter((t) => t.role === 'CUSTOMER').map((t) => t.body), message];
  const slots = accumulateSlots(customerMessages, now, timezone);

  const base = {
    slots,
    secondaryIntents: [] as Intent[],
    actions: [] as TurnAction[],
    needsHuman: false,
    bookingState: 'NONE' as const,
  };

  // --- Stage 1: screening ---------------------------------------------------
  const verdict = screenMessage(message, config);

  if (verdict.action === 'REFUSE') {
    return {
      ...base,
      reply: verdict.reply,
      intent: 'UNKNOWN',
      answerSource: 'REFUSED',
    };
  }

  if (verdict.action === 'ESCALATE') {
    const routeKey = verdict.reason === 'FOOD_SAFETY' || verdict.reason === 'EMERGENCY' ? 'urgent' : 'manager';
    const escalation = escalationDraft(config, slots, {
      reason: verdict.reason,
      severity: verdict.severity,
      summary: verdict.summary,
      routeKey,
    });
    const actions: TurnAction[] = [{ type: 'ESCALATE', escalation }];
    // A food-safety or refund conversation is also a recovery opportunity —
    // the owner needs it in the pipeline, not only in the escalation queue.
    if (verdict.reason !== 'HARASSMENT') {
      actions.push({
        type: 'CAPTURE_LEAD',
        lead: buildLeadDraft('COMPLAINT', slots, config, verdict.summary),
      });
    }
    return {
      ...base,
      reply: escalationReply(verdict.reason, slots),
      intent: verdict.reason === 'REFUND_REQUEST' || verdict.reason === 'PAYMENT_DISPUTE' ? 'COMPLAINT' : 'COMPLAINT',
      answerSource: 'ESCALATED',
      actions,
      needsHuman: true,
    };
  }

  // --- Stage 2: intent ------------------------------------------------------
  //
  // Mid-conversation, customers answer questions tersely: asked "what date?",
  // they reply "Friday". In isolation that classifies as UNKNOWN, and treating
  // it as a fresh unclear enquiry would restart the conversation and lose the
  // booking. So an unclassifiable message inherits the revenue intent already
  // in progress. A message that classifies on its own is never overridden — a
  // customer who switches to "do you have parking?" gets a parking answer.
  const detected = detectIntent(message);
  const inherited = detected.intent === 'UNKNOWN' ? activeRevenueIntent(history) : null;
  const intent = inherited ?? detected.intent;
  const withIntent = { ...base, intent, secondaryIntents: detected.secondary };

  // --- Stage 3: allergy -----------------------------------------------------
  if (intent === 'ALLERGY') {
    const allergy = buildAllergyResponse(message, config);
    const actions: TurnAction[] = [];
    if (allergy.escalate) {
      actions.push({
        type: 'ESCALATE',
        escalation: escalationDraft(config, slots, {
          reason: 'ALLERGY_UNCERTAINTY',
          severity: allergy.severity,
          summary: 'Customer reported a serious allergy and needs to speak with the kitchen',
          routeKey: 'manager',
        }),
      });
    }
    return {
      ...withIntent,
      reply: allergy.reply,
      answerSource: allergy.escalate ? 'ESCALATED' : 'UNVERIFIED_DEFERRED',
      actions,
      needsHuman: allergy.escalate,
    };
  }

  // --- Stage 4: intents that always reach a human ---------------------------
  if (intentRequiresHuman(intent)) {
    const reasonByIntent = {
      COMPLAINT: 'COMPLAINT',
      MANAGER_REQUEST: 'CUSTOMER_REQUESTED_HUMAN',
      HUMAN_ASSISTANCE: 'CUSTOMER_REQUESTED_HUMAN',
      LOST_PROPERTY: 'CUSTOMER_REQUESTED_HUMAN',
    } as const;

    const escalation = escalationDraft(config, slots, {
      reason: reasonByIntent[intent as keyof typeof reasonByIntent],
      severity: intent === 'COMPLAINT' ? 'HIGH' : 'STANDARD',
      summary:
        intent === 'COMPLAINT'
          ? 'Customer raised a complaint'
          : intent === 'LOST_PROPERTY'
            ? 'Customer is looking for a lost item'
            : 'Customer asked to speak with a person',
      routeKey: 'manager',
    });

    const actions: TurnAction[] = [{ type: 'ESCALATE', escalation }];
    if (intent === 'COMPLAINT') {
      actions.push({
        type: 'CAPTURE_LEAD',
        lead: buildLeadDraft('COMPLAINT', slots, config, truncate(message, 400)),
      });
    }

    return {
      ...withIntent,
      reply: humanRequestReply(intent, slots),
      answerSource: 'ESCALATED',
      actions,
      needsHuman: true,
    };
  }

  // --- Stage 5: revenue intents --------------------------------------------
  if (isLeadGenerating(intent)) {
    return handleRevenueIntent(intent, config, slots, message, now, detected.secondary, history);
  }

  // --- Stage 6: verified knowledge -----------------------------------------
  if (detected.confidence >= CONFIDENCE_FLOOR || intent === 'UNKNOWN') {
    const knowledge = resolveKnowledge(intent, config, message, now);
    if (knowledge.resolved) {
      const followUp = knowledge.followUp ? ` ${knowledge.followUp}` : '';
      const nextStep = shouldOfferNextStep(intent) ? ` ${offerNextStep(config)}` : '';
      const actions: TurnAction[] = [];
      // Review eligibility is flagged, never spoken. Phase 3 decides whether
      // and when to send — the front desk does not pressure customers (§XIII).
      if (config.reviewLink && history.length >= 2) actions.push({ type: 'OFFER_REVIEW' });
      return {
        ...withIntent,
        reply: `${knowledge.text}${followUp}${nextStep}`.trim(),
        answerSource: knowledge.source,
        actions,
      };
    }
  }

  // --- Stage 7: honest deferral --------------------------------------------
  // Low confidence on a short message is worth one clarifying question before
  // handing off — most of the time the customer just typed tersely.
  if (intent === 'UNKNOWN' && message.trim().split(/\s+/).length <= 3) {
    return {
      ...withIntent,
      reply: `Happy to help — what would you like to know? I can cover hours, directions, the menu${
        config.reservations.enabled ? ', or a reservation' : ''
      }.`,
      answerSource: 'CLARIFYING',
    };
  }

  return {
    ...withIntent,
    reply: `I don't want to give you incorrect information on that, so I'd rather have the restaurant confirm it for you. ${CONTACT_ASK}`,
    answerSource: 'UNVERIFIED_DEFERRED',
    // Categorises to GENERAL — the intent is carried through so an operator can
    // see what was actually asked that the configuration could not answer.
    actions: [{ type: 'CAPTURE_LEAD', lead: buildLeadDraft(intent, slots, config, truncate(message, 400)) }],
  };
}

/**
 * The revenue intent a conversation is already working on, if any. Scans the
 * customer's own turns newest-first and re-detects rather than trusting a
 * stored label, so the answer is the same in a unit test and in production.
 */
function activeRevenueIntent(history: ConversationTurn[]): Intent | null {
  const customerTurns = history.filter((turn) => turn.role === 'CUSTOMER');
  for (let i = customerTurns.length - 1; i >= 0; i--) {
    const match = detectIntent(customerTurns[i].body);
    if (match.confidence >= CONFIDENCE_FLOOR && isLeadGenerating(match.intent)) return match.intent;
  }
  return null;
}

/** Only offer a next step where it is genuinely useful, not after every answer. */
function shouldOfferNextStep(intent: Intent): boolean {
  return intent === 'HOURS' || intent === 'LOCATION' || intent === 'MENU';
}

function handleRevenueIntent(
  intent: Intent,
  config: TenantConfig,
  slots: ExtractedSlots,
  message: string,
  now: Date,
  secondary: Intent[],
  history: ConversationTurn[],
): TurnResult {
  const draft = buildLeadDraft(intent, slots, config, truncate(message, 400));
  const base = { intent, secondaryIntents: secondary, slots, needsHuman: false };

  // Ordering: when a verified pathway exists, sending the customer there is
  // faster and more accurate than taking the order by conversation.
  if (intent === 'TAKEOUT' || intent === 'DELIVERY') {
    const knowledge = resolveKnowledge(intent, config, message, now);
    if (knowledge.resolved) {
      return {
        ...base,
        reply: knowledge.text,
        answerSource: knowledge.source,
        actions: [],
        bookingState: 'NONE',
      };
    }
    // No configured pathway. Say so plainly and capture the enquiry. Sliding
    // into "can I get a name for the booking?" would imply the restaurant
    // offers a service it has never told us it offers.
    const what = intent === 'DELIVERY' ? 'delivery options' : 'takeout options';
    return {
      ...base,
      reply: `I'm not able to confirm our ${what} from here, and I don't want to give you the wrong information. ${CONTACT_ASK}`,
      answerSource: 'UNVERIFIED_DEFERRED',
      actions: [{ type: 'CAPTURE_LEAD', lead: draft }],
      bookingState: 'NONE',
    };
  }

  if (intent === 'RESERVATION_CHANGE') {
    // Changing an existing booking touches a live record the front desk cannot
    // see. Capturing and routing is the only safe handling.
    return {
      ...base,
      reply: config.reservations.url
        ? `You can change or cancel your booking directly here: ${config.reservations.url} — or I can pass the request to the team. ${CONTACT_ASK}`
        : `I can pass that change to the team so they can update your booking. ${CONTACT_ASK}`,
      answerSource: config.reservations.url ? 'VERIFIED_PATHWAY' : 'CLARIFYING',
      actions: [{ type: 'CAPTURE_LEAD', lead: draft }],
      bookingState: 'REQUESTED',
      needsHuman: true,
    };
  }

  const missing = nextMissingSlot(draft.category, slots);

  if (missing) {
    const question = questionFor(draft.category, missing);

    // LOOP PROTECTION. If the customer has already been asked this exact
    // question twice and the engine still cannot read an answer, asking a
    // third time is not going to work — the extraction is failing, not the
    // customer. Hand the conversation to a person with whatever was collected
    // rather than trapping them in a loop (§XVI: never fail silently, and
    // never retry without bound).
    const timesAsked = history.filter((turn) => turn.role === 'ASSISTANT' && turn.body.includes(question)).length;
    if (timesAsked >= 2) {
      return {
        ...base,
        reply:
          "Let me get a person to help you with this rather than keep asking — I've passed the conversation to the team and someone will follow up shortly.",
        answerSource: 'ESCALATED',
        actions: [
          { type: 'CAPTURE_LEAD', lead: draft },
          {
            type: 'ESCALATE',
            escalation: {
              reason: 'LOW_CONFIDENCE',
              severity: 'STANDARD',
              summary: `Front desk could not collect "${missing}" after repeated attempts — ${draft.category.replace('_', ' ').toLowerCase()} request`,
              customerName: slots.customerName,
              contact: slots.phone ?? slots.email,
              routeTo: resolveEscalationRoute(config, 'manager'),
            },
          },
        ],
        bookingState: 'REQUESTED',
        needsHuman: true,
      };
    }

    // One question at a time (§II). An acknowledgement is added only on the
    // opening turn of the request so the exchange does not become repetitive.
    const opener = openerFor(draft.category, config);
    const alreadyOpened = history.some((turn) => turn.role === 'ASSISTANT' && turn.body.startsWith(opener));
    return {
      ...base,
      reply: alreadyOpened ? question : `${opener} ${question}`,
      answerSource: 'CLARIFYING',
      actions: [],
      bookingState: 'NONE',
    };
  }

  // Everything needed is collected. The language here is load-bearing: the
  // request is REQUESTED, never CONFIRMED, because nothing has booked it (§V).
  const summary = describeRequest(slots);
  const actions: TurnAction[] = [{ type: 'CAPTURE_LEAD', lead: draft }];

  if (draft.priority === 'URGENT' || draft.priority === 'HIGH') {
    actions.push({
      type: 'ESCALATE',
      escalation: {
        reason: 'HIGH_VALUE_OPPORTUNITY',
        severity: draft.priority === 'URGENT' ? 'HIGH' : 'STANDARD',
        summary: `${draft.category.replace('_', ' ').toLowerCase()} request${summary ? ` — ${summary}` : ''}`,
        customerName: slots.customerName,
        contact: slots.phone ?? slots.email,
        routeTo: resolveEscalationRoute(
          config,
          draft.category === 'CATERING' ? 'catering' : draft.category === 'PRIVATE_EVENT' ? 'events' : 'manager',
        ),
      },
    });
  }

  return {
    ...base,
    reply: confirmationReply(draft.category, summary, config),
    answerSource: 'CLARIFYING',
    actions,
    bookingState: 'REQUESTED',
    needsHuman: draft.priority === 'URGENT',
  };
}

function openerFor(category: string, config: TenantConfig): string {
  switch (category) {
    case 'CATERING':
      return "I'd be glad to help with catering.";
    case 'PRIVATE_EVENT':
      return "I'd be glad to help with your event.";
    case 'LARGE_PARTY':
      return 'Happy to help with a larger group.';
    case 'RESERVATION':
      return config.reservations.enabled ? 'Happy to help with a reservation.' : "I can pass a table request to the team.";
    default:
      return 'Happy to help.';
  }
}

function confirmationReply(category: string, summary: string, config: TenantConfig): string {
  const detail = summary ? ` for ${summary}` : '';

  if (category === 'CATERING' || category === 'PRIVATE_EVENT') {
    const who = category === 'CATERING' ? 'catering team' : 'events team';
    return `Thank you — I've passed your request${detail} to our ${who}, and someone will contact you shortly to confirm the details. Nothing is booked yet until they've spoken with you.`;
  }

  if (category === 'LARGE_PARTY') {
    return `Thank you — I've sent your request${detail} to the team. Larger groups are confirmed by a manager, so someone will call you shortly. Your table isn't held until they confirm.`;
  }

  // A direct booking link is still offered where one exists: a customer who
  // books themselves gets an instant confirmation the front desk cannot give.
  const selfServe = config.reservations.enabled && config.reservations.url
    ? ` If you'd like to confirm it yourself right now, you can book here: ${config.reservations.url}`
    : '';

  return `Thank you — I've sent your reservation request${detail} to the restaurant and someone will confirm it with you shortly. Please treat it as requested rather than confirmed until you hear back.${selfServe}`;
}

function escalationReply(reason: string, slots: ExtractedSlots): string {
  const ask = slots.phone
    ? 'A manager will be in touch shortly.'
    : "What's the best number for a manager to reach you on?";

  switch (reason) {
    case 'EMERGENCY':
      return 'If this is an emergency, please call 911 right away. I am alerting the restaurant team now.';
    case 'FOOD_SAFETY':
      // No diagnosis, no liability, no minimising — acknowledge and route (§XI, §XII).
      return `I'm very sorry to hear that, and I'm making sure the management team sees this straight away. If you are unwell, please speak to a medical professional. ${ask}`;
    case 'HARASSMENT':
      return "I'm ending this conversation here. If you need to reach the restaurant, please contact them directly.";
    case 'LEGAL_THREAT':
      return `I understand, and I want to make sure this reaches the right person rather than being handled by me. I'm passing it to management now. ${ask}`;
    case 'MEDIA_INQUIRY':
      return `Thanks for reaching out — press enquiries are handled by our management team rather than by me. ${slots.phone ? "They'll be in touch." : 'What is the best way to reach you?'}`;
    case 'REFUND_REQUEST':
    case 'PAYMENT_DISPUTE':
      // Never promises money back — that decision belongs to the restaurant.
      return `I'm sorry about that. I'm not able to make a decision on billing myself, so I'm passing this to a manager who can look into it properly. ${ask}`;
    default:
      return `I want to make sure this reaches the right person. ${ask}`;
  }
}

function humanRequestReply(intent: Intent, slots: ExtractedSlots): string {
  const ask = slots.phone
    ? "I've passed your details along and someone will get back to you shortly."
    : 'Can I get your name and the best number to reach you?';

  switch (intent) {
    case 'COMPLAINT':
      // ACKNOWLEDGE → CLARIFY → CAPTURE → ESCALATE (§XI).
      return `I'm sorry to hear that — thank you for telling us. I'd like to make sure the restaurant gets the full details. ${
        slots.phone ? 'A manager will follow up with you directly.' : 'May I get your name and the best number for a manager to reach you?'
      }`;
    case 'LOST_PROPERTY':
      return `I'm sorry — I can pass that to the team so they can check the lost and found. ${ask}`;
    default:
      return `Of course. ${ask}`;
  }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}
