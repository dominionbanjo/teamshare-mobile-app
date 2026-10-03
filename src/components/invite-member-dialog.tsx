import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AddSquare } from 'iconsax-react-native';
import * as React from 'react';

import { TSDialog, TSForm, TSFormFieldError, TSFormSelect, TSFormTextInput, TSButton } from '@/components/shared';
import { createInvitation } from '@/lib/api/invitations';
import type { Invitation } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { ProjectInviteSchema, type ProjectInviteInput } from '@/lib/validation/schemas';

/**
 * Roles a project member may be given.
 *
 * `owner` is deliberately absent (2026-10): ownership moves only through
 * `POST /projects/:id/transfer`, which demotes every prior owner row. Offering
 * it here produced a second owner row that `removeMember` then refused to
 * touch, with no transfer control in the product to comply with. Company
 * projects have no owner at all and use `manager` instead.
 */
const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
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
