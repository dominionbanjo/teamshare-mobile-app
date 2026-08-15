import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AddSquare, Edit2, Trash } from 'iconsax-react-native';
import * as React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import {
  TSButton,
  TSConfirmDialog,
  TSDialog,
  TSInput,
  TSSearchInput,
} from '@/components/shared';
import {
  createChatChannel,
  deleteChatChannel,
  listChatChannels,
  updateChatChannel,
  type ChannelListEntry,
} from '@/lib/api/chat';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { tokens } from '@/constants/theme';

type ChatChannelsProps = {
  projectId: string;
  activeChannelId: string;
  canManage: boolean;
  onSelect: (channelId: string) => void;
};

/** Project conversation switcher - chip bar + create/rename/delete. */
export function ChatChannels({ projectId, activeChannelId, canManage, onSelect }: ChatChannelsProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ChannelListEntry | null>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [query, setQuery] = React.useState('');

  const channelsQuery = useQuery({
    queryKey: queryKeys.chatChannels(projectId),
    queryFn: () => listChatChannels(token ?? '', projectId),
    enabled: !!token,
  });
  const channels = channelsQuery.data ?? [];

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q)
    );
  }, [channels, q]);

  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.chatChannels(projectId) });
  }, [queryClient, projectId]);

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      createChatChannel(token ?? '', { projectId, ...payload }),
    onSuccess: (channel) => {
      setName('');
      setDescription('');
      setCreateOpen(false);
      onSelect(channel.id);
      refresh();
    },
    onError: (err) =>
      Alert.alert('Could not create conversation', err instanceof Error ? err.message : 'Try again.'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) => {
      if (!editing) return Promise.reject(new Error('No channel'));
      return updateChatChannel(token ?? '', editing.id, payload);
    },
    onSuccess: () => {
      setEditing(null);
      setName('');
      setDescription('');
      refresh();
    },
    onError: (err) =>
      Alert.alert('Could not update conversation', err instanceof Error ? err.message : 'Try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (channelId: string) => deleteChatChannel(token ?? '', channelId),
    onSuccess: (_res, channelId) => {
      if (activeChannelId === channelId) onSelect('');
      refresh();
    },
    onError: (err) =>
      Alert.alert('Could not delete conversation', err instanceof Error ? err.message : 'Try again.'),
  });

  const openCreate = () => {
    setName('');
    setDescription('');
    setCreateOpen(true);
  };

  const openEdit = (channel: ChannelListEntry) => {
    setName(channel.name);
    setDescription(channel.description ?? '');
    setEditing(channel);
  };

  const active = channels.find((c) => c.id === activeChannelId);
  const activeDeletable = !!active && active.name !== 'General';

  return (
    <View className="border-b border-border bg-muted/40 py-2">
      <View className="px-3 pb-2">
        <TSSearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations"
          accessibilityLabel="Search conversations"
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-1.5 px-3"
      >
        {filtered.length === 0 ? (
          <Text className="py-1.5 text-xs text-muted-foreground">
            {channels.length === 0 ? 'No conversations yet.' : 'No conversations found.'}
          </Text>
        ) : (
          filtered.map((channel) => (
            <Pressable
              key={channel.id}
              onPress={() => onSelect(channel.id)}
              className={cn(
                'flex-row items-center gap-1.5 rounded-full border px-3 py-1.5',
                channel.id === activeChannelId
                  ? 'border-transparent bg-primary'
                  : 'border-border bg-background'
              )}
            >
              <View
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  channel.id === activeChannelId ? 'bg-white/70' : 'bg-primary'
                )}
              />
              <Text
                className={cn(
                  'text-xs font-medium',
                  channel.id === activeChannelId ? 'text-white' : 'text-foreground'
                )}
              >
                {channel.name}
              </Text>
            </Pressable>
          ))
        )}
        {canManage && (
          <Pressable
            onPress={openCreate}
            className="flex-row items-center gap-1 rounded-full border border-dashed border-foreground/30 px-3 py-1.5"
          >
            <AddSquare size={14} variant="Outline" color={tokens.textSecondary} />
            <Text className="text-xs font-medium text-muted-foreground">New</Text>
          </Pressable>
        )}
        {canManage && active && (
          <View className="flex-row items-center gap-1 pl-2">
            <Pressable
              onPress={() => openEdit(active)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Rename conversation"
              className="h-7 w-7 items-center justify-center rounded-full border border-border bg-background"
            >
              <Edit2 size={14} variant="Outline" color={tokens.textSecondary} />
            </Pressable>
            {activeDeletable && (
              <TSConfirmDialog
                title="Delete this conversation?"
                description={`"${active.name}" and all its messages will be removed for everyone.`}
                onConfirm={() => deleteMutation.mutateAsync(active.id)}
                trigger={
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete conversation"
                    className="h-7 w-7 items-center justify-center rounded-full border border-border bg-background"
                  >
                    <Trash size={14} variant="Outline" color={tokens.error} />
                  </Pressable>
                }
              />
            )}
          </View>
        )}
      </ScrollView>

      <TSDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New conversation"
        description="Start a new chat in this project."
      >
        <View className="gap-3">
          <TSInput value={name} onChangeText={setName} placeholder="Name, e.g. Design, Launch" maxLength={60} />
          <TSInput value={description} onChangeText={setDescription} placeholder="Description (optional)" maxLength={300} />
          <TSButton
            onPress={() => createMutation.mutate({ name: name.trim(), description: description.trim() })}
            loading={createMutation.isPending}
            disabled={!name.trim()}
          >
            Create conversation
          </TSButton>
        </View>
      </TSDialog>

      <TSDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit conversation"
        description={editing?.name}
      >
        <View className="gap-3">
          <TSInput value={name} onChangeText={setName} placeholder="Name" maxLength={60} />
          <TSInput value={description} onChangeText={setDescription} placeholder="Description (optional)" maxLength={300} />
          <TSButton
            onPress={() => updateMutation.mutate({ name: name.trim(), description: description.trim() })}
            loading={updateMutation.isPending}
            disabled={!name.trim()}
          >
            Save changes
          </TSButton>
        </View>
      </TSDialog>
    </View>
  );
}
