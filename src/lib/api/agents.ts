import type { CreateAgentInput, UpdateAgentInput } from '@/lib/validation/schemas';

import { apiFetch, apiFetchEnvelope, type ApiPagination } from './client';
import type { Agent, AgentCreated, AgentLogRow } from './types';

export interface AgentLogPage {
  data: AgentLogRow[];
  pagination?: ApiPagination;
}

/**
 * Agent Hub REST client (docs/agent-tasks/agent-hub-connection.md section 2).
 * Human calls use Bearer auth; agent calls use X-Api-Key server-side.
 */
export const agentsApi = {
  /** List visible agents; omit companyId for the personal scope. */
  list(query: { companyId?: string }, token: string): Promise<Agent[]> {
    return apiFetch<Agent[]>('/agents', { token, query: { companyId: query.companyId } });
  },

  get(id: string, token: string): Promise<Agent> {
    return apiFetch<Agent>(`/agents/${id}`, { token });
  },

  /** Create agent + underlying user; the returned token is shown ONCE. */
  create(input: CreateAgentInput, token: string): Promise<AgentCreated> {
    return apiFetch<AgentCreated>('/agents', { method: 'POST', body: input, token });
  },

  update(id: string, input: UpdateAgentInput, token: string): Promise<Agent> {
    return apiFetch<Agent>(`/agents/${id}`, { method: 'PATCH', body: input, token });
  },

  /** Hard delete user + agent + revoke keys. */
  delete(id: string, token: string): Promise<{ id: string; deleted: boolean }> {
    return apiFetch<{ id: string; deleted: boolean }>(`/agents/${id}`, { method: 'DELETE', token });
  },

  /** AgentLog feed, server-paginated. */
  logs(id: string, page: number, token: string): Promise<AgentLogPage> {
    return apiFetchEnvelope<AgentLogRow[]>(`/agents/${id}/logs`, { token, query: { page } });
  },
};
