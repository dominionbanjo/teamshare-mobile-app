import { apiFetch } from './client';
import type { Company, Paginated } from './types';

export interface CreateCompanyPayload {
  name: string;
  slug: string;
}

export async function listCompanies(token: string, page = 1, pageSize = 50): Promise<Paginated<Company>> {
  return apiFetch<Paginated<Company>>('/companies', { token, query: { page, pageSize } });
}

export async function getCompany(token: string, id: string): Promise<Company> {
  return apiFetch<Company>(`/companies/${id}`, { token });
}

export async function createCompany(token: string, payload: CreateCompanyPayload): Promise<Company> {
  return apiFetch<Company>('/companies', { method: 'POST', body: payload, token });
}
