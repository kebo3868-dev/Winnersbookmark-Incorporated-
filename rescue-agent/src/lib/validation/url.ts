import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

/**
 * Test-only escape hatch so integration tests can target a fixture server on
 * loopback. Hard-disabled in production builds regardless of the env var.
 */
function privateTargetsAllowed(): boolean {
  return process.env.RESCUE_AGENT_ALLOW_PRIVATE_TARGETS === '1' && process.env.NODE_ENV !== 'production';
}

/** Returns true when an IP address falls in a private, loopback, link-local, or otherwise unsafe range. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true; // "this" network, private, loopback
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 192 && b === 0) return true; // IETF protocol assignments / 192.0.2.0 test
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (lower.startsWith('fe80') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7)); // v4-mapped
    return false;
  }
  return true; // not an IP at all — treat as unsafe when used where an IP is expected
}

/** Syntactic validation: protocol, hostname shape. Does not hit the network. */
export function validateUrlSyntax(raw: string): UrlValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'INVALID WEBSITE URL' };
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'INVALID WEBSITE URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'INVALID WEBSITE URL' };
  }
  const host = url.hostname.toLowerCase();
  if (privateTargetsAllowed()) return { ok: true, url };
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, reason: 'UNSAFE URL DESTINATION' };
  }
  if (isIP(host.replace(/^\[|\]$/g, '')) && isPrivateAddress(host.replace(/^\[|\]$/g, ''))) {
    return { ok: false, reason: 'UNSAFE URL DESTINATION' };
  }
  if (!host.includes('.') && !isIP(host)) {
    return { ok: false, reason: 'INVALID WEBSITE URL' };
  }
  return { ok: true, url };
}

/** Full validation including DNS resolution to reject hostnames resolving into private ranges (SSRF). */
export async function validateUrlTarget(raw: string): Promise<UrlValidationResult> {
  const syntax = validateUrlSyntax(raw);
  if (!syntax.ok) return syntax;
  if (privateTargetsAllowed()) return syntax;
  const host = syntax.url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    return isPrivateAddress(host) ? { ok: false, reason: 'UNSAFE URL DESTINATION' } : syntax;
  }
  try {
    const records = await lookup(host, { all: true });
    if (records.length === 0) return { ok: false, reason: 'WEBSITE COULD NOT BE REACHED' };
    for (const record of records) {
      if (isPrivateAddress(record.address)) {
        return { ok: false, reason: 'UNSAFE URL DESTINATION' };
      }
    }
  } catch {
    return { ok: false, reason: 'WEBSITE COULD NOT BE REACHED' };
  }
  return syntax;
}

/** Normalize a URL for storage/dedup: lowercase host, strip hash, strip trailing slash on root. */
export function normalizeUrl(url: URL): string {
  const copy = new URL(url.toString());
  copy.hash = '';
  copy.hostname = copy.hostname.toLowerCase();
  let s = copy.toString();
  if (copy.pathname === '/' && !copy.search) s = s.replace(/\/$/, '');
  return s;
}
