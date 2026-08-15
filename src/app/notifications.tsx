import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { NotificationBing, Notification } from 'iconsax-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';

import {
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSkeletonList,
  TSButton,
} from '@/components/shared';
import { listNotifications, markAllNotificationsRead, markNotificationRead, unreadNotificationCount } from '@/lib/api/notifications';
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
  const [page, setPage] = React.useState(1);
  const [allItems, setAllItems] = React.useState<NotificationType[]>([]);

  const notifications = useQuery({
    // Flat key so socket invalidation of ['notifications'] prefix-matches it.
    queryKey: ['notifications', 'page', page],
    queryFn: () => listNotifications(token ?? '', page),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  // Exact unread count across ALL pages (IMP-250) - badge + header source.
  const unreadQuery = useQuery({
    queryKey: queryKeys.notificationUnread,
    queryFn: () => unreadNotificationCount(token ?? ''),
    enabled: !!token,
  });

  // Append pages as the user scrolls (pagination UI).
  React.useEffect(() => {
    const items = notifications.data?.items ?? [];
    if (items.length > 0 && page === 1) {
      setAllItems(items);
    } else if (items.length > 0 && page > 1) {
      setAllItems((prev) => {
        const known = new Set(prev.map((n) => n.id));
        return [...prev, ...items.filter((n) => !known.has(n.id))];
      });
    }
  }, [notifications.data, page]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnread });
  };

  const markRead = useMutation({
    mutationFn: (notification: NotificationType) => markNotificationRead(token ?? '', notification.id),
    onSuccess: () => {
      invalidate();
      setAllItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    },
  });
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(token ?? ''),
    onSuccess: () => {
      invalidate();
      setAllItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    },
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

  const unread = unreadQuery.data ?? allItems.filter((n) => !n.readAt).length;
  const total = notifications.data?.pagination?.total ?? allItems.length;
  const hasMore = notifications.data?.pagination
    ? notifications.data.pagination.totalPages > page
    : false;

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

      {notifications.isLoading && allItems.length === 0 ? (
        <TSSkeletonList rows={6} />
      ) : notifications.isError ? (
        <TSErrorState message={notifications.error.message} onRetry={() => void notifications.refetch()} />
      ) : allItems.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {allItems.map((notification, index) => {
            const isRead = !!notification.readAt;
            const isLast = index === allItems.length - 1;
            const rowPending = markRead.isPending && markRead.variables?.id === notification.id;
            return (
              <Pressable
                key={notification.id}
                onPress={() => openNotification(notification)}
                disabled={rowPending}
                className={cn(
                  'min-h-12 flex-row items-start gap-3 px-4 py-3',
                  index > 0 && 'border-t border-border',
                  isLast && 'border-b-0',
                  !isRead && 'bg-muted'
                )}
              >
                {rowPending ? (
                  <ActivityIndicator size="small" color={tokens.primary} />
                ) : isRead ? (
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
      {hasMore && (
        <TSButton
          variant="outline"
          loading={notifications.isFetching}
          onPress={() => setPage((p) => p + 1)}
          className="self-center"
        >
          Load more ({allItems.length}/{total})
        </TSButton>
      )}
    </TSScreen>
  );
}
