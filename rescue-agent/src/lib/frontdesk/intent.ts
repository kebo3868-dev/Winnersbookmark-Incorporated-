import type { Intent } from './types';

/**
 * INTENT DETECTION (§III)
 *
 * Deterministic and rule-based on purpose. This mirrors the decision already
 * made elsewhere in this codebase: deterministic code owns classification and
 * routing, and the optional AI layer only ever improves phrasing. A keyword
 * rule that misfires is debuggable and fixable in one commit; a model that
 * misroutes an allergy question to "menu" is neither.
 *
 * Rules are ordered by consequence, not by likelihood. Safety-critical intents
 * (allergy, complaint, human request) are evaluated before commercial ones so
 * that "I want to book a table for my son who is allergic to peanuts" routes to
 * the allergy path rather than the reservation path.
 */

export interface IntentMatch {
  intent: Intent;
  /** 0-100. Below CONFIDENCE_FLOOR the engine clarifies instead of answering. */
  confidence: number;
  /** Everything else that matched, so one message can carry several intents. */
  secondary: Intent[];
}

export const CONFIDENCE_FLOOR = 55;

interface Rule {
  intent: Intent;
  /** Weight applied when a pattern hits. Higher = more decisive. */
  weight: number;
  patterns: RegExp[];
}

/**
 * Ordered by safety consequence. Ties are broken by the order in this array,
 * so an earlier rule wins a dead heat.
 */
