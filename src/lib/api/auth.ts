import { apiFetch } from './client';
import type { AuthResponse, AuthTokens, User } from './types';

export interface SignUpPayload {
  name: string;
  email: string;
  password: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

/**
 * Raw shape the backend returns for login/register/google: tokens are FLAT
 * ({ user, accessToken, refreshToken }) - normalized to { user, tokens } for
 * the auth-context. Backend is canonical (docs/api-contract.md).
 */
interface RawAuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  verificationToken?: string;
}

function normalize(raw: RawAuthResponse): AuthResponse {
  const tokens: AuthTokens = {
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
  };
  return { user: raw.user, tokens };
}

export async function register(payload: SignUpPayload): Promise<AuthResponse> {
  const raw = await apiFetch<RawAuthResponse>('/auth/register', { method: 'POST', body: payload });
  return normalize(raw);
}

export async function login(payload: SignInPayload): Promise<AuthResponse> {
  const raw = await apiFetch<RawAuthResponse>('/auth/login', { method: 'POST', body: payload });
  return normalize(raw);
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } });
}

export async function getMe(token: string): Promise<User> {
  return apiFetch<User>('/users/me', { token });
}

/** Start Google OAuth - returns the authorize URL to open in a browser. */
export async function googleAuthorize(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/auth/google/authorize', { method: 'GET' });
}

/** Exchange the Google authorization code for a session (same shape as login). */
export async function googleToken(code: string): Promise<AuthResponse> {
  const raw = await apiFetch<RawAuthResponse>('/auth/google/token', { method: 'POST', body: { code } });
  return normalize(raw);
}
