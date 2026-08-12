import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { TaskSquare } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';

import {
  PriorityBadge,
  TaskStatusBadge,
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSkeletonList,
} from '@/components/shared';
import { listTasks } from '@/lib/api/tasks';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatDate } from '@/lib/format';
import { tokens } from '@/constants/theme';

export default function TasksScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const tasks = useQuery({
    queryKey: queryKeys.tasks({ all: true }),
    queryFn: () => listTasks(token ?? '', { pageSize: 100 }),
    enabled: !!token,
  });

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={tasks.isRefetching}
          onRefresh={() => void tasks.refetch()}
          tintColor={tokens.primary}
        />
      }
    >
      <TSPageHeader title="Tasks" description="Across all your projects" />

      {tasks.isLoading ? (
        <TSSkeletonList rows={7} />
      ) : tasks.isError ? (
        <TSErrorState message={tasks.error.message} onRetry={() => void tasks.refetch()} />
      ) : tasks.data && tasks.data.items.length > 0 ? (
        <View className="gap-3">
          {tasks.data.items.map((task) => (
            <Pressable key={task.id} onPress={() => router.push(`/tasks/${task.id}`)}>
              <View className="min-h-12 gap-1.5 rounded-lg border border-border bg-background p-3 shadow-sm">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 text-sm font-semibold text-foreground">{task.title}</Text>
                  <TaskStatusBadge status={task.status} />
                </View>
                <Text className="text-xs text-muted-foreground">
                  {task.project?.name ?? 'Project'} · {task.assignee?.name ?? 'Unassigned'}
                </Text>
                <View className="flex-row items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  {task.dueDate && <Text className="text-xs text-muted-foreground">Due {formatDate(task.dueDate)}</Text>}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<TaskSquare size={28} variant="TwoTone" color={tokens.primary} />}
          title="No tasks yet"
          description="Open a project and add your first task."
        />
      )}
    </TSScreen>
  );
}
