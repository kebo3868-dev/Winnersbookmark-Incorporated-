import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { marketingLeadSchema, normaliseInterest, emptyToNull } from '@/lib/marketing/schema';

describe('marketing lead validation', () => {
  const valid = { name: 'Jane Doe', email: 'jane@example.com', message: 'Help with missed calls.' };

  it('accepts the minimum viable enquiry', () => {
    expect(marketingLeadSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a name, an email and a message', () => {
    for (const field of ['name', 'email', 'message'] as const) {
      const body = { ...valid, [field]: '' };
      expect(marketingLeadSchema.safeParse(body).success, `${field} should be required`).toBe(false);
    }
  });

  it('rejects an address that is obviously not an email', () => {
    for (const email of ['jane', 'jane@', '@example.com', 'jane@example', 'a b@example.com']) {
      expect(marketingLeadSchema.safeParse({ ...valid, email }).success, email).toBe(false);
    }
  });

  it('trims surrounding whitespace rather than treating it as content', () => {
    const parsed = marketingLeadSchema.safeParse({ ...valid, name: '  Jane Doe  ' });
    expect(parsed.success && parsed.data.name).toBe('Jane Doe');
  });

  it('accepts an enquiry with no optional fields at all', () => {
    const parsed = marketingLeadSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('caps field lengths so a single submission cannot be unbounded', () => {
    expect(marketingLeadSchema.safeParse({ ...valid, message: 'x'.repeat(5001) }).success).toBe(false);
    expect(marketingLeadSchema.safeParse({ ...valid, name: 'x'.repeat(121) }).success).toBe(false);
  });
});

describe('interest normalisation', () => {
  it('keeps a known offer', () => {
    expect(normaliseInterest('ai-front-desk')).toBe('ai-front-desk');
  });

  it('is case and whitespace insensitive', () => {
    expect(normaliseInterest('  AI-Front-Desk ')).toBe('ai-front-desk');
  });

  it('discards an unknown value rather than rejecting the lead', () => {
    // The lead must survive. An unrecognised campaign parameter is not a
    // reason to lose a customer enquiry.
    expect(normaliseInterest('some-campaign-from-2027')).toBeNull();
  });

  it('handles non-string input safely', () => {
    expect(normaliseInterest(undefined)).toBeNull();
    expect(normaliseInterest(42)).toBeNull();
    expect(normaliseInterest({})).toBeNull();
  });
});

describe('emptyToNull', () => {
  it('treats an empty or whitespace-only form field as absent', () => {
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull('   ')).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
    expect(emptyToNull(null)).toBeNull();
  });

  it('preserves and trims real content', () => {
    expect(emptyToNull('  Acme Ltd  ')).toBe('Acme Ltd');
  });
});

describe('founder notification', () => {
  const lead = {
    id: 'lead_123',
    name: 'Jane Doe',
    email: 'jane@example.com',
    company: null,
    phone: null,
    websiteUrl: null,
    interest: 'ai-front-desk',
    message: 'Missing calls during service.',
    flaggedSpam: false,
    createdAt: new Date('2026-09-05T10:00:00Z'),
  };

  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.MARKETING_LEAD_NOTIFY_EMAIL;
    delete process.env.MARKETING_LEAD_FROM_EMAIL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.restoreAllMocks();
  });

  it('reports not_configured when no recipient is set, without throwing', async () => {
    const { notifyFounderOfLead } = await import('@/lib/marketing/notify');
    const result = await notifyFounderOfLead(lead);
    expect(result.outcome).toBe('not_configured');
  });

  it('reports not_configured when a recipient exists but no provider does', async () => {
    process.env.MARKETING_LEAD_NOTIFY_EMAIL = 'keith@example.com';
    process.env.MARKETING_LEAD_FROM_EMAIL = 'site@example.com';
    const { notifyFounderOfLead } = await import('@/lib/marketing/notify');
    const result = await notifyFounderOfLead(lead);
    expect(result.outcome).toBe('not_configured');
  });

  it('reports failed — never sent — when the provider is misconfigured', async () => {
    process.env.MARKETING_LEAD_NOTIFY_EMAIL = 'keith@example.com';
    process.env.MARKETING_LEAD_FROM_EMAIL = 'site@example.com';
    process.env.EMAIL_PROVIDER = 'resend';
    // RESEND_API_KEY deliberately absent.
    const { notifyFounderOfLead } = await import('@/lib/marketing/notify');
    const result = await notifyFounderOfLead(lead);
    expect(result.outcome).toBe('failed');
  });

  it('never reports sent for an invalid configured address', async () => {
    process.env.MARKETING_LEAD_NOTIFY_EMAIL = 'not-an-address';
    process.env.MARKETING_LEAD_FROM_EMAIL = 'site@example.com';
    process.env.EMAIL_PROVIDER = 'mock';
    const { notifyFounderOfLead } = await import('@/lib/marketing/notify');
    const result = await notifyFounderOfLead(lead);
    expect(result.outcome).toBe('failed');
  });
});
