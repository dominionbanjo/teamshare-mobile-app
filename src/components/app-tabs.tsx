import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { Folder2, Home2, Setting2, TaskSquare, type Icon } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/constants/theme';
import { cn } from '@/lib/utils';

type TabDef = {
  name: string;
  href: `/${string}`;
  label: string;
  Icon: Icon;
};

const TABS: TabDef[] = [
  { name: 'index', href: '/', label: 'Home', Icon: Home2 },
  { name: 'projects/index', href: '/projects', label: 'Projects', Icon: Folder2 },
  { name: 'tasks/index', href: '/tasks', label: 'Tasks', Icon: TaskSquare },
  { name: 'settings', href: '/settings', label: 'Settings', Icon: Setting2 },
];

export type TabButtonProps = TabTriggerSlotProps & {
  tab: TabDef;
};

/** Tab bar button - 44px touch target, IconSax Outline when idle / Bold when focused (style guide 6.4). */
export function TabButton({ tab, isFocused, ...props }: TabButtonProps) {
  const { Icon } = tab;
  return (
    <Pressable
      {...props}
      className={cn('min-h-11 flex-1 items-center justify-center gap-0.5 rounded-lg', props.className)}
    >
      <Icon
        size={22}
        variant={isFocused ? 'Bold' : 'Outline'}
        color={isFocused ? tokens.primary : tokens.textSecondary}
      />
      <Text
        className={cn(
          'text-[10px] font-medium',
          isFocused ? 'text-[var(--ts-primary-500)]' : 'text-muted-foreground'
        )}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

/**
 * TeamShare app shell - headless bottom tab bar rendered with IconSax icons.
 * Routes: Home (/), Projects (/projects), Tasks (/tasks), Settings (/settings).
 */
export default function AppTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <View
          className="flex-row border-t border-border bg-background px-1"
          style={{ paddingBottom: Math.max(insets.bottom, 8) }}
        >
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton tab={tab} />
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}
