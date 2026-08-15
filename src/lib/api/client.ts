/**
 * TeamShare mobile API client.
 * Mirrors docs/api-contract.md: envelope { success, data, pagination? } /
 * { success: false, error: { code, message, details? } } under /api.
 * On 401 the client exchanges the refresh token once and retries the request
 * (IMP-250) - realtime + REST survive the 15-minute access-token expiry.
 */

import { refreshAccessToken } from '@/lib/auth/token-refresh';

export type ApiPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiEnvelope<T> = {
  success: true;
  data: T;
  pagination?: ApiPagination;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status: number;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Raw body (FormData). When set, body is ignored and Content-Type is not forced. */
  formData?: FormData;
  token?: string | null;
  query?: Record<string, unknown>;
};

function buildUrl(path: string, query?: ApiFetchOptions['query']): string {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  if (params.length === 0) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${params.join('&')}`;
}

async function doFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const { method = 'GET', body, formData, token, query } = options;
  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(formData ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (cause) {
    throw new ApiError('Network error - check your connection and try again.', 'NETWORK_ERROR', 0, cause);
  }
}

/**
 * Fetches with a single 401 -> refresh -> retry cycle. The refresh endpoint
 * itself is never retried (a failing refresh means the session is over).
 */
async function fetchWithRetry<T>(
  path: string,
  options: ApiFetchOptions,
  parse: (response: Response) => Promise<T>
): Promise<T> {
  let response = await doFetch(path, options);
  if (response.status === 401 && options.token && !path.includes('/auth/refresh')) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      response = await doFetch(path, { ...options, token: fresh });
    }
  }
  return parse(response);
}

async function parseEnvelope<T>(
  response: Response
): Promise<{ ok: boolean; data?: T; error?: ApiErrorPayload; pagination?: ApiPagination; payload?: unknown }> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response
  }
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const envelope = payload as {
      success: boolean;
      data?: T;
      error?: ApiErrorPayload;
      pagination?: ApiPagination;
    };
    return { ok: envelope.success, data: envelope.data, error: envelope.error, pagination: envelope.pagination, payload };
  }
  return { ok: response.ok, payload };
}

/**
 * Fetch wrapper parsing the TeamShare envelope.
 * Throws ApiError on transport failures, non-2xx statuses, or error envelopes.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  return fetchWithRetry<T>(path, options, async (response) => {
    const { ok, data, error } = await parseEnvelope<T>(response);
    if (ok && data !== undefined) return data;
    if (error) {
      throw new ApiError(error.message ?? 'Something went wrong.', error.code ?? 'UNKNOWN_ERROR', response.status, error.details);
    }
    if (!response.ok) {
      throw new ApiError(`Request failed (${response.status}).`, 'HTTP_ERROR', response.status);
    }
    return data as T;
  });
}

/**
 * Parse the envelope and return `data` + `pagination` (server-side paging).
 * Mirrors the web client; list endpoints return `data` as the array.
 */
export async function apiFetchEnvelope<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<{ data: T; pagination?: ApiPagination }> {
  return fetchWithRetry<{ data: T; pagination?: ApiPagination }>(path, options, async (response) => {
    const { ok, data, error, pagination, payload } = await parseEnvelope<T>(response);
    if (ok && data !== undefined) return { data, pagination };
    if (error) {
      throw new ApiError(error.message ?? 'Something went wrong.', error.code ?? 'UNKNOWN_ERROR', response.status, error.details);
    }
    if (!response.ok) {
      throw new ApiError(`Request failed (${response.status}).`, 'HTTP_ERROR', response.status);
    }
    return { data: payload as T };
  });
}
