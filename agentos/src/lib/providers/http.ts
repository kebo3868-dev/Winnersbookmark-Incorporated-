import { ProviderError } from './types';

/**
 * One JSON POST/GET to a provider, with a hard timeout and errors mapped to a
 * small set of kinds the orchestrator can act on (retry or stop).
 *
 * Secrets never leave this function inside an error: provider error bodies
 * are truncated and scrubbed of the request's own key and of anything shaped
 * like a common API key, because they are stored in the database and shown in
 * the dashboard.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface JsonRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  /** Values to scrub from any error text (the API key in use). */
  secrets: Array<string | undefined>;
  fetchImpl?: FetchLike;
}

const KEY_SHAPES = [/sk-[A-Za-z0-9_-]{8,}/g, /AIza[0-9A-Za-z_-]{20,}/g, /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi];

export function redact(text: string, secrets: Array<string | undefined>): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) out = out.split(secret).join('[redacted]');
  }
  for (const shape of KEY_SHAPES) out = out.replace(shape, '[redacted]');
  return out;
}

function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 60_000)) : undefined;
}

export async function requestJson(req: JsonRequest): Promise<unknown> {
  const fetchImpl = req.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(req.url, {
      method: req.method ?? 'POST',
      headers: { accept: 'application/json', ...(req.body !== undefined ? { 'content-type': 'application/json' } : {}), ...req.headers },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(req.timeoutMs),
      cache: 'no-store',
    });
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ProviderError('timeout', `No response within ${Math.round(req.timeoutMs / 1000)}s`);
    }
    throw new ProviderError('network', redact(`Could not reach provider: ${String((error as Error)?.message ?? error)}`, req.secrets));
  }

  const raw = await response.text().catch(() => '');
  if (!response.ok) {
    const detail = redact(raw.slice(0, 400), req.secrets).trim();
    const message = `HTTP ${response.status}${detail ? `: ${detail}` : ''}`;
    const status = response.status;
    if (status === 401 || status === 403) throw new ProviderError('auth', message, status);
    if (status === 429) throw new ProviderError('rate_limit', message, status, retryAfterMs(response.headers.get('retry-after')));
    if (status === 408 || status >= 500) throw new ProviderError('server', message, status, retryAfterMs(response.headers.get('retry-after')));
    throw new ProviderError('bad_request', message, status);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ProviderError('bad_response', `Provider returned non-JSON (HTTP ${response.status})`, response.status);
  }
}
