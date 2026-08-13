import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Building4 } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';

import {
  TSBadge,
  TSEmptyState,
  TSErrorState,
  TSPageHeader,
  TSScreen,
  TSSkeletonList,
} from '@/components/shared';
import { listCompanies } from '@/lib/api/companies';
import type { CompanyRoleValue } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';
import { tokens } from '@/constants/theme';

const ROLE_TONE: Record<CompanyRoleValue, 'primary' | 'info' | 'violet' | 'neutral'> = {
  owner: 'primary',
  admin: 'info',
  secret_manager: 'violet',
  member: 'neutral',
  viewer: 'neutral',
};

export default function CompaniesScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const companies = useQuery({
    queryKey: queryKeys.companies,
    queryFn: () => listCompanies(token ?? ''),
    enabled: !!token,
  });

  const rows = companies.data?.items ?? [];

  return (
    <TSScreen
      refreshControl={
        <RefreshControl
          refreshing={companies.isRefetching}
          onRefresh={() => void companies.refetch()}
          tintColor={tokens.primary}
        />
      }
    >
      <TSPageHeader
        title="Companies"
        description="Organizations you belong to - members, roles and settings."
      />

      {companies.isLoading ? (
        <TSSkeletonList rows={4} />
      ) : companies.isError ? (
        <TSErrorState message={companies.error.message} onRetry={() => void companies.refetch()} />
      ) : rows.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {rows.map((row, index) => (
            <Pressable
              key={row.id}
              onPress={() => router.push(`/companies/${row.company.id}`)}
              className="min-h-14 flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-muted"
              style={index === rows.length - 1 ? { borderBottomWidth: 0 } : undefined}
            >
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Building4 size={20} variant="Outline" color={tokens.primary} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-foreground">{row.company.name}</Text>
                <Text className="text-xs text-muted-foreground">@{row.company.slug}</Text>
              </View>
              <TSBadge tone={ROLE_TONE[row.role]}>{row.role}</TSBadge>
            </Pressable>
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<Building4 size={28} variant="TwoTone" color={tokens.primary} />}
          title="No companies yet"
          description="Join or create a company to collaborate with your team."
        />
      )}
    </TSScreen>
  );
}
