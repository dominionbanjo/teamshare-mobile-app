/**
 * TeamShare mobile API client.
 * Mirrors docs/api-contract.md: envelope { success, data, pagination? } /
 * { success: false, error: { code, message, details? } } under /api.
 */

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

/**
 * Fetch wrapper parsing the TeamShare envelope.
 * Throws ApiError on transport failures, non-2xx statuses, or error envelopes.
 */
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, formData, token, query }: ApiFetchOptions = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
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

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response
  }

  if (payload && typeof payload === 'object' && 'success' in payload) {
    const envelope = payload as { success: boolean; data?: T; error?: ApiErrorPayload; pagination?: ApiPagination };
    if (envelope.success) return envelope.data as T;
    throw new ApiError(
      envelope.error?.message ?? 'Something went wrong.',
      envelope.error?.code ?? 'UNKNOWN_ERROR',
      response.status,
      envelope.error?.details
    );
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status}).`, 'HTTP_ERROR', response.status);
  }

  return payload as T;
}

/**
 * Parse the envelope and return `data` + `pagination` (server-side paging).
 * Mirrors the web client; list endpoints return `data` as the array.
 */
export async function apiFetchEnvelope<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<{ data: T; pagination?: ApiPagination }> {
  const { method = 'GET', body, formData, token, query } = options;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
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
    if (envelope.success) return { data: envelope.data as T, pagination: envelope.pagination };
    throw new ApiError(
      envelope.error?.message ?? 'Something went wrong.',
      envelope.error?.code ?? 'UNKNOWN_ERROR',
      response.status,
      envelope.error?.details
    );
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status}).`, 'HTTP_ERROR', response.status);
  }

  return { data: payload as T };
}
