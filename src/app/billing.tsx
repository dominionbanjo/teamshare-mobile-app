import { useMutation, useQuery } from '@tanstack/react-query';
import { Profile2User, Folder2, WalletMoney } from 'iconsax-react-native';
import * as React from 'react';
import { Alert, Linking, Text, View } from 'react-native';

import {
  TSBadge,
  TSCard,
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSelect,
  TSButton,
  TSSkeletonList,
} from '@/components/shared';
import {
  getBillingUsage,
  upgradePlan,
  type BillingPlanValue,
} from '@/lib/api/billing';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { tokens } from '@/constants/theme';
import type { TSBadgeProps } from '@/components/shared/ts-badge';

const PLAN_TONE: Record<BillingPlanValue, NonNullable<TSBadgeProps['tone']>> = {
  free: 'neutral',
  pro: 'primary',
  enterprise: 'violet',
};

const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

function UsageRow({
  label,
  icon,
  used,
  limit,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  used: number;
  limit: number;
  color: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className="text-sm font-medium text-foreground">{label}</Text>
        </View>
        <Text className="text-sm text-muted-foreground">
          {used} / {limit}
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-muted">
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function BillingScreen() {
  const { token } = useAuth();
  const [plan, setPlan] = React.useState<'pro' | 'enterprise'>('pro');

  const usage = useQuery({
    queryKey: queryKeys.billingUsage,
    queryFn: () => getBillingUsage(token ?? ''),
    enabled: !!token,
  });

  const upgrade = useMutation({
    mutationFn: () => upgradePlan(token ?? '', plan),
    onSuccess: (result) => {
      if (result.mock) {
        Alert.alert('Upgrade requested', result.message ?? `Demo mode: ${result.plan} plan simulated.`);
      } else if (result.url) {
        Linking.openURL(result.url).catch(() =>
          Alert.alert('Upgrade', 'Open the checkout link in your browser to continue.')
        );
      }
    },
    onError: (error) => Alert.alert('Upgrade failed', error.message),
  });

  const handleUpgrade = () => {
    if (usage.data?.plan === plan) {
      Alert.alert('Already on this plan', `You're already on the ${plan} plan.`);
      return;
    }
    upgrade.mutate();
  };

  return (
    <TSScreen>
      <TSPageHeader title="Billing" description="Your plan and usage limits" />

      {usage.isLoading ? (
        <TSSkeletonList rows={4} />
      ) : usage.isError ? (
        <TSErrorState message={usage.error.message} onRetry={() => void usage.refetch()} />
      ) : usage.data ? (
        <>
          <TSCard title="Current plan" actions={<TSBadge tone={PLAN_TONE[usage.data.plan]}>{usage.data.plan}</TSBadge>}>
            <View className="gap-4">
              <UsageRow
                label="Members"
                icon={<Profile2User size={16} variant="Outline" color={tokens.primary} />}
                used={usage.data.members.used}
                limit={usage.data.members.limit}
                color={tokens.primary}
              />
              <UsageRow
                label="Projects"
                icon={<Folder2 size={16} variant="Outline" color={tokens.warning} />}
                used={usage.data.projects.used}
                limit={usage.data.projects.limit}
                color={tokens.warning}
              />
            </View>
          </TSCard>

          <TSCard title="Upgrade plan" description="Upgrade to lift your workspace limits.">
            <View className="gap-3">
              <TSSelect value={plan} onValueChange={(v) => setPlan(v as 'pro' | 'enterprise')} options={PLAN_OPTIONS} placeholder="Choose a plan" />
              <TSButton loading={upgrade.isPending} onPress={handleUpgrade} icon={<WalletMoney size={18} variant="Outline" color="#fff" />}>
                Upgrade
              </TSButton>
            </View>
          </TSCard>
        </>
      ) : (
        <TSEmptyState
          icon={<WalletMoney size={28} variant="TwoTone" color={tokens.primary} />}
          title="No billing data"
          description="Usage and plans will show up here."
        />
      )}
    </TSScreen>
  );
}
