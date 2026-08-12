import { apiFetch } from './client';
import type { Comment, Paginated } from './types';

export interface CreateCommentPayload {
  taskId: string;
  body: string;
}

export async function listTaskComments(
  token: string,
  taskId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<Comment>> {
  return apiFetch<Paginated<Comment>>(`/tasks/${taskId}/comments`, { token, query: { page, pageSize } });
}

export async function createComment(token: string, payload: CreateCommentPayload): Promise<Comment> {
  return apiFetch<Comment>('/comments', { method: 'POST', body: payload, token });
}
