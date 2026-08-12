import { useQuery } from '@tanstack/react-query';
import { MessageText, Send2 } from 'iconsax-react-native';
import * as React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
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
import type { ChatMessage } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { tokens } from '@/constants/theme';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:4000';

type MessageAck = { ok: boolean; error?: string; message?: ChatMessage };

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
  const [live, setLive] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [memberNames, setMemberNames] = React.useState<string[]>([]);
  const socketRef = React.useRef<Socket | null>(null);

  const history = useQuery({
    queryKey: queryKeys.chatMessages(projectId),
    queryFn: () => listChatMessages(token ?? '', projectId),
    enabled: !!token && !!projectId,
  });

  React.useEffect(() => {
    if (history.data) {
      setLive((prev) => mergeMessages(history.data?.items ?? [], prev));
      setMemberNames((prev) => {
        const names = new Set(prev);
        for (const message of history.data?.items ?? []) {
          if (message.author?.name) names.add(message.author.name);
        }
        return [...names];
      });
    }
  }, [history.data]);

  React.useEffect(() => {
    if (!token) return;
    const socket = io(`${WS_URL}/chat`, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('join', { projectId });
    });
    socket.on('message:new', (message: ChatMessage) => {
      setLive((prev) => mergeMessages(prev, [message]));
      if (message.author?.name) {
        setMemberNames((prev) => (prev.includes(message.author!.name!) ? prev : [...prev, message.author!.name!]));
      }
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, projectId]);

  const send = () => {
    const body = input.trim();
    if (!body || pending) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setSendError('Not connected to chat. Try again in a moment.');
      return;
    }
    setPending(true);
    setSendError(null);
    socket.emit('message', { projectId, body }, (ack?: MessageAck) => {
      setPending(false);
      if (!ack || ack.ok === false) {
        console.error('chat ack error', ack?.error);
        setSendError(ack?.error ?? 'Message not delivered.');
        return;
      }
      if (ack.message) setLive((prev) => mergeMessages(prev, [ack.message!]));
      setInput('');
    });
  };

  const ownId = user?.id ?? '';

  const messages = mergeMessages(history.data?.items ?? [], live);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="h-[540px] overflow-hidden rounded-lg border border-border bg-background"
    >
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
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerClassName="gap-2 p-3"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const own = item.authorId === ownId;
            return (
              <View
                className={cn(
                  'max-w-[82%] rounded-2xl px-3 py-2',
                  own
                    ? 'self-end rounded-br-md bg-primary'
                    : 'self-start rounded-bl-md border border-border bg-card'
                )}
              >
                {!own && (
                  <View className="mb-1 flex-row items-center gap-1.5">
                    <TSAvatar name={item.author?.name ?? 'Unknown'} src={item.author?.avatarUrl} size={20} />
                    <Text className="text-xs font-semibold text-foreground">{item.author?.name ?? 'Unknown'}</Text>
                  </View>
                )}
                <TSMentionText
                  body={item.body}
                  names={memberNames}
                  textClassName={own ? 'text-sm text-white' : 'text-sm text-foreground'}
                />
                <Text
                  className={cn(
                    'mt-1 text-[10px]',
                    own ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  {formatRelative(item.createdAt)}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View className="gap-1 border-t border-border p-2">
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <TSInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              multiline
              maxLength={4_000}
              className="min-h-10 max-h-24"
            />
          </View>
          <TSButton
            onPress={send}
            loading={pending}
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
