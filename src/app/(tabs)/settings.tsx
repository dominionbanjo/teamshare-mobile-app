import Constants from 'expo-constants';
import * as React from 'react';
import { Text, View } from 'react-native';

import {
  TSConfirmDialog,
  TSCard,
  TSPageHeader,
  TSScreen,
  TSAvatar,
  TSButton,
} from '@/components/shared';
import { useAuth } from '@/lib/auth/auth-context';

export default function SettingsScreen() {
  const { user, logout, status } = useAuth();

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
        onConfirm={() => logout()}
        trigger={
          <TSButton variant="destructive" loading={status === 'loading'}>
            Log out
          </TSButton>
        }
      />
    </TSScreen>
  );
}
