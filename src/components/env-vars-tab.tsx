import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Activity, AddSquare, Copy, Eye, Key, Trash } from 'iconsax-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  EnvTierBadge,
  TSButton,
  TSConfirmDialog,
  TSDialog,
  TSEmptyState,
  TSErrorState,
  TSForm,
  TSFormFieldError,
  TSFormPasswordInput,
  TSFormSelect,
  TSFormTextInput,
  TSBadge,
  TSSkeletonList,
} from '@/components/shared';
import { createEnvVar, deleteEnvVar, listEnvVarAudit, listEnvVars, revealEnvVar } from '@/lib/api/envVars';
import type { EnvVar } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { CreateEnvVarSchema, type CreateEnvVarInput } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

const ENV_TIERS = [
  { value: 'dev', label: 'dev' },
  { value: 'staging', label: 'staging' },
  { value: 'prod', label: 'prod' },
];

export type EnvVarsTabProps = {
  projectId: string;
  /** Owners/admins see the audit log (PRD section 5). */
  canAudit?: boolean;
};

/** Project env vars - masked list, on-demand reveal (audited), delete, audit log. */
export function EnvVarsTab({ projectId, canAudit = false }: EnvVarsTabProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [revealed, setRevealed] = React.useState<{ key: string; value: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [auditOpen, setAuditOpen] = React.useState(false);

  const envVars = useQuery({
    queryKey: queryKeys.projectEnvVars(projectId),
    queryFn: () => listEnvVars(token ?? '', projectId),
    enabled: !!token && !!projectId,
  });
  const audit = useQuery({
    queryKey: queryKeys.projectEnvVarAudit(projectId),
    queryFn: () => listEnvVarAudit(token ?? '', projectId),
    enabled: !!token && !!projectId && auditOpen,
  });

  const create = useMutation({
    mutationFn: (values: CreateEnvVarInput) => createEnvVar(token ?? '', { ...values, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectEnvVars(projectId) });
      setCreateOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEnvVar(token ?? '', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectEnvVars(projectId) });
    },
  });

  const reveal = useMutation({
    mutationFn: (id: string) => revealEnvVar(token ?? '', id),
    onSuccess: (result, id) => {
      const envVar = envVars.data?.items.find((v) => v.id === id);
      setRevealed({ key: envVar?.key ?? 'Secret', value: result.value });
      setCopied(false);
      setRevealOpen(true);
    },
  });

  const handleCopy = async () => {
    if (!revealed) return;
    await Clipboard.setStringAsync(revealed.value);
    setCopied(true);
  };

  const mutationError =
    create.isError ? create.error?.message :
    remove.isError ? remove.error?.message :
    reveal.isError ? reveal.error?.message :
    null;

  const addDialog = (
    <TSDialog
      open={createOpen}
      onOpenChange={setCreateOpen}
      title="Add variable"
      description="Secrets are encrypted at rest and never shown after saving."
      trigger={
        <TSButton icon={<AddSquare size={16} variant="Outline" color="#fff" />}>Add variable</TSButton>
      }
    >
      <TSForm
        schema={CreateEnvVarSchema}
        defaultValues={{ tier: 'dev' }}
        onSubmit={(values) => create.mutate(values)}
        render={({ handleSubmit }) => (
          <>
            <TSFormTextInput
              name="key"
              label="Key"
              placeholder="DATABASE_URL"
              required
              maxLength={64}
              autoCapitalize="characters"
              autoCorrect={false}
              className="font-mono"
              hint="Uppercase letters, numbers and underscores"
            />
            <TSFormPasswordInput name="value" label="Value" placeholder="Super secret value" required maxLength={8_000} />
            <TSFormSelect name="tier" label="Environment" placeholder="Select tier" options={ENV_TIERS} />
            <TSButton onPress={handleSubmit((values) => create.mutate(values))} loading={create.isPending}>
              Add variable
            </TSButton>
            {create.isError && <TSFormFieldError message={create.error?.message ?? 'Could not add variable.'} />}
          </>
        )}
      />
    </TSDialog>
  );

  const auditDialog = (
    <TSDialog
      open={auditOpen}
      onOpenChange={setAuditOpen}
      title="Audit log"
      description="Reveals and changes to this project's secrets."
      trigger={
        <TSButton
          variant="outline"
          icon={<Activity size={16} variant="Outline" color={tokens.textSecondary} />}
        >
          Audit log
        </TSButton>
      }
    >
      {audit.isLoading ? (
        <TSSkeletonList rows={4} />
      ) : audit.isError ? (
        <TSErrorState message={audit.error.message} onRetry={() => void audit.refetch()} />
      ) : audit.data && audit.data.items.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {audit.data.items.map((entry) => (
            <View key={entry.id} className="min-h-11 flex-row items-center gap-2.5 border-b border-border px-3 py-2.5">
              <TSBadge
                tone={entry.action === 'delete' ? 'error' : entry.action === 'reveal' ? 'warning' : 'info'}
              >
                {entry.action}
              </TSBadge>
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">{entry.user?.name ?? 'Unknown'}</Text>
                <Text className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Activity size={28} variant="TwoTone" color={tokens.primary} />}
          title="No audit entries"
          description="Actions on this project's secrets will appear here."
        />
      )}
    </TSDialog>
  );

  const revealDialog = (
    <TSDialog
      open={revealOpen}
      onOpenChange={(open) => {
        setRevealOpen(open);
        if (!open) setRevealed(null);
      }}
      title="Secret value"
      description="Visible only to you. This reveal was recorded in the audit log."
    >
      {revealed && (
        <View className="gap-3">
          <View className="gap-1 rounded-md border border-border bg-muted p-3">
            <Text className="font-mono text-xs text-muted-foreground">{revealed.key}</Text>
            <Text selectable className="font-mono text-sm text-foreground">
              {revealed.value}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TSButton
              variant="outline"
              icon={<Copy size={16} variant="Outline" color={tokens.textSecondary} />}
              onPress={() => void handleCopy()}
            >
              {copied ? 'Copied' : 'Copy'}
            </TSButton>
            {copied && <Text className="text-xs text-[var(--ts-success-500)]">Copied to clipboard</Text>}
          </View>
        </View>
      )}
    </TSDialog>
  );

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        {canAudit && auditDialog}
        {addDialog}
      </View>

      {mutationError && <TSFormFieldError message={mutationError} />}

      {envVars.isLoading ? (
        <TSSkeletonList rows={4} />
      ) : envVars.isError ? (
        <TSErrorState message={envVars.error.message} onRetry={() => void envVars.refetch()} />
      ) : envVars.data && envVars.data.items.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {envVars.data.items.map((envVar, index) => (
            <EnvVarRow
              key={envVar.id}
              envVar={envVar}
              last={index === (envVars.data?.items.length ?? 0) - 1}
              revealPending={reveal.isPending && reveal.variables === envVar.id}
              onReveal={() => reveal.mutate(envVar.id)}
              onDelete={() => remove.mutate(envVar.id)}
              deletePending={remove.isPending && remove.variables === envVar.id}
            />
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Key size={28} variant="TwoTone" color={tokens.primary} />}
          title="No variables yet"
          description="Store API keys and secrets per environment. Values are encrypted and revealed only on demand."
          action={addDialog}
        />
      )}

      {revealDialog}
    </View>
  );
}

