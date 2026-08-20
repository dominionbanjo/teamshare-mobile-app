import * as React from 'react';
import { ScrollView, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';

export type TSTabsProps = ViewProps & {
  defaultValue: string;
  items: { value: string; label: string; count?: number; content?: React.ReactNode }[];
};

/** TeamShare tabs - underline style per style guide 7.8 (controlled). */
export function TSTabs({ defaultValue, items, className, ...props }: TSTabsProps) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <Tabs value={value} onValueChange={setValue} className={cn('w-full', className)} {...(props as object)}>
      <TabsList className="h-10 w-full flex-row items-center border-b border-border bg-transparent px-0">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-1"
          contentContainerClassName="h-10 flex-row items-center gap-6 px-1"
        >
          {items.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="h-9 flex-row items-center gap-1.5 px-1">
              <Text className="native:text-sm text-sm text-muted-foreground">{item.label}</Text>
              {typeof item.count === 'number' && (
                <Text className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{item.count}</Text>
              )}
            </TabsTrigger>
          ))}
        </ScrollView>
      </TabsList>
      {items.map(
        (item) =>
          item.content && (
            <TabsContent key={item.value} value={item.value} className="mt-4">
              {item.content}
            </TabsContent>
          )
      )}
    </Tabs>
  );
}
