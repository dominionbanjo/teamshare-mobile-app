import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { NotificationBing, Notification } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';

import {
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSkeletonList,
  TSButton,
} from '@/components/shared';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api/notifications';
import type { Notification as NotificationType } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatRelative } from '@/lib/format';
import { tokens } from '@/constants/theme';
import { cn } from '@/lib/utils';

export default function NotificationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => listNotifications(token ?? ''),
    enabled: !!token,
  });

  const markRead = useMutation({
    mutationFn: (notification: NotificationType) => markNotificationRead(token ?? '', notification.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(token ?? ''),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });

  const openNotification = (notification: NotificationType) => {
    if (!notification.readAt) markRead.mutate(notification);
    if (notification.deepLink) {
      try {
        router.push(notification.deepLink as never);
      } catch {
        // Unknown deep link target - stay on the list.
      }
    }
  };

  const unread = notifications.data?.items.filter((n) => !n.readAt).length ?? 0;

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={notifications.isRefetching}
          onRefresh={() => void notifications.refetch()}
          tintColor={tokens.primary}
        />
      }
    >
      <TSPageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'All caught up'}
        actions={
          <TSButton variant="outline" loading={markAll.isPending} onPress={() => markAll.mutate()} disabled={unread === 0}>
            Mark all read
          </TSButton>
        }
      />

      {notifications.isLoading ? (
        <TSSkeletonList rows={6} />
      ) : notifications.isError ? (
        <TSErrorState message={notifications.error.message} onRetry={() => void notifications.refetch()} />
      ) : notifications.data && notifications.data.items.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {notifications.data.items.map((notification, index) => {
            const isRead = !!notification.readAt;
            const isLast = index === notifications.data!.items.length - 1;
            return (
              <Pressable
                key={notification.id}
                onPress={() => openNotification(notification)}
                className={cn(
                  'min-h-12 flex-row items-start gap-3 px-4 py-3',
                  index > 0 && 'border-t border-border',
                  isLast && 'border-b-0',
                  !isRead && 'bg-muted'
                )}
              >
                {isRead ? (
                  <Notification size={18} variant="Outline" color={tokens.textMuted} />
                ) : (
                  <NotificationBing size={18} variant="Bold" color={tokens.primary} />
                )}
                <View className="flex-1 gap-0.5">
                  <Text className={cn('text-sm', isRead ? 'text-muted-foreground' : 'font-semibold text-foreground')}>
                    {notification.title}
                  </Text>
                  {notification.body ? (
                    <Text className="text-xs text-muted-foreground">{notification.body}</Text>
                  ) : null}
                  <Text className="text-xs text-muted-foreground">{formatRelative(notification.createdAt)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TSEmptyState
          icon={<NotificationBing size={28} variant="TwoTone" color={tokens.primary} />}
          title="No notifications"
          description="Mentions and task updates will show up here."
        />
      )}
    </TSScreen>
  );
}