function EnvVarRow({
  envVar,
  last,
  revealPending,
  onReveal,
  onDelete,
  deletePending,
}: {
  envVar: EnvVar;
  last: boolean;
  revealPending: boolean;
  onReveal: () => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  return (
    <View
      className="min-h-12 flex-row items-center gap-2 border-b border-border px-4 py-3"
      style={last ? { borderBottomWidth: 0 } : undefined}
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-mono text-sm font-semibold text-foreground">{envVar.key}</Text>
        <Text className="text-xs text-muted-foreground">Updated {formatDate(envVar.updatedAt)}</Text>
      </View>
      <EnvTierBadge tier={envVar.tier} />
      <Pressable
        onPress={onReveal}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Reveal ${envVar.key}`}
        className="h-11 w-11 items-center justify-center rounded-md"
      >
        {revealPending ? (
          <ActivityIndicator size="small" color={tokens.textSecondary} />
        ) : (
          <Eye size={20} variant="Outline" color={tokens.textSecondary} />
        )}
      </Pressable>
      <TSConfirmDialog
        title="Delete variable?"
        description={`"${envVar.key}" (${envVar.tier}) will be permanently removed.`}
        onConfirm={onDelete}
        trigger={
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${envVar.key}`}
            className="h-11 w-11 items-center justify-center rounded-md"
          >
            {deletePending ? (
              <ActivityIndicator size="small" color={tokens.error} />
            ) : (
              <Trash size={20} variant="Outline" color={tokens.error} />
            )}
          </Pressable>
        }
      />
    </View>
  );
}
