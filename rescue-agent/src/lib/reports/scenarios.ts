/**
 * OPTIONAL SCENARIO CALCULATOR — deterministic, driven only by figures the user enters.
 *
 * SAFETY CONTRACT:
 * - The report never fills a scenario in on its own. It used to multiply
 *   invented counts ("5 missed calls a day", "3 lost conversions a day") into a
 *   dollar figure and print it in the executive report; however carefully
 *   labelled, an invented quantity times a real ticket reads as a measured
 *   loss. There are now no default quantities anywhere in this module.
 * - A scenario exists only when every input has been supplied by the user; a
 *   missing or invalid input yields no scenario rather than a guessed one.
 * - Every input is shown back with the result and labelled as the user's own
 *   assumption. The output is a what-if, never a measured loss, a forecast or a
 *   guaranteed recovery.
 * - Scenarios are gated by explicit eligibility rules; findings that prohibit
 *   interpretation (insufficient-data, metadata/technical signals) get none.
 * - Arithmetic is done in integer cents to avoid floating-point drift.
 */

export interface ScenarioAssumption {
  label: string;
  value: string; // display string
  qualifier: 'your assumption';
}

export interface RevenueScenario {
  key: string;
  pathwayTitle: string;
  observedFriction: string;
  classification: 'USER-ENTERED SCENARIO';
  assumptions: ScenarioAssumption[];
  formula: string;
  /**
   * Display strings, rounded to two significant figures and prefixed "about".
   *
   * Every input is an assumption, so printing the output to the cent would
   * claim a precision the model does not have. The exact value is kept below.
   */
  monthlyExposure: string;
  annualExposure: string;
  /** The exact computed values in integer cents, so the arithmetic stays provable. */
  monthlyExposureCents: number;
  annualExposureCents: number;
  dataRequiredToValidate: string[];
  confidenceStatement: string;
}

// ── Decimal-safe helpers (integer cents) ────────────────────────────────────
const toCents = (dollars: number): number => Math.round(dollars * 100);
const formatUSD = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * What a scenario is, and the things it is not.
 *
 * The figures come only from what the reader types in, and the result still
 * is not money measured leaving the business, a forecast of what will happen,
 * or a promise of what a fix returns. Scenarios also overlap — the guest who
 * does not call is often the guest who does not book — so they never add up.
 */
export const SCENARIO_DISCLAIMER =
  'Optional scenario calculator — it uses only the figures you enter. ' +
  'The result is a what-if built on your own assumptions: not a measured loss, not a forecast, and not a guaranteed recovery. ' +
  'Scenarios overlap, so do not add them together.';

/**
 * A scenario OUTPUT, rounded to two significant figures and marked approximate.
 *
 * `formatUSD` is still used for the assumption rows, because an entered value
 * like "$45.00" is an exact stated input. The product of several assumptions is
 * not, and printing it to the cent invited the reader to treat it as measured.
 */
