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

/**
 * Cloudinary form fields — re-sent verbatim alongside the file.
 *
 * There is deliberately NO `folder` field. Cloudinary prepends `folder` to
 * `public_id`, so a reserve that sent both stored every asset at
 * `folder/<public_id>` while the server verified at `<public_id>` — uploads landed
 * (storage answered 200) and were still reported as never received. The server
 * sends `public_id` as the full path and nothing else.
 */
export interface MediaFormParams {
  cloud_name: string;
  api_key: string;
  timestamp: string;
  signature: string;
  type?: string;
  /** The FULL storage path. The only location parameter. */
  public_id: string;
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
 * Media layer — mirrors `frontend/src/lib/api/media.ts`.
 *
 * The split: the API mints the asset id and DERIVES the storage path from it; the
 * device PUTs the bytes straight to storage. There is no confirmation step — the
 * server already knows where the bytes went, and the upload is verified when the
 * asset is attached to its owner (`POST /attachments` / `POST /documents` with the
 * `assetId`), which is also where a missing upload is reported. The device never
 * reports a URL, so what it sends on is an `assetId`.
 */

/**
 * Step 1 — ask the server where the file should go.
 *
 * `folder` is accepted and ignored, kept only so an older caller keeps compiling.
 * Storage location is derived from the asset id the server mints; a document's
 * `folderPath` is a TeamShare display tree and never reaches storage.
 */
export async function reserveUpload(
  token: string,
  input: {
    kind?: MediaKind;
    fileName: string;
    mime: string;
    /** @deprecated Ignored by the server; see the note above. */
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
      ...(input.sizeBytes ? { sizeBytes: input.sizeBytes } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
    },
  });
}

/**
 * Step 2 — hand the bytes to storage.
 *
 * Raw `fetch`: storage is NOT the TeamShare API, so there is no envelope and no
 * auth header.
 *
 * Storage's error message is surfaced rather than discarded. A rejection here is
 * almost always something specific (`public_id (...) is too long`, `Invalid
 * signature`, a media limit), and replacing it with a generic string is what turns
 * an upload bug into a mystery.
 *
 * The response is not read for a URL — the server already knows — but its
 * `public_id` IS checked against what we asked for, because a mismatch means the
 * bytes are somewhere the server does not own.
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
  const payload = (await res.json().catch(() => null)) as
    | { error?: { message?: string }; public_id?: string }
    | null;
  if (!res.ok) {
    throw new Error(
      payload?.error?.message
        ? `Upload to storage failed: ${payload.error.message}`
        : 'Upload to storage failed'
    );
  }
  const landedAt = payload?.public_id;
  if (landedAt && landedAt !== reservation.formParams.public_id) {
    throw new Error(
      `Storage kept the file at an unexpected location (${landedAt}). Nothing was saved — please retry.`
    );
  }
}

/** The whole lifecycle for a file that becomes an attachment row. */
export async function uploadMedia(
  token: string,
  file: LocalFile,
  opts: {
    kind?: MediaKind;
    /** @deprecated Ignored by the server. */
    folder?: string;
    projectId?: string;
    sizeBytes?: number;
  } = {}
): Promise<MediaUploadResult> {
  const reservation = await reserveUpload(token, {
    kind: opts.kind,
    fileName: file.name,
    mime: file.mime,
    sizeBytes: opts.sizeBytes,
    projectId: opts.projectId,
  });
  try {
    await putToStorage(reservation, file);
  } catch (err) {
    // Release the slot so the reaper has nothing to clean, rather than leaving it
    // to sit until the reservation expiry.
    await apiFetch(`/media/assets/${reservation.assetId}`, { method: 'DELETE', token }).catch(
      () => undefined
    );
    throw err;
  }
  // No confirmation step: the derived url is known from the reserve, and the
  // authoritative size is recorded server-side when the asset is attached.
  return {
    assetId: reservation.assetId,
    url: reservation.url,
    name: file.name,
    mime: file.mime,
  };
}

/** The bytes only (no attachment row) — for a document, an avatar, a cover. */
export async function uploadMediaAsset(
  token: string,
  file: LocalFile,
  opts: { kind?: MediaKind; /** @deprecated Ignored by the server. */ folder?: string; projectId?: string } = {}
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
