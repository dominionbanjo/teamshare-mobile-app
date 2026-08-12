/**
 * TeamShare global search - mirror of backend /search (PRD F12).
 * Env var keys are never returned by search (docs/api-contract.md).
 */

import { apiFetch } from './client';
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
  return apiFetch<Paginated<SearchResult>>('/search', { token, query: { ...params } });
}
