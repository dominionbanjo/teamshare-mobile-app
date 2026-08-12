import { apiFetch } from './client';
import type { Paginated, Project, ProjectMember, Task } from './types';

export interface CreateProjectPayload {
  name: string;
  teamId?: string;
  companyId?: string;
}

export async function listProjects(token: string, page = 1, pageSize = 50): Promise<Paginated<Project>> {
  return apiFetch<Paginated<Project>>('/projects', { token, query: { page, pageSize } });
}

export async function getProject(token: string, id: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, { token });
}

export async function createProject(token: string, payload: CreateProjectPayload): Promise<Project> {
  return apiFetch<Project>('/projects', { method: 'POST', body: payload, token });
}

export async function listProjectTasks(
  token: string,
  projectId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<Task>> {
  return apiFetch<Paginated<Task>>(`/projects/${projectId}/tasks`, { token, query: { page, pageSize } });
}

export async function listProjectMembers(
  token: string,
  projectId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<ProjectMember>> {
  return apiFetch<Paginated<ProjectMember>>(`/projects/${projectId}/members`, { token, query: { page, pageSize } });
}