const RULES: Rule[] = [
  {
    intent: 'ALLERGY',
    weight: 100,
    patterns: [
      /\ballerg(y|ies|ic|en|ens)\b/i,
      /\banaphyla/i,
      /\bceliac\b|\bcoeliac\b/i,
      /\b(peanuts?|tree ?nuts?|shellfish|glutens?|dairy|soy|sesame|eggs?)\b.*\b(free|safe|contain|avoid|react)/i,
      /\b(free|safe|contain|avoid)\b.*\b(peanuts?|tree ?nuts?|shellfish|glutens?|dairy|soy|sesame)\b/i,
      // "has no peanuts", "without gluten", "free of dairy" — the phrasing a
      // customer actually uses when asking the question that must never be
      // answered from menu data. The allergen list here is deliberately
      // narrower than a full ingredient list so ordinary menu questions
      // ("do you have any fish?") are not swept into the allergy path.
      /\b(no|free of|without)\s+(\w+\s+)?(peanuts?|tree ?nuts?|shellfish|glutens?|dairy|soy|sesame)\b/i,
      /\bcross[- ]contaminat/i,
    ],
  },
  {
    intent: 'COMPLAINT',
    weight: 95,
    patterns: [
      /\b(complain|complaint)\b/i,
      /\b(terrible|awful|disgusting|rude|unacceptable|worst|horrible)\b/i,
      /\b(food poisoning|got sick|made me sick|threw up|vomit)\b/i,
      /\b(refund|money back|compensat|reimburse)\b/i,
      /\b(hair|bug|roach|undercooked|raw|spoiled|moldy)\b.*\b(food|meal|plate|dish)\b/i,
      /\b(never|not) (coming|going) back\b/i,
      /\b(lawyer|attorney|sue|lawsuit|health department|legal action)\b/i,
    ],
  },
  {
    intent: 'MANAGER_REQUEST',
    weight: 92,
    patterns: [/\b(manager|owner|supervisor|person in charge)\b/i, /\bwho('?s| is) in charge\b/i],
  },
  {
    intent: 'HUMAN_ASSISTANCE',
    weight: 90,
    patterns: [
      /\b(speak|talk|connect|transfer)\b.*\b(person|human|someone|somebody|staff|representative|agent)\b/i,
      /\breal (person|human)\b/i,
      /\b(are you|is this) (a )?(bot|robot|ai|computer|machine)\b/i,
      /\bstop (talking to|using) (a )?(bot|ai)\b/i,
    ],
  },
  {
    intent: 'CATERING',
    weight: 85,
    patterns: [/\bcater(ing|ed|er)?\b/i, /\b(office|corporate|company) (lunch|dinner|order|party)\b/i, /\bfeed \d+\s*(people|guests|folks)\b/i],
  },
  {
    intent: 'PRIVATE_EVENT',
    weight: 84,
    patterns: [
      /\b(private (room|dining|event|party)|buyout|buy[- ]out)\b/i,
      /\b(rehearsal dinner|wedding|reception|banquet|baby shower|bridal shower|retirement party|anniversary party|graduation party)\b/i,
      /\b(book|rent|reserve)\b.*\b(room|space|venue|patio)\b/i,
      /\b(event space|semi[- ]private)\b/i,
    ],
  },
  {
    intent: 'RESERVATION_CHANGE',
    weight: 82,
    patterns: [
      /\b(change|move|modify|update|cancel|reschedule)\b.*\b(reservation|booking|table)\b/i,
      /\b(reservation|booking)\b.*\b(change|cancel|reschedul)/i,
      /\bexisting (reservation|booking)\b/i,
    ],
  },
  {
    intent: 'RESERVATION',
    weight: 78,
    patterns: [
      /\b(reserv(e|ation|ations)|book a table|booking|table for)\b/i,
      /\b(get|make|have)\b.*\b(table|reservation)\b/i,
      /\bavailability\b.*\b(tonight|tomorrow|friday|saturday|sunday|monday|tuesday|wednesday|thursday)\b/i,
      /\bdo you take (walk[- ]ins|reservations)\b/i,
    ],
  },
  {
    intent: 'DELIVERY',
    weight: 76,
    patterns: [/\bdeliver(y|ies|ed)?\b/i, /\bbring it to (my|the)\b/i, /\b(doordash|ubereats|uber eats|grubhub|postmates)\b/i],
  },
  {
    intent: 'TAKEOUT',
    weight: 74,
    patterns: [
      /\b(take[- ]?out|takeaway|to[- ]go|pick[- ]?up|carry[- ]?out|curbside)\b/i,
      /\bplace an order\b/i,
      /\border (food|online|ahead)\b/i,
    ],
  },
  {
    intent: 'LARGE_PARTY',
    weight: 72,
    patterns: [
      /\b(large|big) (party|group)\b/i,
      /\bgroup of \d+/i,
      /\bparty of \d{2,}/i,
      /\b\d{2,}\s*(people|guests|of us)\b/i,
    ],
  },
  {
    intent: 'GIFT_CARD',
    weight: 70,
    patterns: [/\bgift ?(cards?|certificates?|vouchers?)\b/i],
  },
  {
    intent: 'EMPLOYMENT',
    weight: 70,
    patterns: [/\b(hiring|job|apply|application|employment|position|work there|career|resume|résumé)\b/i],
  },
  {
    intent: 'LOST_PROPERTY',
    weight: 70,
    patterns: [/\b(lost|left|forgot|misplaced)\b.*\b(my|a|the)\b/i, /\blost and found\b/i],
  },
  {
    intent: 'ACCESSIBILITY',
    weight: 68,
    patterns: [
      /\b(wheelchair|accessib(le|ility)|ada|handicap|ramp|elevator)\b/i,
      /\b(service (dog|animal)|guide dog)\b/i,
      /\b(braille|hearing loop|high chair)\b/i,
    ],
  },
  {
    intent: 'PARKING',
    weight: 66,
    patterns: [/\bpark(ing)?\b/i, /\bvalet\b/i, /\bwhere (do|can) (i|we) (park|leave the car)\b/i],
  },
  {
    intent: 'DIETARY',
    weight: 64,
    patterns: [
      /\b(vegan|vegetarian|pescatarian|halal|kosher|keto|paleo|dairy[- ]free|gluten[- ]free|plant[- ]based)\b/i,
      /\b(dietary|diet) (option|restriction|need)/i,
    ],
  },
  {
    intent: 'SPECIALS',
    weight: 62,
    patterns: [
      /\b(special|specials|happy hour|deal|promo(tion)?|discount|prix fixe|early bird)\b/i,
      /\b(anything|what'?s) (going on|new) (tonight|today|this week)\b/i,
    ],
  },
  {
    intent: 'PRICING',
    weight: 60,
    patterns: [
      /\bhow much\b/i,
      /\b(price|prices|pricing|cost|costs|expensive|cheap|per person|per head)\b/i,
      /\bwhat (do|does) .* cost\b/i,
    ],
  },
  {
    intent: 'MENU',
    weight: 58,
    patterns: [
      /\bmenu\b/i,
      /\bwhat (kind of |type of )?food\b/i,
      /\bdo you (have|serve|offer|make)\b/i,
      /\b(wine|beer|cocktail|drink) list\b/i,
      /\bwhat'?s good\b/i,
    ],
  },
  {
    intent: 'DIRECTIONS',
    weight: 56,
    patterns: [/\bdirections?\b/i, /\bhow (do|can) (i|we) get (there|to you)\b/i, /\bnear(est)? (me|the)\b/i],
  },
  {
    intent: 'LOCATION',
    weight: 54,
    patterns: [
      /\bwhere are you (located|at)\b/i,
      /\b(address|located|location)\b/i,
      /\bwhat (street|part of town)\b/i,
      /\bhow many locations\b/i,
    ],
  },
  {
    intent: 'HOURS',
    weight: 52,
    patterns: [
      /\b(hours?|open|close[sd]?|closing|opening)\b/i,
      /\bwhat time\b/i,
      /\bare you open\b/i,
      /\bstill serving\b/i,
      /\blast (call|seating|order)\b/i,
    ],
  },
];

/** Normalise curly quotes and collapse whitespace before matching. */
function normalise(message: string): string {
  return message.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

export function detectIntent(message: string): IntentMatch {
  const text = normalise(message);
  if (!text) return { intent: 'UNKNOWN', confidence: 0, secondary: [] };

  const scored: { intent: Intent; score: number; order: number }[] = [];
  RULES.forEach((rule, order) => {
    const hits = rule.patterns.filter((pattern) => pattern.test(text)).length;
    if (hits === 0) return;
    // Additional matching patterns raise confidence but with diminishing
    // returns — one strong signal is usually enough.
    const score = rule.weight + Math.min(hits - 1, 2) * 5;
    scored.push({ intent: rule.intent, score, order });
  });

  if (scored.length === 0) return { intent: 'UNKNOWN', confidence: 0, secondary: [] };

  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const [top, ...rest] = scored;

  // A short message that matched exactly one weak rule is a coin flip; say so
  // rather than acting confidently on it.
  const wordCount = text.split(' ').length;
  const ambiguityPenalty = rest.length > 0 && rest[0].score === top.score ? 15 : 0;
  const brevityPenalty = wordCount <= 2 && top.score < 70 ? 10 : 0;
  const confidence = Math.max(0, Math.min(100, top.score - ambiguityPenalty - brevityPenalty));

  return {
    intent: top.intent,
    confidence,
    secondary: rest.filter((r) => r.score >= 50).map((r) => r.intent),
  };
}

// --- Entity extraction -----------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  a: 2, couple: 2, dozen: 12,
};

/** Party size, from digits or words. Returns null when nothing reliable found. */
export function extractPartySize(message: string): number | null {
  const text = normalise(message).toLowerCase();

  const patterns: RegExp[] = [
    /\b(?:party|table|reservation|group|booking)\s+(?:of|for)\s+([a-z]+|\d{1,3})\b/,
    /\b(?:for|of)\s+(\d{1,3})\s*(?:people|guests|persons|adults|pax|of us|tops?)\b/,
    /\b(\d{1,3})\s*(?:people|guests|persons|adults|pax|of us|tops?)\b/,
    // Spelled-out answers to "how many people?" — "four of us", "just two".
    /\b([a-z]+)\s+(?:people|guests|persons|adults|of us)\b/,
    /\b(?:feed|seat|accommodate)\s+(\d{1,3})\b/,
    /\b(?:there (?:will )?(?:are|be)|we are|we're|it's)\s+(\d{1,3})\s*(?:of us)?\b/,
    // A bare "for 30" only counts when the message already names a meal or an
    // event ("a rehearsal dinner on Friday for 30"). Without that anchor the
    // number is just as likely to be a price or a street address.
    /\b(?:dinner|lunch|brunch|breakfast|party|event|reception|banquet|shower|group|table|reservation|booking|catering)\b.*?\bfor\s+(\d{1,3})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw = match[1];
    const value = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
    // Above 500 the number is far more likely a price, a year or a zip code.
    if (value && value >= 1 && value <= 500) return value;
  }
  return null;
}

/** North-American style phone number. Deliberately conservative. */
export function extractPhone(message: string): string | null {
  const match = normalise(message).match(/(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/);
  if (!match) return null;
  return `(${match[1]}) ${match[2]}-${match[3]}`;
}

export function extractEmail(message: string): string | null {
  const match = normalise(message).match(/\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/);
  return match ? match[0] : null;
}

/** Time of day, e.g. "7pm", "7:30 PM", "19:00", "noon". */
export function extractTime(message: string): string | null {
  const text = normalise(message).toLowerCase();
  if (/\bnoon\b|\bmidday\b/.test(text)) return '12:00';
  if (/\bmidnight\b/.test(text)) return '00:00';

  const twelveHour = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = twelveHour[2] ? Number(twelveHour[2]) : 0;
    const isPm = twelveHour[3].startsWith('p');
    if (hour >= 1 && hour <= 12 && minute < 60) {
      if (isPm && hour !== 12) hour += 12;
      if (!isPm && hour === 12) hour = 0;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour) {
    return `${String(Number(twentyFour[1])).padStart(2, '0')}:${twentyFour[2]}`;
  }
  return null;
}

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};

/**
 * Resolve a date phrase against the customer's local "now".
 *
 * Only unambiguous phrases produce an ISO date. Anything vague ("sometime next
 * month", "the 3rd") is returned as raw text so a human confirms it — booking
 * the wrong date is worse than asking one more question.
 */
export function extractDate(
  message: string,
  now: Date,
  timezone: string,
): { iso: string | null; text: string | null } {
  // Matching is case-insensitive, but the ORIGINAL casing is what gets returned
  // and shown to staff — "December 12th" reads like a date, "december" does not.
  const text = normalise(message);

  const localIso = (offsetDays: number): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(now.getTime() + offsetDays * 86_400_000));
    return parts;
  };

  const shortWeekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now);
  const todayWeekday = Math.max(0, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(shortWeekday));

  const relative = text.match(/\b(today|tonight|this evening|this afternoon)\b/i);
  if (relative) return { iso: localIso(0), text: relative[0] };
  const tomorrow = text.match(/\btomorrow\b/i);
  if (tomorrow) return { iso: localIso(1), text: tomorrow[0] };

  const explicitIso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (explicitIso) return { iso: explicitIso[0], text: explicitIso[0] };

  const weekdayMatch = text.match(
    /\b(this|next|coming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thur?s?|fri|sat)\b/i,
  );
  if (weekdayMatch) {
    const target = DAY_INDEX[weekdayMatch[2].toLowerCase()];
    let delta = (target - todayWeekday + 7) % 7;
    if (delta === 0) delta = 7; // "on Friday" said on a Friday means next Friday.
    if (weekdayMatch[1]?.toLowerCase() === 'next' && delta < 7) delta += 7;
    return { iso: localIso(delta), text: weekdayMatch[0].trim() };
  }

  // Recognised but not confidently resolvable. A month-and-day carries no year,
  // and guessing one could book an event twelve months out, so the phrase is
  // handed to a human intact instead. The day number is captured with the
  // month — "December 12th", never a bare "December".
  const vague = text.match(
    /\b(next (?:week|month|weekend)|this (?:week|weekend|month)|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?|the \d{1,2}(?:st|nd|rd|th))\b/i,
  );
  if (vague) return { iso: null, text: vague[0].trim() };

  return { iso: null, text: null };
}

