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

/**
 * Record a file document from a reserved upload (media layer).
 *
 * `assetId` — NOT a url. The server reads the location and the verified byte size
 * off the asset row it minted, so a client cannot point a stored document at a URL
 * of its choosing nor dictate what it weighs against the quota.
 */
export async function createHostedDocument(
  token: string,
  payload: { projectId: string; name: string; mime: string; assetId: string }
): Promise<DocumentItem> {
  return apiFetch<DocumentItem>('/documents', { method: 'POST', body: payload, token });
}

export async function deleteDocument(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/documents/${id}`, { method: 'DELETE', token });
}
