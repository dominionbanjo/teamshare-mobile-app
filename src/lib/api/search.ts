/**
 * TeamShare global search - mirror of backend /search (PRD F12).
 * Env var keys are never returned by search (docs/api-contract.md).
 */

import { apiFetchEnvelope } from './client';
import type { Paginated } from './types';

export type SearchKindValue = 'task' | 'comment' | 'document' | 'chat';

export interface SearchResult {
  id: string;
  kind: SearchKindValue;
  title: string;
  snippet?: string | null;
  deepLink: string;
  projectId?: string | null;
}

export interface SearchParams {
  q: string;
  type?: SearchKindValue | 'all';
  page?: number;
  pageSize?: number;
}

export async function searchWorkspace(token: string, params: SearchParams): Promise<Paginated<SearchResult>> {
  const { page = 1, pageSize = 25 } = params;
  return apiFetchEnvelope<SearchResult[]>('/search', { token, query: { ...params } }).then(
    ({ data, pagination }) => ({
      items: data,
      pagination: pagination ?? { page, pageSize, total: data.length, totalPages: 1 },
    })
  );
}
