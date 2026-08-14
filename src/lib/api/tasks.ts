import { apiFetch, apiFetchEnvelope } from './client';
import type { Paginated, Task } from './types';

export interface CreateTaskPayload {
  projectId: string;
  title: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  assigneeId?: string;
  dueDate?: string;
  tags?: string[];
}

export type UpdateTaskPayload = Partial<Omit<CreateTaskPayload, 'projectId'>>;

export interface ListTasksParams {
  projectId?: string;
  status?: Task['status'];
  assigneeId?: string;
  page?: number;
  pageSize?: number;
}

export async function listTasks(token: string, params: ListTasksParams = {}): Promise<Paginated<Task>> {
  const { page = 1, pageSize = 25, ...rest } = params;
  return apiFetchEnvelope<Task[]>('/tasks', { token, query: { page, pageSize, ...rest } }).then(
    ({ data, pagination }) => ({
      items: data,
      pagination: pagination ?? { page, pageSize, total: data.length, totalPages: 1 },
    })
  );
}

export async function getTask(token: string, id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, { token });
}

export async function createTask(token: string, payload: CreateTaskPayload): Promise<Task> {
  return apiFetch<Task>('/tasks', { method: 'POST', body: payload, token });
}

export async function updateTask(token: string, id: string, payload: UpdateTaskPayload): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: payload, token });
}

export async function watchTask(token: string, id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/watch`, { method: 'POST', token });
}

export async function unwatchTask(token: string, id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/watch`, { method: 'DELETE', token });
}
