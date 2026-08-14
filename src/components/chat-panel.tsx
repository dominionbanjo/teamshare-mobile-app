import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { AttachCircle, DocumentText, MessageText, Send2, Trash } from 'iconsax-react-native';
import * as React from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, Text, View } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import {
  TSAvatar,
  TSButton,
  TSEmptyState,
  TSErrorState,
  TSInput,
  TSMentionText,
  TSSkeletonList,
} from '@/components/shared';
import { listChatMessages } from '@/lib/api/chat';
import { presignAttachment, uploadToCloudinary } from '@/lib/api/uploads';
import type { ChatMessage } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { tokens } from '@/constants/theme';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:4000';
const GROUP_GAP_MS = 5 * 60 * 1000;

type MessageAck = { ok: boolean; error?: string; message?: ChatMessage };

type PendingAttachment = { uri: string; name: string; mime: string; url: string };

type ChatItem =
  | { kind: 'divider'; label: string; key: string }
  | { kind: 'message'; message: ChatMessage; grouped: boolean; key: string };

function isImage(mime?: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}

function mergeMessages(...lists: (ChatMessage[] | undefined)[]): ChatMessage[] {
  const seen = new Set<string>();
  const merged: ChatMessage[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const message of list) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      merged.push(message);
    }
  }
  return merged.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/** Project chat - socket.io live messages merged with REST history. */
