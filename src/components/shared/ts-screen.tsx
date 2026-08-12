import * as React from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/lib/utils';

export type TSScreenProps = ScrollViewProps & {
  /** When false, renders a plain flex View instead of a ScrollView. */
  scroll?: boolean;
  contentClassName?: string;
};

/** TeamShare screen scaffold - safe area top + scroll + 4px-spaced padding (style guide 4). */
export function TSScreen({ scroll = true, className, contentClassName, children, ...props }: TSScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView edges={['top']} className={cn('flex-1 bg-background', className)}>
        <View className={cn('flex-1 gap-4 p-4', contentClassName)}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['top']} className={cn('flex-1 bg-background', className)}>
      <ScrollView
        className="flex-1"
        contentContainerClassName={cn('gap-4 p-4 pb-24', contentClassName)}
        keyboardShouldPersistTaps="handled"
        {...props}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
