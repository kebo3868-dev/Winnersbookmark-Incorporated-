import { routeOrdering } from '../ordering/routing';
import type { Faq, Location, Pathway, TenantConfig } from '../config/schema';
import type { AnswerSource, Intent } from '../types';
import { formatTime, formatWeek, formatWindows, resolveHours, tenantTimezone, weekdayLabel } from './hours';

/**
 * VERIFIED-KNOWLEDGE RESOLUTION (§IV, §XXIX)
 *
 * Every restaurant-specific answer is produced here, and every one of them is
 * built from a value that an operator explicitly entered. There is no fallback
 * that generates plausible text. When configuration is missing, this returns
 * `resolved: false`, and the engine turns that into an honest deferral.
 *
 * The internal question the spec asks for — "DO I HAVE VERIFIED DATA?" — is
 * structural here rather than a matter of prompt discipline: the function has
 * no source of restaurant facts other than the config object it was handed.
 */

export interface ResolvedAnswer {
  resolved: true;
  text: string;
  source: AnswerSource;
  /** Verified follow-up worth offering, e.g. a booking link. */
  followUp?: string;
}

export interface UnresolvedAnswer {
  resolved: false;
  /** What was missing — surfaced to operators, never to customers. */
  missing: string;
}

export type KnowledgeResult = ResolvedAnswer | UnresolvedAnswer;

const unresolved = (missing: string): UnresolvedAnswer => ({ resolved: false, missing });

/** Single location, or the one whose city the customer named. */
export function selectLocation(config: TenantConfig, message?: string): Location | null {
  if (config.locations.length === 0) return null;
  if (config.locations.length === 1 || !message) return config.locations[0];
  const text = message.toLowerCase();
  const named = config.locations.find(
    (l) => text.includes(l.city.toLowerCase()) || text.includes(l.name.toLowerCase()),
  );
  return named ?? config.locations[0];
}

/** Render a configured pathway as a customer-facing sentence, or null. */
function pathwayText(pathway: Pathway, lead: string): string | null {
  if (!pathway.enabled) return null;
  if (pathway.note) return pathway.note;
  if (pathway.url) return `${lead} ${pathway.url}`;
  if (pathway.phone) return `${lead} give us a call at ${pathway.phone}.`;
  return null;
}

// --- Hours -----------------------------------------------------------------

function answerHours(config: TenantConfig, message: string, now: Date): KnowledgeResult {
  const location = selectLocation(config, message);
  if (!location) return unresolved('No location configured');
  if (!location.hours && location.holidayHours.length === 0) return unresolved('No hours configured');

  const wantsWeek = /\b(week|every ?day|all week|what (are|were) your hours|full schedule|normal hours|regular hours)\b/i.test(message);
  if (wantsWeek) {
    const week = formatWeek(location);
    if (!week) return unresolved('No weekly hours configured');
    return { resolved: true, text: `Here are our hours:\n${week}`, source: 'VERIFIED_CONFIG' };
  }

  const answer = resolveHours(location, now);
  const dayName = weekdayLabel(answer.weekday);

  switch (answer.status) {
    case 'OPEN': {
      const closes = answer.closesAt ? `We're open now and close at ${formatTime(answer.closesAt)}` : "We're open now";
      const holiday = answer.holidayName ? ` (${answer.holidayName} hours today)` : '';
      return { resolved: true, text: `${closes} tonight${holiday}.`, source: 'VERIFIED_CONFIG' };
    }
    case 'CLOSED_NOW': {
      if (answer.opensAt) {
        return {
          resolved: true,
          text: `We're closed at the moment — we open today at ${formatTime(answer.opensAt)}${
            answer.closesAt ? ` and close at ${formatTime(answer.closesAt)}` : ''
          }.`,
          source: 'VERIFIED_CONFIG',
        };
      }
      // No further window today. Avoid "closed for the evening" — a café that
      // shuts at 3 PM would be describing the wrong part of the day.
      return {
        resolved: true,
        text: `We're closed now. Our ${dayName} hours are ${formatWindows(answer.windows)}.`,
        source: 'VERIFIED_CONFIG',
      };
    }
    case 'CLOSED_TODAY': {
      const because = answer.holidayName ? ` for ${answer.holidayName}` : '';
      const note = answer.note ? ` ${answer.note}` : '';
      return { resolved: true, text: `We're closed today${because}.${note}`, source: 'VERIFIED_CONFIG' };
    }
    default:
      // A date with no configured hours. Repeating the weekly schedule here
      // would be a guess, and holidays are exactly when that guess is wrong.
      return unresolved(`No hours configured for ${answer.localDate}`);
  }
}

