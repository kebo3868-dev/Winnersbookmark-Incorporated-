import { describe, expect, it } from 'vitest';
import type { LookupAddress } from 'node:dns';
import { safeLookup } from '@/lib/web/safeFetch';

// NOTE: RESCUE_AGENT_ALLOW_PRIVATE_TARGETS is intentionally NOT set in this file —
// these tests verify the production behavior of the connection-time guard.

function runLookup(hostname: string, options: { all?: boolean } = {}) {
  return new Promise<{ err: NodeJS.ErrnoException | null; address: string | LookupAddress[] }>((resolve) => {
    safeLookup(hostname, options, (err, address) => resolve({ err, address }));
  });
}

describe('safeLookup (connection-time DNS rebinding guard)', () => {
  it('rejects hostnames that resolve to loopback at connection time', async () => {
    const { err } = await runLookup('localhost');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('EUNSAFEDEST');
    expect(err!.message).toMatch(/UNSAFE URL DESTINATION/);
  });

  it('fails closed on unresolvable hostnames', async () => {
    const { err } = await runLookup('definitely-not-a-real-host.invalid');
    expect(err).not.toBeNull();
  });
});
