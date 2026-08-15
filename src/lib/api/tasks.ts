import { apiFetch, apiFetchEnvelope } from './client';
import type { ChecklistItem, Paginated, Subtask, Task } from './types';

export interface ChecklistEntryPayload {
  title: string;
  done?: boolean;
}

export interface SubtaskEntryPayload {
  title: string;
  done?: boolean;
  assigneeId?: string;
  dueDate?: string;
}

export interface CreateTaskPayload {
  projectId: string;
  title: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  assigneeId?: string;
  dueDate?: string;
  tags?: string[];
  /** One-shot creation: checklist rows on the task (IMP-240). */
  checklist?: ChecklistEntryPayload[];
  /** One-shot creation: top-level subtasks (IMP-240). */
  subtasks?: SubtaskEntryPayload[];
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

// ---------------------------------------------------------------------------
// Subtasks (IMP-240)
// ---------------------------------------------------------------------------

export async function createSubtask(
  token: string,
  taskId: string,
  payload: { title: string; parentId?: string; assigneeId?: string; dueDate?: string }
): Promise<Subtask> {
  return apiFetch<Subtask>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: payload, token });
}

export async function listSubtasks(token: string, taskId: string): Promise<Subtask[]> {
  return apiFetch<Subtask[]>(`/tasks/${taskId}/subtasks`, { token });
}

export async function updateSubtask(
  token: string,
  subtaskId: string,
  payload: { title?: string; done?: boolean; parentId?: string; assigneeId?: string; dueDate?: string }
): Promise<Subtask> {
  return apiFetch<Subtask>(`/subtasks/${subtaskId}`, { method: 'PATCH', body: payload, token });
}

export async function deleteSubtask(token: string, subtaskId: string): Promise<void> {
  return apiFetch<void>(`/subtasks/${subtaskId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Checklist items (IMP-240)
// ---------------------------------------------------------------------------

export async function listTaskChecklistItems(token: string, taskId: string): Promise<ChecklistItem[]> {
  return apiFetch<ChecklistItem[]>(`/tasks/${taskId}/checklist-items`, { token });
}

export async function createTaskChecklistItem(
  token: string,
  taskId: string,
  payload: { title: string }
): Promise<ChecklistItem> {
  return apiFetch<ChecklistItem>(`/tasks/${taskId}/checklist-items`, {
    method: 'POST',
    body: payload,
    token,
  });
}

export async function createSubtaskChecklistItem(
  token: string,
  subtaskId: string,
  payload: { title: string }
): Promise<ChecklistItem> {
  return apiFetch<ChecklistItem>(`/subtasks/${subtaskId}/checklist-items`, {
    method: 'POST',
    body: payload,
    token,
  });
}

export async function updateChecklistItem(
  token: string,
  checklistItemId: string,
  payload: { title?: string; done?: boolean }
): Promise<ChecklistItem> {
  return apiFetch<ChecklistItem>(`/checklist-items/${checklistItemId}`, {
    method: 'PATCH',
    body: payload,
    token,
  });
}

export async function deleteChecklistItem(token: string, checklistItemId: string): Promise<void> {
  return apiFetch<void>(`/checklist-items/${checklistItemId}`, { method: 'DELETE', token });
}
