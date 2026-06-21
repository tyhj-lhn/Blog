import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const REFRESH_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

let refreshPromise: Promise<void> | null = null;

/** Fetch wrapper that rejects after timeoutMs via AbortController */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryRefresh(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetchWithTimeout(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }, REFRESH_TIMEOUT_MS);

  if (!res.ok) {
    clearTokens();
    throw new Error('Refresh failed');
  }

  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetchWithTimeout(`${BASE_URL}${url}`, { ...options, headers }, REQUEST_TIMEOUT_MS);

  // Handle 401 — try refresh once
  if (res.status === 401 && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      // Race against timeout to prevent hanging if refresh stalls
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Refresh timed out')), REFRESH_TIMEOUT_MS),
      );
      await Promise.race([refreshPromise, timeoutPromise]);
      const newToken = getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetchWithTimeout(`${BASE_URL}${url}`, { ...options, headers }, REQUEST_TIMEOUT_MS);
    } catch {
      clearTokens();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || res.statusText;
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

async function uploadRequest<T>(url: string, formData: FormData): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  // Don't set Content-Type — browser will set multipart/form-data boundary

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetchWithTimeout(`${BASE_URL}${url}`, { method: 'POST', headers, body: formData }, UPLOAD_TIMEOUT_MS);

  // Handle 401 — try refresh once
  if (res.status === 401 && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => { refreshPromise = null; });
    }

    try {
      // Race against timeout to prevent hanging if refresh stalls
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Refresh timed out')), REFRESH_TIMEOUT_MS),
      );
      await Promise.race([refreshPromise, timeoutPromise]);
      const newToken = getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetchWithTimeout(`${BASE_URL}${url}`, { method: 'POST', headers, body: formData }, UPLOAD_TIMEOUT_MS);
    } catch {
      clearTokens();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || res.statusText;
    throw new Error(msg);
  }

  return res.json();
}

export const api = {
  get<T>(url: string, params?: Record<string, string | number>, options?: RequestInit): Promise<T> {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<T>(`${url}${qs}`, options);
  },

  post<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  del(url: string): Promise<void> {
    return request<void>(url, { method: 'DELETE' });
  },

  upload<T>(url: string, formData: FormData): Promise<T> {
    return uploadRequest<T>(url, formData);
  },
};
