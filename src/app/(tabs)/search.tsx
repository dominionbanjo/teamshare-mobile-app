import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { DocumentText, MessageText, MessageText1, SearchNormal1, TaskSquare, type Icon } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  TSBadge,
  TSBadgeProps,
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSearchInput,
  TSSelect,
  TSSkeletonList,
  TSList,
} from '@/components/shared';
import { searchWorkspace, type SearchKindValue, type SearchResult } from '@/lib/api/search';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { tokens } from '@/constants/theme';

type KindFilterValue = SearchKindValue | 'all';

const KIND_OPTIONS: { value: KindFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'task', label: 'Tasks' },
  { value: 'comment', label: 'Comments' },
  { value: 'document', label: 'Documents' },
  { value: 'chat', label: 'Chat' },
];

const KIND_META: Record<
  SearchKindValue,
  { label: string; tone: NonNullable<TSBadgeProps['tone']>; Icon: Icon; color: string }
> = {
  task: { label: 'Task', tone: 'primary', Icon: TaskSquare, color: tokens.primary },
  comment: { label: 'Comment', tone: 'info', Icon: MessageText, color: tokens.info },
  document: { label: 'Document', tone: 'warning', Icon: DocumentText, color: tokens.warning },
  chat: { label: 'Chat', tone: 'violet', Icon: MessageText1, color: tokens.violet },
};

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [kind, setKind] = React.useState<KindFilterValue>('all');
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const searching = debouncedQuery.length > 0;

  const results = useQuery({
    queryKey: queryKeys.search({ q: debouncedQuery, type: kind }),
    queryFn: () => searchWorkspace(token ?? '', { q: debouncedQuery, type: kind }),
    enabled: !!token && searching,
  });

  const openResult = (result: SearchResult) => {
    try {
      router.push(result.deepLink as never);
    } catch {
      // Unknown deep link target - stay on results.
    }
  };

  return (
    <TSScreen scroll={false}>
      <TSPageHeader title="Search" description="Across your workspace" />
      <View className="gap-3">
        <TSSearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search tasks, comments, documents..."
          autoCorrect={false}
          returnKeyType="search"
        />
        <TSSelect
          value={kind}
          onValueChange={(value) => setKind(value as KindFilterValue)}
          options={KIND_OPTIONS}
          placeholder="All types"
        />
      </View>

      {!searching ? (
        <TSEmptyState
          icon={<SearchNormal1 size={28} variant="TwoTone" color={tokens.primary} />}
          title="Search your workspace"
          description="Find tasks, comments, documents, and chat messages. Type to get started."
        />
      ) : results.isLoading ? (
        <TSSkeletonList rows={6} />
      ) : results.isError ? (
        <TSErrorState message={results.error.message} onRetry={() => void results.refetch()} />
      ) : results.data && results.data.items.length > 0 ? (
        <TSList
          className="flex-1"
          data={results.data.items}
          keyExtractor={(item) => (item as SearchResult).id}
          renderItem={(item) => {
            const result = item as SearchResult;
            const meta = KIND_META[result.kind] ?? KIND_META.task;
            const { Icon } = meta;
            return (
              <Pressable
                onPress={() => openResult(result)}
                className="min-h-12 flex-row items-start gap-3 border-b border-border px-4 py-3"
              >
                <View className="h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Icon size={18} variant="Outline" color={meta.color} />
                </View>
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-sm font-semibold text-foreground">{result.title}</Text>
                    <TSBadge tone={meta.tone}>{meta.label}</TSBadge>
                  </View>
                  {result.snippet ? (
                    <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={2}>
                      {result.snippet}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <TSEmptyState
          icon={<SearchNormal1 size={28} variant="TwoTone" color={tokens.textMuted} />}
          title="No results"
          description={`Nothing found for "${debouncedQuery}". Try a different term or filter.`}
        />
      )}
    </TSScreen>
  );
}
