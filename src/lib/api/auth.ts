import { apiFetch } from './client';
import type { AuthResponse, User } from './types';

export interface SignUpPayload {
  name: string;
  email: string;
  password: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export async function register(payload: SignUpPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: payload });
}

export async function login(payload: SignInPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: payload });
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } });
}

export async function getMe(token: string): Promise<User> {
  return apiFetch<User>('/users/me', { token });
}
