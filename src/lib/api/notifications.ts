import { apiFetch, apiFetchEnvelope } from './client';
import type { Notification, NotificationSettings, Paginated } from './types';

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

/** Exact unread count across ALL pages (badge source, IMP-250). */
export async function unreadNotificationCount(token: string): Promise<number> {
  return apiFetch<{ count: number }>('/notifications/unread-count', { token }).then((r) => r.count);
}

/** Registers the device's Expo push token (OS delivery when app is closed). */
export async function savePushToken(token: string, pushToken: string): Promise<{ saved: boolean }> {
  return apiFetch<{ saved: boolean }>('/notifications/push-token', {
    method: 'POST',
    token,
    body: { token: pushToken, platform: 'expo' },
  });
}

export async function getNotificationSettings(token: string): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>('/notifications/settings', { token });
}

export async function updateNotificationSettings(
  token: string,
  patch: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>('/notifications/settings', {
    method: 'PATCH',
    token,
    body: patch,
  });
}
