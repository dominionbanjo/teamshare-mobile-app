import { apiFetch } from './client';
import type { EnvVar, EnvVarAuditEntry, Paginated } from './types';
import type { EnvTier } from '@/lib/validation/schemas';

export interface CreateEnvVarPayload {
  projectId: string;
  key: string;
  value: string;
  tier: EnvTier;
}

export interface RevealEnvVarResult {
  value: string;
}

/** List env vars for a project - API returns masked entries only (no values). */
export async function listEnvVars(
  token: string,
  projectId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<EnvVar>> {
  return apiFetch<Paginated<EnvVar>>(`/projects/${projectId}/env-vars`, { token, query: { page, pageSize } });
}

export async function createEnvVar(token: string, payload: CreateEnvVarPayload): Promise<EnvVar> {
  return apiFetch<EnvVar>('/env-vars', { method: 'POST', body: payload, token });
}

/** Reveal a secret on demand - audited server-side. */
export async function revealEnvVar(token: string, id: string): Promise<RevealEnvVarResult> {
  return apiFetch<RevealEnvVarResult>(`/env-vars/${id}/reveal`, { method: 'POST', token });
}

export async function deleteEnvVar(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/env-vars/${id}`, { method: 'DELETE', token });
}

/**
 * GET /env-vars/export?projectId=&tier= - returns dotenv text. The backend
 * wraps it in the standard envelope, so data is the plain string.
 */
export async function exportEnvVars(token: string, projectId: string, tier: string): Promise<string> {
  return apiFetch<string>('/env-vars/export', { token, query: { projectId, tier } });
}

/** Audit trail for a project's env vars (reveals, creates, deletes...). */
export async function listEnvVarAudit(
  token: string,
  projectId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<EnvVarAuditEntry>> {
  return apiFetch<Paginated<EnvVarAuditEntry>>(`/projects/${projectId}/env-vars/audit`, {
    token,
    query: { page, pageSize },
  });
}
