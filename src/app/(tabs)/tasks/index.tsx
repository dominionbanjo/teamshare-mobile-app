import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SearchNormal1, TaskSquare } from 'iconsax-react-native';
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
  TSSelect,
  TSInput,
} from '@/components/shared';
import { listTasks } from '@/lib/api/tasks';
import type { Task } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatDate } from '@/lib/format';
import { tokens } from '@/constants/theme';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

/** "2026-08-16" -> end of that calendar day in UTC (due-on-or-before, inclusive). */
function toDueBeforeIso(dateText: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export default function TasksScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [status, setStatus] = React.useState<Task['status'] | ''>('');
  const [priority, setPriority] = React.useState<Task['priority'] | ''>('');
  const [dueText, setDueText] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filtersActive = status !== '' || priority !== '' || dueText !== '' || debouncedSearch !== '';

  const dueBefore = dueText ? toDueBeforeIso(dueText) : undefined;

  const tasks = useQuery({
    queryKey: queryKeys.tasks({ status, priority, dueBefore, search: debouncedSearch, all: true }),
    queryFn: () =>
      listTasks(token ?? '', {
        status: status || undefined,
        priority: priority || undefined,
        dueBefore,
        search: debouncedSearch || undefined,
        pageSize: 100,
      }),
    enabled: !!token,
  });

  const items = tasks.data?.items ?? [];

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

      <View className="gap-2">
        <TSInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks..."
          autoCapitalize="none"
          leadingIcon={<SearchNormal1 size={20} variant="Outline" color={tokens.textMuted} />}
        />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <TSSelect
              value={status}
              onValueChange={(value) => setStatus(value as Task['status'] | '')}
              placeholder="All statuses"
              options={STATUS_OPTIONS}
            />
          </View>
          <View className="flex-1">
            <TSSelect
              value={priority}
              onValueChange={(value) => setPriority(value as Task['priority'] | '')}
              placeholder="All priorities"
              options={PRIORITY_OPTIONS}
            />
          </View>
        </View>
        <TSInput
          value={dueText}
          onChangeText={setDueText}
          placeholder="Due on or before (YYYY-MM-DD)"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
      </View>

      {tasks.isLoading ? (
        <TSSkeletonList rows={7} />
      ) : tasks.isError ? (
        <TSErrorState message={tasks.error.message} onRetry={() => void tasks.refetch()} />
      ) : items.length > 0 ? (
        <View className="gap-3">
          {items.map((task) => (
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
      ) : filtersActive ? (
        <TSEmptyState
          icon={<TaskSquare size={28} variant="TwoTone" color={tokens.primary} />}
          title="No matching tasks"
          description="Try adjusting your search or filters."
        />
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