// --- Location, directions, parking, accessibility --------------------------

function formatAddress(location: Location): string {
  return [
    location.addressLine1,
    location.addressLine2,
    `${location.city}, ${location.state}${location.postalCode ? ` ${location.postalCode}` : ''}`,
  ]
    .filter(Boolean)
    .join(', ');
}

function answerLocation(config: TenantConfig, message: string): KnowledgeResult {
  if (config.locations.length === 0) return unresolved('No location configured');
  if (config.locations.length > 1 && !/\b(closest|nearest|which|how many)\b/i.test(message)) {
    const list = config.locations.map((l) => `${l.name}: ${formatAddress(l)}`).join('\n');
    return { resolved: true, text: `We have ${config.locations.length} locations:\n${list}`, source: 'VERIFIED_CONFIG' };
  }
  const location = selectLocation(config, message)!;
  return {
    resolved: true,
    text: `We're at ${formatAddress(location)}.`,
    source: 'VERIFIED_CONFIG',
    followUp: location.mapUrl ?? undefined,
  };
}

function answerDirections(config: TenantConfig, message: string): KnowledgeResult {
  const location = selectLocation(config, message);
  if (!location) return unresolved('No location configured');
  const parts = [`We're at ${formatAddress(location)}.`];
  if (location.directionsNote) parts.push(location.directionsNote);
  if (location.mapUrl) parts.push(`Directions: ${location.mapUrl}`);
  return { resolved: true, text: parts.join(' '), source: 'VERIFIED_CONFIG' };
}

function answerParking(config: TenantConfig, message: string): KnowledgeResult {
  const location = selectLocation(config, message);
  if (!location?.parkingNote) return unresolved('No parking information configured');
  return { resolved: true, text: location.parkingNote, source: 'VERIFIED_CONFIG' };
}

function answerAccessibility(config: TenantConfig, message: string): KnowledgeResult {
  const location = selectLocation(config, message);
  if (!location?.accessibilityNote) return unresolved('No accessibility information configured');
  return { resolved: true, text: location.accessibilityNote, source: 'VERIFIED_CONFIG' };
}

// --- Menu, pricing, dietary ------------------------------------------------

function answerMenu(config: TenantConfig): KnowledgeResult {
  const { url, summary, highlights } = config.menu;
  if (!url && !summary && highlights.length === 0) return unresolved('No menu information configured');

  const parts: string[] = [];
  if (summary) parts.push(summary);
  else if (highlights.length > 0) parts.push(`We're known for ${highlights.slice(0, 3).join(', ')}.`);
  if (url) parts.push(`You can see the full menu here: ${url}`);
  else parts.push('I can have someone go through the menu with you if there is something specific you are after.');

  return { resolved: true, text: parts.join(' '), source: 'VERIFIED_CONFIG' };
}

function answerPricing(config: TenantConfig): KnowledgeResult {
  // Prices are never inferred from an average check or a menu summary — a
  // wrong price quoted to a customer becomes an argument at the table.
  if (config.menu.pricingNote) {
    return { resolved: true, text: config.menu.pricingNote, source: 'VERIFIED_CONFIG' };
  }
  if (config.menu.url) {
    return {
      resolved: true,
      text: `Current prices are on our menu here: ${config.menu.url}`,
      source: 'VERIFIED_PATHWAY',
    };
  }
  return unresolved('No pricing note or menu link configured');
}

function answerDietary(config: TenantConfig): KnowledgeResult {
  if (config.menu.dietaryOptions.length === 0) return unresolved('No dietary options configured');
  return {
    resolved: true,
    text: `Yes — we have ${config.menu.dietaryOptions.join(', ')}. If you let the kitchen know when you arrive, they can talk you through the options.`,
    source: 'VERIFIED_CONFIG',
  };
}

// --- Commercial pathways ---------------------------------------------------

// Ordering goes through routeOrdering so a recognised vendor can be named
// ("order through Toast") instead of the customer following an unexplained
// link. Presentation only: the destination is always the configured URL, and an
// unrecognised host degrades to the previous plain wording. Returning null
// still means "not configured", so the honest deferral is untouched.
function answerTakeout(config: TenantConfig): KnowledgeResult {
  const route = routeOrdering(config.takeout, 'takeout');
  if (!route) return unresolved('Takeout pathway not configured');
  return { resolved: true, text: route.text, source: 'VERIFIED_PATHWAY' };
}

