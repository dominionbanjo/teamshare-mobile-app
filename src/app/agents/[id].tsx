import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Edit2, Trash } from 'iconsax-react-native';
import * as React from 'react';
import { Alert, RefreshControl, Text, View } from 'react-native';
import { errorAlert } from '@/components/shared/error-alert';

import {
  TSButton,
  TSCard,
  TSConfirmDialog,
  TSDialog,
  TSErrorState,
  TSForm,
  TSFormFieldError,
  TSFormTextInput,
  TSPageHeader,
  TSScreen,
  TSSkeletonList,
  TSSwitch,
} from '@/components/shared';
import { TSAgentAvatar, TSAgentBadge } from '@/components/agents/agent-avatar';
import { AgentStatusLabel } from '@/components/agents/agent-status';
import { AgentCapabilityToggles } from '@/components/agents/agent-capability-toggles';
import { AgentConnectCard } from '@/components/agents/agent-connect-card';
import { RunHistory } from '@/components/agents/run-history';
import { agentsApi } from '@/lib/api/agents';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatDate } from '@/lib/format';
import { UpdateAgentSchema, type UpdateAgentInput } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

export default function AgentDetailScreen() {
  const { id, companyId } = useLocalSearchParams<{ id: string; companyId?: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const agent = useQuery({
    queryKey: queryKeys.agent(id),
    queryFn: () => agentsApi.get(id, token ?? ''),
    enabled: !!token && !!id,
    refetchInterval: 30_000,
  });

  const updateAgent = useMutation({
    mutationFn: ({ input }: { input: UpdateAgentInput }) => agentsApi.update(id, input, token ?? ''),
    onSuccess: (updated) => {
      void queryClient.setQueryData(queryKeys.agent(id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents() });
    },
    onError: (err) => {
      errorAlert(err, "Could not update agent");
    },
  });

  const deleteAgent = useMutation({
    mutationFn: () => agentsApi.delete(id, token ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents() });
      router.back();
    },
    onError: (err) => {
      errorAlert(err, "Could not delete agent");
    },
  });

  const [promptOpen, setPromptOpen] = React.useState(false);

  if (agent.isLoading) {
    return (
      <TSScreen>
        <TSSkeletonList rows={6} />
      </TSScreen>
    );
  }

  if (agent.isError || !agent.data) {
    return (
      <TSScreen>
        <TSErrorState message={agent.error?.message ?? 'Could not load agent.'} onRetry={() => void agent.refetch()} />
      </TSScreen>
    );
  }

  const agentRow = agent.data;
  const listHref = companyId ? `/agents?companyId=${companyId}` : '/agents';

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={agent.isRefetching}
          onRefresh={() => void agent.refetch()}
          tintColor={tokens.primary}
        />
      }
    >
      <TSPageHeader
        title={
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-2xl font-bold text-foreground">{agentRow.name}</Text>
            <TSAgentBadge />
          </View>
        }
        description={
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
            <AgentStatusLabel status={agentRow.status} active={agentRow.active} lastSeenAt={agentRow.lastSeenAt} size="sm" />
            <Text className="font-mono text-xs text-muted-foreground">{agentRow.model || 'default model'}</Text>
            <Text className="text-xs text-muted-foreground">· created {formatDate(agentRow.createdAt)}</Text>
          </View>
        }
        actions={
          <TSButton variant="outline" tsSize="sm" onPress={() => router.push(listHref)} textClassName="text-foreground">
            All agents
          </TSButton>
        }
      />

      {updateAgent.isError && <TSFormFieldError message={updateAgent.error?.message ?? 'Could not save changes.'} />}

      {/* Identity + configuration */}
      <TSCard title="Agent" description="Identity and configuration">
        <View className="flex-row items-center gap-3">
          <TSAgentAvatar name={agentRow.name} src={agentRow.user?.avatarUrl} size={40} />
          <View className="min-w-0 flex-1">
            <Text className="text-base font-semibold text-foreground">{agentRow.name}</Text>
            <Text className="text-xs text-muted-foreground">
              {agentRow._count?.tasks ?? 0} tasks assigned · {agentRow._count?.logs ?? 0} log entries
            </Text>
          </View>
        </View>

        <View className="mt-4 gap-4">
          <View className="gap-1.5">
            <Text className="text-xs font-medium text-foreground">System prompt</Text>
            <View className="rounded-lg border border-border bg-muted/40 p-3">
              <Text className="max-h-40 text-xs leading-5 text-foreground">
                {agentRow.systemPrompt?.trim() ? agentRow.systemPrompt : 'Default prompt - no custom instructions set.'}
              </Text>
            </View>
            <TSButton
              variant="outline"
              tsSize="sm"
              className="mt-1 self-start"
              onPress={() => setPromptOpen(true)}
              icon={<Edit2 size={16} variant="Outline" color={tokens.textSecondary} />}
              textClassName="text-foreground"
            >
              Edit prompt
            </TSButton>
          </View>

          <View className="gap-1.5">
            <Text className="text-xs font-medium text-foreground">Capabilities</Text>
            <View className="rounded-lg border border-border bg-muted/40 p-3">
              <AgentCapabilityToggles
                value={agentRow.capabilities}
                disabled={updateAgent.isPending}
                onChange={(next) => updateAgent.mutate({ input: { capabilities: next } })}
              />
            </View>
            <Text className="text-[11px] text-muted-foreground">
              Changes apply immediately - the bridge picks them up on the next call.
            </Text>
          </View>
        </View>
      </TSCard>

      {/* Danger zone */}
      <TSCard title="Danger zone" description="Pause or remove this agent permanently.">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-medium text-foreground">Active</Text>
            <Text className="text-xs text-muted-foreground">Paused agents stay on your roster but never wake.</Text>
          </View>
          <TSSwitch
            checked={agentRow.active}
            disabled={updateAgent.isPending}
            onValueChange={(active) => updateAgent.mutate({ input: { active } })}
            accessibilityLabel="Toggle active"
          />
        </View>
        <View className="mt-4 items-end border-t border-border pt-4">
          <TSConfirmDialog
            title={`Delete "${agentRow.name}"?`}
            description="This permanently removes the agent, its user account and its API keys. Logs are deleted too."
            confirmLabel="Delete agent"
            onConfirm={() => deleteAgent.mutateAsync()}
            trigger={
              <TSButton
                variant="destructive"
                tsSize="sm"
                icon={<Trash size={16} variant="Broken" color="#fff" />}
              >
                Delete agent
              </TSButton>
            }
          />
        </View>
      </TSCard>

      {/* Connect this agent - three setup methods */}
      <AgentConnectCard agentId={agentRow.id} />

      {/* Run history */}
      <TSCard title="Run history" description="Everything this agent has done, newest first.">
        <RunHistory agentId={agentRow.id} />
      </TSCard>

      {/* System prompt edit dialog */}
      <TSDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title="Edit system prompt"
        description="Guidance the agent sees before every session."
      >
        <TSForm<UpdateAgentInput>
          schema={UpdateAgentSchema}
          defaultValues={{ systemPrompt: agentRow.systemPrompt ?? '' }}
          onSubmit={async (values) => {
            await updateAgent.mutateAsync({ input: { systemPrompt: values.systemPrompt } });
            setPromptOpen(false);
          }}
          render={({ handleSubmit, formState }) => (
            <>
              <TSFormTextInput
                name="systemPrompt"
                label="System prompt"
                placeholder="e.g. Be concise. Verify before claiming. Never reveal secrets."
                multiline
                textAlignVertical="top"
                numberOfLines={5}
                maxLength={8_000}
              />
              <View className="flex-row justify-end gap-2">
                <TSButton variant="outline" onPress={() => setPromptOpen(false)}>
                  Cancel
                </TSButton>
                <TSButton
                  onPress={handleSubmit((values) => void updateAgent.mutateAsync({ input: values }).then(() => setPromptOpen(false)))}
                  loading={updateAgent.isPending || formState.isSubmitting}
                >
                  Save prompt
                </TSButton>
              </View>
            </>
          )}
        />
      </TSDialog>
    </TSScreen>
  );
}
