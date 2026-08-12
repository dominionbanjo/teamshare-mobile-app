import * as React from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { Warning2 } from 'iconsax-react-native';
import { tokens } from '@/constants/theme';
import { TSButton } from './ts-button';

export type TSErrorStateProps = ViewProps & {
  message: React.ReactNode;
  onRetry?: () => void;
};

/** Error state - TwoTone warning icon + message + retry (style guide 8.4). */
export function TSErrorState({ message, onRetry, className }: TSErrorStateProps) {
  return (
    <View className={cn('items-center justify-center gap-3 px-6 py-16', className)}>
      <View className="h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Warning2 size={28} variant="TwoTone" color={tokens.error} />
      </View>
      <Text className="max-w-sm text-center text-sm text-muted-foreground">{message}</Text>
      {onRetry && (
        <TSButton variant="outline" onPress={onRetry} className="mt-2">
          Retry
        </TSButton>
      )}
    </View>
  );
}
