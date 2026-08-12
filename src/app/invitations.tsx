import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send2 } from 'iconsax-react-native';
import * as React from 'react';
import { RefreshControl, Text, View } from 'react-native';

import {
  TSBadge,
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSkeletonList,
  TSButton,
} from '@/components/shared';
import { acceptInvitation, declineInvitation, listInvitations } from '@/lib/api/invitations';
import type { Invitation } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatRelative } from '@/lib/format';
import { tokens } from '@/constants/theme';

export default function InvitationsScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const invitations = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: () => listInvitations(token ?? '', 'pending'),
    enabled: !!token,
  });

  const accept = useMutation({
    mutationFn: (invitation: Invitation) => acceptInvitation(token ?? '', invitation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
  const decline = useMutation({
    mutationFn: (invitation: Invitation) => declineInvitation(token ?? '', invitation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
    },
  });

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={invitations.isRefetching}
          onRefresh={() => void invitations.refetch()}
          tintColor={tokens.primary}
        />
      }
    >
      <TSPageHeader title="Invitations" description="Pending invites expire after 7 days" />

      {invitations.isLoading ? (
        <TSSkeletonList rows={5} />
      ) : invitations.isError ? (
        <TSErrorState message={invitations.error.message} onRetry={() => void invitations.refetch()} />
      ) : invitations.data && invitations.data.items.length > 0 ? (
        <View className="gap-3">
          {invitations.data.items.map((invitation) => (
            <View key={invitation.id} className="min-h-12 gap-2 rounded-lg border border-border bg-background p-3 shadow-sm">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{invitation.email}</Text>
                  <Text className="text-xs text-muted-foreground">
                    {invitation.company ? `Company: ${invitation.company.name}` : invitation.project ? `Project: ${invitation.project.name}` : 'Workspace invite'}
                  </Text>
                </View>
                <TSBadge tone="primary">{invitation.role}</TSBadge>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">
                  Invited {formatRelative(invitation.createdAt)} · expires {formatRelative(invitation.expiresAt)}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <TSButton
                  className="flex-1"
                  loading={accept.isPending && accept.variables?.id === invitation.id}
                  disabled={accept.isPending || decline.isPending}
                  onPress={() => accept.mutate(invitation)}
                >
                  Accept
                </TSButton>
                <TSButton
                  className="flex-1"
                  variant="outline"
                  loading={decline.isPending && decline.variables?.id === invitation.id}
                  disabled={accept.isPending || decline.isPending}
                  onPress={() => decline.mutate(invitation)}
                >
                  Decline
                </TSButton>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Send2 size={28} variant="TwoTone" color={tokens.primary} />}
          title="All caught up"
          description="You have no pending invitations right now."
        />
      )}
    </TSScreen>
  );
}
