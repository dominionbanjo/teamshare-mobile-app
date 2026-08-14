import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import {
  AttachCircle,
  DocumentText,
  Edit2,
  MessageText,
  More,
  Refresh2,
  Send2,
  Trash,
} from 'iconsax-react-native';
import * as React from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, Text, View } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import {
  TSAvatar,
  TSButton,
  TSConfirmDialog,
  TSDialog,
  TSEmptyState,
  TSErrorState,
  TSInput,
  TSMentionText,
  TSSkeletonList,
} from '@/components/shared';
import { TSAgentBadge } from '@/components/agents/agent-avatar';
import {
  deleteChatMessage,
  editChatMessage,
  listChatMessages,
} from '@/lib/api/chat';
import { presignAttachment, uploadToCloudinary } from '@/lib/api/uploads';
import type { ChatMessage } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { tokens } from '@/constants/theme';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:4000';
const GROUP_GAP_MS = 5 * 60 * 1000;
const TYPING_THROTTLE_MS = 2_000;

type MessageAck = { ok: boolean; error?: string; message?: ChatMessage; clientId?: string };

type PendingAttachment = { uri: string; name: string; mime: string; url: string };

/** Optimistic message shown before the server ack (never persisted). */
type TempMessage = {
  clientId: string;
  projectId: string;
  authorId: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  createdAt: string;
  pending: boolean;
  failed: boolean;
};

type ChatItem =
  | { kind: 'divider'; label: string; key: string }
  | { kind: 'message'; message: ChatMessage | TempMessage; grouped: boolean; key: string };

interface TypingUser {
  userId: string;
  name: string;
}

function isImage(mime?: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}

function isTemp(message: ChatMessage | TempMessage): message is TempMessage {
  return 'clientId' in message;
}

