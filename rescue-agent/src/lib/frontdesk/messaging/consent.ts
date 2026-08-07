import type { TenantConfig } from '../config/schema';

/**
 * CONSENT AND OPT-OUT
 *
 * The rule this file enforces: **no outbound message is sent without checking
 * consent first**, and STOP always wins. Getting this wrong is not a bug with
 * a bad user experience — it is a regulatory exposure for the restaurant and a
 * reputational one for Winners Bookmark.
 *
 * NOT LEGAL ADVICE. The policy encoded here is a defensible default for US
 * A2P messaging (honour STOP immediately and permanently; treat a customer
 * contacting the business as implied consent for a bounded operational reply).
 * Each restaurant remains responsible for confirming its own obligations, and
 * the thresholds are per-tenant configuration precisely so they can be
 * tightened without a code change.
 *
 * Consent is scoped per (tenant, number). Opting out of one restaurant must
 * never silence another — they are separate businesses that happen to share
 * this platform.
 */

export type ConsentStatus = 'UNKNOWN' | 'IMPLIED' | 'OPTED_IN' | 'OPTED_OUT';

export type MessagePurpose = 'ESCALATION_ALERT' | 'MISSED_CALL_RECOVERY' | 'CONVERSATION_REPLY';

/** Standard opt-out keywords. Matched on the whole message, case-insensitive. */
const DEFAULT_STOP_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'OPT-OUT'];

/** Re-subscribe keywords. */
const START_KEYWORDS = ['START', 'YES', 'UNSTOP', 'OPTIN', 'OPT-IN'];

/** Help keywords, which carriers expect to be answered. */
const HELP_KEYWORDS = ['HELP', 'INFO'];

export type InboundKeyword = 'STOP' | 'START' | 'HELP' | 'NONE';

/**
 * Classify an inbound message for consent purposes.
 *
 * Deliberately strict: only a message that is ESSENTIALLY just the keyword
 * counts. "Stop by around 7?" is a reservation enquiry, not an opt-out, and
 * treating it as one would silence a paying customer. Carriers expect the bare
 * keyword, so requiring it is both safer and closer to the convention.
 */
export function classifyInboundKeyword(message: string, config?: TenantConfig): InboundKeyword {
  // Strip punctuation and whitespace; a trailing "." or "!" is still a keyword.
  const normalised = message.trim().replace(/[.!?,;:]+$/g, '').trim().toUpperCase();
  if (!normalised || normalised.includes(' ')) return 'NONE';

  const stopWords = (config?.messaging.optOutKeywords ?? DEFAULT_STOP_KEYWORDS).map((k) => k.toUpperCase());
  if (stopWords.includes(normalised)) return 'STOP';
  if (START_KEYWORDS.includes(normalised)) return 'START';
  if (HELP_KEYWORDS.includes(normalised)) return 'HELP';
  return 'NONE';
}

export type SendVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'OPTED_OUT' | 'NO_CONSENT' | 'FOLLOW_UP_CAP'; detail: string };

export interface ConsentCheck {
  status: ConsentStatus;
  purpose: MessagePurpose;
  /**
   * Outbound messages sent to this number since their last inbound message.
   * Used for the follow-up cap — the guard against pestering someone who has
   * stopped replying (§VII: "Do not repeatedly message customers who do not
   * engage").
   */
  unansweredOutbound: number;
  config: TenantConfig;
}

export function maySend(check: ConsentCheck): SendVerdict {
  const { status, purpose, unansweredOutbound, config } = check;

  // STOP is absolute and applies to every purpose, including operational
  // alerts. A manager who texted STOP must stop receiving messages; the
  // failure queue then makes it loud that their alerts are not being delivered
  // so an operator fixes the routing rather than the system ignoring consent.
  if (status === 'OPTED_OUT') {
    return {
      allowed: false,
      reason: 'OPTED_OUT',
      detail: 'Recipient has opted out of messages from this restaurant',
    };
  }

  // Staff alerts go to numbers the restaurant configured itself, so there is
  // no prior-contact requirement — only the STOP check above applies.
  if (purpose === 'ESCALATION_ALERT') return { allowed: true };

  // Customer-directed messages need a basis. A customer who called or texted
  // us has established one; a number we have never heard from has not, and
  // messaging it would be a cold outbound the restaurant did not ask for.
  if (status === 'UNKNOWN') {
    return {
      allowed: false,
      reason: 'NO_CONSENT',
      detail: 'No prior contact from this number, so there is no basis to message it',
    };
  }

  const cap = config.messaging.maxFollowUps;
  if (unansweredOutbound >= cap) {
    return {
      allowed: false,
      reason: 'FOLLOW_UP_CAP',
      detail: `Already sent ${unansweredOutbound} message(s) since their last reply (cap ${cap})`,
    };
  }

  return { allowed: true };
}

/** The status an inbound keyword moves a number to, if any. */
export function statusAfterKeyword(keyword: InboundKeyword, current: ConsentStatus): ConsentStatus {
  if (keyword === 'STOP') return 'OPTED_OUT';
  if (keyword === 'START') return 'OPTED_IN';
  // Any other inbound message is contact from the customer, which establishes
  // an implied basis — but never resurrects a number that opted out. Only an
  // explicit START does that.
  if (current === 'OPTED_OUT') return 'OPTED_OUT';
  if (current === 'OPTED_IN') return 'OPTED_IN';
  return 'IMPLIED';
}

/**
 * Confirmations carriers expect. Sent regardless of the consent gate, because
 * acknowledging a STOP is required — it is the one message an opted-out number
 * should still receive.
 */
export function keywordReply(keyword: InboundKeyword, config: TenantConfig): string | null {
  const name = config.brandVoice.restaurantDisplayName ?? config.restaurantName;
  switch (keyword) {
    case 'STOP':
      return `You've been unsubscribed from ${name} messages and won't receive any more. Reply START to opt back in.`;
    case 'START':
      return `You're subscribed to ${name} messages again. Reply STOP at any time to unsubscribe.`;
    case 'HELP':
      return `${name}${config.mainPhone ? ` — call us on ${config.mainPhone}` : ''}. Reply STOP to unsubscribe.`;
    default:
      return null;
  }
}

/** Purposes that message a customer rather than restaurant staff. */
export function isCustomerDirected(purpose: MessagePurpose): boolean {
  return purpose !== 'ESCALATION_ALERT';
}
