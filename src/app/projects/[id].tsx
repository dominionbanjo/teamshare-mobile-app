import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Box, Message, Profile2User, TaskSquare } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';

import { BuildTab } from '@/components/build-tab';
import { ChatPanel } from '@/components/chat-panel';
import { ChatChannels } from '@/components/chat-channels';
import { DocumentsTab } from '@/components/documents-tab';
import { EnvVarsTab } from '@/components/env-vars-tab';
import { InviteMemberDialog } from '@/components/invite-member-dialog';
import { TaskCreateDialog } from '@/components/task-create-dialog';
import {
  PriorityBadge,
  TaskStatusBadge,
  TSAvatar,
  TSBadge,
  TSCard,
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSkeletonList,
  TSTabs,
} from '@/components/shared';
import { listProjectMembers, listProjectTasks, getProject, getBuildQueue } from '@/lib/api/projects';
import { listChatChannels } from '@/lib/api/chat';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatDate } from '@/lib/format';
import { tokens } from '@/constants/theme';

export default function ProjectDetailScreen() {
  const { id, channel } = useLocalSearchParams<{ id: string; channel?: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const project = useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => getProject(token ?? '', id),
    enabled: !!token && !!id,
  });
  const tasks = useQuery({
    queryKey: queryKeys.projectTasks(id),
    queryFn: () => listProjectTasks(token ?? '', id),
    enabled: !!token && !!id,
  });
  const members = useQuery({
    queryKey: queryKeys.projectMembers(id),
    queryFn: () => listProjectMembers(token ?? '', id),
    enabled: !!token && !!id,
  });
  const channels = useQuery({
    queryKey: queryKeys.chatChannels(id),
    queryFn: () => listChatChannels(token ?? '', id),
    enabled: !!token && !!id,
  });
  const buildQueue = useQuery({
    queryKey: queryKeys.projectBuildQueue(id),
    queryFn: () => getBuildQueue(token ?? '', id),
    enabled: !!token && !!id,
    refetchInterval: 15_000,
  });
  // IMP-250: chat notifications deep-link /projects/:id?channel=:cid - land
  // on that conversation instead of the first channel.
  const [chatChannelId, setChatChannelId] = React.useState<string>(() =>
    typeof channel === 'string' ? channel : ''
  );

  const loading = project.isLoading || tasks.isLoading || members.isLoading;
  const error = project.error ?? tasks.error ?? members.error;

  if (project.isLoading) {
    return (
      <TSScreen>
        <TSSkeletonList rows={6} />
      </TSScreen>
    );
  }

  if (project.isError || !project.data) {
    return (
      <TSScreen>
        <TSErrorState message={error?.message ?? 'Could not load project.'} onRetry={() => void project.refetch()} />
      </TSScreen>
    );
  }

  const projectRow = project.data;
  const currentRole = members.data?.items.find((m) => m.userId === user?.id)?.role;

  // Chat conversations: active falls back to the first channel (General).
  const channelRows = channels.data ?? [];
  const activeChannel = channelRows.find((c) => c.id === chatChannelId) ?? channelRows[0];
  const activeChannelId = activeChannel?.id ?? '';

  const chatContent = (
    <View className="overflow-hidden rounded-lg border border-border bg-background">
      <ChatChannels
        projectId={id}
        activeChannelId={activeChannelId}
        canManage={currentRole !== 'viewer'}
        onSelect={setChatChannelId}
      />
      <ChatPanel projectId={id} channelId={activeChannelId} channelName={activeChannel?.name} />
    </View>
  );

  const membersContent = (
    <View className="gap-3">
      <InviteMemberDialog projectId={id} />
      {members.isLoading ? (
        <TSSkeletonList rows={4} />
      ) : members.isError ? (
        <TSErrorState message={members.error.message} onRetry={() => void members.refetch()} />
      ) : members.data && members.data.items.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {members.data.items.map((member, index) => (
            <View
              key={member.id}
              className="min-h-12 flex-row items-center gap-3 border-b border-border px-4 py-3"
              style={index === (members.data?.items.length ?? 0) - 1 ? { borderBottomWidth: 0 } : undefined}
            >
              <TSAvatar name={member.user?.name ?? 'Unknown'} src={member.user?.avatarUrl} size={32} />
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">{member.user?.name ?? 'Unknown'}</Text>
                <Text className="text-xs text-muted-foreground">{member.user?.email ?? member.userId}</Text>
              </View>
              <TSBadge tone={member.role === 'owner' ? 'primary' : member.role === 'viewer' ? 'neutral' : 'info'}>
                {member.role}
              </TSBadge>
            </View>
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Profile2User size={28} variant="TwoTone" color={tokens.primary} />}
          title="No members yet"
          description="Invite teammates to collaborate on this project."
          action={<InviteMemberDialog projectId={id} />}
        />
      )}
    </View>
  );

  const tasksContent = (
    <View className="gap-3">
      <TaskCreateDialog projectId={id} members={members.data?.items ?? []} />
      {tasks.isLoading ? (
        <TSSkeletonList rows={4} />
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
                <View className="flex-row items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  {task.dueDate && <Text className="text-xs text-muted-foreground">Due {formatDate(task.dueDate)}</Text>}
                  <Text className="text-xs text-muted-foreground">· {task.assignee?.name ?? 'Unassigned'}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<TaskSquare size={28} variant="TwoTone" color={tokens.primary} />}
          title="No tasks yet"
          description="Add the first task to kick things off."
          action={<TaskCreateDialog projectId={id} members={members.data?.items ?? []} />}
        />
      )}
    </View>
  );

  const buildContent = (
    <BuildTab projectId={id} members={members.data?.items ?? []} canManage={currentRole !== 'viewer'} />
  );

  const infoContent = (
    <View className="gap-3">
      <TSCard title="Details">
        <View className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">Status</Text>
            <TSBadge tone={projectRow.status === 'active' ? 'success' : 'neutral'}>{projectRow.status}</TSBadge>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">Team</Text>
            <Text className="text-sm font-medium text-foreground">{projectRow.team?.name ?? 'None'}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">Company</Text>
            <Text className="text-sm font-medium text-foreground">{projectRow.company?.name ?? 'Personal'}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">Created</Text>
            <Text className="text-sm font-medium text-foreground">{formatDate(projectRow.createdAt)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">Members</Text>
            <Text className="text-sm font-medium text-foreground">{projectRow.members?.length ?? 0}</Text>
          </View>
        </View>
      </TSCard>
      <TSCard title="Quick stats">
        <View className="flex-row justify-around">
          <View className="items-center gap-1">
            <TaskSquare size={20} variant="Outline" color={tokens.primary} />
            <Text className="text-lg font-bold text-foreground">{tasks.data?.items.length ?? 0}</Text>
            <Text className="text-xs text-muted-foreground">Tasks</Text>
          </View>
          <View className="items-center gap-1">
            <Profile2User size={20} variant="Outline" color={tokens.info} />
            <Text className="text-lg font-bold text-foreground">{members.data?.items.length ?? 0}</Text>
            <Text className="text-xs text-muted-foreground">Members</Text>
          </View>
          <View className="items-center gap-1">
            <Message size={20} variant="Outline" color={tokens.success} />
            <Text className="text-lg font-bold text-foreground">—</Text>
            <Text className="text-xs text-muted-foreground">Chat</Text>
          </View>
        </View>
      </TSCard>
    </View>
  );

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={loading && !project.isLoading}
          onRefresh={() => {
            void project.refetch();
            void tasks.refetch();
            void members.refetch();
            void buildQueue.refetch();
          }}
          tintColor={tokens.primary}
        />
      }
    >
      <TSPageHeader
        title={projectRow.name}
        description={`Project ${projectRow.status === 'active' ? 'active' : 'archived'}`}
      />

      <TSTabs
        defaultValue="tasks"
        items={[
          { value: 'tasks', label: 'Tasks', count: tasks.data?.items.length ?? 0, content: tasksContent },
          { value: 'members', label: 'Members', count: members.data?.items.length ?? 0, content: membersContent },
          {
            value: 'build',
            label: 'Build',
            count: (buildQueue.data?.pending.length ?? 0) + (buildQueue.data?.blocked.length ?? 0) || undefined,
            content: buildContent,
          },
          { value: 'env', label: 'Env Vars', content: <EnvVarsTab projectId={id} canAudit={currentRole === 'owner'} /> },
          { value: 'documents', label: 'Documents', content: <DocumentsTab projectId={id} /> },
          { value: 'chat', label: 'Chat', content: chatContent },
          { value: 'info', label: 'Info', content: infoContent },
        ]}
      />
    </TSScreen>
  );
}
