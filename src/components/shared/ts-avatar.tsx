import * as React from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export type TSAvatarProps = ViewProps & {
  name: string;
  src?: string | null;
  size?: 20 | 24 | 32 | 40;
  online?: boolean;
};

const SIZE_CLASSES: Record<NonNullable<TSAvatarProps['size']>, string> = {
  20: 'h-5 w-5',
  24: 'h-6 w-6',
  32: 'h-8 w-8',
  40: 'h-10 w-10',
};

const TEXT_CLASSES: Record<NonNullable<TSAvatarProps['size']>, string> = {
  20: 'text-[9px]',
  24: 'text-[10px]',
  32: 'text-xs',
  40: 'text-sm',
};

/** TeamShare avatar - initials fallback + online dot (style guide 7.12). */
export function TSAvatar({ name, src, size = 40, online = false, className }: TSAvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View className={cn('relative', className)}>
      <Avatar alt={name} className={cn('rounded-full border border-border', SIZE_CLASSES[size])}>
        {src ? (
          <AvatarImage source={{ uri: src }} />
        ) : (
          <AvatarFallback className="rounded-full bg-[var(--ts-primary-100)] p-1">
            <Text className={cn('font-medium text-[var(--ts-primary-700)]', TEXT_CLASSES[size])}>{initials}</Text>
          </AvatarFallback>
        )}
      </Avatar>
      {online && (
        <View
          className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-background bg-[var(--ts-success-500)]"
          accessibilityLabel="Online"
        />
      )}
    </View>
  );
}
