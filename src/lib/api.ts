// Lightweight API client. Returns null when no backend is configured (mock mode).
const RAW = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
export const API_URL = RAW && RAW.length > 0 ? RAW.replace(/\/$/, '') : null;
export const HAS_API = API_URL !== null;

const TOKEN_KEY = 'api_auth_token';
const DEVICE_ID_KEY = 'api_device_id';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

/**
 * Stable device id per browser (per localStorage). Used to:
 *  - identify the source of a mutation so the same client can ignore its own SSE echo
 *  - track presence per device
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `d-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  if (!API_URL) throw new ApiError('No API configured', 0);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Id': getDeviceId(),
  };
  if (opts.auth !== false) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!res.ok) throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
  return data as T;
}

/** Build the SSE stream URL with token+deviceId in the query (EventSource cannot set headers). */
export function eventStreamUrl(): string | null {
  const token = getToken();
  if (!API_URL || !token) return null;
  const params = new URLSearchParams({ token, deviceId: getDeviceId() });
  return `${API_URL}/events/stream?${params.toString()}`;
}
