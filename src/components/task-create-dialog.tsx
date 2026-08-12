import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AddSquare } from 'iconsax-react-native';
import * as React from 'react';

import { TSDialog, TSForm, TSFormFieldError, TSFormSelect, TSFormTextInput, TSButton } from '@/components/shared';
import { createTask } from '@/lib/api/tasks';
import type { ProjectMember, Task } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { toIsoDate } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { CreateTaskFormSchema, type CreateTaskFormInput } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export type TaskCreateDialogProps = {
  projectId: string;
  trigger?: React.ReactNode;
  members?: ProjectMember[];
  onCreated?: (task: Task) => void;
};

/** Add task modal - TSForm(CreateTaskFormSchema) with priority + assignee + due date. */
export function TaskCreateDialog({ projectId, trigger, members = [], onCreated }: TaskCreateDialogProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const mutation = useMutation({
    mutationFn: (values: CreateTaskFormInput) =>
      createTask(token ?? '', {
        projectId,
        title: values.title,
        priority: values.priority,
        assigneeId: values.assigneeId || undefined,
        dueDate: toIsoDate(values.dueDate ?? ''),
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      setOpen(false);
      onCreated?.(task);
    },
  });

  return (
    <TSDialog
      open={open}
      onOpenChange={setOpen}
      title="Add task"
      description="Tasks live in this project and roll up to your Tasks tab."
      trigger={
        trigger ?? (
          <TSButton icon={<AddSquare size={16} variant="Outline" color="#fff" />}>Add Task</TSButton>
        )
      }
    >
      <TSForm
        schema={CreateTaskFormSchema}
        defaultValues={{ priority: 'medium' }}
        onSubmit={(values) => mutation.mutate(values)}
        render={({ handleSubmit }) => (
          <>
            <TSFormTextInput name="title" label="Title" placeholder="e.g. Ship onboarding flow" required maxLength={120} />
            <TSFormSelect name="priority" label="Priority" options={PRIORITY_OPTIONS} />
            {members.length > 0 && (
              <TSFormSelect
                name="assigneeId"
                label="Assignee"
                placeholder="Unassigned"
                options={members.map((m) => ({ value: m.userId, label: m.user?.name ?? m.userId }))}
              />
            )}
            <TSFormTextInput
              name="dueDate"
              label="Due date (optional)"
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
            <TSButton onPress={handleSubmit((values) => mutation.mutate(values))} loading={mutation.isPending}>
              Create task
            </TSButton>
            {mutation.isError && (
              <TSFormFieldError message={mutation.error?.message ?? 'Could not create task.'} />
            )}
          </>
        )}
      />
    </TSDialog>
  );
}
