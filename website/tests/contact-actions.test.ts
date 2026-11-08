import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitContactForm } from '@/app/contact/actions';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('marketing contact action', () => {
  it('preserves a strategy call request in the fields recognized by lead ingest', async () => {
    vi.stubEnv('LEADS_INGEST_URL', 'https://example.test/leads');
    vi.stubEnv('MARKETING_INGEST_SECRET', 'test-secret-for-contact-ingest');
    const fetchLead = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchLead);

    const form = new FormData();
    form.set('name', 'Test Owner');
    form.set('email', 'owner@example.test');
    form.set('interest', 'strategy-call');
    form.set('message', 'I would like help with our ordering page.');

    await expect(submitContactForm(null, form)).resolves.toEqual({ ok: true });
    const body = fetchLead.mock.calls[0]?.[1]?.body;
    expect(typeof body).toBe('string');
    expect(JSON.parse(String(body))).toMatchObject({
      interest: 'consulting',
      message: 'Strategy call requested.\n\nI would like help with our ordering page.',
      sourcePath: '/contact?interest=strategy-call',
    });
  });

  it('still requires a visitor message when they request a strategy call', async () => {
    const form = new FormData();
    form.set('name', 'Test Owner');
    form.set('email', 'owner@example.test');
    form.set('interest', 'strategy-call');

    await expect(submitContactForm(null, form)).resolves.toMatchObject({
      ok: false,
      kind: 'validation',
      fieldErrors: { message: expect.any(String) },
    });
  });
});
