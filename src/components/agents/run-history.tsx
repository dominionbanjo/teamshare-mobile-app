import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Danger,
  Edit2,
  Flash,
  MessageAdd1,
  MessageText,
  Play,
  Radar,
  TaskSquare,
  TickCircle,
} from 'iconsax-react-native';
import * as React from 'react';
import { Text, View } from 'react-native';

import { TSEmptyState, TSButton, TSErrorState, TSSkeletonList } from '@/components/shared';
import { agentsApi } from '@/lib/api/agents';
import type { AgentLogRow } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatRelative } from '@/lib/format';
import type { AgentLogActionValue } from '@/constants/enums';
import { tokens } from '@/constants/theme';
import { AGENT_LOG_ACTION_META } from '@/components/agents/agent-utils';

const ACTION_ICON: Record<AgentLogActionValue, React.ReactNode> = {
  run_started: <Play size={16} variant="Outline" color={tokens.info} />,
  run_completed: <TickCircle size={16} variant="Outline" color={tokens.success} />,
  task_created: <TaskSquare size={16} variant="Outline" color={tokens.primary} />,
  task_updated: <Edit2 size={16} variant="Outline" color={tokens.primary} />,
  comment_created: <MessageAdd1 size={16} variant="Outline" color={tokens.info} />,
  chat_message: <MessageText size={16} variant="Outline" color={tokens.info} />,
  wake_sent: <Flash size={16} variant="Outline" color={tokens.warning} />,
  error: <Danger size={16} variant="Broken" color={tokens.error} />,
};

export interface RunHistoryProps {
  agentId: string;
}

/** Run history timeline - the AgentLog feed, paginated with "Load more". */
export function RunHistory({ agentId }: RunHistoryProps) {
  const { token } = useAuth();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.agentLogs(agentId),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => agentsApi.logs(agentId, pageParam, token ?? ''),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.pagination;
      if (!pagination || lastPage.data.length === 0) return undefined;
      const next = pagination.page + 1;
      return next <= pagination.totalPages ? next : undefined;
    },
    enabled: !!token,
  });

  const rows: AgentLogRow[] = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.pagination?.total ?? 0;

  if (isError) {
    return <TSErrorState message={error.message} onRetry={() => void refetch()} />;
  }

  if (isLoading && rows.length === 0) {
    return <TSSkeletonList rows={4} />;
  }

  if (rows.length === 0) {
    return (
      <TSEmptyState
        icon={<Radar size={28} variant="TwoTone" color={tokens.textMuted} />}
        title="No runs yet"
        description="Every task run, comment and wake lands here once the agent starts working."
      />
    );
  }

  return (
    <View className="gap-2">
      {rows.map((log) => (
        <View key={log.id} className="flex-row items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-background">
            {ACTION_ICON[log.action]}
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
              <Text className="text-sm font-medium text-foreground">
                {AGENT_LOG_ACTION_META[log.action]?.label ?? log.action}
              </Text>
              {log.task && (
                <Text className="truncate text-xs text-muted-foreground" numberOfLines={1}>
                  {log.task.title}
                </Text>
              )}
              {log.taskId && !log.task && (
                <Text className="font-mono text-[11px] text-muted-foreground">task #{log.taskId.slice(0, 8)}</Text>
              )}
            </View>
            <Text className="mt-0.5 text-[11px] text-muted-foreground">{formatRelative(log.createdAt)}</Text>
          </View>
        </View>
      ))}

      {hasNextPage && (
        <View className="items-center pt-1">
          <TSButton variant="outline" tsSize="sm" loading={isFetchingNextPage} onPress={() => void fetchNextPage()}>
            Load more
          </TSButton>
        </View>
      )}
      {!hasNextPage && total > 0 && (
        <Text className="pt-1 text-center text-[11px] text-muted-foreground">
          {total} {total === 1 ? 'entry' : 'entries'} total
        </Text>
      )}
    </View>
  );
}
