/**
 * REVENUE EXPOSURE SCENARIO MODEL — deterministic, assumption-driven.
 *
 * SAFETY CONTRACT (Phase 2.5):
 * - A scenario is an ILLUSTRATIVE mathematical example, never a measured loss.
 * - Every assumption used in a scenario is surfaced to the owner; the model
 *   never silently chooses inputs and shows only an output.
 * - Defaults are labeled "illustrative assumption" — never "industry average"
 *   or "benchmark" (no benchmark data source is integrated).
 * - Scenarios are gated by explicit eligibility rules; findings that prohibit
 *   interpretation (insufficient-data, metadata/technical signals) get none.
 * - Arithmetic is done in integer cents to avoid floating-point drift.
 */

export interface ScenarioAssumption {
  label: string;
  value: string; // display string
  qualifier: 'illustrative assumption';
}

export interface RevenueScenario {
  key: string;
  pathwayTitle: string;
  observedFriction: string;
  classification: 'ILLUSTRATIVE SCENARIO';
  assumptions: ScenarioAssumption[];
  formula: string;
  monthlyExposure: string; // formatted USD
  annualExposure: string; // formatted USD
  dataRequiredToValidate: string[];
  confidenceStatement: string;
}

// ── Centralized illustrative defaults ───────────────────────────────────────
// All neutral, conservative, clearly illustrative. Not benchmarks.
export interface ScenarioDefaults {
  phone: { illustrativeMissedCallsPerDay: number; commercialIntentRate: number; illustrativeTransactionValue: number; operatingDays: number };
  reservation: { illustrativeLostBookingsPerWeek: number; illustrativePartySize: number; illustrativePerGuestValue: number; operatingWeeks: number };
  ordering: { illustrativeAbandonedOrdersPerDay: number; illustrativeOrderValue: number; operatingDays: number };
  lead: { illustrativeMissedLeadsPerMonth: number; illustrativeCloseRate: number; illustrativeEventValue: number; operatingMonths: number };
  reactivation: { illustrativeLapsedGuestsReengagedPerMonth: number; illustrativeVisitsPerReengagement: number; illustrativeTicket: number; operatingMonths: number };
  website: { illustrativeLostConversionsPerDay: number; illustrativeConversionValue: number; operatingDays: number };
}

export const SCENARIO_DEFAULTS: ScenarioDefaults = {
  phone: { illustrativeMissedCallsPerDay: 5, commercialIntentRate: 0.3, illustrativeTransactionValue: 45, operatingDays: 365 },
  reservation: { illustrativeLostBookingsPerWeek: 3, illustrativePartySize: 2, illustrativePerGuestValue: 40, operatingWeeks: 52 },
  ordering: { illustrativeAbandonedOrdersPerDay: 2, illustrativeOrderValue: 35, operatingDays: 365 },
  lead: { illustrativeMissedLeadsPerMonth: 2, illustrativeCloseRate: 0.5, illustrativeEventValue: 500, operatingMonths: 12 },
  reactivation: { illustrativeLapsedGuestsReengagedPerMonth: 20, illustrativeVisitsPerReengagement: 2, illustrativeTicket: 40, operatingMonths: 12 },
  website: { illustrativeLostConversionsPerDay: 3, illustrativeConversionValue: 40, operatingDays: 365 },
};

// ── Decimal-safe helpers (integer cents) ────────────────────────────────────
const toCents = (dollars: number): number => Math.round(dollars * 100);
const formatUSD = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (rate: number): string => `${Math.round(rate * 1000) / 10}%`;

/**
 * Annual exposure in integer cents = round(count × rate × valueCents × periods).
 * Multiplying an integer cent value by dimensionless factors then rounding once
 * keeps the result decimal-exact for the display precision we need.
 */
function annualCents(count: number, rate: number, valueDollars: number, periods: number): number {
  return Math.round(count * rate * toCents(valueDollars) * periods);
}
const monthlyFromAnnual = (annual: number): number => Math.round(annual / 12);

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

// ── Scenario builders ───────────────────────────────────────────────────────

