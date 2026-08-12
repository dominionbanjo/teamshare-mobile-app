import * as React from 'react';
import { Pressable, Text, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { UserTag } from 'iconsax-react-native';
import { tokens } from '@/constants/theme';

export type TSMentionChipProps = ViewProps & {
  name: string;
  token?: string;
  onPress?: () => void;
};

/** @mention rendered as a chip (style guide 7.13). */
export function TSMentionChip({ name, token = name, onPress, className }: TSMentionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-1 rounded-md bg-[var(--ts-primary-100)] px-1.5 py-0.5',
        className
      )}
    >
      <UserTag size={12} variant="Outline" color={tokens.primary} />
      <Text className="text-xs font-medium text-[var(--ts-primary-700)]" data-token={token}>
        @{name}
      </Text>
    </Pressable>
  );
}
