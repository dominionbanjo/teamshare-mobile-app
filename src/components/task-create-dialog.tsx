import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AddSquare, CloseCircle, Trash } from 'iconsax-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';

import {
  TSDialog,
  TSForm,
  TSFormFieldError,
  TSFormSelect,
  TSFormTextInput,
  TSButton,
  TSCheckbox,
  TSInput,
} from '@/components/shared';
import {
  createTask,
  createTaskChecklistItem,
  createSubtask,
  listSubtasks,
  listTaskChecklistItems,
  updateChecklistItem,
  updateSubtask,
  updateTask,
  deleteChecklistItem,
  deleteSubtask,
} from '@/lib/api/tasks';
import { listTaskAttachments } from '@/lib/api/comments';
import type { ProjectMember, Task } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { toIsoDate } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { uploadAttachmentCloudinary, type LocalFile } from '@/lib/api/uploads';
import { TaskFormSchema, type TaskFormInput } from '@/lib/validation/schemas';
import { listProjectMembers } from '@/lib/api/projects';
import { tokens } from '@/constants/theme';
import * as ImagePicker from 'expo-image-picker';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

type LocalRow = { id?: string; title: string; done: boolean };

export type TaskCreateDialogProps = {
  projectId: string;
  trigger?: React.ReactNode;
  /** Optional preloaded members - the dialog also refetches them on every open. */
  members?: ProjectMember[];
  onCreated?: (task: Task) => void;
};

export type TaskEditDialogProps = {
  task: Task;
  trigger?: React.ReactNode;
  onUpdated?: (task: Task) => void;
};

/**
 * Task form modal - note-style (title, note body, priority, assignee, due
 * date, tags) with subtasks, checklist rows and image attachments (IMP-240).
 * One component serves both modes:
 *  - create: images queue and upload right after the task exists
 *  - edit: status select, server data seeded, breakdown diff-persisted,
 *    picked files upload straight to the task (web task-form.tsx parity)
 */
export function TaskCreateDialog({ projectId, trigger, members = [], onCreated }: TaskCreateDialogProps) {
  return (
    <TaskFormDialog
      mode="create"
      projectId={projectId}
      members={members}
      trigger={trigger}
      onCreated={onCreated}
    />
  );
}

export function TaskEditDialog({ task, trigger, onUpdated }: TaskEditDialogProps) {
  return <TaskFormDialog mode="edit" projectId={task.projectId} task={task} trigger={trigger} onUpdated={onUpdated} />;
}

