import { apiFetch } from './client';
import type { Company, CompanyMember, CompanyMembershipRow, Membership } from './types';

export interface CreateCompanyPayload {
  name: string;
  slug: string;
}

export interface UpdateCompanyPayload {
  name?: string;
  slug?: string;
}

/** GET /companies - memberships (with nested company) for the current user. */
export async function listCompanies(token: string): Promise<{ items: CompanyMembershipRow[] }> {
  return apiFetch<{ items: CompanyMembershipRow[] }>('/companies', { token });
}

export async function getCompany(token: string, id: string): Promise<Company> {
  return apiFetch<Company>(`/companies/${id}`, { token });
}

export async function createCompany(token: string, payload: CreateCompanyPayload): Promise<Company> {
  return apiFetch<Company>('/companies', { method: 'POST', body: payload, token });
}

export async function updateCompany(token: string, id: string, payload: UpdateCompanyPayload): Promise<Company> {
  return apiFetch<Company>(`/companies/${id}`, { method: 'PATCH', body: payload, token });
}

export async function deleteCompany(token: string, id: string): Promise<Company> {
  return apiFetch<Company>(`/companies/${id}`, { method: 'DELETE', token });
}

/** GET /companies/:id/members - members with nested user profiles. */
export async function listCompanyMembers(token: string, id: string): Promise<{ items: CompanyMember[] }> {
  return apiFetch<{ items: CompanyMember[] }>(`/companies/${id}/members`, { token });
}

export async function updateMembershipRole(
  token: string,
  membershipId: string,
  role: CompanyMember['role']
): Promise<Membership> {
  return apiFetch<Membership>(`/memberships/${membershipId}/role`, {
    method: 'PATCH',
    body: { role },
    token,
  });
}

export async function deleteMembership(token: string, membershipId: string): Promise<Membership> {
  return apiFetch<Membership>(`/memberships/${membershipId}`, { method: 'DELETE', token });
}
