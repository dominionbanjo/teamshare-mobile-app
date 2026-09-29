/**
 * Deleted-author fallback (2026-09).
 *
 * Mirrors `frontend/src/lib/format/deleted-author.ts` and the backend's
 * `common/utils/author-fallback.ts`. Author FKs are `ON DELETE SET NULL` so
 * removing an agent KEEPS the work it created - a comment, a task, a document
 * - instead of cascading it away or blocking the delete. The author is then
 * genuinely absent and every list needs a label.
 *
 * `DELETED_AUTHOR_ID` is synthetic: never a real user id, never a lookup key.
 */
export const DELETED_AUTHOR_ID = 'deleted-author';
export const DELETED_AUTHOR_NAME = 'Deleted agent';

/** Display name for a possibly-absent author (comment / chat message). */
export function displayAuthorName(
  author: { name?: string | null } | null | undefined,
  fallback: string = DELETED_AUTHOR_NAME,
): string {
  return author?.name?.trim() ? author.name : fallback;
}
