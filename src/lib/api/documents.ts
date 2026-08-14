import { apiFetch, apiFetchEnvelope } from './client';
import type { DocumentItem, Paginated } from './types';

export interface CreateDocumentLinkPayload {
  projectId: string;
  name: string;
  type: 'link';
  url: string;
}

export async function listDocuments(
  token: string,
  projectId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<DocumentItem>> {
  return apiFetchEnvelope<DocumentItem[]>('/documents', {
    token,
    query: { projectId, page, pageSize },
  }).then(({ data, pagination }) => ({
    items: data,
    pagination: pagination ?? { page, pageSize, total: data.length, totalPages: 1 },
  }));
}

export async function createDocumentLink(token: string, payload: CreateDocumentLinkPayload): Promise<DocumentItem> {
  return apiFetch<DocumentItem>('/documents/link', { method: 'POST', body: payload, token });
}

/** Upload a document file - multipart form (projectId, name, type=file, file). */
export async function uploadDocumentFile(token: string, formData: FormData): Promise<DocumentItem> {
  return apiFetch<DocumentItem>('/documents/upload', { method: 'POST', formData, token });
}

/** Cloudinary-hosted file document: presign -> upload -> record the secure_url. */
export async function createHostedDocument(
  token: string,
  payload: { projectId: string; name: string; mime: string; url: string }
): Promise<DocumentItem> {
  return apiFetch<DocumentItem>('/documents', { method: 'POST', body: payload, token });
}

export async function deleteDocument(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/documents/${id}`, { method: 'DELETE', token });
}
