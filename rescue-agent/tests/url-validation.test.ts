import { describe, expect, it } from 'vitest';
import { validateUrlSyntax, isPrivateAddress, normalizeUrl } from '@/lib/validation/url';

describe('validateUrlSyntax', () => {
  it('accepts a normal https restaurant URL', () => {
    const result = validateUrlSyntax('https://www.example-restaurant.com/menu');
    expect(result.ok).toBe(true);
  });

  it('adds https to bare domains', () => {
    const result = validateUrlSyntax('example-restaurant.com');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.protocol).toBe('https:');
  });

  it('rejects file: URLs', () => {
    expect(validateUrlSyntax('file:///etc/passwd').ok).toBe(false);
  });

  it('rejects javascript: URLs', () => {
    expect(validateUrlSyntax('javascript:alert(1)').ok).toBe(false);
  });

  it('rejects localhost and .internal hosts', () => {
    expect(validateUrlSyntax('http://localhost:3000').ok).toBe(false);
    expect(validateUrlSyntax('http://metadata.google.internal').ok).toBe(false);
    expect(validateUrlSyntax('http://foo.internal').ok).toBe(false);
  });

  it('rejects private IP literals', () => {
    for (const ip of ['http://127.0.0.1', 'http://10.0.0.5', 'http://192.168.1.1', 'http://172.16.0.1', 'http://169.254.169.254', 'http://[::1]']) {
      expect(validateUrlSyntax(ip).ok).toBe(false);
    }
  });

  it('rejects empty and garbage input', () => {
    expect(validateUrlSyntax('').ok).toBe(false);
    expect(validateUrlSyntax('not a url at all').ok).toBe(false);
    expect(validateUrlSyntax('nodots').ok).toBe(false);
  });
});

describe('isPrivateAddress (SSRF protection)', () => {
  it('flags loopback, private, link-local, CGNAT, metadata ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.31.255.255', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('flags private IPv6 including v4-mapped', () => {
    for (const ip of ['::1', 'fe80::1', 'fd00::1', '::ffff:192.168.1.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('strips hash and lowercases host, dedups trailing slash on root', () => {
    expect(normalizeUrl(new URL('https://EXAMPLE.com/#top'))).toBe('https://example.com');
    expect(normalizeUrl(new URL('https://example.com/menu/'))).toBe('https://example.com/menu/');
  });
});
