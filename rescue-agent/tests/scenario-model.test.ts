import { describe, expect, it } from 'vitest';
import {
  calculateScenario,
  parseScenarioInput,
  prefillFromAverageTicket,
  scenarioInputProblem,
  scenarioKindFor,
  SCENARIO_SPECS,
} from '@/lib/reports/scenarios';

describe('scenarioKindFor (deterministic eligibility)', () => {
  it('maps eligible demand/conversion categories to a scenario kind', () => {
    expect(scenarioKindFor({ category: 'PHONE-DEPENDENT CUSTOMER JOURNEY', classification: 'MANUAL VALIDATION REQUIRED' })).toBe('phone');
    expect(scenarioKindFor({ category: 'RESERVATION FRICTION', classification: 'INFERRED OPPORTUNITY' })).toBe('reservation');
    expect(scenarioKindFor({ category: 'ONLINE ORDERING FAILURE RISK', classification: 'VERIFIED FINDING' })).toBe('ordering');
    expect(scenarioKindFor({ category: 'CATERING LEAD CAPTURE OPPORTUNITY', classification: 'MANUAL VALIDATION REQUIRED' })).toBe('lead');
    expect(scenarioKindFor({ category: 'WEAK PUBLIC RETENTION SIGNALS', classification: 'MANUAL VALIDATION REQUIRED' })).toBe('reactivation');
    expect(scenarioKindFor({ category: 'CONFUSING CTA HIERARCHY', classification: 'INFERRED OPPORTUNITY' })).toBe('website');
  });

  it('returns null for non-eligible categories and insufficient-data findings', () => {
    expect(scenarioKindFor({ category: 'WEBSITE TECHNICAL FOUNDATION', classification: 'VERIFIED FINDING' })).toBeNull();
    expect(scenarioKindFor({ category: 'MENU ACCESS FRICTION', classification: 'VERIFIED FINDING' })).toBeNull();
    expect(scenarioKindFor({ category: 'CONTACT PATH FRICTION', classification: 'INFERRED OPPORTUNITY' })).toBeNull();
    expect(scenarioKindFor({ category: 'PHONE-DEPENDENT CUSTOMER JOURNEY', classification: 'INSUFFICIENT DATA' })).toBeNull();
  });
});

// Every figure below is an explicit, user-entered assumption. The module holds
// no default quantities; a scenario exists only when every input is supplied.
const PHONE = { missedCallsPerDay: 5, commercialIntentPercent: 30, averageTransaction: 45, operatingDays: 365 };
const ENTERED: Record<string, Record<string, number>> = {
  phone: PHONE,
  reservation: { lostBookingsPerWeek: 3, partySize: 2, perGuestValue: 40, operatingWeeks: 52 },
  ordering: { abandonedOrdersPerDay: 2, averageOrder: 35, operatingDays: 365 },
  lead: { unansweredInquiriesPerMonth: 2, closePercent: 50, eventValue: 500, operatingMonths: 12 },
  reactivation: { guestsReengagedPerMonth: 20, visitsPerGuest: 2, averageTicket: 40, operatingMonths: 12 },
  website: { lostConversionsPerDay: 3, valuePerConversion: 40, operatingDays: 365 },
};
const KINDS = ['phone', 'reservation', 'ordering', 'lead', 'reactivation', 'website'] as const;

