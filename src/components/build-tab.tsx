import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Danger, Pause, Play, Send2 } from 'iconsax-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { errorAlert } from '@/components/shared/error-alert';

import {
  TSButton,
  TSEmptyState,
  TSErrorState,
  TSInput,
  TSSelect,
  TSBadge,
  TSSkeletonList,
} from '@/components/shared';
import { createComment } from '@/lib/api/comments';
import { getBuildQueue, startBuild, stopBuild, updateProject } from '@/lib/api/projects';
import type { BuildQueueEntry, ProjectMember } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { tokens } from '@/constants/theme';

const UNASSIGNED_BUILD_AGENT = '__unassigned__';

export type BuildTabProps = {
  projectId: string;
  members: ProjectMember[];
  /** Owners/members can change the build agent + run the queue (not viewers). */
  canManage?: boolean;
};

/**
 * Build mode (IMP-680): assign the project's build agent, review the ordered
 * ready-for-dev queue (pending + blocked), start/stop runs and answer agent
 * questions inline. Mirrors the web Build tab.
 */
export function BuildTab({ projectId, members, canManage = false }: BuildTabProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: queryKeys.projectBuildQueue(projectId),
    queryFn: () => getBuildQueue(token ?? '', projectId),
    enabled: !!token && !!projectId,
    refetchInterval: 10_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projectBuildQueue(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
  };

  const setBuildAgent = useMutation({
    mutationFn: (buildAgentId: string | null) =>
      updateProject(token ?? '', projectId, { buildAgentId }),
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => errorAlert(err, "Could not update build agent"),
  });

  const start = useMutation({
    mutationFn: () => startBuild(token ?? '', projectId),
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => errorAlert(err, "Could not start the build"),
  });

  const stop = useMutation({
    mutationFn: () => stopBuild(token ?? '', projectId),
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => errorAlert(err, "Could not stop the build"),
  });

  const answer = useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: string }) =>
      createComment(token ?? '', { taskId, body }),
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => errorAlert(err, "Could not post the answer"),
  });

  if (queue.isError) {
    return <TSErrorState message={queue.error.message} onRetry={() => void queue.refetch()} />;
  }
  if (queue.isLoading) {
    return <TSSkeletonList rows={4} />;
  }

  const data = queue.data;
  const buildAgentId = data?.buildAgent?.id ?? null;
  const agentOptions = members
    .filter((member) => member.user?.kind === 'agent')
    .map((member) => ({ value: member.userId, label: member.user?.name ?? 'Agent' }));

  return (
    <View className="gap-4">
      {/* Build agent + run controls */}
      <View className="gap-3 rounded-lg border border-border bg-background p-4">
        <View className="flex-row items-center gap-2">
          <Box size={16} variant="Outline" color={tokens.primary} />
          <Text className="text-sm font-semibold text-foreground">Build agent</Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          The agent that works this project&apos;s ready-for-dev tasks, strictly in order - one at a
          time, fully completing each.
        </Text>
        <View className="flex-row items-center gap-2">
          <TSBadge tone={data?.running ? 'primary' : 'neutral'}>
            {data?.running ? 'Building' : 'Idle'}
          </TSBadge>
          <Text className="text-xs text-muted-foreground">
            {buildAgentId ? data?.buildAgent?.name : 'No build agent assigned'}
          </Text>
        </View>
        {canManage && (
          <>
            {agentOptions.length > 0 ? (
              <TSSelect
                value={buildAgentId ?? UNASSIGNED_BUILD_AGENT}
                onValueChange={(value) =>
                  void setBuildAgent.mutate(value === UNASSIGNED_BUILD_AGENT ? null : value)
                }
                placeholder="No build agent"
                options={[
                  { value: UNASSIGNED_BUILD_AGENT, label: 'No build agent' },
                  ...agentOptions,
                ]}
              />
            ) : (
              <Text className="text-xs text-muted-foreground">
                No agents in this project yet - add one in Members.
              </Text>
            )}
            <View className="flex-row gap-2">
              <TSButton
                onPress={() => void start.mutate()}
                loading={start.isPending}
                disabled={!buildAgentId || (data?.pending.length ?? 0) === 0}
                icon={<Play size={16} variant="Bold" color="#ffffff" />}
                className="flex-1"
              >
                Start build
              </TSButton>
              <TSButton
                variant="outline"
                onPress={() => void stop.mutate()}
                loading={stop.isPending}
                disabled={!buildAgentId}
                icon={<Pause size={16} variant="Bold" color={tokens.primary} />}
                className="flex-1"
              >
                Stop
              </TSButton>
            </View>
          </>
        )}
      </View>

      {/* Queue */}
      {!data || (data.pending.length === 0 && data.blocked.length === 0) ? (
        <TSEmptyState
          icon={<Box size={28} variant="TwoTone" color={tokens.textMuted} />}
          title="No ready-for-dev tasks"
          description="Mark a task 'Ready for dev' to add it to the build queue. The agent works them in order, one at a time."
        />
      ) : (
        <View className="gap-4">
          {data.pending.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ready to build ({data.pending.length})
              </Text>
              {data.pending.map((item) => (
                <QueueRow key={item.task.id} item={item} />
              ))}
            </View>
          )}

          {data.blocked.length > 0 && (
            <View className="gap-2">
              <View className="flex-row items-center gap-1.5">
                <Danger size={14} variant="Outline" color={tokens.warning} />
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Blocked - waiting for answers ({data.blocked.length})
                </Text>
              </View>
              {data.blocked.map((item) => (
                <BlockedTaskCard
                  key={item.task.id}
                  item={item}
                  posting={answer.isPending && answer.variables?.taskId === item.task.id}
                  onAnswer={(body) => void answer.mutate({ taskId: item.task.id, body })}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function QueueRow({ item }: { item: BuildQueueEntry }) {
  return (
    <View className="flex-row items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <View
        className="h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: tokens.bgMuted }}
      >
        <Text className="text-xs font-semibold" style={{ color: tokens.primary }}>
          {item.position}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {item.task.title}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {item.task.priority} · sortOrder {item.task.sortOrder ?? '-'}
        </Text>
      </View>
      <TSBadge tone="neutral">{item.task.status}</TSBadge>
    </View>
  );
}

function BlockedTaskCard({
  item,
  posting,
  onAnswer,
}: {
  item: BuildQueueEntry;
  posting: boolean;
  onAnswer: (body: string) => void;
}) {
  const [reply, setReply] = React.useState('');

  return (
    <View className="gap-2.5 rounded-lg border border-border bg-background p-3">
      <View className="flex-row items-center gap-2">
        <Danger size={14} variant="Outline" color={tokens.warning} />
        <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
          {item.task.title}
        </Text>
      </View>
      <Text className="text-xs leading-5 text-muted-foreground">{item.question?.body}</Text>
      {item.task.assigneeId && (
        <Text className="text-[11px] text-muted-foreground">
          Assigned to the build agent - answer below to resume it.
        </Text>
      )}
      <View className="flex-row items-center gap-2">
        <TSInput
          value={reply}
          onChangeText={setReply}
          placeholder="Answer the agent..."
          className="flex-1"
        />
        <TSButton
          tsSize="sm"
          onPress={() => {
            const body = reply.trim();
            if (!body) return;
            onAnswer(body);
            setReply('');
          }}
          disabled={!reply.trim() || posting}
          icon={
            posting ? (
              <ActivityIndicator size={14} color="#ffffff" />
            ) : (
              <Send2 size={14} variant="Outline" color="#ffffff" />
            )
          }
        />
      </View>
    </View>
  );
}