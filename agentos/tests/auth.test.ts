import { describe, expect, it } from 'vitest';
import { authConfig, hashPassword, issueSession, SESSION_TTL_SECONDS, verifyPassword, verifySession } from '@/lib/auth/session';
import { isSameOrigin } from '@/lib/auth/owner';
import { SECURITY_HEADERS } from '@/lib/security/headers.mjs';

const HASH = hashPassword('correct horse battery staple');
const ENV = { AGENTOS_OWNER_PASSWORD_HASH: HASH, AGENTOS_SESSION_SECRET: 'x'.repeat(40) };

describe('password hashing', () => {
  it('verifies the right password and rejects others', () => {
    expect(verifyPassword('correct horse battery staple', HASH)).toBe(true);
    expect(verifyPassword('Correct horse battery staple', HASH)).toBe(false);
    expect(verifyPassword('', HASH)).toBe(false);
  });

  it('salts every hash', () => {
    expect(hashPassword('same password')).not.toBe(hashPassword('same password'));
  });

  it('rejects malformed or weak-parameter hashes', () => {
    expect(verifyPassword('pw', 'plaintext')).toBe(false);
    expect(verifyPassword('pw', 'scrypt$1024$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe(false);
  });
});

describe('configuration fails closed', () => {
  it('requires a valid hash and a long secret', () => {
    expect(authConfig({}).ok).toBe(false);
    expect(authConfig({ ...ENV, AGENTOS_SESSION_SECRET: 'short' }).ok).toBe(false);
    expect(authConfig({ ...ENV, AGENTOS_OWNER_PASSWORD_HASH: 'hunter2' }).ok).toBe(false);
    expect(authConfig(ENV).ok).toBe(true);
  });

  it('accepts no session at all when unconfigured', () => {
    expect(verifySession('v1.9999999999.abc.def', {})).toBe(false);
  });
});

describe('sessions', () => {
  const config = authConfig(ENV);
  if (!config.ok) throw new Error('test config invalid');
  const now = Date.parse('2026-10-30T12:00:00Z');

  it('accepts a fresh token and rejects it after expiry', () => {
    const token = issueSession(config, now);
    expect(verifySession(token, ENV, now)).toBe(true);
    expect(verifySession(token, ENV, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
  });

  it('rejects tampering', () => {
    const token = issueSession(config, now);
    const [v, exp, nonce, mac] = token.split('.');
    expect(verifySession(`${v}.${Number(exp) + 9999}.${nonce}.${mac}`, ENV, now)).toBe(false);
    expect(verifySession(`${v}.${exp}.${nonce}.${mac.slice(0, -2)}AA`, ENV, now)).toBe(false);
    expect(verifySession(undefined, ENV, now)).toBe(false);
  });

  it('is invalidated by a password change or secret rotation', () => {
    const token = issueSession(config, now);
    expect(verifySession(token, { ...ENV, AGENTOS_OWNER_PASSWORD_HASH: hashPassword('a different password') }, now)).toBe(false);
    expect(verifySession(token, { ...ENV, AGENTOS_SESSION_SECRET: 'y'.repeat(40) }, now)).toBe(false);
  });
});

describe('request origin', () => {
  const req = (origin: string | null) => new Request('https://agentos.example.com/api/tasks', { method: 'POST', headers: origin ? { origin } : {} });
  it('accepts only this host', () => {
    expect(isSameOrigin(req('https://agentos.example.com'))).toBe(true);
    expect(isSameOrigin(req('https://evil.example.com'))).toBe(false);
    expect(isSameOrigin(req(null))).toBe(false);
    expect(isSameOrigin(req('null'))).toBe(false);
  });
});

describe('security headers', () => {
  it('refuses framing, indexing and referrers', () => {
    const map = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));
    expect(map['X-Frame-Options']).toBe('DENY');
    expect(map['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(map['X-Robots-Tag']).toContain('noindex');
    expect(map['Referrer-Policy']).toBe('no-referrer');
  });
});