export function ChatPanel({ projectId }: { projectId: string }) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [live, setLive] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [attachment, setAttachment] = React.useState<PendingAttachment | null>(null);
  const socketRef = React.useRef<Socket | null>(null);

  /** Stable "today"/"yesterday" keys - never recomputed during render. */
  const [dayRef] = React.useState(() => {
    const today = new Date().toDateString();
    return {
      today,
      yesterday: new Date(Date.now() - 86_400_000).toDateString(),
    };
  });

  const history = useQuery({
    queryKey: queryKeys.chatMessages(projectId),
    queryFn: () => listChatMessages(token ?? '', projectId),
    enabled: !!token && !!projectId,
  });

  React.useEffect(() => {
    if (!token) return;
    const socket = io(`${WS_URL}/chat`, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { projectId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('message:new', (message: ChatMessage) => {
      setLive((prev) => mergeMessages(prev, [message]));
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(projectId) });
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, projectId, queryClient]);

  const pickAndAttach = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const mime = asset.mimeType ?? 'application/octet-stream';
      setUploading(asset.name);
      try {
        const { uploadUrl, formParams } = await presignAttachment(token ?? '', asset.name, mime, 'chat');
        const secureUrl = await uploadToCloudinary(uploadUrl, formParams, {
          uri: asset.uri,
          name: asset.name,
          mime,
        });
        setAttachment({ uri: asset.uri, name: asset.name, mime, url: secureUrl });
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setUploading(null);
      }
    } catch (err) {
      console.warn('Document picker failed:', err);
    }
  };

  const send = () => {
    const body = input.trim();
    if ((!body && !attachment) || pending || uploading) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setSendError('Not connected to chat. Reconnecting…');
      return;
    }
    setPending(true);
    setSendError(null);
    socket.emit(
      'message',
      {
        projectId,
        body,
        attachmentUrl: attachment?.url,
        attachmentName: attachment?.name,
        attachmentMime: attachment?.mime,
      },
      (ack?: MessageAck) => {
        setPending(false);
        if (!ack || ack.ok === false) {
          console.error('chat ack error', ack?.error);
          setSendError(ack?.error ?? 'Message not delivered.');
          return;
        }
        if (ack.message) setLive((prev) => mergeMessages(prev, [ack.message!]));
        setInput('');
        setAttachment(null);
      }
    );
  };

  const ownId = user?.id ?? '';

  const messages = mergeMessages(history.data?.items ?? [], live);

  /** Mention names derived from loaded messages - no extra state to sync. */
  const memberNames = React.useMemo(() => {
    const names = new Set<string>();
    for (const message of messages) {
      if (message.author?.name) names.add(message.author.name);
    }
    return [...names];
  }, [messages]);

  const items = React.useMemo(() => {
    const out: ChatItem[] = [];
    let lastDay = '';
    let lastAuthor = '';
    let lastTime = 0;
    for (const message of messages) {
      const day = new Date(message.createdAt).toDateString();
      if (day !== lastDay) {
        const label =
          day === dayRef.today
            ? 'Today'
            : day === dayRef.yesterday
              ? 'Yesterday'
              : formatRelative(message.createdAt);
        out.push({ kind: 'divider', label, key: `day-${day}` });
        lastDay = day;
        lastAuthor = '';
        lastTime = 0;
      }
      const grouped =
        message.authorId === lastAuthor &&
        new Date(message.createdAt).getTime() - lastTime < GROUP_GAP_MS;
      out.push({ kind: 'message', message, grouped, key: message.id });
      lastAuthor = message.authorId;
      lastTime = new Date(message.createdAt).getTime();
    }
    return out;
  }, [messages, dayRef]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="h-[540px] overflow-hidden rounded-lg border border-border bg-background"
    >
      {/* Connection banner */}
      {!connected && (
        <View className="flex-row items-center gap-2 border-b border-border bg-[var(--ts-warning-100)] px-3 py-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-[var(--ts-warning-500)]" />
          <Text className="text-xs font-medium text-[var(--ts-warning-600)]">
            Reconnecting to the chat server…
          </Text>
        </View>
      )}

      {history.isLoading ? (
        <TSSkeletonList rows={5} className="p-4" />
      ) : history.isError ? (
        <TSErrorState message={history.error.message} onRetry={() => void history.refetch()} />
      ) : messages.length === 0 ? (
        <TSEmptyState
          icon={<MessageText size={28} variant="TwoTone" color={tokens.primary} />}
          title="No messages yet"
          description="Say hi - @mention a teammate to get their attention."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerClassName="gap-2 p-3"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            item.kind === 'divider' ? (
              <View className="flex-row items-center gap-3 py-1">
                <View className="h-px flex-1 bg-border" />
                <Text className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </Text>
                <View className="h-px flex-1 bg-border" />
              </View>
            ) : (
              <MessageBubble
                message={item.message}
                isOwn={item.message.authorId === ownId}
                grouped={item.grouped}
                memberNames={memberNames}
              />
            )
          }
        />
      )}

      <View className="gap-1 border-t border-border p-2">
        {/* Pending attachment chip */}
        {(attachment || uploading) && (
          <View className="flex-row items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1.5">
            <DocumentText size={16} variant="Outline" color={tokens.primary} />
            <Text className="flex-1 truncate text-xs font-medium text-foreground" numberOfLines={1}>
              {uploading ? `Uploading ${uploading}…` : attachment?.name}
            </Text>
            {!uploading && attachment && (
              <Pressable
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remove attachment"
                onPress={() => setAttachment(null)}
              >
                <Trash size={16} variant="Outline" color={tokens.error} />
              </Pressable>
            )}
          </View>
        )}
        <View className="flex-row items-end gap-2">
          <TSButton
            variant="outline"
            onPress={() => void pickAndAttach()}
            loading={!!uploading}
            disabled={!!uploading}
            accessibilityLabel="Attach a file"
            className="h-10 w-10 items-center justify-center px-0"
            icon={<AttachCircle size={18} variant="Outline" color={tokens.textSecondary} />}
          />
          <View className="flex-1">
            <TSInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message… use @name to mention someone"
              multiline
              maxLength={4_000}
              className="min-h-10 max-h-24"
            />
          </View>
          <TSButton
            onPress={send}
            loading={pending}
            disabled={(!input.trim() && !attachment) || !!uploading}
            accessibilityLabel="Send message"
            className="h-10 w-10 items-center justify-center px-0"
            icon={<Send2 size={18} variant="Bold" color="#fff" />}
          />
        </View>
        {sendError && <Text className="text-xs text-[var(--ts-error-500)]">{sendError}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  isOwn,
  grouped,
  memberNames,
}: {
  message: ChatMessage;
  isOwn: boolean;
  grouped: boolean;
  memberNames: string[];
}) {
  return (
    <View
      className={cn(
        'max-w-[82%]',
        isOwn ? 'self-end' : 'self-start',
        grouped ? '' : 'mt-1'
      )}
    >
      {!grouped && !isOwn && (
        <View className="mb-1 flex-row items-center gap-1.5">
          <TSAvatar name={message.author?.name ?? 'Unknown'} src={message.author?.avatarUrl} size={20} />
          <Text className="text-xs font-semibold text-foreground">{message.author?.name ?? 'Unknown'}</Text>
        </View>
      )}
      <View
        className={cn(
          'rounded-2xl px-3 py-2',
          isOwn ? 'rounded-br-md bg-primary' : 'rounded-bl-md border border-border bg-card'
        )}
      >
        {message.attachmentUrl && isImage(message.attachmentMime) && (
          <Image
            source={{ uri: message.attachmentUrl }}
            alt={message.attachmentName ?? 'Attachment'}
            style={{ width: 220, height: 160, borderRadius: 8, marginBottom: 6 }}
            contentFit="cover"
          />
        )}
        {message.body ? (
          <TSMentionText
            body={message.body}
            names={memberNames}
            textClassName={isOwn ? 'text-sm text-white' : 'text-sm text-foreground'}
          />
        ) : null}
        {message.attachmentUrl && !isImage(message.attachmentMime) && (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(message.attachmentUrl!)}
            className={cn(
              'mt-1.5 flex-row items-center gap-1.5 rounded-md border px-2 py-1.5',
              isOwn ? 'border-white/25' : 'border-border bg-muted'
            )}
          >
            <DocumentText size={14} variant="Outline" color={isOwn ? '#fff' : tokens.primary} />
            <Text
              className={cn('text-xs font-medium', isOwn ? 'text-white' : 'text-foreground')}
              numberOfLines={1}
            >
              {message.attachmentName ?? 'Attachment'}
            </Text>
          </Pressable>
        )}
        {!grouped && (
          <Text
            className={cn(
              'mt-1 text-[10px]',
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {formatRelative(message.createdAt)}
          </Text>
        )}
      </View>
    </View>
  );
}
