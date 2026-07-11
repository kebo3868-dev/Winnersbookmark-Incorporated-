import { describe, expect, it } from 'vitest';
import { checkBasicAuth, resolveAuthMode } from '@/lib/auth';

const header = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

describe('checkBasicAuth', () => {
  it('accepts correct credentials', () => {
    expect(checkBasicAuth(header('keith', 's3cret'), 'keith', 's3cret')).toBe(true);
  });

  it('rejects wrong password, wrong user, and malformed headers', () => {
    expect(checkBasicAuth(header('keith', 'wrong'), 'keith', 's3cret')).toBe(false);
    expect(checkBasicAuth(header('mallory', 's3cret'), 'keith', 's3cret')).toBe(false);
    expect(checkBasicAuth(null, 'keith', 's3cret')).toBe(false);
    expect(checkBasicAuth('Bearer abc', 'keith', 's3cret')).toBe(false);
    expect(checkBasicAuth('Basic not-base64!!!', 'keith', 's3cret')).toBe(false);
    expect(checkBasicAuth(header('keith', 's3cret2'), 'keith', 's3cret')).toBe(false);
    expect(checkBasicAuth(header('keith', 's3cre'), 'keith', 's3cret')).toBe(false);
  });
});

describe('resolveAuthMode (fail-closed in production)', () => {
  it('requires auth when credentials are configured', () => {
    expect(resolveAuthMode({ BASIC_AUTH_USER: 'a', BASIC_AUTH_PASSWORD: 'b', NODE_ENV: 'production' })).toBe('required');
    expect(resolveAuthMode({ BASIC_AUTH_USER: 'a', BASIC_AUTH_PASSWORD: 'b', NODE_ENV: 'development' })).toBe('required');
  });

  it('fails CLOSED in production without credentials', () => {
    expect(resolveAuthMode({ NODE_ENV: 'production' })).toBe('misconfigured');
    expect(resolveAuthMode({ BASIC_AUTH_USER: 'a', NODE_ENV: 'production' })).toBe('misconfigured');
  });

  it('stays open outside production without credentials', () => {
    expect(resolveAuthMode({ NODE_ENV: 'development' })).toBe('open');
    expect(resolveAuthMode({ NODE_ENV: 'test' })).toBe('open');
  });
});
