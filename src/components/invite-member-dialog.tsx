import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AddSquare } from 'iconsax-react-native';
import * as React from 'react';

import { TSDialog, TSForm, TSFormFieldError, TSFormSelect, TSFormTextInput, TSButton } from '@/components/shared';
import { createInvitation } from '@/lib/api/invitations';
import type { Invitation } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { ProjectInviteSchema, type ProjectInviteInput } from '@/lib/validation/schemas';

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'owner', label: 'Owner' },
];

export type InviteMemberDialogProps = {
  projectId: string;
  trigger?: React.ReactNode;
  onInvited?: (invitation: Invitation) => void;
};

/** Invite member modal - email + project role (PRD section 5 matrix). */
export function InviteMemberDialog({ projectId, trigger, onInvited }: InviteMemberDialogProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const mutation = useMutation({
    mutationFn: (values: ProjectInviteInput) =>
      createInvitation(token ?? '', { projectId, email: values.email, role: values.role }),
    onSuccess: (invitation) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
      setOpen(false);
      onInvited?.(invitation);
    },
  });

  return (
    <TSDialog
      open={open}
      onOpenChange={setOpen}
      title="Invite member"
      description="They'll get an email with a 7-day invite link."
      trigger={
        trigger ?? (
          <TSButton icon={<AddSquare size={16} variant="Outline" color="#fff" />}>Invite</TSButton>
        )
      }
    >
      <TSForm
        schema={ProjectInviteSchema}
        defaultValues={{ role: 'member' }}
        onSubmit={(values) => mutation.mutate(values)}
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
            <TSFormSelect name="role" label="Role" options={ROLE_OPTIONS} />
            <TSButton onPress={handleSubmit((values) => mutation.mutate(values))} loading={mutation.isPending}>
              Send invitation
            </TSButton>
            {mutation.isError && (
              <TSFormFieldError message={mutation.error?.message ?? 'Could not send invitation.'} />
            )}
          </>
        )}
      />
    </TSDialog>
  );
}
