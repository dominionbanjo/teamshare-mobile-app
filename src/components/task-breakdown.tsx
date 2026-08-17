import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AddSquare, Trash } from 'iconsax-react-native';
import * as React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { TSButton, TSCheckbox, TSInput } from '@/components/shared';
import {
  createSubtask,
  createSubtaskChecklistItem,
  createTaskChecklistItem,
  deleteChecklistItem,
  deleteSubtask,
  updateChecklistItem,
  updateSubtask,
} from '@/lib/api/tasks';
import type { ChecklistItem, Subtask } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { tokens } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Optimistic write machinery (mirrors web task-breakdown.tsx)
//
// Every mutation patches the query cache in `onMutate` (instant UI), rolls
// back on error, then invalidates in the background so the final state is
// always the server's truth. Temp rows (id prefix "temp-") are placeholders
// for creates - replaced by the settle-refetch and guarded in API calls.
// ---------------------------------------------------------------------------

let tempIdCounter = 0;
function nextTempId(): string {
  tempIdCounter += 1;
  return `temp-${Date.now()}-${tempIdCounter}`;
}
const isTempId = (id: string) => id.startsWith('temp-');

/** Recursively patch one subtask node anywhere in the tree. */
function updateSubtaskNode(
  nodes: Subtask[],
  id: string,
  patch: (node: Subtask) => Subtask
): Subtask[] {
  return nodes.map((node) => {
    if (node.id === id) return patch(node);
    if (node.children && node.children.length > 0) {
      return { ...node, children: updateSubtaskNode(node.children, id, patch) };
    }
    return node;
  });
}

/** Recursively drop a subtask node (with its subtree). */
function removeSubtaskNode(nodes: Subtask[], id: string): Subtask[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.children && node.children.length > 0
        ? { ...node, children: removeSubtaskNode(node.children, id) }
        : node
    );
}

/**
 * Patch checklist rows in the cache. Task-level rows live under
 * queryKeys.checklistItems(taskId); subtask-level rows live inside the
 * subtask tree under queryKeys.subtasks(taskId) (node.checklistItems).
 */
function patchChecklistRows(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string,
  subtaskId: string | undefined,
  updater: (rows: ChecklistItem[]) => ChecklistItem[]
) {
  if (subtaskId) {
    queryClient.setQueryData<Subtask[]>(queryKeys.subtasks(taskId), (nodes) =>
      updateSubtaskNode(nodes ?? [], subtaskId, (node) => ({
        ...node,
        checklistItems: updater(node.checklistItems ?? []),
      }))
    );
  } else {
    queryClient.setQueryData<ChecklistItem[]>(queryKeys.checklistItems(taskId), (rows) =>
      updater(rows ?? [])
    );
  }
}

/**
 * Optimistic mutation: write to the query cache instantly, roll back the
 * snapshotted keys on error, and invalidate in the background on settle so
 * the server response validates the guess. Also refreshes the task row +
 * task lists (their count badges reflect subtask/checklist progress).
 */
