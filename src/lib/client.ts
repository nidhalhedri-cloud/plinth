'use client';

// Tiny fetch wrapper for the browser: sends/receives JSON, throws the API's error message.
export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  // Don't force a JSON content-type on FormData — the browser must set the multipart boundary.
  const isForm = rest.body instanceof FormData;
  const res = await fetch(path, {
    ...rest,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...(rest.headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || 'Request failed');
  return data as T;
}
