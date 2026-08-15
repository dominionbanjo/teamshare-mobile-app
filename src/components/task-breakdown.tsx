import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AddSquare, Trash } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import { TSButton, TSCheckbox, TSInput } from '@/components/shared';
import {
  createSubtask,
  createSubtaskChecklistItem,
  createTaskChecklistItem,
  deleteChecklistItem,
  deleteSubtask,
  listTaskChecklistItems,
  updateChecklistItem,
  updateSubtask,
} from '@/lib/api/tasks';
import type { ChecklistItem, Subtask } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { tokens } from '@/constants/theme';

/** Refreshes every cache key reflecting subtask/checklist state (IMP-240). */
function invalidateBreakdown(queryClient: ReturnType<typeof useQueryClient>, taskId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(taskId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.checklistItems(taskId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</Text>
      {meta ? <Text className="text-xs tabular-nums text-muted-foreground">{meta}</Text> : null}
    </View>
  );
}

function ProgressBar({ total, done }: { total: number; done: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
      <View style={{ width: `${percent}%` }} className="h-full rounded-full bg-primary" />
    </View>
  );
}

/** Live checklist panel - rows on a task OR a subtask (saves immediately). */
export function ChecklistPanel({
  taskId,
  subtaskId,
  items,
}: {
  taskId: string;
  subtaskId?: string;
  items: ChecklistItem[] | undefined;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState('');

  const refresh = () => invalidateBreakdown(queryClient, taskId);

  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateChecklistItem(token ?? '', id, { done }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteChecklistItem(token ?? '', id),
    onSuccess: refresh,
  });
  const add = useMutation({
    mutationFn: (title: string) =>
      subtaskId
        ? createSubtaskChecklistItem(token ?? '', subtaskId, { title })
        : createTaskChecklistItem(token ?? '', taskId, { title }),
    onSuccess: () => {
      setDraft('');
      refresh();
    },
  });

  const rows = items ?? [];
  const done = rows.filter((item) => item.done).length;

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-3">
        <SectionTitle title="Checklist" />
        <View className="flex-1 flex-row items-center gap-2">
          <ProgressBar total={rows.length} done={done} />
          <Text className="text-xs tabular-nums text-muted-foreground">
            {done}/{rows.length}
          </Text>
        </View>
      </View>
      {rows.map((item) => (
        <View key={item.id} className="flex-row items-center gap-2">
          <TSCheckbox
            checked={item.done}
            onCheckedChange={(checked) => toggle.mutate({ id: item.id, done: checked })}
          />
          <Text
            className="min-w-0 flex-1 text-sm text-foreground"
            numberOfLines={1}
            style={item.done ? { textDecorationLine: 'line-through', color: tokens.textMuted } : undefined}
          >
            {item.title}
          </Text>
          <Pressable onPress={() => remove.mutate(item.id)} hitSlop={12} accessibilityRole="button">
            <Trash size={14} variant="Outline" color={tokens.textMuted} />
          </Pressable>
        </View>
      ))}
      {rows.length === 0 && (
        <Text className="text-xs text-muted-foreground">No checklist items yet.</Text>
      )}
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <TSInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a checklist item..."
            returnKeyType="done"
            onSubmitEditing={() => {
              const title = draft.trim();
              if (title) add.mutate(title);
            }}
          />
        </View>
        <TSButton
          variant="outline"
          tsSize="sm"
          disabled={!draft.trim()}
          loading={add.isPending}
          onPress={() => add.mutate(draft.trim())}
        >
          Add
        </TSButton>
      </View>
    </View>
  );
}

