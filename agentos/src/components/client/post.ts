/** Same-origin JSON POST. The browser adds the Origin header the API requires. */
export async function postJson(url: string, body: unknown = {}): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

export function errorText(result: { status: number; data: Record<string, unknown> }): string {
  const error = typeof result.data.error === 'string' ? result.data.error : `Request failed (${result.status})`;
  return error;
}
