import { apiFetch } from './client';
import type { Attachment, Comment } from './types';

export interface CreateCommentPayload {
  /** Exactly one of taskId or documentId (backend validates). */
  taskId?: string;
  documentId?: string;
  /** Reply to another comment (backend stores parentId). */
  parentId?: string;
  body: string;
}

/**
 * GET /comments?taskId= - the backend returns a flat array (createdAt asc)
 * including parentId, so replies are grouped client-side.
 */
export async function listTaskComments(token: string, taskId: string): Promise<Comment[]> {
  return apiFetch<Comment[]>(`/comments`, { token, query: { taskId } });
}

export async function createComment(token: string, payload: CreateCommentPayload): Promise<Comment> {
  return apiFetch<Comment>('/comments', { method: 'POST', body: payload, token });
}

/** GET /attachments?taskId= - task attachments (IMP-240, hydrates detail). */
export async function listTaskAttachments(token: string, taskId: string): Promise<Attachment[]> {
  return apiFetch<Attachment[]>(`/attachments`, { token, query: { taskId } });
}
