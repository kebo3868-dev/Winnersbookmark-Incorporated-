import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { StoreUnavailableError } from '@/lib/store';

export const uuidSchema = z.string().uuid();

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

/** Parse a JSON body against a schema, refusing oversized or malformed input. */
export async function readJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = 32_768): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const text = await request.text();
  if (text.length > maxBytes) return { ok: false, response: jsonError(413, 'REQUEST TOO LARGE') };
  let value: unknown;
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: jsonError(400, 'INVALID JSON') };
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, response: jsonError(400, 'INVALID INPUT', { issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }) };
  }
  return { ok: true, data: parsed.data };
}

/** Map infrastructure failures to a response without leaking internals. */
export function failure(error: unknown) {
  if (error instanceof StoreUnavailableError) return jsonError(503, 'DATABASE NOT CONFIGURED');
  console.error('[agentos] request failed', error);
  return jsonError(500, 'INTERNAL ERROR');
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}
