import { apiFetch } from './client';
import type { Attachment } from './types';

/** A local file ready to upload (expo pickers return uri/name/mime). */
export interface LocalFile {
  uri: string;
  name: string;
  mime: string;
}

export interface CreateAttachmentPayload {
  taskId?: string | null;
  commentId?: string | null;
}

/**
 * Cloudinary direct-upload flow (backend signs, client uploads, URL attached):
 * 1. POST /attachments/presign {fileName, mime, folder} -> {uploadUrl, formParams}
 * 2. POST formParams + file to uploadUrl -> {secure_url}
 * 3. POST /attachments {taskId|commentId, url, name, mime} -> attachment row
 */
export async function presignAttachment(
  token: string,
  fileName: string,
  mime: string,
  folder: 'task' | 'comment' | 'chat' | 'documents' = 'task'
): Promise<{ uploadUrl: string; formParams: Record<string, string> }> {
  return apiFetch<{ uploadUrl: string; formParams: Record<string, string> }>('/attachments/presign', {
    method: 'POST',
    token,
    body: { fileName, mime, folder },
  });
}

export async function uploadToCloudinary(
  uploadUrl: string,
  formParams: Record<string, string>,
  file: LocalFile
): Promise<string> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(formParams)) {
    formData.append(key, value);
  }
  formData.append('file', { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);

  const res = await fetch(uploadUrl, { method: 'POST', body: formData });
  const json = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !json.secure_url) {
    throw new Error(json.error?.message ?? 'Cloudinary upload failed');
  }
  return json.secure_url;
}

export async function createAttachment(
  token: string,
  payload: CreateAttachmentPayload,
  url: string,
  name: string,
  mime: string
): Promise<Attachment> {
  return apiFetch<Attachment>('/attachments', {
    method: 'POST',
    token,
    body: {
      taskId: payload.taskId ?? undefined,
      commentId: payload.commentId ?? undefined,
      url,
      name,
      mime,
    },
  });
}

/** presign -> direct Cloudinary upload -> attach row, in one call. */
export async function uploadAttachmentCloudinary(
  token: string,
  payload: CreateAttachmentPayload,
  file: LocalFile,
  folder: 'task' | 'comment' | 'chat' | 'documents' = 'task'
): Promise<Attachment> {
  const { uploadUrl, formParams } = await presignAttachment(token, file.name, file.mime, folder);
  const secureUrl = await uploadToCloudinary(uploadUrl, formParams, file);
  return createAttachment(token, payload, secureUrl, file.name, file.mime);
}

export async function deleteAttachment(token: string, id: string): Promise<{ id: string; deleted: boolean }> {
  return apiFetch<{ id: string; deleted: boolean }>(`/attachments/${id}`, { method: 'DELETE', token });
}

/** Guess a mime type from a file name (pickers sometimes omit it). */
export function mimeFromName(name: string, fallback = 'application/octet-stream'): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
  };
  return map[ext] ?? fallback;
}
