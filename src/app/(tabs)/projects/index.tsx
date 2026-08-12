import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Folder2 } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';

import { ProjectCreateDialog } from '@/components/project-create-dialog';
import {
  TSBadge,
  TSCard,
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSkeletonList,
} from '@/components/shared';
import { listProjects } from '@/lib/api/projects';
import { listTeams } from '@/lib/api/teams';
import type { Project } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatDate } from '@/lib/format';
import { tokens } from '@/constants/theme';

export default function ProjectsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const projects = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => listProjects(token ?? ''),
    enabled: !!token,
  });
  const teams = useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => listTeams(token ?? ''),
    enabled: !!token,
  });

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={projects.isRefetching}
          onRefresh={() => void projects.refetch()}
          tintColor={tokens.primary}
        />
      }
    >
      <TSPageHeader
        title="Projects"
        description={`${projects.data?.items.length ?? 0} total`}
        actions={<ProjectCreateDialog teams={teams.data?.items ?? []} />}
      />

      {projects.isLoading ? (
        <TSSkeletonList rows={6} />
      ) : projects.isError ? (
        <TSErrorState message={projects.error.message} onRetry={() => void projects.refetch()} />
      ) : projects.data && projects.data.items.length > 0 ? (
        <View className="gap-3">
          {projects.data.items.map((project: Project) => (
            <Pressable key={project.id} onPress={() => router.push(`/projects/${project.id}`)}>
              <TSCard className="min-h-12">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <Text className="text-sm font-semibold text-foreground">{project.name}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {project.members?.length ?? 0} members
                      {project.createdAt ? ` · created ${formatDate(project.createdAt)}` : ''}
                    </Text>
                  </View>
                  <TSBadge tone={project.status === 'active' ? 'success' : 'neutral'}>
                    {project.status}
                  </TSBadge>
                </View>
              </TSCard>
            </Pressable>
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Folder2 size={28} variant="TwoTone" color={tokens.primary} />}
          title="No projects yet"
          description="Tap New Project to create your first project."
          action={<ProjectCreateDialog teams={teams.data?.items ?? []} />}
        />
      )}
    </TSScreen>
  );
}
