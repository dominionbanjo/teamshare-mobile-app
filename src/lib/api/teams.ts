import { apiFetch } from './client';
import type { Paginated, Team } from './types';

export interface CreateTeamPayload {
  name: string;
  leadId?: string;
}

export async function listTeams(token: string, page = 1, pageSize = 50): Promise<Paginated<Team>> {
  return apiFetch<Paginated<Team>>('/teams', { token, query: { page, pageSize } });
}

export async function createTeam(token: string, payload: CreateTeamPayload): Promise<Team> {
  return apiFetch<Team>('/teams', { method: 'POST', body: payload, token });
}
