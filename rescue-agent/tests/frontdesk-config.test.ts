import { describe, expect, it } from 'vitest';
import { buildCompletenessReport } from '@/lib/frontdesk/config/completeness';
import { parseTenantConfig, tenantConfigSchema, type TenantConfig } from '@/lib/frontdesk/config/schema';
import { demoTenantBConfig, demoTenantConfig } from '@/lib/frontdesk/demo/tenant';

/**
 * ONBOARDING GATE (§XXII) and configuration safety (§XX).
 *
 * The point of these: a restaurant must not be able to go live in a state
 * where the front desk would quietly stop being useful, and a configuration
 * must never be a place where a credential can hide.
 */

describe('config parsing', () => {
  it('accepts a minimal configuration — most fields are optional by design', () => {
    // Requiring more here would push operators to enter placeholder data,
    // which is exactly what the anti-hallucination rules exist to prevent.
    const parsed = parseTenantConfig({ restaurantName: 'A Restaurant' });
    expect(parsed.ok).toBe(true);
  });

  it('rejects a configuration with no restaurant name', () => {
    const parsed = parseTenantConfig({ locations: [] });
    expect(parsed.ok).toBe(false);
  });

  it('rejects malformed hours rather than accepting them silently', () => {
    const parsed = parseTenantConfig({
      restaurantName: 'A Restaurant',
      locations: [
        {
          id: 'l1',
          name: 'Main',
          addressLine1: '1 Street',
          city: 'Town',
          state: 'FL',
          timezone: 'America/New_York',
          hours: { sun: [{ open: '25:00', close: '22:00' }], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] },
        },
      ],
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects a malformed holiday date', () => {
    const parsed = parseTenantConfig({
      restaurantName: 'A Restaurant',
      locations: [
        {
          id: 'l1',
          name: 'Main',
          addressLine1: '1 Street',
          city: 'Town',
          state: 'FL',
          timezone: 'America/New_York',
          holidayHours: [{ date: '25/12/2026', closed: true }],
        },
      ],
    });
    expect(parsed.ok).toBe(false);
  });

  it('returns an error string instead of throwing, so one bad tenant cannot blank a dashboard', () => {
    const parsed = parseTenantConfig({ restaurantName: '' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('restaurantName');
  });

  it('strips unknown keys rather than carrying arbitrary data through the engine', () => {
    const result = tenantConfigSchema.parse({ restaurantName: 'A', apiKey: 'sk-secret-value' });
    expect(result).not.toHaveProperty('apiKey');
  });

  it('both demo configurations are valid against the schema', () => {
    expect(tenantConfigSchema.safeParse(demoTenantConfig).success).toBe(true);
    expect(tenantConfigSchema.safeParse(demoTenantBConfig).success).toBe(true);
  });

  it('references messaging credentials by env var name, never by value', () => {
    // The schema has a `credentialRef` and no field for a secret itself, so a
    // stored config cannot become a place a token lives (§XX).
    const shape = Object.keys(tenantConfigSchema.shape.messaging._def.innerType.shape);
    expect(shape).toContain('credentialRef');
    expect(shape).not.toContain('apiKey');
    expect(shape).not.toContain('authToken');
  });
});

describe('missing information report', () => {
  it('clears the demo restaurant for activation', () => {
    const report = buildCompletenessReport(demoTenantConfig);
    expect(report.readyToActivate).toBe(true);
    expect(report.requiredGaps).toHaveLength(0);
  });

  it('blocks activation when there is no escalation contact', () => {
    const config: TenantConfig = { ...demoTenantConfig, escalationContacts: [] };
    const report = buildCompletenessReport(config);
    expect(report.readyToActivate).toBe(false);
    expect(report.requiredGaps.some((g) => g.field === 'escalationContacts')).toBe(true);
  });

  it('blocks activation when an escalation contact has no way to be reached', () => {
    const config: TenantConfig = {
      ...demoTenantConfig,
      escalationContacts: [{ key: 'manager', name: 'Nobody' }],
    };
    expect(buildCompletenessReport(config).readyToActivate).toBe(false);
  });

  it('blocks activation when no location has hours', () => {
    const config: TenantConfig = {
      ...demoTenantConfig,
      locations: [{ ...demoTenantConfig.locations[0], hours: undefined }],
    };
    const report = buildCompletenessReport(config);
    expect(report.readyToActivate).toBe(false);
    expect(report.requiredGaps.some((g) => g.capabilityLost.includes('hours'))).toBe(true);
  });

  it('blocks activation when reservations are on but point nowhere', () => {
    const config: TenantConfig = {
      ...demoTenantConfig,
      reservations: { enabled: true },
    };
    const report = buildCompletenessReport(config);
    expect(report.readyToActivate).toBe(false);
    expect(report.requiredGaps.some((g) => g.field === 'reservations')).toBe(true);
  });

  it('blocks activation when SMS is on with no sending number', () => {
    const config: TenantConfig = {
      ...demoTenantConfig,
      messaging: { ...demoTenantConfig.messaging, smsEnabled: true },
    };
    expect(buildCompletenessReport(config).readyToActivate).toBe(false);
  });

  it('names the capability each gap switches off, not just the missing field', () => {
    const config: TenantConfig = { ...demoTenantConfig, escalationContacts: [] };
    const gap = buildCompletenessReport(config).requiredGaps[0];
    expect(gap.capabilityLost.length).toBeGreaterThan(0);
    expect(gap.message.length).toBeGreaterThan(0);
  });

  it('allows activation with recommended gaps outstanding', () => {
    // A restaurant without catering is not broken — it just has catering off.
    const config: TenantConfig = { ...demoTenantConfig, catering: { enabled: false } };
    const report = buildCompletenessReport(config);
    expect(report.readyToActivate).toBe(true);
    expect(report.gaps.some((g) => g.severity === 'RECOMMENDED')).toBe(true);
  });

  it('flags the thinner demo restaurant as live-able but incomplete', () => {
    const report = buildCompletenessReport(demoTenantBConfig);
    expect(report.readyToActivate).toBe(true);
    expect(report.score).toBeLessThan(buildCompletenessReport(demoTenantConfig).score);
  });

  it('lists which capabilities are safe to switch on', () => {
    const report = buildCompletenessReport(demoTenantConfig);
    expect(report.enabledCapabilities).toEqual(
      expect.arrayContaining(['Answer hours questions', 'Take reservation requests', 'Route customers to a human']),
    );
  });

  it('warns when no holiday hours are configured', () => {
    const config: TenantConfig = {
      ...demoTenantConfig,
      locations: [{ ...demoTenantConfig.locations[0], holidayHours: [] }],
    };
    const report = buildCompletenessReport(config);
    expect(report.gaps.some((g) => g.field.includes('holidayHours'))).toBe(true);
  });
});
