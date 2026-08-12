import * as React from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { TSMentionChip } from './ts-mention-chip';

const MENTION_RE = /(@[A-Za-z0-9_.-]+)/g;

export type TSMentionTextProps = ViewProps & {
  body: string;
  /** Known member names - matches are rendered as mention chips. */
  names?: string[];
  onMentionPress?: (name: string) => void;
};

/** Comment/chat body renderer - @mentions become TSMentionChip pills (style guide 7.13). */
export function TSMentionText({ body, names = [], onMentionPress, className }: TSMentionTextProps) {
  const normalized = names.map((n) => n.toLowerCase());
  const parts = body.split(MENTION_RE);

  return (
    <View className={cn('flex-row flex-wrap items-center gap-0.5', className)}>
      {parts.map((part, index) => {
        if (part.startsWith('@') && part.length > 1) {
          const match = names.find((n) => n.toLowerCase() === part.slice(1).toLowerCase());
          if (match) {
            return (
              <TSMentionChip
                key={index}
                name={match}
                onPress={() => onMentionPress?.(match)}
              />
            );
          }
        }
        return (
          <Text key={index} className="text-sm text-foreground">
            {part}
          </Text>
        );
      })}
    </View>
  );
}
