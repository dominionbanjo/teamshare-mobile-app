import { apiFetch } from './client';
import type { Notification, Paginated } from './types';

export async function listNotifications(token: string, page = 1, pageSize = 50): Promise<Paginated<Notification>> {
  return apiFetch<Paginated<Notification>>('/notifications', { token, query: { page, pageSize } });
}

export async function markNotificationRead(token: string, id: string): Promise<Notification> {
  return apiFetch<Notification>(`/notifications/${id}/read`, { method: 'POST', token });
}

export async function markAllNotificationsRead(token: string): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/notifications/read-all', { method: 'POST', token });
}