/** Live nested subtask tree (saves immediately, every level gets its own checklist). */
export function SubtasksPanel({
  taskId,
  subtasks,
  loading,
}: {
  taskId: string;
  subtasks: Subtask[] | undefined;
  loading?: boolean;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState('');

  const refresh = () => invalidateBreakdown(queryClient, taskId);

  const addTop = useMutation({
    mutationFn: (title: string) => createSubtask(token ?? '', taskId, { title }),
    onSuccess: () => {
      setDraft('');
      refresh();
    },
  });

  const tree = subtasks ?? [];
  const done = countDone(tree);
  const total = countTotal(tree);

  return (
    <View className="gap-2">
      <SectionTitle title="Subtasks" meta={`${done}/${total} done`} />
      {tree.map((node) => (
        <SubtaskRow key={node.id} taskId={taskId} node={node} depth={0} onChanged={refresh} />
      ))}
      {tree.length === 0 && !loading && (
        <Text className="text-xs text-muted-foreground">No subtasks yet - break the task down.</Text>
      )}
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <TSInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a subtask..."
            returnKeyType="done"
            onSubmitEditing={() => {
              const title = draft.trim();
              if (title) addTop.mutate(title);
            }}
          />
        </View>
        <TSButton
          variant="outline"
          tsSize="sm"
          disabled={!draft.trim()}
          loading={addTop.isPending}
          onPress={() => addTop.mutate(draft.trim())}
        >
          Add
        </TSButton>
      </View>
    </View>
  );
}

function countDone(subtasks: Subtask[]): number {
  return subtasks.reduce(
    (sum, node) => sum + (node.done ? 1 : 0) + countDone(node.children ?? []),
    0
  );
}

function countTotal(subtasks: Subtask[]): number {
  return subtasks.reduce((sum, node) => sum + 1 + countTotal(node.children ?? []), 0);
}

function SubtaskRow({
  taskId,
  node,
  depth,
  onChanged,
}: {
  taskId: string;
  node: Subtask;
  depth: number;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [addingChild, setAddingChild] = React.useState(false);
  const [childDraft, setChildDraft] = React.useState('');

  const toggle = useMutation({
    mutationFn: (done: boolean) => updateSubtask(token ?? '', node.id, { done }),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => deleteSubtask(token ?? '', node.id),
    onSuccess: onChanged,
  });
  const addChild = useMutation({
    mutationFn: (title: string) => createSubtask(token ?? '', taskId, { title, parentId: node.id }),
    onSuccess: () => {
      setChildDraft('');
      setAddingChild(false);
      onChanged();
    },
  });

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2" style={{ marginLeft: depth * 16 }}>
        <TSCheckbox checked={node.done} onCheckedChange={(checked) => toggle.mutate(checked)} />
        <Text
          className="min-w-0 flex-1 text-sm text-foreground"
          numberOfLines={1}
          style={node.done ? { textDecorationLine: 'line-through', color: tokens.textMuted } : undefined}
        >
          {node.title}
        </Text>
        <Pressable
          onPress={() => setAddingChild((value) => !value)}
          hitSlop={10}
          accessibilityRole="button"
        >
          <AddSquare size={16} variant="Outline" color={tokens.textMuted} />
        </Pressable>
        <Pressable onPress={() => remove.mutate()} hitSlop={10} accessibilityRole="button">
          <Trash size={16} variant="Outline" color={tokens.textMuted} />
        </Pressable>
      </View>
      {node.checklistItems && (
        <View className="ml-7 rounded-lg bg-muted/50 p-2.5">
          <ChecklistPanel taskId={taskId} subtaskId={node.id} items={node.checklistItems} />
        </View>
      )}
      {addingChild && (
        <View className="flex-row items-center gap-2" style={{ marginLeft: depth * 16 + 20 }}>
          <View className="flex-1">
            <TSInput
              value={childDraft}
              onChangeText={setChildDraft}
              placeholder="Nested subtask..."
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                const title = childDraft.trim();
                if (title) addChild.mutate(title);
              }}
            />
          </View>
          <TSButton variant="outline" tsSize="sm" disabled={!childDraft.trim()} onPress={() => addChild.mutate(childDraft.trim())}>
            Add
          </TSButton>
          <TSButton variant="ghost" tsSize="sm" onPress={() => setAddingChild(false)}>
            Cancel
          </TSButton>
        </View>
      )}
      {node.children && node.children.length > 0 && (
        <View className="gap-2">
          {node.children.map((child) => (
            <SubtaskRow key={child.id} taskId={taskId} node={child} depth={depth + 1} onChanged={onChanged} />
          ))}
        </View>
      )}
    </View>
  );
}
