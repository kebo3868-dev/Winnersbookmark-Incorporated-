import { describe, it, expect, vi, afterEach } from 'vitest';
import { ResendEmailProvider } from '@/lib/frontdesk/email/resend';
import { getEmailProvider, EmailProviderNotConfigured } from '@/lib/frontdesk/email/factory';

const message = {
  to: 'keith@example.com',
  from: 'site@example.com',
  subject: 'New enquiry',
  text: 'Body',
  reference: 'marketing-lead:abc',
  idempotencyKey: 'marketing-lead-abc',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ResendEmailProvider', () => {
  it('refuses to construct without an API key', () => {
    expect(() => new ResendEmailProvider('')).toThrow();
    expect(() => new ResendEmailProvider('   ')).toThrow();
  });

  it('is never marked simulated — a real send must not look like a mock', () => {
    expect(new ResendEmailProvider('key').simulated).toBe(false);
  });

  it('reports ACCEPTED with the provider id on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 })),
    );
    const result = await new ResendEmailProvider('key').send(message);
    expect(result.status).toBe('ACCEPTED');
    expect(result.providerMessageId).toBe('msg_1');
  });

  it('forwards the idempotency key so a retry cannot double-send', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await new ResendEmailProvider('key').send(message);

    const init = fetchMock.mock.calls[0][1];
    const headers = init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBe('marketing-lead-abc');
  });

  it('never puts the API key anywhere but the Authorization header', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ id: 'x' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await new ResendEmailProvider('super-secret-key').send(message);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain('super-secret-key');
    expect(String(init.body)).not.toContain('super-secret-key');
  });

  it('marks a 4xx rejection NON-retryable — retrying burns sending reputation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad address', { status: 422 })));
    const result = await new ResendEmailProvider('key').send(message);
    expect(result.status).toBe('FAILED');
    expect(result.retryable).toBe(false);
  });

  it('marks 429 and 5xx retryable', async () => {
    for (const status of [429, 500, 503]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('later', { status })));
      const result = await new ResendEmailProvider('key').send(message);
      expect(result.status, `status ${status}`).toBe('FAILED');
      expect(result.retryable, `status ${status}`).toBe(true);
    }
  });

  it('treats a transport failure as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('socket hang up'); }));
    const result = await new ResendEmailProvider('key').send(message);
    expect(result.status).toBe('FAILED');
    expect(result.retryable).toBe(true);
  });
});

describe('email provider factory', () => {
  it('still returns null when EMAIL_PROVIDER is unset — no accidental default', async () => {
    expect(await getEmailProvider({})).toBeNull();
  });

  it('builds the resend adapter when configured', async () => {
    const provider = await getEmailProvider({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'key' });
    expect(provider?.name).toBe('resend');
    expect(provider?.simulated).toBe(false);
  });

  it('refuses resend without a key rather than falling back to the mock', async () => {
    await expect(getEmailProvider({ EMAIL_PROVIDER: 'resend' })).rejects.toBeInstanceOf(
      EmailProviderNotConfigured,
    );
  });

  it('still refuses the mock in production', async () => {
    await expect(
      getEmailProvider({ EMAIL_PROVIDER: 'mock', NODE_ENV: 'production' }),
    ).rejects.toBeInstanceOf(EmailProviderNotConfigured);
  });
});