export function formatApproxUSD(cents: number): string {
  const dollars = cents / 100;
  if (dollars === 0) return '$0';
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(dollars))) - 1);
  const rounded = Math.round(dollars / magnitude) * magnitude;
  // "about", not "≈". The PDF's embedded Times and Helvetica subsets have no
  // glyph for U+2248, so it rendered as a tofu box sitting on top of the
  // dollar sign — a visual defect on the figure the client looks at hardest.
  // A word carries the same meaning and is in every font.
  return `about $${rounded.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

// ── Eligibility ─────────────────────────────────────────────────────────────
// A finding is scenario-eligible only when it maps to a measurable demand or
// conversion pathway whose math can be shown transparently. Insufficient-data,
// metadata, and technical-implementation findings are never eligible.
export type ScenarioKind = 'phone' | 'reservation' | 'ordering' | 'lead' | 'reactivation' | 'website';

const ELIGIBILITY: [RegExp, ScenarioKind][] = [
  [/PHONE-DEPENDENT|MISSED-CALL/i, 'phone'],
  [/RESERVATION/i, 'reservation'],
  [/ORDERING FAILURE|THIRD-PARTY ORDERING|ONLINE ORDERING/i, 'ordering'],
  [/CATERING|PRIVATE DINING|LEAD/i, 'lead'],
  [/RETENTION|REACTIVATION/i, 'reactivation'],
  [/CTA|WEBSITE CONVERSION|CONVERSION/i, 'website'],
];

const NON_ELIGIBLE = /TECHNICAL FOUNDATION|MENU ACCESS|CONTACT PATH|BROKEN CUSTOMER PATHWAY|DISCOVERY|METADATA|INSUFFICIENT/i;

export interface ScenarioEligibilityInput {
  category: string;
  classification: string; // EvidenceClassification
}

/** Returns the scenario kind a finding qualifies for, or null. Deterministic. */
export function scenarioKindFor(input: ScenarioEligibilityInput): ScenarioKind | null {
  if (input.classification === 'INSUFFICIENT DATA') return null;
  if (NON_ELIGIBLE.test(input.category)) {
    // A category may match both lists (e.g. contains "ordering" and "menu");
    // the specific eligible patterns below still win only if matched first.
    const eligible = ELIGIBILITY.find(([re]) => re.test(input.category));
    if (!eligible) return null;
  }
  const match = ELIGIBILITY.find(([re]) => re.test(input.category));
  return match ? match[1] : null;
}

// ── Calculator specifications ───────────────────────────────────────────────
// Each pathway's formula is a plain product of its inputs, in the order listed,
// with the one dollar input converted to cents. The last input is the number
// of periods in a year, so the product is an annual figure.

export type ScenarioFieldUnit = 'count' | 'percent' | 'usd' | 'periods';

export interface ScenarioField {
  key: string;
  label: string;
  unit: ScenarioFieldUnit;
}

export interface ScenarioSpec {
  kind: ScenarioKind;
  pathwayTitle: string;
  fields: ScenarioField[];
  formula: string;
  dataRequiredToValidate: string[];
}

export const SCENARIO_SPECS: Record<ScenarioKind, ScenarioSpec> = {
  phone: {
    kind: 'phone',
    pathwayTitle: 'Phone Demand Scenario',
    fields: [
      { key: 'missedCallsPerDay', label: 'Missed calls per day', unit: 'count' },
      { key: 'commercialIntentPercent', label: 'Share of those calls with order or booking intent (%)', unit: 'percent' },
      { key: 'averageTransaction', label: 'Average transaction value ($)', unit: 'usd' },
      { key: 'operatingDays', label: 'Operating days per year', unit: 'periods' },
    ],
    formula: 'missed calls/day × intent share × average transaction value × operating days',
    dataRequiredToValidate: ['Call logs', 'Missed-call count', 'Caller reason sample', 'Average ticket', 'Operating days'],
  },
  reservation: {
    kind: 'reservation',
    pathwayTitle: 'Reservation Demand Scenario',
    fields: [
      { key: 'lostBookingsPerWeek', label: 'Booking requests lost per week', unit: 'count' },
      { key: 'partySize', label: 'Average party size', unit: 'count' },
      { key: 'perGuestValue', label: 'Average spend per guest ($)', unit: 'usd' },
      { key: 'operatingWeeks', label: 'Operating weeks per year', unit: 'periods' },
    ],
    formula: 'lost bookings/week × party size × spend per guest × operating weeks',
    dataRequiredToValidate: ['Reservation system logs', 'Turn-away count', 'Average party size', 'Average per-guest spend'],
  },
  ordering: {
    kind: 'ordering',
    pathwayTitle: 'Online Ordering Scenario',
    fields: [
      { key: 'abandonedOrdersPerDay', label: 'Orders abandoned per day', unit: 'count' },
      { key: 'averageOrder', label: 'Average order value ($)', unit: 'usd' },
      { key: 'operatingDays', label: 'Operating days per year', unit: 'periods' },
    ],
    formula: 'abandoned orders/day × average order value × operating days',
    dataRequiredToValidate: ['Online ordering analytics', 'Cart abandonment data', 'Average order value', 'Channel mix (direct vs third-party)'],
  },
  lead: {
    kind: 'lead',
    pathwayTitle: 'Catering & Event Inquiry Scenario',
    fields: [
      { key: 'unansweredInquiriesPerMonth', label: 'Inquiries per month not answered in time', unit: 'count' },
      { key: 'closePercent', label: 'Share of answered inquiries you book (%)', unit: 'percent' },
      { key: 'eventValue', label: 'Average event value ($)', unit: 'usd' },
      { key: 'operatingMonths', label: 'Operating months per year', unit: 'periods' },
    ],
    formula: 'unanswered inquiries/month × booking share × event value × operating months',
    dataRequiredToValidate: ['Inquiry acknowledgment records', 'Response-time records', 'Booking records', 'Average event value'],
  },
  reactivation: {
    kind: 'reactivation',
    pathwayTitle: 'Guest Reactivation Scenario',
    fields: [
      { key: 'guestsReengagedPerMonth', label: 'Lapsed guests re-engaged per month', unit: 'count' },
      { key: 'visitsPerGuest', label: 'Return visits per re-engaged guest', unit: 'count' },
      { key: 'averageTicket', label: 'Average ticket ($)', unit: 'usd' },
      { key: 'operatingMonths', label: 'Operating months per year', unit: 'periods' },
    ],
    formula: 're-engaged guests/month × visits per guest × average ticket × operating months',
    dataRequiredToValidate: ['Guest database size', 'Lapsed-guest count', 'Historical repeat-visit rate', 'Average ticket'],
  },
  website: {
    kind: 'website',
    pathwayTitle: 'Website Conversion Scenario',
    fields: [
      { key: 'lostConversionsPerDay', label: 'Website visitors lost before acting, per day', unit: 'count' },
      { key: 'valuePerConversion', label: 'Average value per conversion ($)', unit: 'usd' },
      { key: 'operatingDays', label: 'Operating days per year', unit: 'periods' },
    ],
    formula: 'lost conversions/day × value per conversion × operating days',
    dataRequiredToValidate: ['Website analytics', 'Conversion-action tracking', 'Average conversion value', 'Traffic volume'],
  },
};

export type ScenarioValues = Record<string, number | null | undefined>;

const validInput = (field: ScenarioField, value: number | null | undefined): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  (field.unit !== 'percent' || value <= 100) &&
  (field.unit !== 'periods' || value <= 366);

function display(field: ScenarioField, value: number): string {
  if (field.unit === 'usd') return formatUSD(toCents(value));
  if (field.unit === 'percent') return `${value}%`;
  return `${value}`;
}

/**
 * The scenario for the figures the user entered, or null.
 *
 * Null — never a guessed figure — whenever any input is missing or invalid.
 */
export function calculateScenario(
  kind: ScenarioKind,
  values: ScenarioValues,
  observedFriction = 'Observed on the analyzed public pages.',
): RevenueScenario | null {
  const spec = SCENARIO_SPECS[kind];
  if (!spec.fields.every((f) => validInput(f, values[f.key]))) return null;
  let annual = 1;
  for (const field of spec.fields) {
    const v = values[field.key] as number;
    annual *= field.unit === 'usd' ? toCents(v) : field.unit === 'percent' ? v / 100 : v;
  }
  const annualExposureCents = Math.round(annual);
  const monthlyExposureCents = Math.round(annualExposureCents / 12);
  return {
    key: kind,
    pathwayTitle: spec.pathwayTitle,
    observedFriction,
    classification: 'USER-ENTERED SCENARIO',
    assumptions: spec.fields.map((f) => ({ label: f.label, value: display(f, values[f.key] as number), qualifier: 'your assumption' })),
    formula: spec.formula,
    monthlyExposure: formatApproxUSD(monthlyExposureCents),
    annualExposure: formatApproxUSD(annualExposureCents),
    monthlyExposureCents,
    annualExposureCents,
    dataRequiredToValidate: spec.dataRequiredToValidate,
    confidenceStatement:
      'A what-if built only on the figures entered above — not a measured loss, not a forecast, and not a guaranteed recovery. Check each figure against the records listed before relying on it.',
  };
}

/**
 * Inputs the user already supplied, mapped onto a calculator's fields.
 *
 * Only the average ticket entered when the audit was requested is carried
 * over, and only into fields that are a per-guest or per-order amount. Event
 * value is not a per-cover ticket, so it is left for the user. Nothing else is
 * ever prefilled.
 */
export function prefillFromAverageTicket(kind: ScenarioKind, avgTicket: number | null): Record<string, number> {
  if (avgTicket === null || !Number.isFinite(avgTicket) || avgTicket <= 0) return {};
  const field = SCENARIO_SPECS[kind].fields.find((f) => f.unit === 'usd');
  if (!field || kind === 'lead') return {};
  return { [field.key]: Math.round(avgTicket * 100) / 100 };
}
