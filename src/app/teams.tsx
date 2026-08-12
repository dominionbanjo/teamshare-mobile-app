import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AddSquare, Profile2User } from 'iconsax-react-native';
import * as React from 'react';
import { RefreshControl, Text, View } from 'react-native';

import {
  TSCard,
  TSDialog,
  TSEmptyState,
  TSErrorState,
  TSForm,
  TSFormFieldError,
  TSFormTextInput,
  TSButton,
  TSPageHeader,
  TSScreen,
  TSSkeletonList,
} from '@/components/shared';
import { createTeam, listTeams } from '@/lib/api/teams';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { CreateTeamSchema } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

export default function TeamsScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const teams = useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => listTeams(token ?? ''),
    enabled: !!token,
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const create = useMutation({
    mutationFn: (values: { name: string }) => createTeam(token ?? '', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams });
      setDialogOpen(false);
    },
  });

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={teams.isRefetching}
          onRefresh={() => void teams.refetch()}
          tintColor={tokens.primary}
        />
      }
    >
      <TSPageHeader
        title="Teams"
        description="Groups of people inside a company"
        actions={
          <TSDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="New team"
            description="Teams bundle people and projects together."
            trigger={<TSButton icon={<AddSquare size={16} variant="Outline" color="#fff" />}>New Team</TSButton>}
          >
            <TSForm
              schema={CreateTeamSchema}
              defaultValues={{}}
              onSubmit={(values) => create.mutate(values)}
              render={({ handleSubmit }) => (
                <>
                  <TSFormTextInput name="name" label="Team name" placeholder="e.g. Platform" required maxLength={60} />
                  <TSButton onPress={handleSubmit((values) => create.mutate(values))} loading={create.isPending}>
                    Create team
                  </TSButton>
                  {create.isError && (
                    <TSFormFieldError message={create.error?.message ?? 'Could not create team.'} />
                  )}
                </>
              )}
            />
          </TSDialog>
        }
      />

      {teams.isLoading ? (
        <TSSkeletonList rows={5} />
      ) : teams.isError ? (
        <TSErrorState message={teams.error.message} onRetry={() => void teams.refetch()} />
      ) : teams.data && teams.data.items.length > 0 ? (
        <View className="gap-3">
          {teams.data.items.map((team) => (
            <TSCard key={team.id} className="min-h-12">
              <View className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Profile2User size={16} variant="Outline" color={tokens.textSecondary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{team.name}</Text>
                  <Text className="text-xs text-muted-foreground">{team.members?.length ?? 0} members</Text>
                </View>
              </View>
            </TSCard>
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Profile2User size={28} variant="TwoTone" color={tokens.primary} />}
          title="No teams yet"
          description="Create a team to organize members and projects."
        />
      )}
    </TSScreen>
  );
}
