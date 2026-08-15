import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AddSquare, CloseCircle, Trash } from 'iconsax-react-native';
import * as React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

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
import { createTask, createTaskChecklistItem, createSubtask } from '@/lib/api/tasks';
import type { ChecklistItem, ProjectMember, Subtask, Task } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { toIsoDate } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { uploadAttachmentCloudinary, type LocalFile } from '@/lib/api/uploads';
import { CreateTaskFormSchema, type CreateTaskFormInput } from '@/lib/validation/schemas';
import { listProjectMembers } from '@/lib/api/projects';
import { tokens } from '@/constants/theme';
import * as ImagePicker from 'expo-image-picker';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

type LocalRow = { id?: string; title: string; done: boolean };

export type TaskCreateDialogProps = {
  projectId: string;
  trigger?: React.ReactNode;
  /** Optional preloaded members - the dialog also refetches them on every open. */
  members?: ProjectMember[];
  onCreated?: (task: Task) => void;
};

/**
 * Add task modal - note-style form (title, note body, tags, assignee, due
 * date) with subtasks, checklist rows and image attachments (IMP-240).
 * Members are refetched every time the dialog opens.
 */
export function TaskCreateDialog({
  projectId,
  trigger,
  members = [],
  onCreated,
}: TaskCreateDialogProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [checklist, setChecklist] = React.useState<LocalRow[]>([]);
  const [subtasks, setSubtasks] = React.useState<LocalRow[]>([]);
  const [pendingImages, setPendingImages] = React.useState<LocalFile[]>([]);
  const [uploading, setUploading] = React.useState(false);

  // Refetch project members on every open so assignment sees fresh people.
  const membersQuery = useQuery({
    queryKey: queryKeys.projectMembers(projectId),
    queryFn: () => listProjectMembers(token ?? '', projectId),
    enabled: open && !!token,
  });
  const effectiveMembers = membersQuery.data?.items ?? members;

  const reset = () => {
    setChecklist([]);
    setSubtasks([]);
    setPendingImages([]);
  };

  const mutation = useMutation({
    mutationFn: async (values: CreateTaskFormInput) => {
      const task = await createTask(token ?? '', {
        projectId,
        title: values.title,
        description: values.description || undefined,
        priority: values.priority,
        assigneeId: values.assigneeId || undefined,
        dueDate: toIsoDate(values.dueDate ?? ''),
        tags: (values.tagsText ?? '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 10),
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
              await uploadAttachmentCloudinary(token, { taskId: task.id }, file, 'task');
            } catch {
              Alert.alert('Upload failed', `Could not upload ${file.name}.`);
            }
          }
        } finally {
          setUploading(false);
        }
      }
      return task;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      setOpen(false);
      reset();
      onCreated?.(task);
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
    setPendingImages((current) => [...current, ...files]);
  };

  const addChecklistRow = () => setChecklist((rows) => [...rows, { title: '', done: false }]);
  const addSubtaskRow = () => setSubtasks((rows) => [...rows, { title: '', done: false }]);

  return (
    <TSDialog
      open={open}
      onOpenChange={setOpen}
      title="Add task"
      description="Tasks live in this project and roll up to your Tasks tab."
      trigger={
        trigger ?? (
          <TSButton icon={<AddSquare size={16} variant="Outline" color="#ffffff" />}>
            Add Task
          </TSButton>
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
                  Add images
                </TSButton>
              </View>
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
              {pendingImages.length === 0 && (
                <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                  Images upload right after the task is created.
                </Text>
              )}
            </View>

            <TSButton
              onPress={handleSubmit((values) => mutation.mutate(values))}
              loading={mutation.isPending || uploading}
            >
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
