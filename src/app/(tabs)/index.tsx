import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Folder2, NotificationBing, Send2, TaskSquare } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';

import {
  TSCard,
  TSEmptyState,
  TSErrorState,
  TSScreen,
  TSSkeletonList,
} from '@/components/shared';
import { ProjectCreateDialog } from '@/components/project-create-dialog';
import { listInvitations } from '@/lib/api/invitations';
import { listNotifications } from '@/lib/api/notifications';
import { listProjects } from '@/lib/api/projects';
import { listTeams } from '@/lib/api/teams';
import { listTasks } from '@/lib/api/tasks';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatDate } from '@/lib/format';
import { tokens } from '@/constants/theme';
import { cn } from '@/lib/utils';

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number; loading: boolean }) {
  return (
    <TSCard className="flex-1">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-2xl font-bold text-foreground">{loading ? '—' : value}</Text>
      </View>
      <Text className="mt-1 text-xs text-muted-foreground">{label}</Text>
    </TSCard>
  );
}

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();

  const projects = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => listProjects(token ?? ''),
    enabled: !!token,
  });
  const openTasks = useQuery({
    queryKey: queryKeys.tasks({ status: 'open' }),
    queryFn: () => listTasks(token ?? '', { status: 'open', pageSize: 100 }),
    enabled: !!token,
  });
  const invitations = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: () => listInvitations(token ?? '', 'pending'),
    enabled: !!token,
  });
  const notifications = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => listNotifications(token ?? ''),
    enabled: !!token,
  });
  const teams = useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => listTeams(token ?? ''),
    enabled: !!token,
  });

  const loading = projects.isLoading || openTasks.isLoading;
  const error = projects.isError ? projects.error : openTasks.isError ? openTasks.error : null;

  const unreadCount = notifications.data?.items.filter((n) => !n.readAt).length ?? 0;
  const firstName = user?.name.split(/\s+/)[0] ?? 'there';

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={projects.isRefetching || openTasks.isRefetching}
          onRefresh={() => {
            void projects.refetch();
            void openTasks.refetch();
            void invitations.refetch();
            void notifications.refetch();
          }}
          tintColor={tokens.primary}
        />
      }
    >
      <View className="gap-1">
        <Text className="text-2xl font-bold text-foreground">Welcome back, {firstName}</Text>
        <Text className="text-sm text-muted-foreground">Here's what's happening across your workspaces.</Text>
      </View>

      {error ? (
        <TSErrorState message={error.message} onRetry={() => { void projects.refetch(); void openTasks.refetch(); }} />
      ) : (
        <>
          <View className="flex-row gap-3">
            <StatCard icon={<Folder2 size={20} variant="Outline" color={tokens.primary} />} label="Projects" value={projects.data?.items.length ?? 0} loading={loading} />
            <StatCard icon={<TaskSquare size={20} variant="Outline" color={tokens.warning} />} label="Open tasks" value={openTasks.data?.items.length ?? 0} loading={loading} />
          </View>
          <View className="flex-row gap-3">
            <StatCard icon={<Send2 size={20} variant="Outline" color={tokens.success} />} label="Pending invites" value={invitations.data?.items.length ?? 0} loading={invitations.isLoading} />
            <StatCard icon={<NotificationBing size={20} variant="Outline" color={tokens.info} />} label="Unread" value={unreadCount} loading={notifications.isLoading} />
          </View>

          <ProjectCreateDialog teams={teams.data?.items ?? []} />

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push('/teams')}
              className="min-h-11 flex-1 items-center justify-center rounded-lg border border-border bg-background"
            >
              <Text className="text-sm font-medium text-foreground">Teams</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/invitations')}
              className="min-h-11 flex-1 items-center justify-center rounded-lg border border-border bg-background"
            >
              <Text className="text-sm font-medium text-foreground">Invitations</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/notifications')}
              className="min-h-11 flex-1 items-center justify-center rounded-lg border border-border bg-background"
            >
              <Text className="text-sm font-medium text-foreground">Notifications</Text>
            </Pressable>
          </View>

          <View className="mt-2">
            <Text className="mb-2 text-base font-semibold text-foreground">Recent projects</Text>
            {projects.isLoading ? (
              <TSSkeletonList rows={3} />
            ) : projects.data && projects.data.items.length > 0 ? (
              <TSCard className="overflow-hidden p-0">
                {projects.data.items.slice(0, 4).map((project, index) => (
                  <Pressable
                    key={project.id}
                    onPress={() => router.push(`/projects/${project.id}`)}
                    className={cn('min-h-12 flex-row items-center justify-between px-4 py-3', index > 0 && 'border-t border-border')}
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">{project.name}</Text>
                      {project.createdAt && (
                        <Text className="text-xs text-muted-foreground">Created {formatDate(project.createdAt)}</Text>
                      )}
                    </View>
                    <Text className="text-xs text-muted-foreground">{project.members?.length ?? 0} members</Text>
                  </Pressable>
                ))}
              </TSCard>
            ) : (
              <TSEmptyState
                icon={<Folder2 size={28} variant="TwoTone" color={tokens.primary} />}
                title="No projects yet"
                description="Create your first project to start tracking tasks."
              />
            )}
          </View>
        </>
      )}
    </TSScreen>
  );
}
