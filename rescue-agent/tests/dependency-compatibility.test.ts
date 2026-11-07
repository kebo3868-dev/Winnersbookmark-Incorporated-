import { describe, expect, it } from 'vitest';
import { z, validationIssues } from '@/lib/validation/zod';
import { messagingSchema, parseTenantConfig, tenantConfigSchema } from '@/lib/frontdesk/config/schema';
import { marketingLeadSchema } from '@/lib/marketing/schema';

describe('secure validator migration preserves application contracts', () => {
  it('rejects oversized constrained collections before validating their elements', () => {
    let visits = 0;
    const schema = z.array(z.string().superRefine(() => { visits++; })).max(2);
    expect(schema.safeParse(Array(10_000).fill('a')).success).toBe(false);
    expect(visits).toBe(0);
  });

  it('keeps messaging disabled and includes the nested email default', () => {
    const config = tenantConfigSchema.parse({ restaurantName: 'A' });
    expect(config.messaging).toEqual(messagingSchema.parse({}));
    expect(config.messaging.emailEnabled).toBe(false);
    expect(config.messaging.smsEnabled).toBe(false);
  });

  it('preserves stored integer thresholds and the established first error', () => {
    expect(tenantConfigSchema.parse({ restaurantName: 'A', thresholds: { largePartySize: 1e30 } }).thresholds.largePartySize).toBe(1e30);
    expect(parseTenantConfig({ restaurantName: 'A', thresholds: { largePartySize: 1.5 } })).toEqual({
      ok: false, error: 'thresholds.largePartySize: Expected integer, received float',
    });
  });

  it('keeps the public enquiry type error without additional length messages', () => {
    const result = marketingLeadSchema.safeParse({ name: [], email: 'a@example.com', message: 'Help' });
    expect(result.success).toBe(false);
    if (!result.success) expect(validationIssues(result.error).map(i => [i.path, i.message])).toEqual([
      [['name'], 'Expected string, received array'],
    ]);
  });

  it('keeps exact explicit public form messages', () => {
    const result = marketingLeadSchema.safeParse({ name: '', email: 'bad', message: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(validationIssues(result.error).map(i => i.message)).toEqual([
      'Enter your name', 'Enter a valid email address', 'Tell us what you need',
    ]);
  });

  it('keeps default stripping of unrecognized keys', () => {
    const result = tenantConfigSchema.parse({ restaurantName: 'A', unrecognized: 'discard', messaging: { unrecognized: 'discard' } });
    expect(result).not.toHaveProperty('unrecognized');
    expect(result.messaging).not.toHaveProperty('unrecognized');
  });
});
