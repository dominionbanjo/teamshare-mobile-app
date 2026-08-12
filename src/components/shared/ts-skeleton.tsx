import * as React from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/** TeamShare skeleton loader (style guide 7.11). */
export function TSSkeleton({ className, ...props }: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn('bg-muted', className)} {...(props as object)} />;
}

export type TSSkeletonListProps = ViewProps & {
  rows?: number;
};

/** Skeleton list rows for loading states. */
export function TSSkeletonList({ rows = 5, className }: TSSkeletonListProps) {
  return (
    <View className={cn('gap-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} className="flex-row items-center gap-3 rounded-lg border border-border p-4">
          <TSSkeleton className="h-10 w-10 rounded-full" />
          <View className="flex-1 gap-2">
            <TSSkeleton className="h-4 w-3/4" />
            <TSSkeleton className="h-3 w-1/2" />
          </View>
        </View>
      ))}
    </View>
  );
}

export { Text as TSText };
