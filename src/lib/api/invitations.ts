import { apiFetch } from './client';
import type { Invitation, Paginated } from './types';

export interface CreateInvitationPayload {
  email: string;
  role: string;
  companyId?: string;
  projectId?: string;
}

export async function listInvitations(
  token: string,
  status: Invitation['status'] = 'pending',
  page = 1,
  pageSize = 50
): Promise<Paginated<Invitation>> {
  return apiFetch<Paginated<Invitation>>('/invitations', { token, query: { status, page, pageSize } });
}

export async function createInvitation(token: string, payload: CreateInvitationPayload): Promise<Invitation> {
  return apiFetch<Invitation>('/invitations', { method: 'POST', body: payload, token });
}

export async function acceptInvitation(token: string, id: string): Promise<Invitation> {
  return apiFetch<Invitation>(`/invitations/${id}/accept`, { method: 'POST', token });
}

export async function declineInvitation(token: string, id: string): Promise<Invitation> {
  return apiFetch<Invitation>(`/invitations/${id}/decline`, { method: 'POST', token });
}
