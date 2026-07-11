import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from 'undici';
import { lookup, type LookupAddress } from 'node:dns';
import { isPrivateAddress } from '@/lib/validation/url';

/**
 * DNS-rebinding-safe transport. The SSRF policy is enforced at connection time
 * by a custom lookup: every address DNS returns for the socket about to be
 * opened is checked against the private-range policy, so a hostname cannot
 * answer with a public IP during pre-validation and a private IP during the
 * actual fetch. Combined with manual redirect handling (each hop re-validated
 * by the caller), this closes the validate-then-fetch TOCTOU gap.
 */

function privateTargetsAllowed(): boolean {
  return process.env.RESCUE_AGENT_ALLOW_PRIVATE_TARGETS === '1' && process.env.NODE_ENV !== 'production';
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

export function safeLookup(
  hostname: string,
  options: { all?: boolean; family?: number | string; hints?: number },
  callback: LookupCallback,
): void {
  lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const records = addresses as LookupAddress[];
    if (records.length === 0) {
      const notFound: NodeJS.ErrnoException = Object.assign(new Error(`No addresses for ${hostname}`), { code: 'ENOTFOUND' });
      return callback(notFound, '');
    }
    if (!privateTargetsAllowed()) {
      const unsafe = records.find((r) => isPrivateAddress(r.address));
      if (unsafe) {
        const blocked: NodeJS.ErrnoException = Object.assign(
          new Error(`UNSAFE URL DESTINATION: ${hostname} resolves to a private or reserved address`),
          { code: 'EUNSAFEDEST' },
        );
        return callback(blocked, '');
      }
    }
    if (options?.all) return callback(null, records);
    const family = typeof options?.family === 'number' && options.family !== 0 ? options.family : undefined;
    const chosen = family ? records.find((r) => r.family === family) ?? records[0] : records[0];
    callback(null, chosen.address, chosen.family);
  });
}

const safeAgent = new Agent({
  connect: { lookup: safeLookup as never, timeout: 10_000 },
});

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs: number;
}

/** Single-hop fetch (redirects NOT followed) over the rebinding-safe agent. */
export async function safeFetchHop(url: string, options: SafeFetchOptions): Promise<UndiciResponse> {
  return undiciFetch(url, {
    method: 'GET',
    redirect: 'manual',
    dispatcher: safeAgent,
    signal: AbortSignal.timeout(options.timeoutMs),
    headers: options.headers,
  });
}

/**
 * Read a response body up to maxBytes, then cancel the stream. Never buffers
 * more than the cap regardless of Content-Length or chunked encoding.
 */
export async function readBodyCapped(response: UndiciResponse, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(0);
  const contentLength = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > maxBytes * 4) {
    // Grossly oversized declared payloads are not worth streaming at all.
    await response.body.cancel().catch(() => {});
    throw new Error(`Response too large (declared ${contentLength} bytes)`);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(Math.min(received, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= out.length) break;
    const slice = chunk.subarray(0, Math.min(chunk.length, out.length - offset));
    out.set(slice, offset);
    offset += slice.length;
  }
  return out;
}