function answerDelivery(config: TenantConfig): KnowledgeResult {
  const route = routeOrdering(config.delivery, 'delivery');
  if (!route) return unresolved('Delivery pathway not configured');
  return { resolved: true, text: route.text, source: 'VERIFIED_PATHWAY' };
}

function answerGiftCard(config: TenantConfig): KnowledgeResult {
  const text = pathwayText(config.giftCards, 'You can buy a gift card here:');
  if (!text) return unresolved('Gift card pathway not configured');
  return { resolved: true, text, source: 'VERIFIED_PATHWAY' };
}

function answerEmployment(config: TenantConfig): KnowledgeResult {
  const text = pathwayText(config.employment, 'You can apply here:');
  if (!text) return unresolved('Employment pathway not configured');
  return { resolved: true, text, source: 'VERIFIED_PATHWAY' };
}

/** Promotions are only mentioned inside their configured window. */
function answerSpecials(config: TenantConfig, now: Date, timezone: string): KnowledgeResult {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const active = config.promotions.filter(
    (p) => (!p.startsOn || p.startsOn <= today) && (!p.endsOn || p.endsOn >= today),
  );
  if (active.length === 0) return unresolved('No active promotion configured');
  return {
    resolved: true,
    text: active.map((p) => `${p.title}: ${p.details}`).join('\n'),
    source: 'VERIFIED_CONFIG',
  };
}

// --- FAQ -------------------------------------------------------------------

/**
 * Operator-controlled keyword retrieval. Scoring is transparent so a
 * restaurant can predict which FAQ fires — an owner who cannot explain why the
 * front desk said something will not trust it.
 */
export function matchFaq(message: string, faqs: Faq[]): Faq | null {
  const text = message.toLowerCase();
  let best: { faq: Faq; score: number } | null = null;

  for (const faq of faqs) {
    let score = 0;
    for (const keyword of faq.keywords) {
      const term = keyword.toLowerCase().trim();
      if (!term) continue;
      // Multi-word keywords are phrases; single words match on word boundaries
      // so "tab" does not match "table".
      const hit = term.includes(' ')
        ? text.includes(term)
        : new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
      if (hit) score += term.includes(' ') ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { faq, score };
  }
  return best?.faq ?? null;
}

function answerFaq(config: TenantConfig, message: string): KnowledgeResult {
  const faq = matchFaq(message, config.faqs);
  if (!faq) return unresolved('No matching FAQ');
  return { resolved: true, text: faq.answer, source: 'VERIFIED_FAQ' };
}

// --- Entry point -----------------------------------------------------------

/**
 * Resolve an intent against verified configuration.
 *
 * ALLERGY is absent by design — it is handled by the guardrail module before
 * the pipeline reaches knowledge resolution, so no code path can answer an
 * allergen question from menu data.
 */
export function resolveKnowledge(
  intent: Intent,
  config: TenantConfig,
  message: string,
  now: Date,
): KnowledgeResult {
  const timezone = tenantTimezone(config);

  switch (intent) {
    case 'HOURS':
      return answerHours(config, message, now);
    case 'LOCATION':
      return answerLocation(config, message);
    case 'DIRECTIONS':
      return answerDirections(config, message);
    case 'PARKING':
      return answerParking(config, message);
    case 'ACCESSIBILITY':
      return answerAccessibility(config, message);
    case 'MENU':
      return answerMenu(config);
    case 'PRICING':
      return answerPricing(config);
    case 'DIETARY':
      return answerDietary(config);
    case 'TAKEOUT':
      return answerTakeout(config);
    case 'DELIVERY':
      return answerDelivery(config);
    case 'GIFT_CARD':
      return answerGiftCard(config);
    case 'EMPLOYMENT':
      return answerEmployment(config);
    case 'SPECIALS':
      // A promotion is bounded by calendar dates, so answering needs to know
      // which calendar day it is for this restaurant. Without a configured
      // timezone we would be reading the date off UTC and could announce a
      // promotion that has not started, or one that ended last night.
      return timezone
        ? answerSpecials(config, now, timezone)
        : unresolved("No location timezone configured, so today's date is unknown");
    case 'FAQ':
    case 'UNKNOWN':
      return answerFaq(config, message);
    default:
      return unresolved(`Intent ${intent} is not answered from static configuration`);
  }
}