export function buildScenario(kind: ScenarioKind, friction = 'Observed on the analyzed public pages.', defaults: ScenarioDefaults = SCENARIO_DEFAULTS): RevenueScenario {
  switch (kind) {
    case 'phone': {
      const d = defaults.phone;
      const annual = annualCents(d.illustrativeMissedCallsPerDay, d.commercialIntentRate, d.illustrativeTransactionValue, d.operatingDays);
      return {
        key: 'phone',
        pathwayTitle: 'Phone Demand Exposure',
        observedFriction: friction,
        classification: 'ILLUSTRATIVE SCENARIO',
        assumptions: [
          { label: 'Potentially missed calls per day', value: `${d.illustrativeMissedCallsPerDay}`, qualifier: 'illustrative assumption' },
          { label: 'Estimated share with order or booking intent', value: pct(d.commercialIntentRate), qualifier: 'illustrative assumption' },
          { label: 'Illustrative average transaction value', value: formatUSD(toCents(d.illustrativeTransactionValue)), qualifier: 'illustrative assumption' },
          { label: 'Operating days', value: `${d.operatingDays}`, qualifier: 'illustrative assumption' },
        ],
        formula: 'missed calls/day × commercial intent rate × average transaction value × operating days',
        monthlyExposure: formatUSD(monthlyFromAnnual(annual)),
        annualExposure: formatUSD(annual),
        dataRequiredToValidate: ['Call logs', 'Missed-call count', 'Caller reason sample', 'Average ticket', 'Operating days'],
        confidenceStatement: 'Illustrative scenario — not a confirmed loss. Actual call volume, missed-call count, caller intent, and transaction value must be validated against restaurant phone and POS data.',
      };
    }
    case 'reservation': {
      const d = defaults.reservation;
      const annual = annualCents(d.illustrativeLostBookingsPerWeek * d.illustrativePartySize, 1, d.illustrativePerGuestValue, d.operatingWeeks);
      return {
        key: 'reservation',
        pathwayTitle: 'Reservation Demand Exposure',
        observedFriction: friction,
        classification: 'ILLUSTRATIVE SCENARIO',
        assumptions: [
          { label: 'Potentially lost bookings per week', value: `${d.illustrativeLostBookingsPerWeek}`, qualifier: 'illustrative assumption' },
          { label: 'Illustrative party size', value: `${d.illustrativePartySize}`, qualifier: 'illustrative assumption' },
          { label: 'Illustrative per-guest value', value: formatUSD(toCents(d.illustrativePerGuestValue)), qualifier: 'illustrative assumption' },
          { label: 'Operating weeks', value: `${d.operatingWeeks}`, qualifier: 'illustrative assumption' },
        ],
        formula: 'lost bookings/week × party size × per-guest value × operating weeks',
        monthlyExposure: formatUSD(monthlyFromAnnual(annual)),
        annualExposure: formatUSD(annual),
        dataRequiredToValidate: ['Reservation system logs', 'Turn-away count', 'Average party size', 'Average per-guest spend'],
        confidenceStatement: 'Illustrative scenario — not a confirmed loss. Actual booking demand, turn-away rate, and per-guest value must be validated against reservation and POS data.',
      };
    }
    case 'ordering': {
      const d = defaults.ordering;
      const annual = annualCents(d.illustrativeAbandonedOrdersPerDay, 1, d.illustrativeOrderValue, d.operatingDays);
      return {
        key: 'ordering',
        pathwayTitle: 'Online Ordering Exposure',
        observedFriction: friction,
        classification: 'ILLUSTRATIVE SCENARIO',
        assumptions: [
          { label: 'Potentially abandoned orders per day', value: `${d.illustrativeAbandonedOrdersPerDay}`, qualifier: 'illustrative assumption' },
          { label: 'Illustrative average order value', value: formatUSD(toCents(d.illustrativeOrderValue)), qualifier: 'illustrative assumption' },
          { label: 'Operating days', value: `${d.operatingDays}`, qualifier: 'illustrative assumption' },
        ],
        formula: 'abandoned orders/day × average order value × operating days',
        monthlyExposure: formatUSD(monthlyFromAnnual(annual)),
        annualExposure: formatUSD(annual),
        dataRequiredToValidate: ['Online ordering analytics', 'Cart abandonment data', 'Average order value', 'Channel mix (direct vs third-party)'],
        confidenceStatement: 'Illustrative scenario — not a confirmed loss. Actual order abandonment and order value must be validated against ordering-platform analytics.',
      };
    }
    case 'lead': {
      const d = defaults.lead;
      const annual = annualCents(d.illustrativeMissedLeadsPerMonth, d.illustrativeCloseRate, d.illustrativeEventValue, d.operatingMonths);
      return {
        key: 'lead',
        pathwayTitle: 'Catering & Event Lead Exposure',
        observedFriction: friction,
        classification: 'ILLUSTRATIVE SCENARIO',
        assumptions: [
          { label: 'Potentially missed event leads per month', value: `${d.illustrativeMissedLeadsPerMonth}`, qualifier: 'illustrative assumption' },
          { label: 'Illustrative close rate', value: pct(d.illustrativeCloseRate), qualifier: 'illustrative assumption' },
          { label: 'Illustrative event value', value: formatUSD(toCents(d.illustrativeEventValue)), qualifier: 'illustrative assumption' },
          { label: 'Operating months', value: `${d.operatingMonths}`, qualifier: 'illustrative assumption' },
        ],
        formula: 'missed leads/month × close rate × event value × operating months',
        monthlyExposure: formatUSD(monthlyFromAnnual(annual)),
        annualExposure: formatUSD(annual),
        dataRequiredToValidate: ['Event-inquiry logs', 'Response-time records', 'Historical close rate', 'Average event value'],
        confidenceStatement: 'Illustrative scenario — not a confirmed loss. Actual lead volume, close rate, and event value must be validated against internal event records.',
      };
    }
    case 'reactivation': {
      const d = defaults.reactivation;
      const annual = annualCents(d.illustrativeLapsedGuestsReengagedPerMonth, d.illustrativeVisitsPerReengagement, d.illustrativeTicket, d.operatingMonths);
      return {
        key: 'reactivation',
        pathwayTitle: 'Guest Reactivation Opportunity',
        observedFriction: friction,
        classification: 'ILLUSTRATIVE SCENARIO',
        assumptions: [
          { label: 'Lapsed guests re-engaged per month', value: `${d.illustrativeLapsedGuestsReengagedPerMonth}`, qualifier: 'illustrative assumption' },
          { label: 'Illustrative visits per re-engagement', value: `${d.illustrativeVisitsPerReengagement}`, qualifier: 'illustrative assumption' },
          { label: 'Illustrative average ticket', value: formatUSD(toCents(d.illustrativeTicket)), qualifier: 'illustrative assumption' },
          { label: 'Operating months', value: `${d.operatingMonths}`, qualifier: 'illustrative assumption' },
        ],
        formula: 're-engaged guests/month × visits per re-engagement × average ticket × operating months',
        monthlyExposure: formatUSD(monthlyFromAnnual(annual)),
        annualExposure: formatUSD(annual),
        dataRequiredToValidate: ['Guest database size', 'Lapsed-guest count', 'Historical repeat-visit rate', 'Average ticket'],
        confidenceStatement: 'Illustrative scenario — an opportunity model, not a confirmed loss. Actual database size and repeat behavior must be validated against POS and CRM data.',
      };
    }
    case 'website': {
      const d = defaults.website;
      const annual = annualCents(d.illustrativeLostConversionsPerDay, 1, d.illustrativeConversionValue, d.operatingDays);
      return {
        key: 'website',
        pathwayTitle: 'Website Conversion Exposure',
        observedFriction: friction,
        classification: 'ILLUSTRATIVE SCENARIO',
        assumptions: [
          { label: 'Potentially lost conversions per day', value: `${d.illustrativeLostConversionsPerDay}`, qualifier: 'illustrative assumption' },
          { label: 'Illustrative value per conversion', value: formatUSD(toCents(d.illustrativeConversionValue)), qualifier: 'illustrative assumption' },
          { label: 'Operating days', value: `${d.operatingDays}`, qualifier: 'illustrative assumption' },
        ],
        formula: 'lost conversions/day × value per conversion × operating days',
        monthlyExposure: formatUSD(monthlyFromAnnual(annual)),
        annualExposure: formatUSD(annual),
        dataRequiredToValidate: ['Website analytics', 'Conversion-action tracking', 'Average conversion value', 'Traffic volume'],
        confidenceStatement: 'Illustrative scenario — not a confirmed loss. Actual traffic, conversion rate, and conversion value must be validated against website analytics.',
      };
    }
  }
}
