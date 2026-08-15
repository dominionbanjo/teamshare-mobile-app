import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { Folder2, Home2, SearchNormal1, Setting2, TaskSquare, type Icon } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/constants/theme';
import { cn } from '@/lib/utils';
import { useUnreadCount } from '@/lib/realtime/notification-socket';

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
  { name: 'search', href: '/search', label: 'Search', Icon: SearchNormal1 },
  { name: 'settings', href: '/settings', label: 'Settings', Icon: Setting2 },
];

export type TabButtonProps = TabTriggerSlotProps & {
  tab: TabDef;
  /** Unread badge count (IMP-250) - shown on the Home tab. */
  badge?: number;
};

/** Tab bar button - 44px touch target, IconSax Outline when idle / Bold when focused (style guide 6.4). */
export function TabButton({ tab, isFocused, badge, ...props }: TabButtonProps) {
  const { Icon } = tab;
  return (
    <Pressable
      {...props}
      className={cn('min-h-11 flex-1 items-center justify-center gap-0.5 rounded-lg', props.className)}
    >
      <View className="relative">
        <Icon
          size={22}
          variant={isFocused ? 'Bold' : 'Outline'}
          color={isFocused ? tokens.primary : tokens.textSecondary}
        />
        {badge != null && badge > 0 && (
          <View
            className="absolute -right-2 -top-1.5 min-w-4 items-center rounded-full px-1"
            style={{ backgroundColor: tokens.error, paddingVertical: 1 }}
          >
            <Text className="text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
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
 * Routes: Home (/), Projects (/projects), Tasks (/tasks), Search (/search),
 * Settings (/settings). The Home tab shows the unread notification badge.
 */
export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const { data: unread } = useUnreadCount();
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
              <TabButton tab={tab} badge={tab.name === 'index' ? (unread ?? 0) : undefined} />
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}
