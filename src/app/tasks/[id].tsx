import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { Camera, CloseCircle, DocumentUpload, Gallery, Message, MessageAdd1, Notification } from 'iconsax-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, View } from 'react-native';

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
} from '@/components/shared';
import { createComment, listTaskComments } from '@/lib/api/comments';
import { listProjectMembers } from '@/lib/api/projects';
import { getTask, unwatchTask, watchTask } from '@/lib/api/tasks';
import { deleteAttachment, mimeFromName, uploadAttachmentCloudinary, type LocalFile } from '@/lib/api/uploads';
import type { Attachment, Comment } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { formatDateTime, formatRelative } from '@/lib/format';
import { CommentFormSchema, type CommentFormInput } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

type UploadKind = 'file' | 'gallery' | 'camera' | null;

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
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
      Alert.alert('Could not update watch status', err.message);
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
    onSuccess: (_result, attachmentId) => {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    },
  });

  const uploadTaskAttachment = async (file: LocalFile) => {
    try {
      const row = await uploadAttachmentCloudinary(token ?? '', { taskId: id }, file, 'task');
      setAttachments((prev) => [row, ...prev]);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload the file.');
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
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not pick a file.');
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
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not take a photo.');
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
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not pick an image.');
    } finally {
      setUploadingKind(null);
    }
  };

  const attachCommentImage = async () => {
    try {
      const file = await pickGalleryImage();
      if (file) setCommentImage(file);
    } catch (err) {
      Alert.alert('Could not pick an image', err instanceof Error ? err.message : 'Try again.');
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
  const commentList = comments.data ?? [];
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
          <View className="mt-2 flex-row items-center justify-between border-t border-border pt-3">
            <Text className="text-xs text-muted-foreground">{taskRow.watcherCount ?? 0} watching</Text>
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
        <Text className="text-xs text-muted-foreground">{formatRelative(comment.createdAt)}</Text>
      </View>
      <TSMentionText body={comment.body} names={memberNames} />
    </View>
  );
}