function mergeMessages(...lists: ((ChatMessage | TempMessage)[] | undefined)[]): (ChatMessage | TempMessage)[] {
  const seen = new Set<string>();
  const merged: (ChatMessage | TempMessage)[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const message of list) {
      const key = isTemp(message) ? message.clientId : message.id;
      if (seen.has(key)) continue;
      seen.add(key);
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
  const [temps, setTemps] = React.useState<TempMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [onlineCount, setOnlineCount] = React.useState(0);
  const [typingUsers, setTypingUsers] = React.useState<TypingUser[]>([]);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [attachment, setAttachment] = React.useState<PendingAttachment | null>(null);
  const [actionsFor, setActionsFor] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ id: string; body: string } | null>(null);
  const socketRef = React.useRef<Socket | null>(null);
  const typingSentAtRef = React.useRef(0);

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
      socket.emit('join', { projectId }, (res?: { ok?: boolean; data?: { onlineIds?: string[] } }) => {
        if (res?.data?.onlineIds) setOnlineCount(res.data.onlineIds.length);
      });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('message:new', (message: ChatMessage) => {
      setLive((prev) => mergeMessages(prev, [message]) as ChatMessage[]);
      setTemps((prev) => prev.filter((t) => t.pending || t.authorId !== message.authorId || t.body !== message.body));
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(projectId) });
    });
    socket.on('presence:update', (payload?: { projectId?: string; onlineIds?: string[] }) => {
      if (payload?.projectId !== projectId) return;
      setOnlineCount(payload.onlineIds?.length ?? 0);
    });
    socket.on('typing:update', (payload?: { projectId?: string; userId?: string; name?: string; isTyping?: boolean }) => {
      if (payload?.projectId !== projectId || !payload.userId || payload.userId === user?.id) return;
      setTypingUsers((prev) => {
        const without = prev.filter((t) => t.userId !== payload.userId);
        return payload.isTyping ? [...without, { userId: payload.userId!, name: payload.name ?? 'Someone' }] : without;
      });
    });
    socket.on('message:updated', (payload?: { id?: string; body?: string; editedAt?: string }) => {
      if (!payload?.id) return;
      setLive((prev) =>
        prev.map((m) => (m.id === payload.id ? { ...m, body: payload.body ?? m.body, editedAt: payload.editedAt ?? m.editedAt } : m))
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(projectId) });
    });
    socket.on('message:deleted', (payload?: { id?: string }) => {
      if (!payload?.id) return;
      setLive((prev) => prev.filter((m) => m.id !== payload.id));
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(projectId) });
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, projectId, queryClient, user?.id]);

  /* ------------------------------------------------------- composer */

  const emitTyping = (isTyping: boolean) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    const now = Date.now();
    if (isTyping && now - typingSentAtRef.current < TYPING_THROTTLE_MS) return;
    typingSentAtRef.current = now;
    socket.emit('typing', { projectId, isTyping });
  };

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
    const clientId = `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const authorId = user?.id ?? '';
    setTemps((prev) => [
      ...prev,
      {
        clientId,
        projectId,
        authorId,
        body,
        attachmentUrl: attachment?.url,
        attachmentName: attachment?.name,
        attachmentMime: attachment?.mime,
        createdAt: new Date().toISOString(),
        pending: true,
        failed: false,
      },
    ]);
    setPending(true);
    setSendError(null);
    setAttachment(null);
    setInput('');
    emitTyping(false);
    socket.emit(
      'message',
      {
        projectId,
        body,
        clientId,
        attachmentUrl: attachment?.url,
        attachmentName: attachment?.name,
        attachmentMime: attachment?.mime,
      },
      (ack?: MessageAck) => {
        setPending(false);
        if (!ack || ack.ok === false) {
          console.error('chat ack error', ack?.error);
          setTemps((prev) =>
            prev.map((t) => (t.clientId === clientId ? { ...t, pending: false, failed: true } : t))
          );
          setSendError(ack?.error ?? 'Message not delivered.');
          return;
        }
        setTemps((prev) => prev.filter((t) => t.clientId !== clientId));
        if (ack.message) setLive((prev) => mergeMessages(prev, [ack.message!]) as ChatMessage[]);
        void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(projectId) });
      }
    );
  };

  const retry = (temp: TempMessage) => {
    setTemps((prev) => prev.map((t) => (t.clientId === temp.clientId ? { ...t, pending: true, failed: false } : t)));
    const socket = socketRef.current;
    if (!socket?.connected) {
      setTemps((prev) => prev.map((t) => (t.clientId === temp.clientId ? { ...t, pending: false, failed: true } : t)));
      return;
    }
    socket.emit(
      'message',
      {
        projectId,
        body: temp.body,
        clientId: temp.clientId,
        attachmentUrl: temp.attachmentUrl,
        attachmentName: temp.attachmentName,
        attachmentMime: temp.attachmentMime,
      },
      (ack?: MessageAck) => {
        if (!ack || ack.ok === false) {
          setTemps((prev) => prev.map((t) => (t.clientId === temp.clientId ? { ...t, pending: false, failed: true } : t)));
          return;
        }
        setTemps((prev) => prev.filter((t) => t.clientId !== temp.clientId));
        if (ack.message) setLive((prev) => mergeMessages(prev, [ack.message!]) as ChatMessage[]);
        void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(projectId) });
      }
    );
  };

  const drop = (clientId: string) => {
    setTemps((prev) => prev.filter((t) => t.clientId !== clientId));
  };

  const saveEdit = async () => {
    if (!editing || !editing.body.trim()) return;
    try {
      const updated = await editChatMessage(token ?? '', editing.id, editing.body.trim());
      setLive((prev) =>
        prev.map((m) => (m.id === editing.id ? { ...m, body: updated.body, editedAt: updated.editedAt ?? undefined } : m))
      );
      setEditing(null);
      setActionsFor(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(projectId) });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not update message.');
    }
  };

  const removeMessage = async (id: string) => {
    try {
      await deleteChatMessage(token ?? '', id);
      setLive((prev) => prev.filter((m) => m.id !== id));
      setActionsFor(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(projectId) });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not delete message.');
    }
  };

  /* ------------------------------------------------------- render */

  /** Identity for "own message" checks - session id with JWT `sub` fallback. */
  const ownId = React.useMemo(() => {
    if (user?.id) return user.id;
    if (!token) return '';
    try {
      const payload = JSON.parse(
        globalThis
          .atob(token.split('.')[1] ?? '')
          .replace(/-/g, '+')
          .replace(/_/g, '/')
      ) as { sub?: unknown };
      return typeof payload.sub === 'string' ? payload.sub : '';
    } catch {
      return '';
    }
  }, [user?.id, token]);

  const messages = mergeMessages(history.data?.items ?? [], live, temps);

  /** Mention names derived from loaded messages - no extra state to sync. */
  const memberNames = React.useMemo(() => {
    const names = new Set<string>();
    for (const message of messages) {
      if (!isTemp(message) && message.author?.name) names.add(message.author.name);
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
      out.push({ kind: 'message', message, grouped, key: isTemp(message) ? message.clientId : message.id });
      lastAuthor = message.authorId;
      lastTime = new Date(message.createdAt).getTime();
    }
    return out;
  }, [messages, dayRef]);

  const typers = typingUsers.filter((t) => t.userId !== ownId);

  const editDialog = editing ? (
    <TSDialog
      open={!!editing}
      onOpenChange={(open) => !open && setEditing(null)}
      title="Edit message"
      trigger={<></>}
    >
      <TSInput
        value={editing.body}
        onChangeText={(body) => setEditing((e) => (e ? { ...e, body } : e))}
        placeholder="Message"
        multiline
        maxLength={4_000}
      />
      <View className="mt-3 flex-row justify-end gap-2">
        <TSButton variant="outline" onPress={() => setEditing(null)}>
          Cancel
        </TSButton>
        <TSButton onPress={() => void saveEdit()} loading={pending}>
          Save
        </TSButton>
      </View>
    </TSDialog>
  ) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="h-[560px] overflow-hidden rounded-lg border border-border bg-background"
    >
      {/* Header - presence signature */}
      <View className="flex-row items-center justify-between border-b border-border bg-muted/40 px-3 py-2.5">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <MessageText size={16} variant="Bold" color={tokens.primary} />
          </View>
          <View>
            <Text className="text-sm font-semibold text-foreground">Project chat</Text>
            <Text className="text-[11px] text-muted-foreground">
              {connected ? `${onlineCount} online` : 'reconnecting…'}
            </Text>
          </View>
        </View>
        <View
          className={cn(
            'flex-row items-center gap-1.5 rounded-full px-2 py-1',
            connected ? 'bg-success/10' : 'bg-warning/10'
          )}
        >
          <View
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              connected ? 'bg-success' : 'bg-warning'
            )}
          />
          <Text
            className={cn(
              'text-[11px] font-semibold',
              connected ? 'text-success' : 'text-warning'
            )}
          >
            {connected ? 'Live' : 'Reconnecting'}
          </Text>
        </View>
      </View>

      {!connected && (
        <View className="flex-row items-center gap-2 border-b border-border bg-warning/10 px-3 py-1.5">
          <Refresh2 size={14} variant="Outline" color={tokens.warning} />
          <Text className="text-xs font-medium text-warning">
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
          className="flex-1"
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
                actionsOpen={actionsFor === (isTemp(item.message) ? item.message.clientId : item.message.id)}
                onToggleActions={() =>
                  setActionsFor((cur) =>
                    cur === (isTemp(item.message) ? item.message.clientId : item.message.id)
                      ? null
                      : isTemp(item.message)
                        ? item.message.clientId
                        : item.message.id
                  )
                }
                onEdit={() => {
                  setActionsFor(null);
                  setEditing({ id: (item.message as ChatMessage).id, body: item.message.body });
                }}
                onDelete={() => void removeMessage((item.message as ChatMessage).id)}
                onRetry={() => isTemp(item.message) && retry(item.message)}
                onDrop={() => isTemp(item.message) && drop(item.message.clientId)}
                onOpenAttachment={() => item.message.attachmentUrl && void Linking.openURL(item.message.attachmentUrl)}
              />
            )
          }
        />
      )}

      {/* Typing line */}
      {typers.length > 0 && (
        <Text className="px-3 pb-1 text-[11px] italic text-muted-foreground">
          {typers.map((t) => t.name).join(', ')} {typers.length === 1 ? 'is' : 'are'} typing…
        </Text>
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
              onChangeText={(value) => {
                setInput(value);
                emitTyping(true);
              }}
              onBlur={() => emitTyping(false)}
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

      {editDialog}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  isOwn,
  grouped,
  memberNames,
  actionsOpen,
  onToggleActions,
  onEdit,
  onDelete,
  onRetry,
  onDrop,
  onOpenAttachment,
}: {
  message: ChatMessage | TempMessage;
  isOwn: boolean;
  grouped: boolean;
  memberNames: string[];
  actionsOpen: boolean;
  onToggleActions: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onDrop: () => void;
  onOpenAttachment: () => void;
}) {
  const temp = isTemp(message);
  const failed = temp && message.failed;
  const pending = temp && message.pending;
  const authorName = !temp ? (message.author?.name ?? 'Unknown') : isOwn ? 'You' : 'Unknown';

  return (
    <View className={cn('max-w-[84%]', isOwn ? 'self-end' : 'self-start', grouped ? '' : 'mt-1')}>
      {!grouped && !isOwn && (
        <View className="mb-1 flex-row items-center gap-1.5">
          <TSAvatar name={authorName} src={!temp ? message.author?.avatarUrl : undefined} size={20} />
          <Text className="text-xs font-semibold text-foreground">{authorName}</Text>
          {!temp && message.author?.kind === 'agent' && <TSAgentBadge />}
        </View>
      )}
      <View
        className={cn(
          'rounded-2xl px-3 py-2',
          isOwn ? 'rounded-br-md bg-primary' : 'rounded-bl-md border border-border bg-card',
          failed && 'border-[var(--ts-error-500)]/60'
        )}
      >
        {message.attachmentUrl && isImage(message.attachmentMime) && (
          <Pressable onPress={onOpenAttachment} accessibilityRole="imagebutton" accessibilityLabel="Open attachment">
            <Image
              source={{ uri: message.attachmentUrl }}
              alt={message.attachmentName ?? 'Attachment'}
              style={{ width: 220, height: 160, borderRadius: 8, marginBottom: 6 }}
              contentFit="cover"
            />
          </Pressable>
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
            onPress={onOpenAttachment}
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
            {!temp && message.editedAt ? ' · (edited)' : ''}
          </Text>
        )}
      </View>

      {/* Status + actions */}
      <View className={cn('mt-1 flex-row items-center gap-2', isOwn ? 'justify-end' : 'justify-start')}>
        {pending && (
          <Text className="text-[11px] text-muted-foreground">Sending…</Text>
        )}
        {failed && (
          <View className="flex-row items-center gap-2">
            <Text className="text-[11px] text-[var(--ts-error-500)]">Not delivered</Text>
            <Pressable onPress={onRetry} hitSlop={8}>
              <Text className="text-[11px] font-semibold text-[var(--ts-error-500)] underline">Retry</Text>
            </Pressable>
            <Pressable onPress={onDrop} hitSlop={8}>
              <Text className="text-[11px] text-muted-foreground underline">Remove</Text>
            </Pressable>
          </View>
        )}
        {!temp && !failed && isOwn && (
          <Pressable onPress={onToggleActions} hitSlop={8} accessibilityRole="button" accessibilityLabel="Message actions">
            <More size={16} variant="Outline" color={tokens.textSecondary} />
          </Pressable>
        )}
      </View>

      {!temp && !failed && isOwn && actionsOpen && (
        <View className="mt-1 flex-row items-center gap-2 rounded-md border border-border bg-muted px-2 py-1.5">
          <Pressable onPress={onEdit} hitSlop={8} className="flex-row items-center gap-1.5">
            <Edit2 size={14} variant="Outline" color={tokens.primary} />
            <Text className="text-xs font-medium text-foreground">Edit</Text>
          </Pressable>
          <TSConfirmDialog
            title="Delete message?"
            description="This message will be removed for everyone."
            onConfirm={onDelete}
            trigger={
              <Pressable hitSlop={8} className="flex-row items-center gap-1.5">
                <Trash size={14} variant="Outline" color={tokens.error} />
                <Text className="text-xs font-medium text-[var(--ts-error-500)]">Delete</Text>
              </Pressable>
            }
          />
        </View>
      )}
    </View>
  );
}
