import * as React from 'react';
import { ScrollView, Text, View, type ScrollViewProps, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { TSBadge } from './ts-badge';

export type TSEmptyStateProps = ViewProps & {
  /** IconSax element - TwoTone variant for illustrations per style guide. */
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
};

/** Empty state - 48px TwoTone icon + title + description + action (style guide 8.3). */
export function TSEmptyState({ icon, title, description, action, className }: TSEmptyStateProps) {
  return (
    <View className={cn('items-center justify-center gap-3 px-6 py-16', className)}>
      <View className="h-14 w-14 items-center justify-center rounded-full bg-muted">{icon}</View>
      <Text className="text-xl font-semibold text-foreground">{title}</Text>
      {description && <Text className="max-w-sm text-center text-sm text-muted-foreground">{description}</Text>}
      {action && <View className="mt-2">{action}</View>}
    </View>
  );
}

export type TSPageHeaderProps = ViewProps & {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

/** Page header - title + description + right-aligned actions. */
export function TSPageHeader({ title, description, actions, className }: TSPageHeaderProps) {
  return (
    <View className={cn('mb-6 flex-row items-start justify-between gap-3', className)}>
      <View className="flex-1">
        <Text className="text-2xl font-bold text-foreground">{title}</Text>
        {description && <Text className="mt-1 text-sm text-muted-foreground">{description}</Text>}
      </View>
      {actions && <View className="flex-row items-center gap-2">{actions}</View>}
    </View>
  );
}

export type TSListProps = ScrollViewProps & {
  data: readonly unknown[];
  keyExtractor: (item: never, index: number) => string;
  renderItem: (item: never, index: number) => React.ReactNode;
  empty?: React.ReactNode;
};

/** TeamShare list - scrollable rows per style guide 7.15 (mobile tables). */
export function TSList({ data, keyExtractor, renderItem, empty, className, ...props }: TSListProps) {
  if (data.length === 0) return <>{empty}</>;
  return (
    <ScrollView className={cn('w-full', className)} {...props}>
      {data.map((item, index) => (
        <React.Fragment key={keyExtractor(item as never, index)}>{renderItem(item as never, index)}</React.Fragment>
      ))}
    </ScrollView>
  );
}

export function TSListRow({ className, children, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'min-h-12 flex-row items-center gap-3 border-b border-border px-4 py-2',
        className
      )}
      {...props}
    >
      {children}
    </View>
  );
}

export { TSBadge };
