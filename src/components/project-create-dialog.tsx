import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AddSquare } from 'iconsax-react-native';
import * as React from 'react';

import { TSDialog, TSForm, TSFormFieldError, TSFormSelect, TSFormTextInput, TSButton } from '@/components/shared';
import { createProject } from '@/lib/api/projects';
import type { Project, Team } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { CreateProjectSchema, type CreateProjectInput } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

export type ProjectCreateDialogProps = {
  trigger?: React.ReactNode;
  teams?: Team[];
  onCreated?: (project: Project) => void;
};

/** New project modal - TSForm(CreateProjectSchema) per style guide 7.7. */
export function ProjectCreateDialog({ trigger, teams = [], onCreated }: ProjectCreateDialogProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const mutation = useMutation({
    mutationFn: (values: CreateProjectInput) => createProject(token ?? '', values),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      setOpen(false);
      onCreated?.(project);
    },
  });

  return (
    <TSDialog
      open={open}
      onOpenChange={setOpen}
      title="New project"
      description="Projects group tasks, documents and env vars."
      trigger={
        trigger ?? (
          <TSButton icon={<AddSquare size={16} variant="Outline" color="#fff" />}>New Project</TSButton>
        )
      }
    >
      <TSForm
        schema={CreateProjectSchema}
        defaultValues={{}}
        onSubmit={(values) => mutation.mutate(values)}
        render={({ handleSubmit }) => (
          <>
            <TSFormTextInput
              name="name"
              label="Project name"
              placeholder="e.g. Website redesign"
              required
              maxLength={80}
            />
            {teams.length > 0 && (
              <TSFormSelect
                name="teamId"
                label="Team (optional)"
                placeholder="No team"
                options={teams.map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
            <TSButton
              onPress={handleSubmit((values) => mutation.mutate(values))}
              loading={mutation.isPending}
            >
              Create project
            </TSButton>
            {mutation.isError && (
              <TSFormFieldError message={mutation.error?.message ?? 'Could not create project.'} />
            )}
          </>
        )}
      />
    </TSDialog>
  );
}
