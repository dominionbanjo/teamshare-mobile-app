import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { io, type Socket } from 'socket.io-client';
import * as React from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { getAccessToken, onTokenRefreshed } from '@/lib/auth/token-refresh';
import { savePushToken, unreadNotificationCount } from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query/keys';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:4000';

// Foreground presentation (IMP-250): locally-scheduled banners (socket
// events) show in-app; remote push banners are suppressed while the app is
// foregrounded (the socket already surfaces them) and show via the OS when
// the app is backgrounded/closed.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const trigger = notification.request.trigger;
    const isRemote = trigger !== null && 'type' in trigger && trigger.type === 'push';
    return {
      shouldShowBanner: !isRemote,
      shouldShowList: !isRemote,
      shouldPlaySound: !isRemote,
      shouldSetBadge: false,
    };
  },
});

interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  deepLink?: string | null;
  actorId?: string | null;
}

/** One-time: register this device for OS-level pushes (best-effort). */
let pushRegistration: Promise<void> | null = null;
async function registerPushToken(token: string): Promise<void> {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) {
      const requested = await Notifications.requestPermissionsAsync();
      if (!requested.granted) return;
    }
    const pushToken = await Notifications.getExpoPushTokenAsync();
    await savePushToken(token, pushToken.data);
  } catch {
    // Expo Go / dev builds without EAS projectId throw - fine, socket +
    // local notifications still cover the foreground experience.
  }
}

/**
 * One realtime notification socket for the session. IMP-250:
 * - `notification:new` invalidates the list + unread badge and shows a local
 *   banner instantly; the device push token is registered once per session;
 * - tapping the banner deep-links to the notification's target;
 * - token rotation (auth function + auth:error) keeps the socket alive.
 */
export function NotificationSocketBridge() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!token) return;
    let socket: Socket | null = null;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnread });
    };

    const connect = () => {
      socket = io(`${WS_URL}/notifications`, {
        auth: (cb) => cb({ token: getAccessToken() }),
        transports: ['websocket'],
      });
      socket.on('connect', () => socket?.emit('join'));
      socket.on('notification:new', (notification: RealtimeNotification) => {
        if (!notification) return;
        invalidate();
        void Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.body ?? undefined,
            data: { deepLink: notification.deepLink ?? undefined },
          },
          trigger: null,
        }).catch(() => undefined);
      });
      socket.on('notification:read', () => invalidate());
      socket.on('auth:error', () => {
        // Token rejected - reconnect with the fresh token from the auth fn.
        if (socket) {
          socket.disconnect();
          socket.connect();
        }
      });
    };

    // Re-auth instantly when the API client rotates the access token.
    const unsubscribe = onTokenRefreshed(() => {
      if (socket?.connected) {
        socket.disconnect();
        socket.connect();
      }
    });

    connect();
    if (!pushRegistration) {
      pushRegistration = registerPushToken(token);
    }

    // Banner taps -> deep link.
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const deepLink = response.notification.request.content.data?.deepLink as string | undefined;
        if (deepLink) router.push(deepLink as never);
      }
    );

    return () => {
      unsubscribe();
      subscription.remove();
      socket?.disconnect();
    };
  }, [token, queryClient]);

  return null;
}

/** Exact unread count across ALL pages - badge source (IMP-250). */
export function useUnreadCount() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.notificationUnread,
    queryFn: () => unreadNotificationCount(token ?? ''),
    enabled: !!token,
    refetchInterval: 60_000,
  });
}