function TaskFormDialog({
  mode,
  projectId,
  task,
  members = [],
  trigger,
  onCreated,
  onUpdated,
}: {
  mode: 'create' | 'edit';
  projectId: string;
  task?: Task | null;
  trigger?: React.ReactNode;
  members?: ProjectMember[];
  onCreated?: (task: Task) => void;
  onUpdated?: (task: Task) => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [checklist, setChecklist] = React.useState<LocalRow[]>([]);
  const [subtasks, setSubtasks] = React.useState<LocalRow[]>([]);
  const [pendingImages, setPendingImages] = React.useState<LocalFile[]>([]);
  const [uploading, setUploading] = React.useState(false);
  // Edit mode: files upload instantly - in-flight chips show progress.
  const [inFlight, setInFlight] = React.useState<{ key: string; name: string }[]>([]);

  const editing = mode === 'edit' && !!task;

  // Refetch project members on every open so assignment sees fresh people.
  const membersQuery = useQuery({
    queryKey: queryKeys.projectMembers(projectId),
    queryFn: () => listProjectMembers(token ?? '', projectId),
    enabled: open && !!token,
  });
  const effectiveMembers = membersQuery.data?.items ?? members;

  const checklistQuery = useQuery({
    queryKey: queryKeys.checklistItems(task?.id ?? 'none'),
    queryFn: () => listTaskChecklistItems(token ?? '', task!.id),
    enabled: editing && open && !!token,
  });
  const subtasksQuery = useQuery({
    queryKey: queryKeys.subtasks(task?.id ?? 'none'),
    queryFn: () => listSubtasks(token ?? '', task!.id),
    enabled: editing && open && !!token,
  });
  const attachmentsQuery = useQuery({
    queryKey: queryKeys.taskAttachments(task?.id ?? 'none'),
    queryFn: () => listTaskAttachments(token ?? '', task!.id),
    enabled: editing && open && !!token,
  });

  // Seed the local editors once per open when the server data arrives
  // (render-time adjustment - a stable key prevents clobbering user edits).
  const [seededFor, setSeededFor] = React.useState<string | null>(null);
  const seedKey =
    editing && checklistQuery.data && subtasksQuery.data
      ? `${task!.id}:${checklistQuery.data.length}:${subtasksQuery.data.length}`
      : null;
  if (seedKey && seedKey !== seededFor) {
    setSeededFor(seedKey);
    setChecklist(
      checklistQuery.data!.map((item) => ({ id: item.id, title: item.title, done: item.done }))
    );
    setSubtasks(
      subtasksQuery.data!.map((sub) => ({ id: sub.id, title: sub.title, done: sub.done }))
    );
  }

  const reset = () => {
    setChecklist([]);
    setSubtasks([]);
    setPendingImages([]);
    setInFlight([]);
    setSeededFor(null);
  };

  // Diff-based persistence for edit mode (web task-form.tsx parity): added
  // rows are created, edited rows patched, removed rows deleted.
  const persistBreakdown = async (taskId: string) => {
    const initialChecklist = checklistQuery.data ?? [];
    const initialSubtasks = subtasksQuery.data ?? [];
    const checklistIds = new Set(checklist.map((item) => item.id).filter(Boolean));
    const subtaskIds = new Set(subtasks.map((sub) => sub.id).filter(Boolean));

    await Promise.all(
      checklist
        .filter((item) => item.title.trim().length > 0)
        .map((item) => {
          if (!item.id) {
            return createTaskChecklistItem(token ?? '', taskId, { title: item.title.trim() });
          }
          const original = initialChecklist.find((row) => row.id === item.id);
          if (!original) return Promise.resolve();
          const patch: { done?: boolean; title?: string } = {};
          if (original.done !== item.done) patch.done = item.done;
          if (original.title !== item.title.trim()) patch.title = item.title.trim();
          return Object.keys(patch).length
            ? updateChecklistItem(token ?? '', item.id, patch)
            : Promise.resolve();
        })
    );
    await Promise.all(
      initialChecklist
        .filter((row) => !checklistIds.has(row.id))
        .map((row) => deleteChecklistItem(token ?? '', row.id))
    );

    await Promise.all(
      subtasks
        .filter((sub) => sub.title.trim().length > 0)
        .map((sub) => {
          if (!sub.id) {
            return createSubtask(token ?? '', taskId, { title: sub.title.trim() });
          }
          const original = initialSubtasks.find((row) => row.id === sub.id);
          if (!original) return Promise.resolve();
          const patch: { done?: boolean; title?: string } = {};
          if (original.done !== sub.done) patch.done = sub.done;
          if (original.title !== sub.title.trim()) patch.title = sub.title.trim();
          return Object.keys(patch).length
            ? updateSubtask(token ?? '', sub.id, patch)
            : Promise.resolve();
        })
    );
    await Promise.all(
      initialSubtasks
        .filter((row) => !subtaskIds.has(row.id))
        .map((row) => deleteSubtask(token ?? '', row.id))
    );
  };

  const mutation = useMutation({
    mutationFn: async (values: TaskFormInput) => {
      const base = {
        title: values.title,
        description: values.description || undefined,
        priority: values.priority,
        // null clears a field on edit; undefined leaves it untouched.
        assigneeId: values.assigneeId || (editing ? null : undefined),
        dueDate: values.dueDate
          ? toIsoDate(values.dueDate)
          : editing
            ? null
            : undefined,
        tags: (values.tagsText ?? '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 10),
      };

      if (editing) {
        const updated = await updateTask(token ?? '', task!.id, {
          ...base,
          status: values.status,
          checklist: undefined,
          subtasks: undefined,
        });
        await persistBreakdown(task!.id);
        return { created: false, task: updated };
      }

      const created = await createTask(token ?? '', {
        projectId,
        ...base,
        checklist: checklist
          .filter((item) => item.title.trim().length > 0)
          .map((item) => ({ title: item.title.trim(), done: item.done })),
        subtasks: subtasks
          .filter((sub) => sub.title.trim().length > 0)
          .map((sub) => ({ title: sub.title.trim(), done: sub.done })),
      });
      // Upload collected images onto the freshly created task.
      if (pendingImages.length > 0 && token) {
        setUploading(true);
        try {
          for (const file of pendingImages) {
            try {
              await uploadAttachmentCloudinary(token, { taskId: created.id }, file, 'task');
            } catch {
              Alert.alert('Upload failed', `Could not upload ${file.name}.`);
            }
          }
        } finally {
          setUploading(false);
        }
      }
      return { created: true, task: created };
    },
    onSuccess: ({ created, task: saved }) => {
      if (editing) {
        queryClient.invalidateQueries({ queryKey: queryKeys.task(task!.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(task!.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.checklistItems(task!.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.taskAttachments(task!.id) });
        onUpdated?.(saved);
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) });
        onCreated?.(saved);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      setOpen(false);
      reset();
    },
  });

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const files: LocalFile[] = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.fileName ?? `image-${Date.now()}.jpg`,
      mime: asset.mimeType ?? 'image/jpeg',
    }));

    if (editing) {
      // Edit mode: upload straight to this task - no staging queue.
      const keys = files.map((file, index) => `${file.name}-${Date.now()}-${index}`);
      setInFlight((current) => [
        ...current,
        ...files.map((file, index) => ({ key: keys[index], name: file.name })),
      ]);
      void Promise.all(
        files.map((file, index) =>
          uploadAttachmentCloudinary(token ?? '', { taskId: task!.id }, file, 'task')
            .catch((err: unknown) =>
              Alert.alert('Upload failed', err instanceof Error ? err.message : `Could not upload ${file.name}.`)
            )
            .finally(() => {
              setInFlight((current) => current.filter((entry) => entry.key !== keys[index]));
              queryClient.invalidateQueries({ queryKey: queryKeys.taskAttachments(task!.id) });
            })
        )
      );
      return;
    }
    setPendingImages((current) => [...current, ...files]);
  };

  const addChecklistRow = () => setChecklist((rows) => [...rows, { title: '', done: false }]);
  const addSubtaskRow = () => setSubtasks((rows) => [...rows, { title: '', done: false }]);

  const defaultValues: TaskFormInput = editing
    ? {
        title: task!.title,
        description: task!.description ?? '',
        priority: task!.priority,
        status: task!.status,
        assigneeId: task!.assigneeId ?? '',
        dueDate: task!.dueDate ? task!.dueDate.slice(0, 10) : '',
        tagsText: task!.tags.join(', '),
      }
    : {
        title: '',
        description: '',
        priority: 'medium',
        status: 'open',
        assigneeId: '',
        dueDate: '',
        tagsText: '',
      };

  const existingAttachments = attachmentsQuery.data ?? [];

  return (
    <TSDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      title={editing ? 'Edit task' : 'Add task'}
      description={
        editing ? `#${task!.id.slice(0, 8)} - update anything and save.` : 'Tasks live in this project and roll up to your Tasks tab.'
      }
      trigger={
        trigger ?? (
          <TSButton icon={<AddSquare size={16} variant="Outline" color="#ffffff" />}>
            Add Task
          </TSButton>
        )
      }
    >
      <TSForm
        key={editing ? task!.id : 'create'}
        schema={TaskFormSchema}
        defaultValues={defaultValues}
        onSubmit={(values) => mutation.mutate(values)}
        render={({ handleSubmit }) => (
          <>
            <TSFormTextInput name="title" label="Title" placeholder="e.g. Ship onboarding flow" required maxLength={120} />
            <TSFormTextInput
              name="description"
              label="Note"
              placeholder="Describe the task in detail - context, acceptance criteria..."
              multiline
              numberOfLines={6}
              style={{ minHeight: 110 }}
              maxLength={10_000}
            />
            <TSFormSelect name="priority" label="Priority" options={PRIORITY_OPTIONS} />
            {editing && <TSFormSelect name="status" label="Status" options={STATUS_OPTIONS} />}
            {effectiveMembers.length > 0 && (
              <TSFormSelect
                name="assigneeId"
                label="Assignee"
                placeholder="Unassigned"
                options={effectiveMembers.map((m) => ({ value: m.userId, label: m.user?.name ?? m.userId }))}
              />
            )}
            <TSFormTextInput
              name="dueDate"
              label="Due date (optional)"
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
            <TSFormTextInput
              name="tagsText"
              label="Tags (optional)"
              placeholder="bug, api, v2 - comma separated"
              autoCapitalize="none"
            />

            <EditorSection title="Subtasks" count={subtasks.length} onAdd={addSubtaskRow}>
              {subtasks.map((sub, index) => (
                <RowEditor
                  key={index}
                  row={sub}
                  placeholder="Subtask..."
                  onChange={(patch) =>
                    setSubtasks((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
                  }
                  onRemove={() => setSubtasks((rows) => rows.filter((_, i) => i !== index))}
                />
              ))}
            </EditorSection>

            <EditorSection title="Checklist" count={checklist.length} onAdd={addChecklistRow}>
              {checklist.map((item, index) => (
                <RowEditor
                  key={index}
                  row={item}
                  placeholder="Checklist item..."
                  onChange={(patch) =>
                    setChecklist((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
                  }
                  onRemove={() => setChecklist((rows) => rows.filter((_, i) => i !== index))}
                />
              ))}
            </EditorSection>

            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.text }}>
                  Pictures & attachments
                </Text>
                <TSButton variant="outline" tsSize="sm" onPress={() => void pickImages()}>
                  {editing ? 'Add files' : 'Add images'}
                </TSButton>
              </View>

              {editing && existingAttachments.length > 0 && (
                <View style={{ gap: 6 }}>
                  {existingAttachments.map((attachment) =>
                    attachment.mime.startsWith('image/') && attachment.url ? (
                      <View key={attachment.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Image
                          source={{ uri: attachment.url }}
                          style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: tokens.border }}
                        />
                        <Text style={{ flex: 1, fontSize: 13, color: tokens.text }} numberOfLines={1}>
                          {attachment.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: tokens.textMuted }}>attached</Text>
                      </View>
                    ) : (
                      <View
                        key={attachment.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: tokens.bgSubtle,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 13, color: tokens.text }} numberOfLines={1}>
                          {attachment.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: tokens.textMuted }}>attached</Text>
                      </View>
                    )
                  )}
                </View>
              )}

              {inFlight.length > 0 && (
                <View style={{ gap: 6 }}>
                  {inFlight.map((entry) => (
                    <View
                      key={entry.key}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        backgroundColor: tokens.bgSubtle,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <ActivityIndicator size="small" color={tokens.primary} />
                      <Text style={{ flex: 1, fontSize: 13, color: tokens.text }} numberOfLines={1}>
                        {entry.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: tokens.textMuted }}>Uploading…</Text>
                    </View>
                  ))}
                </View>
              )}

              {pendingImages.length > 0 && (
                <View style={{ gap: 6 }}>
                  {pendingImages.map((file, index) => (
                    <View
                      key={`${file.name}-${index}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        backgroundColor: tokens.bgSubtle,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        style={{ flex: 1, fontSize: 13, color: tokens.text }}
                        numberOfLines={1}
                      >
                        {file.name}
                      </Text>
                      <Pressable
                        onPress={() => setPendingImages((rows) => rows.filter((_, i) => i !== index))}
                        hitSlop={12}
                      >
                        <CloseCircle size={16} variant="Outline" color={tokens.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              {!editing && pendingImages.length === 0 && (
                <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                  Images upload right after the task is created.
                </Text>
              )}
            </View>

            <TSButton
              onPress={handleSubmit((values) => mutation.mutate(values))}
              loading={mutation.isPending || uploading}
            >
              {editing ? 'Save changes' : 'Create task'}
            </TSButton>
            {mutation.isError && (
              <TSFormFieldError message={mutation.error?.message ?? 'Could not save task.'} />
            )}
          </>
        )}
      />
    </TSDialog>
  );
}

function EditorSection({
  title,
  count,
  onAdd,
  children,
}: {
  title: string;
  count: number;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.text }}>
          {title} <Text style={{ fontWeight: '400', color: tokens.textMuted }}>({count})</Text>
        </Text>
        <Pressable onPress={onAdd} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AddSquare size={16} variant="Outline" color={tokens.primary} />
          <Text style={{ fontSize: 13, color: tokens.primary, fontWeight: '500' }}>Add</Text>
        </Pressable>
      </View>
      {count === 0 && (
        <Text style={{ fontSize: 12, color: tokens.textMuted }}>Nothing added yet.</Text>
      )}
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

function RowEditor({
  row,
  placeholder,
  onChange,
  onRemove,
}: {
  row: LocalRow;
  placeholder: string;
  onChange: (patch: Partial<LocalRow>) => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TSCheckbox checked={row.done} onCheckedChange={(checked) => onChange({ done: checked })} />
      <View style={{ flex: 1 }}>
        <TSInput value={row.title} onChangeText={(title) => onChange({ title })} placeholder={placeholder} />
      </View>
      <Pressable onPress={onRemove} hitSlop={12}>
        <Trash size={16} variant="Outline" color={tokens.textMuted} />
      </Pressable>
    </View>
  );
}