/** Name, only from explicit self-identification. Never guessed from prose. */
export function extractName(message: string): string | null {
  const text = normalise(message);
  // The `i` flag is deliberately NOT used: the introducer may be capitalised
  // ("My name is"), but the captured name must still start with a capital
  // letter. That capitalisation is the signal separating a real name from an
  // ordinary word, so it cannot be relaxed.
  const patterns = [
    /\b(?:[Mm]y name is|[Nn]ame'?s|[Tt]his is|[Ii] am|[Ii]'m)\s+([A-Z][a-z'’-]{1,20}(?:\s+[A-Z][a-z'’-]{1,20})?)\b/,
    /\b(?:[Uu]nder|[Ff]or)\s+the\s+name\s+([A-Z][a-z'’-]{1,20})\b/,
    /\b(?:[Ii]t'?s|[Ii]ts)\s+([A-Z][a-z'’-]{1,20})\s*(?:,|\.|$)/,
    // "…, Dana, 727-555-0142" — customers routinely give a name and number
    // together with no introducer at all, especially over SMS.
    /\b([A-Z][a-z'’-]{1,20}(?:\s+[A-Z][a-z'’-]{1,20})?)\s*[,.]?\s*(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const candidate = match[1].trim();
      // Guard against "I'm looking", "this is Friday" and similar false hits.
      if (!/^(Looking|Trying|Calling|Wondering|Just|Not|Sorry|Hi|Hello|Friday|Monday|Tuesday|Wednesday|Thursday|Saturday|Sunday)$/i.test(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}
