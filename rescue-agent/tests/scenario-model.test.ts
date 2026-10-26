import { describe, expect, it } from 'vitest';
import { calculateScenario, prefillFromAverageTicket, scenarioKindFor, SCENARIO_SPECS } from '@/lib/reports/scenarios';

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
      for (const field of spec.fields) expect(Object.keys(field).sort()).toEqual(['key', 'label', 'unit']);
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
