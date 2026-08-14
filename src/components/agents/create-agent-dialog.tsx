import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Copy, Radar, Warning2 } from 'iconsax-react-native';
import * as React from 'react';
import { Controller } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  TSButton,
  TSDialog,
  TSForm,
  TSFormField,
  TSFormFieldError,
  TSFormSelect,
  TSFormTextInput,
} from '@/components/shared';
import { AgentCapabilityToggles } from '@/components/agents/agent-capability-toggles';
import { TSAgentBadge } from '@/components/agents/agent-avatar';
import { agentsApi } from '@/lib/api/agents';
import { listCompanies } from '@/lib/api/companies';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { AGENT_DEFAULT_CAPABILITIES } from '@/constants/enums';
import { CreateAgentSchema, type CreateAgentInput } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

export interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Company context - defaults the scope radio to "company". */
  companyId?: string;
}

type Scope = 'personal' | 'company';

/** API-key-shown-once state - reset when the dialog closes. */
type CreatedState = { agentName: string; token: string };

/**
 * Create agent dialog - identity + model + prompt + capability toggles +
 * scope. On success the API key is revealed exactly once with a warning.
 */
export function CreateAgentDialog({ open, onOpenChange, companyId }: CreateAgentDialogProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [created, setCreated] = React.useState<CreatedState | null>(null);

  const companies = useQuery({
    queryKey: queryKeys.companies,
    queryFn: () => listCompanies(token ?? ''),
    enabled: open && !!token,
  });

  const createAgent = useMutation({
    mutationFn: (input: CreateAgentInput) => agentsApi.create(input, token ?? ''),
    onSuccess: (result) => {
      setCreated({ agentName: result.agent.name, token: result.token });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents() });
    },
  });

  const close = () => {
    onOpenChange(false);
    setCreated(null);
  };

  return (
    <TSDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
      title={created ? 'Agent created' : 'Create an agent'}
      description={created ? undefined : 'Add an AI crew member - it acts as a user in your workspaces.'}
    >
      {created ? (
        <CreatedAgentCard
          agentName={created.agentName}
          token={created.token}
          onDone={close}
        />
      ) : (
        <ScrollView className="max-h-[62vh]" keyboardShouldPersistTaps="handled">
          <TSForm<CreateAgentInput>
            schema={CreateAgentSchema}
            defaultValues={{
              name: '',
              model: '',
              systemPrompt: '',
              capabilities: [...AGENT_DEFAULT_CAPABILITIES],
              companyId: companyId ?? null,
            }}
            onSubmit={(values) => createAgent.mutate(values)}
            render={(f) => {
              const selectedScope: Scope = f.watch('companyId') ? 'company' : 'personal';
              return (
                <>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-medium text-foreground">Scope</Text>
                    <View className="flex-row rounded-lg border border-border bg-muted p-0.5">
                      <ScopeButton
                        active={selectedScope === 'personal'}
                        label="Personal"
                        onPress={() => f.setValue('companyId', null, { shouldDirty: true })}
                      />
                      <ScopeButton
                        active={selectedScope === 'company'}
                        label="Company"
                        onPress={() => f.setValue('companyId', companyId ?? null, { shouldDirty: true })}
                      />
                    </View>
                  </View>

                  {selectedScope === 'company' && (
                    <TSFormSelect
                      name="companyId"
                      label="Company"
                      placeholder="Select a company"
                      required
                      options={companies.data?.items.map((row) => ({
                        value: row.company.id,
                        label: row.company.name,
                      })) ?? []}
                    />
                  )}

                  <TSFormTextInput name="name" label="Name" placeholder="e.g. Ship-It" required maxLength={60} />
                  <TSFormTextInput
                    name="model"
                    label="Model"
                    placeholder="deepseek-chat"
                    hint="Free text - the bridge uses it as a hint."
                    autoCapitalize="none"
                  />
                  <TSFormTextInput
                    name="systemPrompt"
                    label="System prompt"
                    placeholder="How should this agent behave? Leave empty for the default."
                    multiline
                    textAlignVertical="top"
                    numberOfLines={3}
                    maxLength={8_000}
                  />

                  <TSFormField
                    name="capabilities"
                    label="Capabilities"
                    hint="tasks:assign is off by default - you can enable it later."
                    required
                    error={f.formState.errors.capabilities?.message}
                  >
                    <View className="rounded-lg border border-border bg-muted/40 p-3">
                      <Controller
                        control={f.control}
                        name="capabilities"
                        render={({ field }) => (
                          <AgentCapabilityToggles
                            value={field.value ?? []}
                            onChange={(next) => field.onChange(next)}
                          />
                        )}
                      />
                    </View>
                  </TSFormField>

                  <TSButton
                    onPress={f.handleSubmit((values) => createAgent.mutate(values))}
                    loading={createAgent.isPending}
                    icon={<Radar size={16} variant="Outline" color="#fff" />}
                  >
                    Create agent
                  </TSButton>
                  {createAgent.isError && (
                    <TSFormFieldError message={createAgent.error?.message ?? 'Could not create agent.'} />
                  )}
                </>
              );
            }}
          />
        </ScrollView>
      )}
    </TSDialog>
  );
}

function ScopeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={cn(
        'min-h-9 items-center justify-center rounded-md px-3',
        active ? 'bg-background shadow-sm' : 'bg-transparent'
      )}
    >
      <Text className={cn('text-xs font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</Text>
    </Pressable>
  );
}

function CreatedAgentCard({ agentName, token, onDone }: CreatedState & { onDone: () => void }) {
  const [copied, setCopied] = React.useState(false);

  const copyKey = async () => {
    await Clipboard.setStringAsync(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-start gap-2 rounded-lg border border-[var(--ts-warning-500)]/40 bg-[var(--ts-warning-100)]/60 p-3">
        <Warning2 size={20} variant="TwoTone" color={tokens.warning} />
        <Text className="flex-1 text-sm text-muted-foreground">
          Store this key now - <Text className="font-medium text-foreground">{"it won't be shown again"}</Text>.
          Anyone with it can act as <Text className="font-medium text-foreground">{agentName}</Text>.
        </Text>
      </View>
      <View className="flex-row items-center gap-2 rounded-lg border border-border bg-muted p-3">
        <Text className="flex-1 font-mono text-xs text-foreground" selectable>
          {token}
        </Text>
        <TSButton
          variant="outline"
          tsSize="sm"
          onPress={() => void copyKey()}
          icon={<Copy size={16} variant="Outline" color={tokens.textSecondary} />}
          textClassName="text-foreground"
        >
          {copied ? 'Copied' : 'Copy'}
        </TSButton>
      </View>
      <View className="flex-row items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2.5">
        <TSAgentBadge />
        <Text className="flex-1 text-xs text-muted-foreground">
          Next: open the {"agent's"} page and use the Connect card to wire it to your machine.
        </Text>
      </View>
      <TSButton onPress={onDone}>Done</TSButton>
    </View>
  );
}
