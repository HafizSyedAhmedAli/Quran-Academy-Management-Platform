export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function sendJson<T = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: unknown };
    if (!res.ok) {
      return { ok: false, error: typeof json.error === 'string' ? json.error : 'Request failed' };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
