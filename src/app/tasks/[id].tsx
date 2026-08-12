import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Message } from 'iconsax-react-native';
import * as React from 'react';
import { RefreshControl, Text, View } from 'react-native';

import {
  PriorityBadge,
  TaskStatusBadge,
  TSAvatar,
  TSCard,
  TSEmptyState,
  TSErrorState,
  TSForm,
  TSFormFieldError,
  TSFormTextInput,
  TSButton,
  TSMentionText,
  TSScreen,
  TSSkeletonList,
} from '@/components/shared';
import { createComment, listTaskComments } from '@/lib/api/comments';
import { listProjectMembers } from '@/lib/api/projects';
import { getTask } from '@/lib/api/tasks';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatDateTime, formatRelative } from '@/lib/format';
import { CommentFormSchema, type CommentFormInput } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const task = useQuery({
    queryKey: queryKeys.task(id),
    queryFn: () => getTask(token ?? '', id),
    enabled: !!token && !!id,
  });
  const comments = useQuery({
    queryKey: queryKeys.taskComments(id),
    queryFn: () => listTaskComments(token ?? '', id),
    enabled: !!token && !!id,
  });
  const members = useQuery({
    queryKey: queryKeys.projectMembers(task.data?.projectId ?? ''),
    queryFn: () => listProjectMembers(token ?? '', task.data?.projectId ?? ''),
    enabled: !!token && !!task.data?.projectId,
  });

  const sendComment = useMutation({
    mutationFn: (values: CommentFormInput) => createComment(token ?? '', { taskId: id, body: values.body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(id) });
    },
  });

  if (task.isLoading) {
    return (
      <TSScreen>
        <TSSkeletonList rows={6} />
      </TSScreen>
    );
  }

  if (task.isError || !task.data) {
    return (
      <TSScreen>
        <TSErrorState message={task.error?.message ?? 'Could not load task.'} onRetry={() => void task.refetch()} />
      </TSScreen>
    );
  }

  const taskRow = task.data;
  const memberNames = members.data?.items.map((m) => m.user?.name ?? '') ?? [];

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={task.isRefetching || comments.isRefetching}
          onRefresh={() => {
            void task.refetch();
            void comments.refetch();
          }}
          tintColor={tokens.primary}
        />
      }
    >
      <TSCard>
        <View className="gap-2">
          <Text className="text-lg font-bold text-foreground">{taskRow.title}</Text>
          {taskRow.description ? (
            <Text className="text-sm text-muted-foreground">{taskRow.description}</Text>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-2">
            <TaskStatusBadge status={taskRow.status} />
            <PriorityBadge priority={taskRow.priority} />
          </View>
          <View className="mt-1 gap-1.5">
            <View className="flex-row items-center gap-2">
              <TSAvatar name={taskRow.assignee?.name ?? 'Unassigned'} src={taskRow.assignee?.avatarUrl} size={24} />
              <Text className="text-sm text-muted-foreground">
                Assignee: {taskRow.assignee?.name ?? 'Unassigned'}
              </Text>
            </View>
            <Text className="text-sm text-muted-foreground">
              Due: {taskRow.dueDate ? formatDateTime(taskRow.dueDate) : 'No due date'}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {taskRow.project?.name ? `Project: ${taskRow.project.name}` : ''}
            </Text>
            {taskRow.tags.length > 0 && (
              <Text className="text-sm text-muted-foreground">Tags: {taskRow.tags.join(', ')}</Text>
            )}
          </View>
        </View>
      </TSCard>

      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">Comments</Text>
        <Text className="text-xs text-muted-foreground">{comments.data?.items.length ?? 0}</Text>
      </View>

      {comments.isLoading ? (
        <TSSkeletonList rows={3} />
      ) : comments.isError ? (
        <TSErrorState message={comments.error.message} onRetry={() => void comments.refetch()} />
      ) : comments.data && comments.data.items.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {comments.data.items.map((comment) => (
            <View key={comment.id} className="gap-1.5 border-b border-border px-4 py-3">
              <View className="flex-row items-center gap-2">
                <TSAvatar name={comment.author?.name ?? 'Unknown'} src={comment.author?.avatarUrl} size={24} />
                <Text className="text-sm font-semibold text-foreground">
                  {comment.author?.name ?? 'Unknown'}
                </Text>
                <Text className="text-xs text-muted-foreground">{formatRelative(comment.createdAt)}</Text>
              </View>
              <TSMentionText body={comment.body} names={memberNames} />
            </View>
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Message size={28} variant="TwoTone" color={tokens.primary} />}
          title="No comments yet"
          description="Start the discussion - @mention a teammate to notify them."
        />
      )}

      <TSCard title="Add a comment">
        <TSForm
          schema={CommentFormSchema}
          defaultValues={{}}
          onSubmit={(values) => sendComment.mutate(values)}
          render={({ handleSubmit }) => (
            <>
              <TSFormTextInput
                name="body"
                placeholder="Write a comment... use @name to mention"
                multiline
                textAlignVertical="top"
                numberOfLines={3}
                maxLength={8_000}
              />
              <View className="flex-row justify-end">
                <TSButton
                  onPress={handleSubmit((values) => sendComment.mutate(values))}
                  loading={sendComment.isPending}
                >
                  Send
                </TSButton>
              </View>
              {sendComment.isError && (
                <TSFormFieldError message={sendComment.error?.message ?? 'Could not post comment.'} />
              )}
            </>
          )}
        />
      </TSCard>
    </TSScreen>
  );
}
