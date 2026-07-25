import { describe, expect, it } from 'vitest';
import { buildScenario, scenarioKindFor, SCENARIO_DEFAULTS } from '@/lib/reports/scenarios';

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

describe('buildScenario (decimal-safe, assumptions always shown)', () => {
  it('computes the documented phone example exactly (5 × 0.30 × $45 × 365 = $24,637.50)', () => {
    const sc = buildScenario('phone', 'friction');
    expect(sc.annualExposure).toBe('$24,637.50');
    expect(sc.monthlyExposure).toBe('$2,053.13'); // 24637.50 / 12 rounded to cents
    expect(sc.classification).toBe('ILLUSTRATIVE SCENARIO');
  });

  it('surfaces every assumption used, each labeled illustrative — never a hidden input', () => {
    const sc = buildScenario('phone');
    expect(sc.assumptions).toHaveLength(4);
    for (const a of sc.assumptions) expect(a.qualifier).toBe('illustrative assumption');
    const labels = sc.assumptions.map((a) => a.label.toLowerCase()).join(' ');
    expect(labels).toContain('missed calls per day');
    expect(labels).toContain('intent');
    expect(labels).toContain('transaction value');
    expect(labels).toContain('operating days');
  });

  it('always includes a not-a-confirmed-loss confidence statement and data-to-validate list', () => {
    for (const kind of ['phone', 'reservation', 'ordering', 'lead', 'reactivation', 'website'] as const) {
      const sc = buildScenario(kind);
      expect(sc.confidenceStatement.toLowerCase()).toContain('not a confirmed loss');
      expect(sc.dataRequiredToValidate.length).toBeGreaterThan(0);
      expect(sc.assumptions.length).toBeGreaterThan(0);
      expect(sc.annualExposure).toMatch(/^\$[\d,]+\.\d{2}$/);
    }
  });

  it('never labels defaults as benchmark or industry average', () => {
    const serialized = JSON.stringify(['phone', 'reservation', 'ordering', 'lead', 'reactivation', 'website'].map((k) => buildScenario(k as never)));
    expect(serialized.toLowerCase()).not.toContain('industry average');
    expect(serialized.toLowerCase()).not.toContain('benchmark');
    expect(serialized.toLowerCase()).not.toContain('typical restaurant');
  });

  it('is decimal-exact for reservation (3 × 2 × $40 × 52 = $12,480.00)', () => {
    const sc = buildScenario('reservation');
    expect(sc.annualExposure).toBe('$12,480.00');
  });

  it('exposes centralized defaults for configuration', () => {
    expect(SCENARIO_DEFAULTS.phone.illustrativeMissedCallsPerDay).toBe(5);
    expect(SCENARIO_DEFAULTS.phone.commercialIntentRate).toBe(0.3);
  });
});

describe('withAverageTicket (owner-supplied ticket refinement)', () => {
  it('replaces per-transaction dollar values, keeps counts/rates illustrative', async () => {
    const { withAverageTicket, buildScenario } = await import('@/lib/reports/scenarios');
    const defaults = withAverageTicket(60);
    const phone = buildScenario('phone', 'friction', defaults);
    // 5 missed/day × 0.30 intent × $60 × 365 = $32,850.00
    expect(phone.annualExposure).toBe('$32,850.00');
    // assumption row reflects the real ticket
    expect(phone.assumptions.some((a) => a.value === '$60.00')).toBe(true);
    // still illustrative
    expect(phone.assumptions.every((a) => a.qualifier === 'illustrative assumption')).toBe(true);
  });

  it('returns base defaults unchanged for null/invalid ticket', async () => {
    const { withAverageTicket, SCENARIO_DEFAULTS } = await import('@/lib/reports/scenarios');
    expect(withAverageTicket(null)).toBe(SCENARIO_DEFAULTS);
    expect(withAverageTicket(0)).toBe(SCENARIO_DEFAULTS);
    expect(withAverageTicket(-5)).toBe(SCENARIO_DEFAULTS);
  });
})
