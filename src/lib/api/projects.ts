import { apiFetch, apiFetchEnvelope } from './client';
import type { BuildQueue, Paginated, Project, ProjectMember, Task } from './types';

export interface CreateProjectPayload {
  name: string;
  teamId?: string;
  companyId?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  status?: 'active' | 'archived';
  blockUnassignedAgentWork?: boolean;
  /** IMP-680: the agent that works this project's ready-for-dev build queue. */
  buildAgentId?: string | null;
}

async function toPaginated<T>(result: { data: T[]; pagination?: Paginated<T>['pagination'] }): Promise<Paginated<T>> {
  return {
    items: result.data,
    pagination:
      result.pagination ?? { page: 1, pageSize: 50, total: result.data.length, totalPages: 1 },
  };
}

export async function listProjects(token: string, page = 1, pageSize = 50): Promise<Paginated<Project>> {
  return apiFetchEnvelope<Project[]>('/projects', { token, query: { page, pageSize } }).then(toPaginated);
}

export async function getProject(token: string, id: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, { token });
}

export async function createProject(token: string, payload: CreateProjectPayload): Promise<Project> {
  return apiFetch<Project>('/projects', { method: 'POST', body: payload, token });
}

export async function updateProject(token: string, id: string, payload: UpdateProjectPayload): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, { method: 'PATCH', body: payload, token });
}

// ---------------------------------------------------------------------------
// Build mode (IMP-680)
// ---------------------------------------------------------------------------

export async function getBuildQueue(token: string, projectId: string): Promise<BuildQueue> {
  return apiFetch<BuildQueue>(`/projects/${projectId}/build/queue`, { token });
}

export async function startBuild(token: string, projectId: string): Promise<{ started: boolean }> {
  return apiFetch<{ started: boolean }>(`/projects/${projectId}/build/start`, { method: 'POST', token });
}

export async function stopBuild(token: string, projectId: string): Promise<{ stopped: boolean }> {
  return apiFetch<{ stopped: boolean }>(`/projects/${projectId}/build/stop`, { method: 'POST', token });
}

export async function listProjectTasks(
  token: string,
  projectId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<Task>> {
  return apiFetchEnvelope<Task[]>(`/projects/${projectId}/tasks`, { token, query: { page, pageSize } }).then(
    toPaginated
  );
}

export async function listProjectMembers(
  token: string,
  projectId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<ProjectMember>> {
  return apiFetch<{ items: ProjectMember[] }>(`/projects/${projectId}/members`, { token }).then(
    ({ items }) => ({
      items,
      pagination: { page, pageSize, total: items.length, totalPages: 1 },
    })
  );
}
