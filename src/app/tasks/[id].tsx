import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { Camera, CloseCircle, DocumentUpload, Edit2, Gallery, Message, MessageAdd1, Notification, Radar } from 'iconsax-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { errorAlert } from '@/components/shared/error-alert';

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
  TSBadge,
  TSInput,
  TSScreen,
  TSSkeletonList,
  TSSelect,
} from '@/components/shared';
import { TSAgentBadge } from '@/components/agents/agent-avatar';
import { createComment, listTaskAttachments, listTaskComments } from '@/lib/api/comments';
import { listProjectMembers } from '@/lib/api/projects';
import { getTask, listSubtasks, listTaskChecklistItems, unwatchTask, updateTask, watchTask } from '@/lib/api/tasks';
import { deleteAttachment, mimeFromName, uploadAttachmentCloudinary, type LocalFile } from '@/lib/api/uploads';
import type { Attachment, Comment, Task } from '@/lib/api/types';
import { ChecklistPanel, SubtasksPanel } from '@/components/task-breakdown';
import { TaskEditDialog } from '@/components/task-create-dialog';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatDateTime, formatRelative } from '@/lib/format';
import { CommentFormSchema, type CommentFormInput } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

type UploadKind = 'file' | 'gallery' | 'camera' | null;

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Attachments come from GET /attachments?taskId (hydrated from the server;
  // previously this state started empty and never loaded existing files).
  const attachmentsQuery = useQuery({
    queryKey: queryKeys.taskAttachments(id),
    queryFn: () => listTaskAttachments(token ?? '', id),
    enabled: !!token && !!id,
  });
  const attachments = attachmentsQuery.data ?? [];
  const [uploadingKind, setUploadingKind] = React.useState<UploadKind>(null);
  const [commentImage, setCommentImage] = React.useState<LocalFile | null>(null);
  const [replyToId, setReplyToId] = React.useState<string | null>(null);
  const [replyBody, setReplyBody] = React.useState('');

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
  const subtasks = useQuery({
    queryKey: queryKeys.subtasks(id),
    queryFn: () => listSubtasks(token ?? '', id),
    enabled: !!token && !!id,
  });
  const checklistItems = useQuery({
    queryKey: queryKeys.checklistItems(id),
    queryFn: () => listTaskChecklistItems(token ?? '', id),
    enabled: !!token && !!id,
  });
  const members = useQuery({
    queryKey: queryKeys.projectMembers(task.data?.projectId ?? ''),
    queryFn: () => listProjectMembers(token ?? '', task.data?.projectId ?? ''),
    enabled: !!token && !!task.data?.projectId,
  });

  const toggleWatch = useMutation({
    mutationFn: () => {
      const taskRow = task.data;
      if (!taskRow || !token) throw new Error('Task not loaded.');
      return taskRow.watching ? unwatchTask(token, id) : watchTask(token, id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(id) });
    },
    onError: (err) => {
      errorAlert(err, "Could not update watch status");
    },
  });

  // Quick-edit parity with the web details rail: status/priority patch in
  // place (backend enforces the state machine - INVALID_TRANSITION otherwise).
  const quickUpdate = useMutation({
    mutationFn: (payload: { status?: Task['status']; priority?: Task['priority'] }) =>
      updateTask(token ?? '', id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    },
    onError: (err) => errorAlert(err, "Could not update task"),
  });

  // Phase B ask-human: the open question is the last agent comment starting
  // with `[question]` that no later human comment has answered.
  const commentList = comments.data ?? [];
  const pendingQuestion = React.useMemo(() => {
    let pending: Comment | null = null;
    for (const comment of commentList) {
      if (comment.author?.kind === 'agent' && comment.body.startsWith('[question]')) {
        pending = comment;
      } else if (comment.author?.kind === 'human' && pending) {
        pending = null;
      }
    }
    return pending;
  }, [commentList]);
  const [askReply, setAskReply] = React.useState('');

  const answerQuestion = useMutation({
    mutationFn: (body: string) => createComment(token ?? '', { taskId: id, body }),
    onSuccess: () => {
      setAskReply('');
      queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(id) });
    },
  });

  const sendComment = useMutation({
    mutationFn: async (values: CommentFormInput) => {
      const comment = await createComment(token ?? '', { taskId: id, body: values.body });
      if (commentImage) {
        await uploadAttachmentCloudinary(token ?? '', { commentId: comment.id }, commentImage, 'comment');
      }
      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(id) });
      setCommentImage(null);
    },
  });

  const sendReply = useMutation({
    mutationFn: ({ parentId, body }: { parentId: string; body: string }) =>
      createComment(token ?? '', { taskId: id, parentId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(id) });
      setReplyToId(null);
      setReplyBody('');
    },
  });

  const removeAttachment = useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(token ?? '', attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskAttachments(id) });
    },
  });

  const uploadTaskAttachment = async (file: LocalFile) => {
    try {
      await uploadAttachmentCloudinary(token ?? '', { taskId: id }, file, 'task');
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskAttachments(id) });
    } catch (err) {
      errorAlert(err, "Upload failed");
    }
  };

  const pickFile = async () => {
    setUploadingKind('file');
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await uploadTaskAttachment({
        uri: asset.uri,
        name: asset.name,
        mime: mimeFromName(asset.name, asset.mimeType ?? undefined),
      });
    } catch (err) {
      errorAlert(err, "Upload failed");
    } finally {
      setUploadingKind(null);
    }
  };

  const takePhoto = async () => {
    setUploadingKind('camera');
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to attach photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await uploadTaskAttachment({
        uri: asset.uri,
        name: asset.fileName ?? `photo-${Date.now()}.jpg`,
        mime: asset.mimeType ?? 'image/jpeg',
      });
    } catch (err) {
      errorAlert(err, "Upload failed");
    } finally {
      setUploadingKind(null);
    }
  };

  const pickGalleryImage = async (): Promise<LocalFile | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      mime: asset.mimeType ?? 'image/jpeg',
    };
  };

  const attachTaskImage = async () => {
    setUploadingKind('gallery');
    try {
      const file = await pickGalleryImage();
      if (file) await uploadTaskAttachment(file);
    } catch (err) {
      errorAlert(err, "Upload failed");
    } finally {
      setUploadingKind(null);
    }
  };

  const attachCommentImage = async () => {
    try {
      const file = await pickGalleryImage();
      if (file) setCommentImage(file);
    } catch (err) {
      errorAlert(err, "Could not pick an image");
    }
  };

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
  const repliesByParent = new Map<string, Comment[]>();
  for (const comment of commentList) {
    if (comment.parentId) {
      const replies = repliesByParent.get(comment.parentId) ?? [];
      replies.push(comment);
      repliesByParent.set(comment.parentId, replies);
    }
  }
  const topLevelComments = commentList.filter((c) => !c.parentId);

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
                {taskRow.assignee?.kind === 'agent' && <TSAgentBadge />}
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
              <Text className="text-xs text-muted-foreground">
                Created {formatRelative(taskRow.createdAt)} · Updated {formatRelative(taskRow.updatedAt)}
              </Text>
            </View>
            <View className="mt-2 flex-row gap-2">
              <View className="flex-1">
                <TSSelect
                  value={taskRow.status}
                  onValueChange={(value) => quickUpdate.mutate({ status: value as Task['status'] })}
                  options={STATUS_OPTIONS}
                />
              </View>
              <View className="flex-1">
                <TSSelect
                  value={taskRow.priority}
                  onValueChange={(value) => quickUpdate.mutate({ priority: value as Task['priority'] })}
                  options={PRIORITY_OPTIONS}
                />
              </View>
            </View>
            <View className="mt-2 flex-row items-center justify-between border-t border-border pt-3">
              <Text className="text-xs text-muted-foreground">{taskRow.watcherCount ?? 0} watching</Text>
              <View className="flex-row items-center gap-2">
                <TaskEditDialog
                  task={taskRow}
                  onUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.task(id) });
                    queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
                  }}
                  trigger={
                    <TSButton
                      variant="outline"
                      tsSize="sm"
                      icon={<Edit2 size={16} variant="Outline" color={tokens.textSecondary} />}
                      textClassName="text-foreground"
                    >
                      Edit
                    </TSButton>
                  }
                />
                <TSButton
                  variant={taskRow.watching ? 'outline' : 'default'}
                  tsSize="sm"
                  loading={toggleWatch.isPending}
                  icon={
                    <Notification
                      size={16}
                      variant="Outline"
                      color={taskRow.watching ? tokens.textSecondary : '#fff'}
                    />
                  }
                  onPress={() => toggleWatch.mutate()}
                  textClassName={taskRow.watching ? 'text-foreground' : undefined}
                >
                  {taskRow.watching ? 'Unwatch' : 'Watch'}
                </TSButton>
              </View>
            </View>
        </View>
      </TSCard>

      <TSCard title="Subtasks" description="Break the task down - subtasks can nest and each has its own checklist.">
        <SubtasksPanel taskId={id} subtasks={subtasks.data} loading={subtasks.isLoading} />
      </TSCard>

      <TSCard title="Checklist" description="Check off the steps needed to finish this task.">
        <ChecklistPanel taskId={id} items={checklistItems.data} />
      </TSCard>

      <TSCard title="Attachments" description="Files attached to this task (25MB max).">
        <View className="flex-row flex-wrap gap-2">
          <TSButton
            variant="outline"
            tsSize="sm"
            icon={<DocumentUpload size={16} variant="Outline" color={tokens.textSecondary} />}
            onPress={() => void pickFile()}
            loading={uploadingKind === 'file'}
            textClassName="text-foreground"
          >
            File
          </TSButton>
          <TSButton
            variant="outline"
            tsSize="sm"
            icon={<Gallery size={16} variant="Outline" color={tokens.textSecondary} />}
            onPress={() => void attachTaskImage()}
            loading={uploadingKind === 'gallery'}
            textClassName="text-foreground"
          >
            Photo
          </TSButton>
          <TSButton
            variant="outline"
            tsSize="sm"
            icon={<Camera size={16} variant="Outline" color={tokens.textSecondary} />}
            onPress={() => void takePhoto()}
            loading={uploadingKind === 'camera'}
            textClassName="text-foreground"
          >
            Camera
          </TSButton>
        </View>
        {attachments.length > 0 && (
          <View className="mt-3 overflow-hidden rounded-lg border border-border">
            {attachments.map((attachment, index) => (
              <View
                key={attachment.id}
                className="min-h-12 flex-row items-center gap-2.5 border-b border-border px-3 py-2.5"
                style={index === attachments.length - 1 ? { borderBottomWidth: 0 } : undefined}
              >
                {attachment.mime.startsWith('image/') && attachment.url ? (
                  <Image
                    source={{ uri: attachment.url }}
                    style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: tokens.border }}
                  />
                ) : null}
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground">{formatRelative(attachment.createdAt)}</Text>
                </View>
                <TSBadge tone="neutral">{attachment.mime}</TSBadge>
                <Pressable
                  onPress={() => removeAttachment.mutate(attachment.id)}
                  disabled={removeAttachment.isPending && removeAttachment.variables === attachment.id}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${attachment.name}`}
                  className="h-11 w-11 items-center justify-center rounded-md"
                >
                  {removeAttachment.isPending && removeAttachment.variables === attachment.id ? (
                    <ActivityIndicator size="small" color={tokens.error} />
                  ) : (
                    <CloseCircle size={20} variant="Outline" color={tokens.error} />
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </TSCard>

      {pendingQuestion && (
        <View className="rounded-lg border border-[var(--ts-warning-500)]/40 bg-[var(--ts-warning-100)]/10 p-4">
          <View className="flex-row items-start gap-2.5">
            <Radar size={18} variant="TwoTone" color={tokens.warning} />
            <View className="flex-1 gap-2">
              <Text className="text-sm font-semibold text-foreground">Agent is waiting for your answer</Text>
              <Text className="text-xs leading-5 text-secondary-foreground">
                {pendingQuestion.body.replace(/^\[question\]\s*/, '')}
              </Text>
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <TSInput
                    value={askReply}
                    onChangeText={setAskReply}
                    placeholder="Type your answer..."
                  />
                </View>
                <TSButton
                  tsSize="sm"
                  loading={answerQuestion.isPending}
                  disabled={!askReply.trim()}
                  onPress={() => answerQuestion.mutate(askReply.trim())}
                >
                  Answer
                </TSButton>
              </View>
            </View>
          </View>
        </View>
      )}

      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">Comments</Text>
        <Text className="text-xs text-muted-foreground">{commentList.length}</Text>
      </View>

      {comments.isLoading ? (
        <TSSkeletonList rows={3} />
      ) : comments.isError ? (
        <TSErrorState message={comments.error.message} onRetry={() => void comments.refetch()} />
      ) : topLevelComments.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {topLevelComments.map((comment) => {
            const replies = repliesByParent.get(comment.id) ?? [];
            return (
              <View key={comment.id} className="border-b border-border px-4 py-3">
                <CommentBody comment={comment} memberNames={memberNames} />
                <Pressable
                  onPress={() => {
                    setReplyToId(replyToId === comment.id ? null : comment.id);
                    setReplyBody('');
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Reply to comment"
                  className="mt-1 min-h-11 flex-row items-center gap-1.5 self-start"
                >
                  <MessageAdd1 size={14} variant="Outline" color={tokens.textMuted} />
                  <Text className="text-xs font-medium text-muted-foreground">Reply</Text>
                </Pressable>
                {replyToId === comment.id && (
                  <View className="mb-2 mt-1 flex-row items-end gap-2">
                    <TSInput
                      value={replyBody}
                      onChangeText={setReplyBody}
                      placeholder={`Reply to ${comment.author?.name ?? 'comment'}...`}
                      multiline
                      textAlignVertical="top"
                      numberOfLines={2}
                      maxLength={8_000}
                      containerClassName="flex-1"
                    />
                    <TSButton
                      tsSize="sm"
                      loading={sendReply.isPending}
                      onPress={() => {
                        const body = replyBody.trim();
                        if (!body) return;
                        sendReply.mutate({ parentId: comment.id, body });
                      }}
                    >
                      Send
                    </TSButton>
                  </View>
                )}
                {sendReply.isError && replyToId === comment.id && (
                  <TSFormFieldError message={sendReply.error?.message ?? 'Could not post reply.'} />
                )}
                {replies.length > 0 && (
                  <View className="ml-3 mt-2 border-l border-border pl-3">
                    {replies.map((reply) => (
                      <View key={reply.id} className="border-b border-border py-2.5 last:border-b-0">
                        <CommentBody comment={reply} memberNames={memberNames} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
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
              {commentImage && (
                <View className="flex-row items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                  <Text className="flex-1 text-xs text-foreground" numberOfLines={1}>
                    {commentImage.name}
                  </Text>
                  <Pressable
                    onPress={() => setCommentImage(null)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove attached image"
                    className="h-11 w-11 items-center justify-center"
                  >
                    <CloseCircle size={18} variant="Outline" color={tokens.textSecondary} />
                  </Pressable>
                </View>
              )}
              <View className="flex-row items-center justify-between">
                <Pressable
                  onPress={() => void attachCommentImage()}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Attach an image to this comment"
                  className="h-11 w-11 items-center justify-center rounded-md bg-muted"
                >
                  <Gallery size={20} variant="Outline" color={tokens.textSecondary} />
                </Pressable>
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

function CommentBody({ comment, memberNames }: { comment: Comment; memberNames: string[] }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        <TSAvatar name={comment.author?.name ?? 'Unknown'} src={comment.author?.avatarUrl} size={24} />
        <Text className="text-sm font-semibold text-foreground">{comment.author?.name ?? 'Unknown'}</Text>
        {comment.author?.kind === 'agent' && <TSAgentBadge />}
        <Text className="text-xs text-muted-foreground">{formatRelative(comment.createdAt)}</Text>
      </View>
      <TSMentionText body={comment.body} names={memberNames} />
    </View>
  );
}
