import { apiFetch, apiFetchEnvelope } from './client';
import type { Notification, Paginated } from './types';

export async function listNotifications(token: string, page = 1, pageSize = 50): Promise<Paginated<Notification>> {
  return apiFetchEnvelope<Notification[]>('/notifications', { token, query: { page, pageSize } }).then(
    ({ data, pagination }) => ({
      items: data,
      pagination: pagination ?? { page, pageSize, total: data.length, totalPages: 1 },
    })
  );
}

export async function markNotificationRead(token: string, id: string): Promise<Notification> {
  return apiFetch<Notification>(`/notifications/${id}/read`, { method: 'POST', token });
}

export async function markAllNotificationsRead(token: string): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/notifications/read-all', { method: 'POST', token });
}
