/**
 * OPTIONAL INTAKE NUMBERS ARE READ, NEVER GUESSED.
 *
 * The intake form sent `Number(field)`. Anything that wasn't a plain number —
 * "4,5", "4.5 stars", "N/A" — became NaN, which JSON sends as null, and the
 * route's `z.coerce.number()` turned null into 0. A rating typed with a comma
 * was stored as an owner-reported 0.0★, printed in the report as fact, and
 * scored the 10%-weighted reputation category 0: 84 became 75 on the same site.
 *
 * Now each optional number is parsed here, on the server:
 * - empty, missing or null is "not provided" — never 0;
 * - a comma followed by one or two digits is a decimal comma ("4,5" → 4.5,
 *   "45,50" → 45.5); commas grouping thousands are accepted ("1,200" → 1200);
 * - a leading "$" is accepted for the average ticket only;
 * - anything else ("4.5 stars", "N/A", "4,5,6") is refused with a message that
 *   names the field, so the operator corrects it instead of a wrong number
 *   being stored.
 */

export type IntakeNumberField = 'ownerRating' | 'ownerReviewCount' | 'avgTicket';

interface FieldRule {
  min: number;
  max: number;
  integer: boolean;
  currency: boolean;
  error: string;
}

export const INTAKE_NUMBER_RULES: Record<IntakeNumberField, FieldRule> = {
  ownerRating: { min: 0, max: 5, integer: false, currency: false, error: 'OWNER RATING MUST BE A NUMBER FROM 0 TO 5, FOR EXAMPLE 4.5' },
  ownerReviewCount: { min: 0, max: 10_000_000, integer: true, currency: false, error: 'REVIEW COUNT MUST BE A WHOLE NUMBER, FOR EXAMPLE 312' },
  avgTicket: { min: 0, max: 100_000, integer: false, currency: true, error: 'AVERAGE TICKET MUST BE A DOLLAR AMOUNT, FOR EXAMPLE 45' },
};

const PLAIN = /^\d+(?:\.\d+)?$/;
const DECIMAL_COMMA = /^\d+,\d{1,2}$/;
const THOUSANDS = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

/** Reads a typed number; null when the text is not a number this parser accepts. */
export function readNumberText(text: string): number | null {
  const s = text.trim();
  if (PLAIN.test(s)) return Number(s);
  if (DECIMAL_COMMA.test(s)) return Number(s.replace(',', '.'));
  if (THOUSANDS.test(s)) return Number(s.replace(/,/g, ''));
  return null;
}

export type IntakeNumberResult = { ok: true; value: number | undefined } | { ok: false; error: string };

export function parseIntakeNumber(raw: unknown, field: IntakeNumberField): IntakeNumberResult {
  const rule = INTAKE_NUMBER_RULES[field];
  if (raw === undefined || raw === null) return { ok: true, value: undefined };

  let value: number | null;
  if (typeof raw === 'number') {
    value = Number.isFinite(raw) ? raw : null;
  } else if (typeof raw === 'string') {
    let text = raw.trim();
    if (text === '') return { ok: true, value: undefined };
    if (rule.currency) text = text.replace(/^\$\s*/, '');
    value = readNumberText(text);
  } else {
    value = null;
  }

  if (value === null || value < rule.min || value > rule.max || (rule.integer && !Number.isInteger(value))) {
    return { ok: false, error: rule.error };
  }
  return { ok: true, value };
}