function useOptimistic<TVars, TResult>({
  taskId,
  queryKeysList,
  mutationFn,
  write,
  errorMessage,
  onApply,
}: {
  taskId: string;
  queryKeysList: readonly (readonly unknown[])[];
  mutationFn: (vars: TVars) => Promise<TResult>;
  write: (vars: TVars) => void;
  errorMessage: string;
  onApply?: (vars: TVars) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVars, { snapshots: { key: readonly unknown[]; data: unknown }[] }>({
    mutationFn,
    onMutate: async (vars) => {
      await Promise.all(queryKeysList.map((key) => queryClient.cancelQueries({ queryKey: key })));
      const snapshots = queryKeysList.map((key) => ({ key, data: queryClient.getQueryData(key) }));
      write(vars);
      onApply?.(vars);
      return { snapshots };
    },
    onError: (err, _vars, context) => {
      for (const { key, data } of context?.snapshots ?? []) {
        if (data !== undefined) queryClient.setQueryData(key, data);
      }
      Alert.alert(errorMessage, err.message);
    },
    onSettled: () => {
      for (const key of queryKeysList) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    },
  });
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

/** Live checklist panel - rows on a task OR a subtask (saves immediately, optimistic). */
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

  const rows = items ?? [];

  // Task-level rows live in queryKeys.checklistItems; subtask-level rows
  // live inside the subtask tree (node.checklistItems).
  const cacheKeys = subtaskId ? [queryKeys.subtasks(taskId)] : [queryKeys.checklistItems(taskId)];

  const toggle = useOptimistic<{ id: string; done: boolean }, ChecklistItem>({
    taskId,
    queryKeysList: cacheKeys,
    mutationFn: ({ id, done }) =>
      isTempId(id)
        ? Promise.resolve({} as ChecklistItem)
        : updateChecklistItem(token ?? '', id, { done }),
    write: ({ id, done }) =>
      patchChecklistRows(queryClient, taskId, subtaskId, (rows) =>
        rows.map((item) => (item.id === id ? { ...item, done } : item))
      ),
    errorMessage: 'Could not update checklist item',
  });

  const remove = useOptimistic<string, void>({
    taskId,
    queryKeysList: cacheKeys,
    mutationFn: (id) =>
      isTempId(id) ? Promise.resolve() : deleteChecklistItem(token ?? '', id),
    write: (id) =>
      patchChecklistRows(queryClient, taskId, subtaskId, (rows) =>
        rows.filter((item) => item.id !== id)
      ),
    errorMessage: 'Could not remove checklist item',
  });

  const add = useOptimistic<string, ChecklistItem>({
    taskId,
    queryKeysList: cacheKeys,
    mutationFn: (title) =>
      subtaskId
        ? createSubtaskChecklistItem(token ?? '', subtaskId, { title })
        : createTaskChecklistItem(token ?? '', taskId, { title }),
    write: (title) =>
      patchChecklistRows(queryClient, taskId, subtaskId, (rows) => [
        ...rows,
        {
          id: nextTempId(),
          taskId: subtaskId ? null : taskId,
          subtaskId: subtaskId ?? null,
          title,
          done: false,
          sortOrder: rows.length + 1,
          createdBy: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } satisfies ChecklistItem,
      ]),
    onApply: () => setDraft(''),
    errorMessage: 'Could not add checklist item',
  });

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
        <View
          key={item.id}
          className="flex-row items-center gap-2"
          style={isTempId(item.id) ? { opacity: 0.6 } : undefined}
        >
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

/** Live nested subtask tree (saves immediately, optimistic - every level gets its own checklist). */
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

  const addTop = useOptimistic<string, Subtask>({
    taskId,
    queryKeysList: [queryKeys.subtasks(taskId)],
    mutationFn: (title) => createSubtask(token ?? '', taskId, { title }),
    write: (title) =>
      queryClient.setQueryData<Subtask[]>(queryKeys.subtasks(taskId), (nodes) => [
        ...(nodes ?? []),
        {
          id: nextTempId(),
          taskId,
          title,
          done: false,
          sortOrder: (nodes?.length ?? 0) + 1,
          createdBy: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          children: [],
        } satisfies Subtask,
      ]),
    onApply: () => setDraft(''),
    errorMessage: 'Could not add subtask',
  });

  const tree = subtasks ?? [];
  const done = countDone(tree);
  const total = countTotal(tree);

  return (
    <View className="gap-2">
      <SectionTitle title="Subtasks" meta={`${done}/${total} done`} />
      {tree.map((node) => (
        <SubtaskRow key={node.id} taskId={taskId} node={node} depth={0} />
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
}: {
  taskId: string;
  node: Subtask;
  depth: number;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [addingChild, setAddingChild] = React.useState(false);
  const [childDraft, setChildDraft] = React.useState('');

  const treeKey = queryKeys.subtasks(taskId);
  const pending = isTempId(node.id);

  const toggle = useOptimistic<boolean, Subtask>({
    taskId,
    queryKeysList: [treeKey],
    mutationFn: (done) =>
      pending
        ? Promise.resolve({} as Subtask)
        : updateSubtask(token ?? '', node.id, { done }),
    write: (done) =>
      queryClient.setQueryData<Subtask[]>(treeKey, (nodes) =>
        updateSubtaskNode(nodes ?? [], node.id, (n) => ({ ...n, done }))
      ),
    errorMessage: 'Could not update subtask',
  });

  const remove = useOptimistic<void, void>({
    taskId,
    queryKeysList: [treeKey],
    mutationFn: () => (pending ? Promise.resolve() : deleteSubtask(token ?? '', node.id)),
    write: () =>
      queryClient.setQueryData<Subtask[]>(treeKey, (nodes) =>
        removeSubtaskNode(nodes ?? [], node.id)
      ),
    errorMessage: 'Could not remove subtask',
  });

  const addChild = useOptimistic<string, Subtask>({
    taskId,
    queryKeysList: [treeKey],
    mutationFn: (title) =>
      pending
        ? Promise.resolve({} as Subtask)
        : createSubtask(token ?? '', taskId, { title, parentId: node.id }),
    write: (title) =>
      queryClient.setQueryData<Subtask[]>(treeKey, (nodes) =>
        updateSubtaskNode(nodes ?? [], node.id, (n) => ({
          ...n,
          children: [
            ...(n.children ?? []),
            {
              id: nextTempId(),
              taskId,
              parentId: node.id,
              title,
              done: false,
              sortOrder: (n.children?.length ?? 0) + 1,
              createdBy: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              children: [],
            } satisfies Subtask,
          ],
        }))
      ),
    onApply: () => {
      setChildDraft('');
      setAddingChild(false);
    },
    errorMessage: 'Could not add nested subtask',
  });

  return (
    <View className="gap-2">
      <View
        className="flex-row items-center gap-2"
        style={{ marginLeft: depth * 16, opacity: pending ? 0.6 : 1 }}
      >
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
            <SubtaskRow key={child.id} taskId={taskId} node={child} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  );
}
