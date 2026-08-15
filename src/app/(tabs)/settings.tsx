import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ArrowRight2, Building4, Chart, Element, Key, NotificationBing, Radar, WalletMoney } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  TSConfirmDialog,
  TSCard,
  TSPageHeader,
  TSScreen,
  TSAvatar,
  TSButton,
  TSSwitch,
} from '@/components/shared';
import { useAuth } from '@/lib/auth/auth-context';
import { getNotificationSettings, updateNotificationSettings } from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { tokens } from '@/constants/theme';

type SettingsRowProps = {
  icon: React.ReactNode;
  title: string;
  note?: string;
  onPress?: () => void;
};

function SettingsRow({ icon, title, note, onPress }: SettingsRowProps) {
  const enabled = !!onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole={enabled ? 'button' : undefined}
      className={cn('min-h-11 flex-row items-center gap-3 px-4 py-3', enabled && 'active:bg-muted')}
    >
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted">{icon}</View>
      <View className="flex-1">
        <Text className={cn('text-sm font-medium', enabled ? 'text-foreground' : 'text-muted-foreground')}>
          {title}
        </Text>
        {note ? <Text className="text-xs text-muted-foreground">{note}</Text> : null}
      </View>
      {enabled ? (
        <ArrowRight2 size={16} variant="Outline" color={tokens.textMuted} />
      ) : (
        <Text className="text-xs text-muted-foreground">Web only</Text>
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, logout, token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [logoutPending, setLogoutPending] = React.useState(false);

  const settingsQuery = useQuery({
    queryKey: queryKeys.notificationSettings,
    queryFn: () => getNotificationSettings(token ?? ''),
    enabled: !!token,
  });

  const updateSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      updateNotificationSettings(token ?? '', { [key]: value }),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationSettings });
    },
  });

  const settings = settingsQuery.data;
  const toggle = (key: string, value: boolean) => {
    // Optimistic flip, reconciled by the mutation + refetch.
    queryClient.setQueryData(queryKeys.notificationSettings, (prev: typeof settings) =>
      prev ? { ...prev, [key]: value } : prev
    );
    updateSetting.mutate({ key, value });
  };

  const handleLogout = async () => {
    setLogoutPending(true);
    try {
      await logout();
    } finally {
      setLogoutPending(false);
    }
  };

  const notificationToggles: { key: string; label: string; note: string }[] = [
    { key: 'mentions', label: 'Mentions', note: '@name mentions in comments and chat' },
    { key: 'assignments', label: 'Assignments', note: 'Tasks and subtasks assigned to you' },
    { key: 'comments', label: 'Comments', note: 'Replies on tasks you watch' },
    { key: 'resolutions', label: 'Resolutions', note: 'Tasks marked resolved' },
    { key: 'taskUpdates', label: 'Task updates', note: 'Started, reopened and closed tasks' },
    { key: 'dueDates', label: 'Due dates', note: 'Tasks due within 24 hours' },
    { key: 'invites', label: 'Invitations', note: 'Company and project invites' },
    { key: 'digest', label: 'Daily digest', note: 'One summary email per day' },
  ];

  return (
    <TSScreen>
      <TSPageHeader title="Settings" description="Your profile and session" />

      <TSCard title="Profile" description="Shown to your teammates">
        <View className="flex-row items-center gap-3">
          <TSAvatar name={user?.name ?? 'TeamShare User'} src={user?.avatarUrl} size={40} />
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">{user?.name ?? '—'}</Text>
            <Text className="text-sm text-muted-foreground">{user?.email ?? '—'}</Text>
          </View>
        </View>
      </TSCard>

      <TSCard title="Notifications" description="Which updates reach you (IMP-250)">
        <View className="-mx-4">
          {notificationToggles.map((item, index) => {
            const checked = settings ? Boolean(settings[item.key as keyof typeof settings]) : false;
            return (
              <View key={item.key}>
                {index > 0 && <View className="h-px bg-border" />}
                <View className="min-h-11 flex-row items-center gap-3 px-4 py-2.5">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">{item.label}</Text>
                    <Text className="text-xs text-muted-foreground">{item.note}</Text>
                  </View>
                  <TSSwitch
                    checked={checked}
                    disabled={!settings || updateSetting.isPending}
                    onValueChange={(value) => toggle(item.key, value)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </TSCard>

      <TSCard title="Workspace tools" description="Analytics, billing, and developer features">
        <View className="-mx-4">
          <SettingsRow
            icon={<Building4 size={16} variant="Outline" color={tokens.violet} />}
            title="Companies"
            note="Organizations, members and roles"
            onPress={() => router.push('/companies')}
          />
          <View className="h-px bg-border" />
          <SettingsRow
            icon={<Radar size={16} variant="Outline" color={tokens.violet} />}
            title="Agents"
            note="Your AI crew - tasks, runs and keys"
            onPress={() => router.push('/agents')}
          />
          <View className="h-px bg-border" />
          <SettingsRow
            icon={<Chart size={16} variant="Outline" color={tokens.info} />}
            title="Analytics"
            note="Project insights and activity"
            onPress={() => router.push('/analytics')}
          />
          <View className="h-px bg-border" />
          <SettingsRow
            icon={<WalletMoney size={16} variant="Outline" color={tokens.success} />}
            title="Billing"
            note="Plan and usage limits"
            onPress={() => router.push('/billing')}
          />
          <View className="h-px bg-border" />
          <SettingsRow
            icon={<Key size={16} variant="Outline" color={tokens.textMuted} />}
            title="API keys"
            note="Personal access tokens"
          />
          <View className="h-px bg-border" />
          <SettingsRow
            icon={<Element size={16} variant="Outline" color={tokens.textMuted} />}
            title="Webhooks"
            note="Task and comment events"
          />
        </View>
      </TSCard>

      <TSCard title="About">
        <View className="gap-1">
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">App</Text>
            <Text className="text-sm font-medium text-foreground">TeamShare</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">Version</Text>
            <Text className="text-sm font-medium text-foreground">
              {Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
        </View>
      </TSCard>

      <TSConfirmDialog
        title="Log out?"
        description="You'll need to sign in again to access your workspaces."
        confirmLabel="Log out"
        onConfirm={() => handleLogout()}
        trigger={
          <TSButton variant="destructive" loading={logoutPending}>
            Log out
          </TSButton>
        }
      />
    </TSScreen>
  );
}
