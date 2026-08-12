/**
 * TeamShare activity & analytics - mirror of backend /audit (PRD F13).
 */

import { apiFetch } from './client';
import type { Paginated } from './types';

export type PriorityKey = 'low' | 'medium' | 'high' | 'urgent';

export interface AuditMemberWorkload {
  userId: string;
  name?: string | null;
  avatarUrl?: string | null;
  count: number;
}

export interface AuditStats {
  tasksResolvedLast7Days?: number;
  openCount?: number;
  overdueCount?: number;
  openByPriority?: Partial<Record<PriorityKey, number>>;
  memberWorkload?: AuditMemberWorkload[];
}

export interface AuditActor {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface AuditActivityItem {
  id: string;
  type: string;
  actor?: AuditActor | null;
  summary?: string;
  createdAt: string;
}

export async function getAuditStats(token: string, projectId?: string): Promise<AuditStats> {
  return apiFetch<AuditStats>('/audit/stats', { token, query: projectId ? { projectId } : {} });
}

export async function getAuditActivity(
  token: string,
  projectId?: string,
  page = 1,
  pageSize = 25
): Promise<Paginated<AuditActivityItem>> {
  return apiFetch<Paginated<AuditActivityItem>>('/audit/activity', {
    token,
    query: { page, pageSize, ...(projectId ? { projectId } : {}) },
  });
}
