import { useQuery } from '@tanstack/react-query';
import { Activity, Chart, Clock, TaskSquare, TickCircle } from 'iconsax-react-native';
import * as React from 'react';
import { Text, View } from 'react-native';

import {
  TSAvatar,
  TSCard,
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSelect,
  TSSkeletonList,
  TSList,
  TSListRow,
} from '@/components/shared';
import {
  getAuditActivity,
  getAuditStats,
  type AuditActivityItem,
  type AuditMemberWorkload,
  type PriorityKey,
} from '@/lib/api/audit';
import { listProjects } from '@/lib/api/projects';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatRelative } from '@/lib/format';
import { tokens } from '@/constants/theme';

const PRIORITY_ORDER: PriorityKey[] = ['urgent', 'high', 'medium', 'low'];

const PRIORITY_COLORS: Record<PriorityKey, string> = {
  urgent: tokens.error,
  high: tokens.warning,
  medium: tokens.info,
  low: tokens.textMuted,
};

const PRIORITY_LABELS: Record<PriorityKey, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

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

function PriorityBar({ priority, count, max }: { priority: PriorityKey; count: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-medium text-foreground">{PRIORITY_LABELS[priority]}</Text>
        <Text className="text-xs text-muted-foreground">{count}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-muted">
        <View className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: PRIORITY_COLORS[priority] }} />
      </View>
    </View>
  );
}

function WorkloadRow({ item }: { item: AuditMemberWorkload }) {
  return (
    <TSListRow>
      <TSAvatar name={item.name ?? 'Team member'} src={item.avatarUrl} size={32} />
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground">{item.name ?? 'Unassigned'}</Text>
      </View>
      <Text className="text-sm text-muted-foreground">{item.count} tasks</Text>
    </TSListRow>
  );
}

export default function AnalyticsScreen() {
  const { token } = useAuth();
  const [selectedProject, setSelectedProject] = React.useState<string | undefined>(undefined);

  const projects = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => listProjects(token ?? ''),
    enabled: !!token,
  });

  const firstProjectId = projects.data?.items[0]?.id;
  const projectId = selectedProject ?? firstProjectId;

  const stats = useQuery({
    queryKey: queryKeys.auditStats(projectId),
    queryFn: () => getAuditStats(token ?? '', projectId),
    enabled: !!token && !!projectId,
  });

  const activity = useQuery({
    queryKey: queryKeys.auditActivity(projectId),
    queryFn: () => getAuditActivity(token ?? '', projectId),
    enabled: !!token && !!projectId,
  });

  const loading = projects.isLoading || (!!projectId && (stats.isLoading || activity.isLoading));
  const error = projects.isError ? projects.error : projectId ? (stats.error ?? activity.error) : null;

  const byPriority = stats.data?.openByPriority ?? {};
  const openCount =
    Object.values(byPriority).length > 0
      ? Object.values(byPriority).reduce((sum, n) => sum + (n ?? 0), 0)
      : (stats.data?.openCount ?? 0);
  const resolved = stats.data?.tasksResolvedLast7Days ?? 0;
  const overdue = stats.data?.overdueCount;
  const maxPriority = Math.max(1, ...PRIORITY_ORDER.map((p) => byPriority[p] ?? 0));
  const workload = stats.data?.memberWorkload ?? [];
  const activityItems = activity.data?.items ?? [];

  return (
    <TSScreen>
      <TSPageHeader title="Analytics" description="Project insights and activity" />

      {loading ? (
        <TSSkeletonList rows={6} />
      ) : error ? (
        <TSErrorState message={error.message} onRetry={() => { void stats.refetch(); void activity.refetch(); }} />
      ) : projects.data && projects.data.items.length === 0 ? (
        <TSEmptyState
          icon={<Chart size={28} variant="TwoTone" color={tokens.primary} />}
          title="No projects yet"
          description="Create a project to see analytics and activity."
        />
      ) : (
        <>
          <TSSelect
            value={projectId}
            onValueChange={setSelectedProject}
            placeholder="Select a project"
            options={projects.data?.items.map((p) => ({ value: p.id, label: p.name })) ?? []}
          />

          <View className="flex-row gap-3">
            <StatCard
              icon={<TickCircle size={20} variant="Outline" color={tokens.success} />}
              label="Resolved (7d)"
              value={resolved}
              loading={stats.isLoading}
            />
            <StatCard
              icon={<TaskSquare size={20} variant="Outline" color={tokens.info} />}
              label="Open"
              value={openCount}
              loading={stats.isLoading}
            />
            {overdue !== undefined && (
              <StatCard
                icon={<Clock size={20} variant="Outline" color={tokens.error} />}
                label="Overdue"
                value={overdue}
                loading={stats.isLoading}
              />
            )}
          </View>

          <TSCard title="Open by priority" description="Current open tasks by priority level">
            {PRIORITY_ORDER.filter((p) => (byPriority[p] ?? 0) > 0).length === 0 ? (
              <Text className="text-sm text-muted-foreground">No open tasks in this project.</Text>
            ) : (
              <View className="gap-3">
                {PRIORITY_ORDER.map((priority) => {
                  const count = byPriority[priority] ?? 0;
                  if (count === 0) return null;
                  return <PriorityBar key={priority} priority={priority} count={count} max={maxPriority} />;
                })}
              </View>
            )}
          </TSCard>

          <TSCard title="Member workload" description="Open tasks per member">
            {workload.length === 0 ? (
              <Text className="text-sm text-muted-foreground">No assigned work in this project.</Text>
            ) : (
              <View className="-mx-4">
                {workload.map((item) => (
                  <WorkloadRow key={item.userId} item={item} />
                ))}
              </View>
            )}
          </TSCard>

          <View className="mt-2">
            <Text className="mb-2 text-base font-semibold text-foreground">Recent activity</Text>
            {activity.isLoading ? (
              <TSSkeletonList rows={3} />
            ) : activityItems.length > 0 ? (
              <TSList
                className="overflow-hidden rounded-lg border border-border bg-background"
                data={activityItems}
                keyExtractor={(item) => (item as AuditActivityItem).id}
                renderItem={(item) => {
                  const entry = item as AuditActivityItem;
                  return (
                    <TSListRow>
                      <View className="flex-1 gap-0.5">
                        <Text className="text-sm font-medium capitalize text-foreground">{entry.type.replace(/[_.]/g, ' ')}</Text>
                        {entry.summary ? <Text className="text-xs text-muted-foreground" numberOfLines={2}>{entry.summary}</Text> : null}
                      </View>
                      <View className="items-end gap-0.5">
                        <Text className="text-xs text-muted-foreground">{entry.actor?.name ?? 'System'}</Text>
                        <Text className="text-xs text-muted-foreground">{formatRelative(entry.createdAt)}</Text>
                      </View>
                    </TSListRow>
                  );
                }}
              />
            ) : (
              <TSEmptyState
                icon={<Activity size={28} variant="TwoTone" color={tokens.primary} />}
                title="No recent activity"
                description="Task updates and comments will appear here."
              />
            )}
          </View>
        </>
      )}
    </TSScreen>
  );
}
