import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

let refreshPromise: Promise<void> | null = null;

async function tryRefresh(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

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

  let res = await fetch(`${BASE_URL}${url}`, { ...options, headers });

  // Handle 401 — try refresh once
  if (res.status === 401 && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      await refreshPromise;
      const newToken = getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
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

  let res = await fetch(`${BASE_URL}${url}`, { method: 'POST', headers, body: formData });

  // Handle 401 — try refresh once
  if (res.status === 401 && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => { refreshPromise = null; });
    }

    try {
      await refreshPromise;
      const newToken = getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${url}`, { method: 'POST', headers, body: formData });
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
  get<T>(url: string, params?: Record<string, string | number>): Promise<T> {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<T>(`${url}${qs}`);
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