describe('calculateScenario (user-entered inputs only, decimal-safe)', () => {
  it('computes the phone example exactly from entered figures (5 × 30% × $45 × 365 = $24,637.50)', () => {
    const sc = calculateScenario('phone', PHONE, 'friction')!;
    expect(sc.annualExposureCents).toBe(2_463_750);
    expect(sc.monthlyExposureCents).toBe(205_313); // 24637.50 / 12 rounded to cents
    expect(sc.classification).toBe('USER-ENTERED SCENARIO');
  });

  it('displays the output as a magnitude, not to the cent', () => {
    const sc = calculateScenario('phone', PHONE)!;
    expect(sc.annualExposure).toBe('about $25,000');
    expect(sc.monthlyExposure).toBe('about $2,100');
    expect(sc.annualExposure).not.toMatch(/\.\d{2}/);
  });

  it('shows back every input, each labelled as the user\'s own assumption', () => {
    const sc = calculateScenario('phone', PHONE)!;
    expect(sc.assumptions).toHaveLength(4);
    for (const a of sc.assumptions) expect(a.qualifier).toBe('your assumption');
    const labels = sc.assumptions.map((a) => a.label.toLowerCase()).join(' ');
    expect(labels).toContain('missed calls per day');
    expect(labels).toContain('intent');
    expect(labels).toContain('transaction value');
    expect(labels).toContain('operating days');
    expect(sc.assumptions.map((a) => a.value)).toEqual(['5', '30%', '$45.00', '365']);
  });

  it('never invents an input: any missing figure yields no scenario at all', () => {
    for (const kind of KINDS) {
      expect(calculateScenario(kind, {}), kind).toBeNull();
      const [first, ...rest] = Object.keys(ENTERED[kind]);
      const partial = Object.fromEntries(rest.map((k) => [k, ENTERED[kind][k]]));
      expect(calculateScenario(kind, partial), `${kind} without ${first}`).toBeNull();
    }
  });

  it('rejects invalid figures rather than coercing them', () => {
    expect(calculateScenario('phone', { ...PHONE, missedCallsPerDay: -1 })).toBeNull();
    expect(calculateScenario('phone', { ...PHONE, commercialIntentPercent: 130 })).toBeNull();
    expect(calculateScenario('phone', { ...PHONE, operatingDays: 400 })).toBeNull();
    expect(calculateScenario('phone', { ...PHONE, averageTransaction: Number.NaN })).toBeNull();
  });

  it('every scenario says it is not a measured loss, forecast or guaranteed recovery', () => {
    for (const kind of KINDS) {
      const sc = calculateScenario(kind, ENTERED[kind])!;
      expect(sc, kind).not.toBeNull();
      expect(sc.confidenceStatement).toMatch(/not a measured loss/i);
      expect(sc.confidenceStatement).toMatch(/not a forecast/i);
      expect(sc.confidenceStatement).toMatch(/not a guaranteed recovery/i);
      expect(sc.dataRequiredToValidate.length).toBeGreaterThan(0);
      expect(sc.annualExposure).toMatch(/^about \$[\d,]+$/);
      expect(sc.annualExposureCents).toBeGreaterThan(0);
    }
  });

  it('never labels inputs as benchmark or industry average', () => {
    const serialized = JSON.stringify([SCENARIO_SPECS, KINDS.map((k) => calculateScenario(k, ENTERED[k]))]);
    expect(serialized.toLowerCase()).not.toContain('industry average');
    expect(serialized.toLowerCase()).not.toContain('benchmark');
    expect(serialized.toLowerCase()).not.toContain('typical restaurant');
  });

  it('is decimal-exact for reservation (3 × 2 × $40 × 52 = $12,480.00)', () => {
    const sc = calculateScenario('reservation', ENTERED.reservation)!;
    expect(sc.annualExposureCents).toBe(1_248_000);
    expect(sc.annualExposure).toBe('about $12,000');
  });

  it('the module holds no default quantities', async () => {
    const mod = await import('@/lib/reports/scenarios');
    expect('SCENARIO_DEFAULTS' in mod).toBe(false);
    expect('buildScenario' in mod).toBe(false);
    for (const spec of Object.values(SCENARIO_SPECS)) {
      // A field states what it is and its upper LIMIT — never a value to use.
      for (const field of spec.fields) expect(Object.keys(field).sort()).toEqual(['key', 'label', 'max', 'unit']);
    }
  });
});

// P2-3 (review of d14e2b7): days, weeks and months shared one limit of 366,
// so 365 "operating months" produced an annual figure 30× too large.
describe('P2-3: each period is bounded by its own unit', () => {
  it('rejects more than 12 operating months, and says so', () => {
    const lead = { unansweredInquiriesPerMonth: 2, closePercent: 50, eventValue: 500 };
    expect(calculateScenario('lead', { ...lead, operatingMonths: 365 })).toBeNull();
    expect(calculateScenario('lead', { ...lead, operatingMonths: 13 })).toBeNull();
    expect(calculateScenario('lead', { ...lead, operatingMonths: 12 })!.annualExposureCents).toBe(600_000);
    expect(scenarioInputProblem('lead', { ...lead, operatingMonths: 365 })).toBe('Operating months per year must be a number from 0 to 12.');
  });

  it('rejects more than 53 operating weeks', () => {
    const r = { lostBookingsPerWeek: 1, partySize: 2, perGuestValue: 40 };
    expect(calculateScenario('reservation', { ...r, operatingWeeks: 366 })).toBeNull();
    expect(calculateScenario('reservation', { ...r, operatingWeeks: 54 })).toBeNull();
    expect(calculateScenario('reservation', { ...r, operatingWeeks: 53 })).not.toBeNull();
    expect(scenarioInputProblem('reservation', { ...r, operatingWeeks: 54 })).toMatch(/Operating weeks per year must be a number from 0 to 53/);
  });

  it('rejects more than 366 operating days', () => {
    expect(calculateScenario('phone', { ...PHONE, operatingDays: 367 })).toBeNull();
    expect(calculateScenario('phone', { ...PHONE, operatingDays: 366 })).not.toBeNull();
  });

  it('every period field carries the limit of its own unit', () => {
    for (const spec of Object.values(SCENARIO_SPECS)) {
      const period = spec.fields.find((f) => f.unit === 'periods')!;
      const expected = /days/i.test(period.label) ? 366 : /weeks/i.test(period.label) ? 53 : /months/i.test(period.label) ? 12 : NaN;
      expect(period.max, `${spec.kind}: ${period.label}`).toBe(expected);
    }
  });

  it('reports no problem for valid or still-empty inputs', () => {
    expect(scenarioInputProblem('phone', PHONE)).toBeNull();
    expect(scenarioInputProblem('phone', {})).toBeNull();
  });
});

