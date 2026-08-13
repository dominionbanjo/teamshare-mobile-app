import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AddSquare, Profile2User, Trash, UserAdd } from 'iconsax-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import {
  TSBadge,
  TSButton,
  TSCard,
  TSConfirmDialog,
  TSDialog,
  TSEmptyState,
  TSErrorState,
  TSForm,
  TSFormFieldError,
  TSFormSelect,
  TSFormTextInput,
  TSAvatar,
  TSPageHeader,
  TSScreen,
  TSSelect,
  TSSkeletonList,
  TSTabs,
} from '@/components/shared';
import {
  deleteCompany,
  deleteMembership,
  getCompany,
  listCompanyMembers,
  updateCompany,
  updateMembershipRole,
} from '@/lib/api/companies';
import { createInvitation } from '@/lib/api/invitations';
import type { CompanyMember, CompanyRoleValue } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { CreateCompanySchema, CreateInvitationSchema } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

const ROLE_TONE: Record<CompanyRoleValue, 'primary' | 'info' | 'violet' | 'neutral'> = {
  owner: 'primary',
  admin: 'info',
  secret_manager: 'violet',
  member: 'neutral',
  viewer: 'neutral',
};

/** Roles assignable via invite/role-change (never 'owner'). */
const ASSIGNABLE_ROLES: { value: string; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'secret_manager', label: 'Secret Manager' },
];

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [rolePendingId, setRolePendingId] = React.useState<string | null>(null);

  const company = useQuery({
    queryKey: queryKeys.company(id),
    queryFn: () => getCompany(token ?? '', id),
    enabled: !!token && !!id,
  });
  const members = useQuery({
    queryKey: queryKeys.companyMembers(id),
    queryFn: () => listCompanyMembers(token ?? '', id),
    enabled: !!token && !!id,
  });

  const role = company.data?.membershipRole;
  const canManage = role === 'owner' || role === 'admin';
  const canDelete = role === 'owner';

  const invalidateCompany = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.company(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.companies });
  };

  const invite = useMutation({
    mutationFn: (values: { email: string; role: string }) =>
      createInvitation(token ?? '', { companyId: id, email: values.email, role: values.role }),
    onSuccess: () => {
      setInviteOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
    },
  });

  const update = useMutation({
    mutationFn: (values: { name: string; slug: string }) => updateCompany(token ?? '', id, values),
    onSuccess: () => {
      invalidateCompany();
      setSaved(true);
      setTimeout(() => setSaved(false), 2_500);
    },
  });

  const removeCompany = useMutation({
    mutationFn: () => deleteCompany(token ?? '', id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companies });
      router.back();
    },
  });

  const changeRole = useMutation({
    mutationFn: ({ membershipId, nextRole }: { membershipId: string; nextRole: string }) =>
      updateMembershipRole(token ?? '', membershipId, nextRole as CompanyRoleValue),
    onMutate: ({ membershipId }) => setRolePendingId(membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
      invalidateCompany();
    },
    onError: (err) => {
      Alert.alert('Could not change role', err.message);
    },
    onSettled: () => setRolePendingId(null),
  });

  const removeMember = useMutation({
    mutationFn: (membershipId: string) => deleteMembership(token ?? '', membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
    },
    onError: (err) => {
      Alert.alert('Could not remove member', err.message);
    },
  });

  const mutationError = invite.isError
    ? invite.error.message
    : update.isError
      ? update.error.message
      : removeCompany.isError
        ? removeCompany.error.message
        : null;

  if (company.isLoading) {
    return (
      <TSScreen>
        <TSSkeletonList rows={6} />
      </TSScreen>
    );
  }

  if (company.isError || !company.data) {
    return (
      <TSScreen>
        <TSErrorState message={company.error?.message ?? 'Could not load company.'} onRetry={() => void company.refetch()} />
      </TSScreen>
    );
  }

  const companyRow = company.data;
  const memberRows = members.data?.items ?? [];

  const inviteDialog = (
    <TSDialog
      open={inviteOpen}
      onOpenChange={setInviteOpen}
      title="Invite member"
      description="They'll get an email with a link that expires in 7 days."
      trigger={
        <TSButton icon={<UserAdd size={16} variant="Outline" color="#fff" />}>Invite</TSButton>
      }
    >
      <TSForm
        schema={CreateInvitationSchema}
        defaultValues={{ role: 'member' }}
        onSubmit={(values) => invite.mutate(values)}
        render={({ handleSubmit }) => (
          <>
            <TSFormTextInput
              name="email"
              label="Email"
              placeholder="teammate@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              required
            />
            <TSFormSelect name="role" label="Role" placeholder="Select role" options={ASSIGNABLE_ROLES} required />
            <TSButton onPress={handleSubmit((values) => invite.mutate(values))} loading={invite.isPending}>
              Send invite
            </TSButton>
            {invite.isError && <TSFormFieldError message={invite.error?.message ?? 'Could not send invite.'} />}
          </>
        )}
      />
    </TSDialog>
  );

  const membersContent = (
    <View className="gap-3">
      {canManage && inviteDialog}
      {members.isLoading ? (
        <TSSkeletonList rows={4} />
      ) : members.isError ? (
        <TSErrorState message={members.error.message} onRetry={() => void members.refetch()} />
      ) : memberRows.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {memberRows.map((member, index) => (
            <MemberRow
              key={member.id}
              member={member}
              last={index === memberRows.length - 1}
              canManage={canManage}
              rolePending={rolePendingId === member.id}
              onRoleChange={(nextRole) => changeRole.mutate({ membershipId: member.id, nextRole })}
              onRemove={() => removeMember.mutate(member.id)}
              removePending={removeMember.isPending && removeMember.variables === member.id}
            />
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Profile2User size={28} variant="TwoTone" color={tokens.primary} />}
          title="No members yet"
          description="Invite teammates to join this company."
          action={canManage ? inviteDialog : undefined}
        />
      )}
    </View>
  );

  const settingsContent = canManage ? (
    <View className="gap-3">
      <TSCard title="Company details">
        <TSForm
          schema={CreateCompanySchema}
          defaultValues={{ name: companyRow.name, slug: companyRow.slug }}
          onSubmit={(values) => update.mutate(values)}
          render={({ handleSubmit }) => (
            <>
              <TSFormTextInput name="name" label="Company name" placeholder="Acme Inc." required maxLength={100} />
              <TSFormTextInput
                name="slug"
                label="Slug"
                placeholder="acme-inc"
                autoCapitalize="none"
                autoCorrect={false}
                hint="Lowercase letters, numbers and dashes - used in URLs"
                required
                maxLength={60}
              />
              <View className="flex-row items-center gap-3">
                <TSButton onPress={handleSubmit((values) => update.mutate(values))} loading={update.isPending}>
                  Save changes
                </TSButton>
                {saved && <Text className="text-xs text-[var(--ts-success-500)]">Saved</Text>}
              </View>
            </>
          )}
        />
      </TSCard>

      {canDelete && (
        <TSConfirmDialog
          title="Delete company?"
          description={`"${companyRow.name}" and all of its teams, projects and data will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete company"
          onConfirm={() => removeCompany.mutate()}
          trigger={
            <TSButton
              variant="destructive"
              icon={<Trash size={16} variant="Outline" color="#fff" />}
              loading={removeCompany.isPending}
            >
              Delete company
            </TSButton>
          }
        />
      )}
    </View>
  ) : (
    <TSCard description="Only owners and admins can change company settings.">
      <Text className="text-sm text-muted-foreground">
        Your role in this company does not allow editing settings.
      </Text>
    </TSCard>
  );

  return (
    <TSScreen>
      <TSPageHeader
        title={companyRow.name}
        description={`@${companyRow.slug}`}
        actions={
          role ? (
            <TSBadge tone={ROLE_TONE[role] ?? 'neutral'}>{role}</TSBadge>
          ) : undefined
        }
      />

      {mutationError && <TSFormFieldError message={mutationError} />}

      <TSTabs
        defaultValue="members"
        items={[
          {
            value: 'members',
            label: 'Members',
            count: memberRows.length,
            content: membersContent,
          },
          { value: 'settings', label: 'Settings', content: settingsContent },
        ]}
      />
    </TSScreen>
  );
}

function MemberRow({
  member,
  last,
  canManage,
  rolePending,
  onRoleChange,
  onRemove,
  removePending,
}: {
  member: CompanyMember;
  last: boolean;
  canManage: boolean;
  rolePending: boolean;
  onRoleChange: (role: string) => void;
  onRemove: () => void;
  removePending: boolean;
}) {
  const isOwner = member.role === 'owner';
  return (
    <View
      className="min-h-14 flex-row items-center gap-3 border-b border-border px-4 py-3"
      style={last ? { borderBottomWidth: 0 } : undefined}
    >
      <TSAvatar name={member.user?.name ?? 'Unknown'} src={member.user?.avatarUrl} size={32} />
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground">{member.user?.name ?? 'Unknown'}</Text>
        <Text className="text-xs text-muted-foreground">{member.user?.email ?? ''}</Text>
      </View>
      {isOwner || !canManage ? (
        <TSBadge tone={ROLE_TONE[member.role]}>{member.role}</TSBadge>
      ) : (
        <View className="flex-row items-center gap-2">
          {rolePending ? (
            <ActivityIndicator size="small" color={tokens.textSecondary} />
          ) : (
            <View className="w-36">
              <TSSelect
                value={member.role}
                onValueChange={onRoleChange}
                options={ASSIGNABLE_ROLES}
                disabled={rolePending}
              />
            </View>
          )}
          <TSConfirmDialog
            title="Remove member?"
            description={`${member.user?.name ?? 'This member'} will lose access to ${member.user?.email ?? 'the company'} and its projects.`}
            onConfirm={onRemove}
            trigger={
              <Pressable
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${member.user?.name ?? 'member'}`}
                className="h-11 w-11 items-center justify-center rounded-md"
              >
                {removePending ? (
                  <ActivityIndicator size="small" color={tokens.error} />
                ) : (
                  <Trash size={20} variant="Outline" color={tokens.error} />
                )}
              </Pressable>
            }
          />
        </View>
      )}
    </View>
  );
}
