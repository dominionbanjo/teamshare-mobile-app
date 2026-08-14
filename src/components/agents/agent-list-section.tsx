import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Radar } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  TSBadge,
  TSEmptyState,
  TSErrorState,
  TSButton,
  TSSkeletonList,
} from '@/components/shared';
import { TSAgentAvatar, TSAgentBadge } from '@/components/agents/agent-avatar';
import { AgentStatusLabel } from '@/components/agents/agent-status';
import { agentsApi } from '@/lib/api/agents';
import type { Agent } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatRelative } from '@/lib/format';
import { capabilityLabel } from '@/components/agents/agent-utils';
import { tokens } from '@/constants/theme';
import { cn } from '@/lib/utils';

export interface AgentListSectionProps {
  /** Company scope - lists agents created in this company. */
  companyId?: string;
  /** Renders a "Create agent" button inside the empty state. */
  onCreatePress?: () => void;
  className?: string;
}

export interface AgentListSectionHandle {
  refetch: () => Promise<unknown>;
}

/** Agents roster - rows shared by the personal screen and the company tab. */
export const AgentListSection = React.forwardRef<AgentListSectionHandle, AgentListSectionProps>(
  function AgentListSection({ companyId, onCreatePress, className }: AgentListSectionProps, ref) {
    const { token } = useAuth();
    const router = useRouter();

    const agents = useQuery({
      queryKey: queryKeys.agents(companyId ? { companyId } : {}),
      queryFn: () => agentsApi.list(companyId ? { companyId } : {}, token ?? ''),
      enabled: !!token,
    });

    React.useImperativeHandle(ref, () => ({ refetch: () => agents.refetch() }), [agents]);

    const rows = agents.data ?? [];

  const emptyAction = onCreatePress ? (
    <TSButton
      variant="outline"
      onPress={onCreatePress}
      icon={<Radar size={16} variant="Outline" color={tokens.primary} />}
    >
      Create agent
    </TSButton>
  ) : undefined;

  return (
    <View className={cn('gap-3', className)}>
      {agents.isLoading ? (
        <TSSkeletonList rows={4} />
      ) : agents.isError ? (
        <TSErrorState message={agents.error.message} onRetry={() => void agents.refetch()} />
      ) : rows.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {rows.map((agent, index) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              last={index === rows.length - 1}
              onPress={() => {
                const query = companyId ? `?companyId=${companyId}` : '';
                router.push(`/agents/${agent.id}${query}`);
              }}
            />
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Radar size={28} variant="TwoTone" color={tokens.textMuted} />}
          title="Create your first agent"
          description="Add an AI crew member to take on tasks, answer mentions and keep your team moving."
          action={emptyAction}
        />
      )}
    </View>
  );
});

function AgentRow({ agent, last, onPress }: { agent: Agent; last: boolean; onPress: () => void }) {
  const chips = agent.capabilities.slice(0, 3);
  const extra = agent.capabilities.length - chips.length;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${agent.name}`}
      className="min-h-14 flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-muted"
      style={last ? { borderBottomWidth: 0 } : undefined}
    >
      <TSAgentAvatar name={agent.name} src={agent.user?.avatarUrl} size={40} />
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Text className="text-sm font-semibold text-foreground">{agent.name}</Text>
          <TSAgentBadge />
        </View>
        <AgentStatusLabel status={agent.status} active={agent.active} lastSeenAt={agent.lastSeenAt} size="sm" />
        <Text className="font-mono text-[11px] text-muted-foreground">{agent.model || 'default'}</Text>
        <View className="flex-row flex-wrap items-center gap-1">
          {chips.map((capability) => (
            <TSBadge key={capability} tone="neutral" className="px-1.5 py-0 text-[10px]">
              {capabilityLabel(capability)}
            </TSBadge>
          ))}
          {extra > 0 && (
            <TSBadge tone="primary" className="px-1.5 py-0 text-[10px]">
              +{extra}
            </TSBadge>
          )}
        </View>
      </View>
      <View className="items-end gap-0.5">
        <Text className="text-[11px] text-muted-foreground">
          {agent.lastRunAt ? `Run ${formatRelative(agent.lastRunAt)}` : 'Never run'}
        </Text>
        <Text className="text-[11px] text-muted-foreground">{agent.memberships?.length ?? 0} projects</Text>
      </View>
    </Pressable>
  );
}