// P2-4 (review of d14e2b7): finite inputs could still overflow — 1e308 dollars
// produced Infinity cents and "about $NaN" as a completed what-if.
describe('P2-4: no input can produce an unrepresentable result', () => {
  it('rejects the reported overflow cases instead of showing $NaN', () => {
    expect(calculateScenario('ordering', { abandonedOrdersPerDay: 1, averageOrder: 1e308, operatingDays: 365 })).toBeNull();
    expect(calculateScenario('ordering', { abandonedOrdersPerDay: 0, averageOrder: 1e308, operatingDays: 365 })).toBeNull();
    expect(calculateScenario('ordering', { abandonedOrdersPerDay: 1e20, averageOrder: 35, operatingDays: 365 })).toBeNull();
    expect(scenarioInputProblem('ordering', { abandonedOrdersPerDay: 1, averageOrder: 1e308, operatingDays: 365 })).toMatch(
      /^Average order value must be a number from 0 to \$100,000\.$/,
    );
  });

  it('every field has an explicit upper limit', () => {
    for (const spec of Object.values(SCENARIO_SPECS)) {
      for (const f of spec.fields) expect(Number.isFinite(f.max) && f.max > 0, `${spec.kind}.${f.key}`).toBe(true);
    }
  });

  it('even every input at its limit gives an exact, safely representable total', () => {
    for (const spec of Object.values(SCENARIO_SPECS)) {
      const atMax = Object.fromEntries(spec.fields.map((f) => [f.key, f.max]));
      const sc = calculateScenario(spec.kind, atMax);
      expect(sc, spec.kind).not.toBeNull();
      expect(Number.isSafeInteger(sc!.annualExposureCents), spec.kind).toBe(true);
      expect(sc!.annualExposure, spec.kind).toMatch(/^about \$[\d,]+$/);
      expect(sc!.monthlyExposure, spec.kind).not.toMatch(/NaN|Infinity/);
    }
  });

  it('parses only plain amounts — no scientific notation, hex or words', () => {
    expect(parseScenarioInput('45')).toBe(45);
    expect(parseScenarioInput(' 45.50 ')).toBe(45.5);
    expect(parseScenarioInput('$1,200')).toBe(1200);
    expect(parseScenarioInput('30%')).toBe(30);
    expect(parseScenarioInput('')).toBeNull();
    for (const bad of ['1e308', '1E3', '0x10', 'Infinity', 'NaN', '-5', 'five', '1.2.3']) {
      expect(Number.isNaN(parseScenarioInput(bad)), bad).toBe(true);
    }
  });
});

describe('prefillFromAverageTicket (only a figure the owner already entered)', () => {
  it('fills only the per-transaction dollar field, never a count, rate or period', () => {
    expect(prefillFromAverageTicket('phone', 60)).toEqual({ averageTransaction: 60 });
    expect(prefillFromAverageTicket('ordering', 60)).toEqual({ averageOrder: 60 });
    // event value is not a per-cover ticket
    expect(prefillFromAverageTicket('lead', 60)).toEqual({});
  });

  it('prefills nothing for a null or invalid ticket', () => {
    expect(prefillFromAverageTicket('phone', null)).toEqual({});
    expect(prefillFromAverageTicket('phone', 0)).toEqual({});
    expect(prefillFromAverageTicket('phone', -5)).toEqual({});
  });
});
