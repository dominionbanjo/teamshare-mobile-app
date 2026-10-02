import { API_BASE_URL, apiFetch } from './client';
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

export type MediaKind =
  | 'attachment'
  | 'document'
  | 'chat'
  | 'avatar'
  | 'blog_cover'
  | 'blog_asset'
  | 'whiteboard_thumbnail';

export interface MediaFormParams {
  cloud_name: string;
  api_key: string;
  timestamp: string;
  signature: string;
  folder: string;
  type?: string;
  public_id?: string;
  resource_type?: string;
}

export interface ReservedUpload {
  assetId: string;
  uploadUrl: string;
  formParams: MediaFormParams;
  /** Backend-derived delivery URL. Private unless `delivery: 'public'`. */
  url: string;
}

export interface MediaUploadResult {
  assetId: string;
  url: string;
  name: string;
  mime: string;
}

/**
 * Media layer (2026-10) — mirrors `frontend/src/lib/api/media.ts`.
 *
 * The split: the API mints the Cloudinary public id and owns the resulting URL;
 * the device PUTs the bytes straight to storage; the API confirms and verifies.
 * The device never reports a URL, so what it sends on to `POST /attachments` or
 * `POST /documents` is an `assetId`.
 */

/** Step 1 — ask the server where the file should go. */
export async function reserveUpload(
  token: string,
  input: {
    kind?: MediaKind;
    fileName: string;
    mime: string;
    folder?: string;
    sizeBytes?: number;
    projectId?: string;
  }
): Promise<ReservedUpload> {
  return apiFetch<ReservedUpload>('/media/uploads', {
    method: 'POST',
    token,
    body: {
      kind: input.kind ?? 'attachment',
      fileName: input.fileName,
      mime: input.mime,
      mimeType: input.mime,
      folder: input.folder ?? 'task',
      ...(input.sizeBytes ? { sizeBytes: input.sizeBytes } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
    },
  });
}

/**
 * Step 2 — hand the bytes to storage.
 *
 * Raw `fetch`: storage is NOT the TeamShare API, so there is no envelope and no
 * auth header. The response is not read for a URL — the server already knows.
 */
export async function putToStorage(
  reservation: ReservedUpload,
  file: LocalFile
): Promise<void> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(reservation.formParams)) {
    formData.append(key, String(value));
  }
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mime,
  } as unknown as Blob);

  const res = await fetch(reservation.uploadUrl, { method: 'POST', body: formData });
  if (!res.ok) {
    throw new Error('Upload to storage failed');
  }
}

/** Step 3 — confirm. The server verifies the bytes it actually received. */
export async function completeUpload(
  token: string,
  assetId: string,
  sizeBytes?: number
): Promise<{ assetId: string; url: string; verified: boolean }> {
  return apiFetch(`/media/uploads/${assetId}/complete`, {
    method: 'POST',
    token,
    body: sizeBytes ? { sizeBytes } : {},
  });
}

/** The whole lifecycle for a file that becomes an attachment row. */
export async function uploadMedia(
  token: string,
  file: LocalFile,
  opts: { kind?: MediaKind; folder?: string; projectId?: string; sizeBytes?: number } = {}
): Promise<MediaUploadResult> {
  const reservation = await reserveUpload(token, {
    kind: opts.kind,
    fileName: file.name,
    mime: file.mime,
    folder: opts.folder ?? 'task',
    sizeBytes: opts.sizeBytes,
    projectId: opts.projectId,
  });
  try {
    await putToStorage(reservation, file);
  } catch (err) {
    // Release the slot so the reaper has nothing to clean, rather than leaving it
    // to sit until the 30-minute reservation expiry.
    await apiFetch(`/media/assets/${reservation.assetId}`, { method: 'DELETE', token }).catch(
      () => undefined
    );
    throw err;
  }
  const done = await completeUpload(token, reservation.assetId, opts.sizeBytes);
  return { assetId: done.assetId, url: done.url, name: file.name, mime: file.mime };
}

/** The bytes only (no attachment row) — for a document, an avatar, a cover. */
export async function uploadMediaAsset(
  token: string,
  file: LocalFile,
  opts: { kind?: MediaKind; folder?: string; projectId?: string } = {}
): Promise<MediaUploadResult> {
  return uploadMedia(token, file, opts);
}

export async function createAttachment(
  token: string,
  payload: CreateAttachmentPayload,
  assetId: string,
  name: string,
  mime: string
): Promise<Attachment> {
  return apiFetch<Attachment>('/attachments', {
    method: 'POST',
    token,
    body: {
      taskId: payload.taskId ?? undefined,
      commentId: payload.commentId ?? undefined,
      assetId,
      name,
      mime,
    },
  });
}

/** The full lifecycle, ending in an attachment row. */
export async function uploadAttachmentMedia(
  token: string,
  payload: CreateAttachmentPayload,
  file: LocalFile,
  folder: 'task' | 'comment' | 'chat' | 'documents' = 'task'
): Promise<Attachment> {
  const asset = await uploadMedia(token, file, { folder, kind: 'attachment' });
  return createAttachment(token, payload, asset.assetId, file.name, file.mime);
}

export async function deleteAttachment(
  token: string,
  id: string
): Promise<{ id: string; deleted: boolean }> {
  return apiFetch(`/attachments/${id}`, { method: 'DELETE', token });
}

/**
 * A same-origin URL an `<Image source>` can fetch: it 302s to a freshly-signed
 * storage URL, so it never expires in a cached list.
 *
 * NOTE: a stored `attachment.url` is a private reference and will NOT render —
 * always resolve through here.
 */
export function attachmentRedirectUrl(id: string): string {
  return `${API_BASE_URL}/attachments/${id}?redirect=1`;
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
    csv: 'text/csv',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  };
  return map[ext] ?? fallback;
}
